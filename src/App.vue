<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, type Component } from 'vue'
import { useTheme } from './composables/useTheme'
import { useDebugMode } from './composables/useDebugMode'
import { useConfig } from './composables/useConfig'
import { useDisplayOrder } from './composables/useDisplayOrder'
import { refreshEffectiveStatus } from './composables/useItemActions'
import { useReferenceData } from './composables/useReferenceData'
import { useFileStorage } from './composables/useFileStorage'
import { useConfigChain } from './composables/useConfigChain'
import type { ChainNode } from './composables/useConfigChain'
import {
  generateEntryContent,
  useEditorOutput,
  EDITOR_OUTPUT_FILENAME,
  REQUIRED_FILE
} from './composables/useEditorOutput'
import {
  ensureProfileScaffold,
  deleteEditorProfile,
  listEditorProfiles,
  pickConfigDirectory,
  readConfigFile,
  resolveConfigPath,
  saveActiveProfileToLibrary,
  saveProfileLayers,
  switchEditorProfile,
  writeConfigFile,
  type ConfigDirectory,
  type ProfileInfo
} from './services/tauriApi'
import { classifyConfigFile } from './profile/profileLayers'
import { ENTRY_FILENAME } from './profile/profileConstants'
import { parseProfileName, withProfileHeader } from './profile/profileHeader'
import { parseConfig } from './parser'
import { useI18n } from './i18n'
import ToggleEditor from './components/ToggleEditor.vue'
import ItemColorEditor from './components/ItemColorEditor.vue'
import ImportItemEditor from './components/ImportItemEditor.vue'
import StatLimitEditor from './components/StatLimitEditor.vue'
import TransmuteEditor from './components/TransmuteEditor.vue'
import KeyBindingEditor from './components/KeyBindingEditor.vue'
import ValidationEditor from './components/ValidationEditor.vue'
import ConfigChainDialog from './components/ConfigChainDialog.vue'
import HelpGuide from './components/HelpGuide.vue'
import ProfileToolbar from './components/ProfileToolbar.vue'
import DebugDrawer from './components/debug/DebugDrawer.vue'

const { theme, setTheme } = useTheme()
const { debugMode, isDebugUiEnabled, toggleDebugMode } = useDebugMode()
const { t } = useI18n()
const { displayOrder, setDisplayOrder } = useDisplayOrder()
const { loadReferenceData } = useReferenceData()
const {
  config,
  hasUnsavedChanges,
  isReadOnly,
  fileName,
  initForDirectoryLoad,
  closeConfig,
  loadConfigText
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
  setDirHandle,
  saveUserConfig,
  saveCurrentProfileConfig,
  saveMergedProfileAs,
  resetActiveProfileConfig,
  hasUnsavedProfileLayers
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

const lastUsedHandle = ref<ConfigDirectory | null>(null)  // Remember last directory even after close

const activeTab = ref<string>('toggles')
const tabsWithLocalDebugDrawer = new Set([
  'toggles',
  'itemColors',
  'importItems',
  'statLimitGroup',
  'autoTransmute',
  'keyBindings'
])
const shouldShowGlobalDebugDrawer = computed(() => debugMode.value && !tabsWithLocalDebugDrawer.has(activeTab.value))

// Watch activeTab changes and save to localStorage
watch(activeTab, (newTab) => {
  const normalizedTab = normalizeActiveTab(newTab)
  if (normalizedTab !== newTab) {
    activeTab.value = normalizedTab
    return
  }
  saveActiveTab(normalizedTab)
})
const searchQuery = ref<string>('')
const CURRENT_PROFILE_VALUE = '__current_profile__'
const profileOptions = ref<ProfileInfo[]>([])
const isProfileMenuOpen = ref(false)

const tabs = computed(() => [
  { id: 'toggles', label: t('tab.toggles') },
  { id: 'itemColors', label: t('tab.itemColors') },
  { id: 'importItems', label: t('tab.importItems') },
  { id: 'statLimitGroup', label: t('tab.statLimitGroup') },
  { id: 'autoTransmute', label: t('tab.autoTransmute') },
  { id: 'keyBindings', label: t('tab.keyBindings') },
  { id: 'validation', label: t('tab.validation') },
  { id: 'help', label: t('tab.help') },
])

const editorComponents: Record<string, Component> = {
  toggles: ToggleEditor,
  itemColors: ItemColorEditor,
  importItems: ImportItemEditor,
  statLimitGroup: StatLimitEditor,
  autoTransmute: TransmuteEditor,
  keyBindings: KeyBindingEditor,
  validation: ValidationEditor,
  help: HelpGuide
}

const activeEditorComponent = computed<Component | null>(() => {
  if (!config.value) return null
  return editorComponents[activeTab.value] ?? ToggleEditor
})

const activeEditorProps = computed(() => {
  if (activeTab.value === 'validation' || activeTab.value === 'help') return {}
  return { searchQuery: searchQuery.value }
})

function normalizeActiveTab(tab: string): string {
  return tab === 'itemDescriptors' ? 'autoTransmute' : tab
}

const currentProfileName = computed(() =>
  config.value?.files.find(file => file.layer === 'profile')?.profileName || t('profile.unnamed')
)

const selectedProfileFile = computed(() =>
  profileOptions.value.find(profile => profile.name === currentProfileName.value)?.file || CURRENT_PROFILE_VALUE
)

const selectedProfileInfo = computed(() =>
  profileOptions.value.find(profile => profile.file === selectedProfileFile.value) || null
)

const visibleProfileOptions = computed(() => {
  if (selectedProfileInfo.value) return profileOptions.value
  return [
    { name: currentProfileName.value, file: CURRENT_PROFILE_VALUE, path: '' },
    ...profileOptions.value
  ]
})

// Open directory and parse config chain
async function handleOpenDirectoryClick() {
  if (!isFileSystemAccessSupported) {
    alert(t('error.browserNotSupported'))
    return
  }

  try {
    const dirHandle = await pickConfigDirectory(lastUsedHandle.value?.path ?? null)
    if (!dirHandle) return

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

    await ensureProfileFiles(dirHandle)

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
    console.error('Failed to open directory:', e)
  }
}

// Load config after directory is validated and chain is parsed
async function loadConfigFromDirectory(dirHandle: ConfigDirectory) {
  // Get all loaded nodes from chain (BFS order)
  const allNodes = getLoadedNodes(chainRoot.value)
  if (allNodes.length === 0) return

  // Initialize empty config (without creating empty editable file)
  initForDirectoryLoad()
  fileName.value = EDITOR_OUTPUT_FILENAME

  // Load all nodes in BFS order
  // gen.cfg is editable (isEditable=true), others are extern (isEditable=false)
  // Skip refresh during batch loading to avoid intermediate renders

  for (const node of allNodes) {
    try {
      if (!node.fullPath) continue
      const file = await readConfigFile(node.fullPath)
      const displayName = node.path || file.name
      const layer = classifyConfigFile(displayName)
      await loadConfigText(displayName, file.lines, layer, true)  // skipRefresh=true
    } catch (e) {
      console.error('Failed to read file:', node.file, e)
      alert(t('error.readFileFailed', { file: node.file }))
      // Reset state on error
      closeConfig()
      return
    }
  }

  // Refresh effective status once after all files loaded
  if (config.value) {
    refreshEffectiveStatus(config.value)
    hasUnsavedChanges.value = false
  }

  // Remember directory for restore
  await saveDirHandle(dirHandle)
  await refreshProfileOptions()
}

function joinRootConfigPath(rootPath: string, fileName: string): string {
  const separator = rootPath.includes('\\') ? '\\' : '/'
  return `${rootPath.replace(/[\\/]+$/, '')}${separator}${fileName}`
}

async function ensureProfileFiles(dirHandle: ConfigDirectory): Promise<void> {
  const entryContent = generateEntryContent()
  const scaffold = await ensureProfileScaffold(
    dirHandle.path,
    entryContent,
    withProfileHeader('', t('profile.unnamed')),
    ''
  )

  const activeProfile = await readConfigFile(scaffold.activeProfilePath)
  const userDefined = await readConfigFile(scaffold.userDefinedPath)
  let profileContent = joinConfigLines(activeProfile.lines)
  let userContent = joinConfigLines(userDefined.lines)
  let shouldSaveLayers = false

  if (shouldMigratePreviousEntry(scaffold.previousEntryContent, entryContent)) {
    userContent = mergePreviousEntryIntoUser(userContent, scaffold.previousEntryContent || '')
    shouldSaveLayers = true
  }

  if (parseProfileName(activeProfile.lines) === '默认') {
    profileContent = withProfileHeader(profileContent, t('profile.unnamed'))
    shouldSaveLayers = true
  }

  if (shouldSaveLayers) {
    await saveProfileLayers(dirHandle.path, entryContent, profileContent, userContent)
  }

  await ensureEditorEntryImported(dirHandle)
}

async function ensureEditorEntryImported(dirHandle: ConfigDirectory): Promise<void> {
  const defaultPath = joinRootConfigPath(dirHandle.path, REQUIRED_FILE)
  const defaultFile = await readConfigFile(defaultPath)
  const defaultConfig = parseConfig(defaultFile.lines, REQUIRED_FILE, 'extern')
  const firstImport = defaultConfig.includes[0]?.file
  if (!firstImport) {
    throw new Error(`${REQUIRED_FILE} has no Import Config entry`)
  }

  const target = await resolveConfigPath(dirHandle.path, defaultPath, firstImport)
  if (target.status !== 'loaded' || !target.fullPath) {
    throw new Error(`Failed to resolve Import Config target: ${firstImport}`)
  }

  const targetFile = await readConfigFile(target.fullPath)
  const targetConfig = parseConfig(targetFile.lines, target.path || targetFile.name, 'extern')
  if (targetConfig.includes.some(item => isSameImportFile(item.file, ENTRY_FILENAME))) {
    return
  }

  const content = insertImportLine(targetFile.lines, `    Import Config: "${ENTRY_FILENAME}"`)
  await writeConfigFile(target.fullPath, content)
}

function isSameImportFile(importPath: string, fileName: string): boolean {
  return importPath.split(/[\\/]/).pop()?.toLowerCase() === fileName.toLowerCase()
}

function insertImportLine(lines: string[], line: string): string {
  const nextLines = [...lines]
  const lastImportIndex = findLastActiveImportLineIndex(nextLines)
  if (lastImportIndex >= 0) {
    nextLines.splice(lastImportIndex + 1, 0, line)
    return nextLines.join('\r\n')
  }

  const firstConfigIndex = findFirstActiveConfigLineIndex(nextLines)
  if (firstConfigIndex >= 0) {
    nextLines.splice(firstConfigIndex, 0, line)
    return nextLines.join('\r\n')
  }

  return [...nextLines, line].join('\r\n')
}

function findLastActiveImportLineIndex(lines: string[]): number {
  for (let index = lines.length - 1; index >= 0; index--) {
    const trimmed = lines[index].trim()
    if (!trimmed.startsWith('//') && trimmed.startsWith('Import Config:')) return index
  }
  return -1
}

function findFirstActiveConfigLineIndex(lines: string[]): number {
  return lines.findIndex(line => {
    const trimmed = line.trim()
    return trimmed.length > 0 && !trimmed.startsWith('//')
  })
}

function shouldMigratePreviousEntry(previousEntryContent: string | null, entryContent: string): boolean {
  if (!previousEntryContent?.trim()) return false
  if (normalizeConfigText(previousEntryContent) === normalizeConfigText(entryContent)) return false

  const parsed = parseConfig(splitConfigText(previousEntryContent), ENTRY_FILENAME, 'user')
  return hasConfigItems(parsed)
}

function hasConfigItems(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (!value || typeof value !== 'object') return false

  return Object.entries(value).some(([key, child]) => {
    if (key === 'includes') return false
    return hasConfigItems(child)
  })
}

function mergePreviousEntryIntoUser(userContent: string, previousEntryContent: string): string {
  const previous = previousEntryContent.trim()
  if (!previous) return userContent
  if (!userContent.trim()) return `${previous}\r\n`

  return `${userContent.trimEnd()}\r\n\r\n    // ========== migrated from old d2hackmap.gen.cfg ==========\r\n\r\n${previous}\r\n`
}

function splitConfigText(text: string): string[] {
  return text.split(/\r?\n/)
}

function joinConfigLines(lines: string[]): string {
  return lines.join('\r\n')
}

function normalizeConfigText(text: string): string {
  return splitConfigText(text).map(line => line.trimEnd()).join('\n').trim()
}

// Handle config chain dialog events
async function handleChainSelectDir(node: ChainNode) {
  await selectFileForNode(node)
}

function handleChainSkipNode(node: ChainNode) {
  skipNode(node)
}

// Called when user confirms chain dialog (after authorizing pending dirs)
async function handleChainConfirm() {
  showChainDialog.value = false
  if (editorDirHandle.value) {
    await loadConfigFromDirectory(editorDirHandle.value)
  }
}

function handleChainClose() {
  showChainDialog.value = false
}

async function reloadCurrentDirectory(): Promise<void> {
  if (!editorDirHandle.value) return
  await parseConfigChain(editorDirHandle.value)
  await loadConfigFromDirectory(editorDirHandle.value)
}

async function refreshUnsavedState(): Promise<void> {
  if (!config.value || !editorDirHandle.value) return
  hasUnsavedChanges.value = await hasUnsavedProfileLayers(config.value)
}

async function refreshProfileOptions(): Promise<void> {
  try {
    profileOptions.value = await listEditorProfiles()
  } catch (e) {
    console.error('Failed to list profiles:', e)
    profileOptions.value = []
  }
}

function toggleProfileMenu(): void {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
}

function closeProfileMenu(): void {
  isProfileMenuOpen.value = false
}

async function handleProfileSelect(profile: ProfileInfo): Promise<void> {
  if (!editorDirHandle.value) return
  if (!profile.file || profile.file === CURRENT_PROFILE_VALUE || profile.file === selectedProfileFile.value) {
    closeProfileMenu()
    return
  }

  if (hasUnsavedChanges.value && !confirm(t('profile.confirmSwitchUnsaved'))) {
    closeProfileMenu()
    return
  }

  closeProfileMenu()
  await switchEditorProfile(editorDirHandle.value.path, profile.file)
  await reloadCurrentDirectory()
  await refreshProfileOptions()
}

async function handleSaveUserConfig(): Promise<void> {
  if (!editorDirHandle.value || !config.value) return
  try {
    await saveUserConfig(config.value)
    await refreshUnsavedState()
  } catch (e) {
    console.error('Failed to save user config:', e)
    alert(t('error.saveFailed', { message: (e as Error).message }))
  }
}

async function handleSaveCurrentProfile(): Promise<void> {
  if (!editorDirHandle.value || !config.value) return
  try {
    const profileName = config.value.files.find(file => file.layer === 'profile')?.profileName || t('profile.unnamed')
    await saveCurrentProfileConfig(config.value)
    await saveActiveProfileToLibrary(editorDirHandle.value.path, profileName)
    await refreshProfileOptions()
    await refreshUnsavedState()
  } catch (e) {
    console.error('Failed to save current profile:', e)
    alert(t('error.saveFailed', { message: (e as Error).message }))
  }
}

async function handleSaveProfileAs(): Promise<void> {
  if (!editorDirHandle.value || !config.value) return
  const profileName = prompt(t('profile.name'), '')
  if (!profileName?.trim()) return
  try {
    const normalizedName = profileName.trim()
    await saveMergedProfileAs(config.value, normalizedName)
    await saveActiveProfileToLibrary(editorDirHandle.value.path, normalizedName)
    await reloadCurrentDirectory()
    await refreshProfileOptions()
    await refreshUnsavedState()
  } catch (e) {
    console.error('Failed to save new profile:', e)
    alert(t('error.saveFailed', { message: (e as Error).message }))
  }
}

async function handleDeleteProfile(profile: ProfileInfo): Promise<void> {
  if (!editorDirHandle.value || !config.value || profile.file === CURRENT_PROFILE_VALUE) return
  if (!confirm(t('profile.confirmDelete', { name: profile.name }))) return

  try {
    await deleteEditorProfile(profile.file)
    if (profile.file === selectedProfileFile.value) {
      await resetActiveProfileConfig(config.value, t('profile.unnamed'))
      await reloadCurrentDirectory()
    }
    await refreshProfileOptions()
    await refreshUnsavedState()
    closeProfileMenu()
  } catch (e) {
    console.error('Failed to delete profile:', e)
    alert(t('error.saveFailed', { message: (e as Error).message }))
  }
}

// Unsaved changes warning
function handleBeforeUnload(e: BeforeUnloadEvent) {
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
        await ensureProfileFiles(dirHandle)
        await parseConfigChain(dirHandle)
        if (hasPendingNodes(chainRoot.value)) {
          showChainDialog.value = true
        } else {
          await loadConfigFromDirectory(dirHandle)
        }
        activeTab.value = normalizeActiveTab(loadActiveTab())
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
  setDirHandle(null)
  // Note: lastUsedHandle is kept for directory memory
  showRestorePrompt.value = false
}

// Check for remembered files
const showRestorePrompt = ref(false)
const rememberedInfo = ref({ mainFile: '', externFiles: [] })

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('click', closeProfileMenu)

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
          await ensureProfileFiles(dirHandle)
          // Parse config chain and load
          await parseConfigChain(dirHandle)
          if (hasPendingNodes(chainRoot.value)) {
            showChainDialog.value = true
          } else {
            await loadConfigFromDirectory(dirHandle)
          }
          // Restore active tab
          activeTab.value = normalizeActiveTab(loadActiveTab())
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
  window.removeEventListener('click', closeProfileMenu)
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
        <div v-if="config" class="header-profile-group" @click.stop>
          <button
            class="header-profile-picker"
            type="button"
            :title="currentProfileName"
            @click="toggleProfileMenu"
          >
            <span class="header-profile-display">
              <span class="header-profile-label">{{ t('profile.current') }}:</span>
              <span class="header-profile-name">{{ currentProfileName }}</span>
            </span>
          </button>
          <div v-if="isProfileMenuOpen" class="header-profile-menu">
            <div
              v-for="profile in visibleProfileOptions"
              :key="profile.file || profile.name"
              class="header-profile-option"
              :class="{ active: profile.file === selectedProfileFile }"
              @click="handleProfileSelect(profile)"
            >
              <span class="header-profile-option-name">{{ profile.name }}</span>
              <button
                v-if="profile.file !== CURRENT_PROFILE_VALUE"
                class="header-profile-option-delete"
                type="button"
                :title="t('profile.delete')"
                @click.stop="handleDeleteProfile(profile)"
              >×</button>
            </div>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <ProfileToolbar
          v-if="config"
          @save-user="handleSaveUserConfig"
          @save-profile="handleSaveCurrentProfile"
          @save-profile-as="handleSaveProfileAs"
        />
        <button class="btn btn-secondary" @click="handleOpenDirectoryClick">{{ t('btn.openDir') }}</button>
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
        <div class="display-order-switch" role="group" :aria-label="t('displayOrder.label')">
          <span>{{ t('displayOrder.label') }}</span>
          <div class="display-order-buttons">
            <button
              type="button"
              :class="{ active: displayOrder === 'file' }"
              @click="setDisplayOrder('file')"
            >{{ t('displayOrder.file') }}</button>
            <button
              type="button"
              :class="{ active: displayOrder === 'effective' }"
              @click="setDisplayOrder('effective')"
            >{{ t('displayOrder.effective') }}</button>
          </div>
        </div>
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
        <KeepAlive>
          <component
            :is="activeEditorComponent"
            v-if="activeEditorComponent"
            :key="activeTab"
            v-bind="activeEditorProps"
          />
        </KeepAlive>
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
          v-if="isDebugUiEnabled"
          class="debug-btn"
          :class="{ active: debugMode }"
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
    <DebugDrawer v-if="shouldShowGlobalDebugDrawer" logs-only />
  </div>
</template>
