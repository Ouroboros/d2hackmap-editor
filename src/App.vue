<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTheme } from './composables/useTheme'
import { useDebugMode } from './composables/useDebugMode'
import { useConfig } from './composables/useConfig'
import { refreshEffectiveStatus } from './composables/useItemActions'
import { useReferenceData } from './composables/useReferenceData'
import { useFileStorage } from './composables/useFileStorage'
import { useConfigChain } from './composables/useConfigChain'
import { useEditorOutput, EDITOR_OUTPUT_FILENAME, REQUIRED_FILE } from './composables/useEditorOutput'
import { useI18n } from './i18n'
import ToggleEditor from './components/ToggleEditor.vue'
import ItemColorEditor from './components/ItemColorEditor.vue'
import ImportItemEditor from './components/ImportItemEditor.vue'
import TransmuteEditor from './components/TransmuteEditor.vue'
import ConfigChainDialog from './components/ConfigChainDialog.vue'
import HelpGuide from './components/HelpGuide.vue'

const { theme, setTheme } = useTheme()
const { debugMode, toggleDebugMode } = useDebugMode()
const { t } = useI18n()
const { loadReferenceData } = useReferenceData()
const {
  config,
  hasUnsavedChanges,
  isReadOnly,
  fileName,
  pendingExterns,
  loadedFiles,
  openFile,
  saveFile,
  newConfig,
  initForDirectoryLoad,
  closeConfig,
  loadConfigFile,
  loadConfigFiles
} = useConfig()

const {
  chainRoot,
  parseConfigChain,
  selectFileForNode,
  skipNode,
  getLoadedNodes,
  hasPendingNodes
} = useConfigChain()

const {
  dirHandle: editorDirHandle,
  validateConfigDirectory,
  getEditorOutputHandle,
  setDirHandle,
  saveToEditorFile
} = useEditorOutput()

// Config chain dialog state
const showChainDialog = ref<boolean>(false)

const {
  isFileSystemAccessSupported,
  isRestoring,
  clearRememberedFiles,
  saveActiveTab,
  loadActiveTab,
  saveDirHandle,
  restoreDirHandle,
  hasSavedDirectory,
  getSavedDirectoryName,
  clearAllStorage
} = useFileStorage()

// Track file handles for File System Access API
const mainFileHandle = ref<FileSystemFileHandle | null>(null)
const externFileHandles = ref<FileSystemFileHandle[]>([])
const lastUsedHandle = ref<FileSystemDirectoryHandle | null>(null)  // Remember last directory even after close

const activeTab = ref<string>('toggles')

// Watch activeTab changes and save to localStorage
watch(activeTab, (newTab) => {
  saveActiveTab(newTab)
})
const searchQuery = ref<string>('')

const tabs = computed(() => [
  { id: 'toggles', label: t('tab.toggles') },
  { id: 'itemColors', label: t('tab.itemColors') },
  { id: 'importItems', label: t('tab.importItems') },
  { id: 'statLimitGroup', label: t('tab.statLimitGroup') },
  { id: 'itemDescriptors', label: t('tab.itemDescriptors') },
  { id: 'autoTransmute', label: t('tab.autoTransmute') },
  { id: 'keyBindings', label: t('tab.keyBindings') },
  { id: 'validation', label: t('tab.validation') },
  { id: 'help', label: t('tab.help') },
])

// Open directory and parse config chain
async function handleOpenDirectoryClick() {
  if (!isFileSystemAccessSupported) {
    alert(t('error.browserNotSupported'))
    return
  }

  try {
    const options = {}
    if (lastUsedHandle.value) {
      options.startIn = lastUsedHandle.value
    }
    const dirHandle = await window.showDirectoryPicker(options)

    // Validate directory: check permission and required file
    const result = await validateConfigDirectory(dirHandle)
    if (!result.ok) {
      if (result.error === 'no_permission') {
        alert(t('error.noPermission'))
      } else {
        alert(t('error.invalidConfigDir', { file: REQUIRED_FILE }))
      }
      return
    }

    setDirHandle(dirHandle)
    lastUsedHandle.value = dirHandle

    // Parse config chain starting from d2hackmap.default.cfg
    await parseConfigChain(dirHandle)

    // Check if there are pending nodes that need authorization
    if (hasPendingNodes(chainRoot.value)) {
      // Show dialog for user to authorize pending directories
      showChainDialog.value = true
    } else {
      // No pending nodes, load directly
      await loadConfigFromDirectory(dirHandle)
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Failed to open directory:', e)
    }
  }
}

// Load config after directory is validated and chain is parsed
async function loadConfigFromDirectory(dirHandle) {
  // Get all loaded nodes from chain (BFS order)
  const allNodes = getLoadedNodes(chainRoot.value)
  if (allNodes.length === 0) return

  // Initialize empty config (without creating empty editable file)
  initForDirectoryLoad()
  fileName.value = EDITOR_OUTPUT_FILENAME

  // Load all nodes in BFS order
  // gen.cfg is editable (isEditable=true), others are extern (isEditable=false)
  // Skip refresh during batch loading to avoid intermediate renders

  const externHandles = []
  for (const node of allNodes) {
    try {
      const file = await node.handle.getFile()
      const isEditable = node.file === EDITOR_OUTPUT_FILENAME
      await loadConfigFile(file, isEditable, true)  // skipRefresh=true
      if (!isEditable) {
        externHandles.push(node.handle)
      } else {
        mainFileHandle.value = node.handle
      }
    } catch (e) {
      console.error('Failed to read file:', node.file, e)
      alert(t('error.readFileFailed', { file: node.file }))
      // Reset state on error
      closeConfig()
      return
    }
  }
  externFileHandles.value = externHandles

  // Refresh effective status once after all files loaded
  if (config.value) {
    refreshEffectiveStatus(config.value)
  }

  // Remember directory for restore
  await saveDirHandle(dirHandle)
}

// Handle config chain dialog events
async function handleChainSelectDir(node) {
  await selectFileForNode(node)
}

function handleChainSkipNode(node) {
  skipNode(node)
}

// Called when user confirms chain dialog (after authorizing pending dirs)
async function handleChainConfirm() {
  showChainDialog.value = false
  await loadConfigFromDirectory(editorDirHandle.value)
}

function handleChainClose() {
  showChainDialog.value = false
}

// Save to editor output file
async function handleSave() {
  if (!config.value || !editorDirHandle.value) {
    // Fallback to download if no directory handle
    saveFile()
    return
  }

  try {
    const editorHandle = await saveToEditorFile(config.value)
    mainFileHandle.value = editorHandle
    hasUnsavedChanges.value = false
    // Brief visual feedback
    const btn = document.activeElement
    if (btn) {
      btn.textContent = t('status.saved')
      setTimeout(() => { btn.textContent = t('btn.save') }, 1500)
    }
    // Reload config to refresh effective status
    await loadConfigFromDirectory(editorDirHandle.value)
  } catch (e) {
    console.error('Failed to save:', e)
    alert(t('error.saveFailed', { message: e.message }))
  }
}

// Unsaved changes warning
function handleBeforeUnload(e) {
  if (hasUnsavedChanges.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// Try to restore last opened directory (manual trigger from restore prompt)
async function handleRestoreDirectory() {
  try {
    const dirHandle = await restoreDirHandle()
    if (dirHandle) {
      const result = await validateConfigDirectory(dirHandle)
      if (result.ok) {
        setDirHandle(dirHandle)
        lastUsedHandle.value = dirHandle
        await parseConfigChain(dirHandle)
        if (hasPendingNodes(chainRoot.value)) {
          showChainDialog.value = true
        } else {
          await loadConfigFromDirectory(dirHandle)
        }
        activeTab.value = loadActiveTab()
        showRestorePrompt.value = false
      } else {
        if (result.error === 'no_permission') {
          alert(t('error.noPermission'))
        } else {
          alert(t('error.invalidConfigDir', { file: REQUIRED_FILE }))
        }
      }
    }
  } catch (e) {
    console.warn('Restore directory failed:', e)
  }
}

// Clear remembered files
async function handleClearRemembered() {
  await clearRememberedFiles()
  showRestorePrompt.value = false
}

// Clear all storage (for debugging/reset)
async function handleClearAllStorage() {
  if (confirm(t('storage.confirmClear'))) {
    await clearAllStorage()
    showRestorePrompt.value = false
    location.reload()
  }
}

// Close current config and return to empty state
async function handleCloseConfig() {
  await clearRememberedFiles()
  closeConfig()
  mainFileHandle.value = null
  externFileHandles.value = []
  setDirHandle(null)
  // Note: lastUsedHandle is kept for directory memory
  showRestorePrompt.value = false
}

// Check for remembered files
const showRestorePrompt = ref(false)
const rememberedInfo = ref({ mainFile: '', externFiles: [] })

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)

  // Load reference data for ID lookups
  loadReferenceData()

  // Auto-restore last opened directory if available
  if (hasSavedDirectory()) {
    rememberedInfo.value = { mainFile: getSavedDirectoryName(), externFiles: [] }
    // Try to auto-restore
    try {
      const dirHandle = await restoreDirHandle()
      if (dirHandle) {
        // Validate directory: check permission and required file
        const result = await validateConfigDirectory(dirHandle)
        if (result.ok) {
          setDirHandle(dirHandle)
          lastUsedHandle.value = dirHandle
          // Parse config chain and load
          await parseConfigChain(dirHandle)
          if (hasPendingNodes(chainRoot.value)) {
            showChainDialog.value = true
          } else {
            await loadConfigFromDirectory(dirHandle)
          }
          // Restore active tab
          activeTab.value = loadActiveTab()
        } else {
          // Directory no longer valid or no permission, show prompt
          showRestorePrompt.value = true
        }
      } else {
        // Permission denied or handle expired, show prompt
        showRestorePrompt.value = true
      }
    } catch (e) {
      // If auto-restore fails, show manual restore prompt
      console.warn('Auto-restore failed:', e)
      showRestorePrompt.value = true
    }
  } else {
    // First launch, show help guide
    activeTab.value = 'help'
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <h1 class="header-title">{{ t('app.title') }}</h1>
        <template v-if="editorDirHandle">
          <span class="header-separator">|</span>
          <span class="loaded-file">{{ editorDirHandle.name }}</span>
        </template>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="handleOpenDirectoryClick">{{ t('btn.openDir') }}</button>
        <button class="btn btn-primary" @click="handleSave" :disabled="!config || isReadOnly">{{ t('btn.save') }}</button>
        <button v-if="config" class="btn btn-secondary" @click="handleCloseConfig">{{ t('btn.close') }}</button>
      </div>
    </header>

    <!-- Tabs and Search -->
    <div class="tabs-row">
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
      <div class="search-box" v-if="config">
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="t('search.placeholder')"
          class="search-input"
        />
        <button v-if="searchQuery" class="btn btn-small btn-secondary" @click="searchQuery = ''">{{ t('search.clear') }}</button>
      </div>
    </div>

    <!-- Content -->
    <main class="content">
      <template v-if="config">
        <ToggleEditor v-show="activeTab === 'toggles'" :searchQuery="searchQuery" />
        <ItemColorEditor v-show="activeTab === 'itemColors'" :searchQuery="searchQuery" />
        <ImportItemEditor v-show="activeTab === 'importItems'" :searchQuery="searchQuery" />
        <TransmuteEditor
          v-show="['statLimitGroup', 'itemDescriptors', 'autoTransmute', 'keyBindings', 'validation'].includes(activeTab)"
          :searchQuery="searchQuery"
          :activeSection="activeTab"
        />
        <HelpGuide v-show="activeTab === 'help'" />
      </template>
      <HelpGuide v-if="!config && activeTab === 'help'" />
      <div v-else-if="!config" class="empty-state">
        <h2>{{ t('welcome.title') }}</h2>
        <p>{{ t('welcome.hint') }}</p>

        <!-- Restore prompt for remembered directory -->
        <div v-if="showRestorePrompt" class="restore-prompt">
          <div class="restore-info">
            <span class="restore-label">{{ t('restore.lastOpened') }}</span>
            <span class="restore-file main-file">{{ rememberedInfo.mainFile }}</span>
          </div>
          <div class="restore-actions">
            <button class="btn btn-primary" @click="handleRestoreDirectory" :disabled="isRestoring">
              {{ isRestoring ? t('btn.restoring') : t('btn.restoreLast') }}
            </button>
            <button class="btn btn-secondary btn-small" @click="handleClearRemembered" :title="t('restore.clearTitle')">
              {{ t('restore.clear') }}
            </button>
          </div>
        </div>

        <button class="btn btn-primary" @click="handleOpenDirectoryClick">{{ t('welcome.openDir') }}</button>
        <button class="btn btn-secondary btn-small" style="margin-top: 2rem; opacity: 0.6;" @click="handleClearAllStorage">{{ t('storage.clearAll') }}</button>
      </div>
    </main>

    <!-- Status bar -->
    <footer class="status-bar">
      <div>
        <span v-if="editorDirHandle">{{ t('status.outputFile', { file: EDITOR_OUTPUT_FILENAME }) }}</span>
        <span v-else-if="fileName">{{ fileName }}</span>
        <span v-else>{{ t('status.noFile') }}</span>
        <span v-if="isReadOnly" class="text-muted"> {{ t('status.readOnly') }}</span>
        <span v-else-if="hasUnsavedChanges" class="text-warning"> {{ t('status.unsaved') }}</span>
      </div>
      <div class="status-bar-right">
        <button
          class="debug-btn"
          @click="toggleDebugMode"
          title="Toggle Debug Panel"
        >[D]</button>
        <div class="theme-selector">
          <button
            class="theme-btn"
            :class="{ active: theme === 'light' }"
            @click="setTheme('light')"
          >{{ t('theme.light') }}</button>
          <button
            class="theme-btn"
            :class="{ active: theme === 'dark' }"
            @click="setTheme('dark')"
          >{{ t('theme.dark') }}</button>
          <button
            class="theme-btn"
            :class="{ active: theme === 'system' }"
            @click="setTheme('system')"
          >{{ t('theme.system') }}</button>
        </div>
      </div>
    </footer>

    <!-- Config Chain Dialog (for authorizing cross-directory imports) -->
    <ConfigChainDialog
      v-if="chainRoot"
      :chainRoot="chainRoot"
      :visible="showChainDialog"
      @close="handleChainClose"
      @confirm="handleChainConfirm"
      @selectDir="handleChainSelectDir"
      @skipNode="handleChainSkipNode"
    />
  </div>
</template>
