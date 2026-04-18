import { ref, type Ref } from 'vue'
import type { ConfigDirectory } from '../services/tauriApi'

// Tauri provides native file access through backend commands.
const isFileSystemAccessSupported = true

interface StoredFileNames {
  mainFile: string
  externFiles: string[]
}

interface RestoreFilesResult {
  mainFile: File | null
  externFiles: File[]
  mainHandle: null
  externHandles: []
}

const rememberedMainFile: Ref<string | null> = ref(null)
const rememberedExternFiles: Ref<string[]> = ref([])
const isRestoring = ref(false)

const DIR_PATH_KEY = 'd2hackmap-dirPath'
const DIR_NAME_KEY = 'd2hackmap-dirName'

export function useFileStorage() {
  // Save file info to localStorage (names only for fallback)
  function saveToLocalStorage(mainFileName: string | undefined, externFileNames: string[] | undefined): void {
    try {
      localStorage.setItem('d2hackmap-mainFile', mainFileName || '')
      localStorage.setItem('d2hackmap-externFiles', JSON.stringify(externFileNames || []))
    } catch (e) {
      console.warn('Failed to save to localStorage:', e)
    }
  }

  // Load file info from localStorage
  function loadFromLocalStorage(): StoredFileNames {
    try {
      const mainFile = localStorage.getItem('d2hackmap-mainFile') || ''
      const externFiles = JSON.parse(localStorage.getItem('d2hackmap-externFiles') || '[]')
      return { mainFile, externFiles }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e)
      return { mainFile: '', externFiles: [] }
    }
  }

  // Save active tab to localStorage
  function saveActiveTab(tabId: string): void {
    try {
      localStorage.setItem('d2hackmap-activeTab', tabId)
    } catch (e) {
      console.warn('Failed to save active tab:', e)
    }
  }

  // Load active tab from localStorage
  function loadActiveTab(): string {
    try {
      return localStorage.getItem('d2hackmap-activeTab') || 'toggles'
    } catch (e) {
      console.warn('Failed to load active tab:', e)
      return 'toggles'
    }
  }

  // Save sub-tab state to localStorage
  function saveSubTab(componentId: string, tabId: string): void {
    try {
      const subTabs = JSON.parse(localStorage.getItem('d2hackmap-subTabs') || '{}')
      subTabs[componentId] = tabId
      localStorage.setItem('d2hackmap-subTabs', JSON.stringify(subTabs))
    } catch (e) {
      console.warn('Failed to save sub tab:', e)
    }
  }

  // Load sub-tab state from localStorage
  function loadSubTab(componentId: string, defaultTab: string = ''): string {
    try {
      const subTabs = JSON.parse(localStorage.getItem('d2hackmap-subTabs') || '{}')
      return subTabs[componentId] || defaultTab
    } catch (e) {
      console.warn('Failed to load sub tab:', e)
      return defaultTab
    }
  }

  // Save directory handle
  async function saveDirHandle(dirHandle: ConfigDirectory | null): Promise<void> {
    if (!dirHandle) return

    try {
      localStorage.setItem(DIR_PATH_KEY, dirHandle.path)
      localStorage.setItem(DIR_NAME_KEY, dirHandle.name)
    } catch (e) {
      console.warn('Failed to save directory handle:', e)
    }
  }

  // Restore directory handle
  async function restoreDirHandle(): Promise<ConfigDirectory | null> {
    isRestoring.value = true
    try {
      const path = localStorage.getItem(DIR_PATH_KEY)
      const name = localStorage.getItem(DIR_NAME_KEY)
      if (!path || !name) return null
      return { path, name }
    } catch (e) {
      console.warn('Failed to restore directory handle:', e)
      return null
    } finally {
      isRestoring.value = false
    }
  }

  // Check if there's a saved directory
  function hasSavedDirectory(): boolean {
    return !!localStorage.getItem(DIR_PATH_KEY)
  }

  // Get saved directory name (for display)
  function getSavedDirectoryName(): string {
    return localStorage.getItem(DIR_NAME_KEY) || ''
  }

  // Legacy browser-file restore API kept for component compatibility.
  async function restoreFiles(): Promise<RestoreFilesResult> {
    return { mainFile: null, externFiles: [], mainHandle: null, externHandles: [] }
  }

  // Legacy browser-file remember API kept for component compatibility.
  async function rememberFiles(mainFile: File | null, externFiles: File[]): Promise<void> {
    const externNames = externFiles.map(f => f.name)
    saveToLocalStorage(mainFile?.name, externNames)
    rememberedMainFile.value = mainFile?.name || null
    rememberedExternFiles.value = externNames
  }

  // Clear all remembered files and directory
  async function clearRememberedFiles(): Promise<void> {
    try {
      localStorage.removeItem('d2hackmap-mainFile')
      localStorage.removeItem('d2hackmap-externFiles')
      localStorage.removeItem('d2hackmap-externHandleNames')
      localStorage.removeItem(DIR_PATH_KEY)
      localStorage.removeItem(DIR_NAME_KEY)

      rememberedMainFile.value = null
      rememberedExternFiles.value = []
    } catch (e) {
      console.warn('Failed to clear remembered files:', e)
    }
  }

  // Check if there are remembered files
  function hasRememberedFiles(): boolean {
    const stored = loadFromLocalStorage()
    return !!stored.mainFile
  }

  // Get remembered file names (for display)
  function getRememberedFileNames(): StoredFileNames {
    return loadFromLocalStorage()
  }

  // Clear all storage (localStorage for this app)
  async function clearAllStorage(): Promise<void> {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('d2hackmap-') || key === 'cfg-editor-theme')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      rememberedMainFile.value = null
      rememberedExternFiles.value = []
    } catch (e) {
      console.warn('Failed to clear all storage:', e)
    }
  }

  return {
    isFileSystemAccessSupported,
    rememberedMainFile,
    rememberedExternFiles,
    isRestoring,
    restoreFiles,
    rememberFiles,
    clearRememberedFiles,
    hasRememberedFiles,
    getRememberedFileNames,
    saveActiveTab,
    loadActiveTab,
    saveSubTab,
    loadSubTab,
    // Directory handle functions
    saveDirHandle,
    restoreDirHandle,
    hasSavedDirectory,
    getSavedDirectoryName,
    // Clear all storage
    clearAllStorage
  }
}
