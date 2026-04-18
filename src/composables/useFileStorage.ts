import { ref, type Ref } from 'vue'

// Check if File System Access API is supported
const isFileSystemAccessSupported = 'showOpenFilePicker' in window

// IndexedDB for storing file handles
const DB_NAME = 'd2hackmap-editor'
const DB_VERSION = 1
const STORE_NAME = 'fileHandles'

let db: IDBDatabase | null = null

async function openDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function saveHandle(id: string, handle: FileSystemHandle): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put({ id, handle })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function getHandle(id: string): Promise<FileSystemHandle | null> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result?.handle || null)
    request.onerror = () => reject(request.error)
  })
}

async function clearHandles(): Promise<void> {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Stored file names type
interface StoredFileNames {
  mainFile: string
  externFiles: string[]
}

// Restore files result type
interface RestoreFilesResult {
  mainFile: File | null
  externFiles: File[]
  mainHandle: FileSystemFileHandle | null
  externHandles: FileSystemFileHandle[]
}

// State
const rememberedMainFile: Ref<string | null> = ref(null)
const rememberedExternFiles: Ref<string[]> = ref([])
const isRestoring = ref(false)

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

  // Save file handles (for File System Access API)
  async function saveFileHandles(mainHandle: FileSystemFileHandle | null, externHandles: FileSystemFileHandle[]): Promise<void> {
    if (!isFileSystemAccessSupported) return

    try {
      if (mainHandle) {
        await saveHandle('main', mainHandle)
      }

      // Save extern handles with their names as keys
      for (const handle of externHandles) {
        await saveHandle(`extern:${handle.name}`, handle)
      }

      // Save list of extern file names
      const externNames = externHandles.map(h => h.name)
      localStorage.setItem('d2hackmap-externHandleNames', JSON.stringify(externNames))
    } catch (e) {
      console.warn('Failed to save file handles:', e)
    }
  }

  // Save directory handle
  async function saveDirHandle(dirHandle: FileSystemDirectoryHandle | null): Promise<void> {
    if (!isFileSystemAccessSupported || !dirHandle) return

    try {
      await saveHandle('directory', dirHandle)
      localStorage.setItem('d2hackmap-dirName', dirHandle.name)
    } catch (e) {
      console.warn('Failed to save directory handle:', e)
    }
  }

  // Restore directory handle
  async function restoreDirHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (!isFileSystemAccessSupported) return null

    try {
      const dirHandle = await getHandle('directory') as FileSystemDirectoryHandle | null
      if (!dirHandle) return null

      // Request permission (will prompt user)
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        return dirHandle
      }
    } catch (e) {
      console.warn('Failed to restore directory handle:', e)
    }
    return null
  }

  // Check if there's a saved directory
  function hasSavedDirectory(): boolean {
    return !!localStorage.getItem('d2hackmap-dirName')
  }

  // Get saved directory name (for display)
  function getSavedDirectoryName(): string {
    return localStorage.getItem('d2hackmap-dirName') || ''
  }

  // Try to restore files from saved handles
  async function restoreFiles(): Promise<RestoreFilesResult> {
    isRestoring.value = true
    const result: RestoreFilesResult = { mainFile: null, externFiles: [], mainHandle: null, externHandles: [] }

    try {
      if (isFileSystemAccessSupported) {
        // Try to restore main file handle
        const mainHandle = await getHandle('main') as FileSystemFileHandle | null
        if (mainHandle) {
          // Request permission
          const permission = await mainHandle.requestPermission({ mode: 'read' })
          if (permission === 'granted') {
            result.mainFile = await mainHandle.getFile()
            result.mainHandle = mainHandle
            rememberedMainFile.value = mainHandle.name
          }
        }

        // Try to restore extern file handles
        const externNames: string[] = JSON.parse(localStorage.getItem('d2hackmap-externHandleNames') || '[]')
        for (const name of externNames) {
          const handle = await getHandle(`extern:${name}`) as FileSystemFileHandle | null
          if (handle) {
            const permission = await handle.requestPermission({ mode: 'read' })
            if (permission === 'granted') {
              const file = await handle.getFile()
              result.externFiles.push(file)
              result.externHandles.push(handle)
              rememberedExternFiles.value.push(handle.name)
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore files:', e)
    }

    // If no handles restored, just load names from localStorage for display
    if (!result.mainFile) {
      const stored = loadFromLocalStorage()
      rememberedMainFile.value = stored.mainFile || null
      rememberedExternFiles.value = stored.externFiles || []
    }

    isRestoring.value = false
    return result
  }

  // Remember files after opening
  async function rememberFiles(
    mainFile: File | null,
    externFiles: File[],
    mainHandle: FileSystemFileHandle | null = null,
    externHandles: FileSystemFileHandle[] = []
  ): Promise<void> {
    // Save names to localStorage
    const externNames = externFiles.map(f => f.name)
    saveToLocalStorage(mainFile?.name, externNames)

    rememberedMainFile.value = mainFile?.name || null
    rememberedExternFiles.value = externNames

    // Save handles if available
    if (mainHandle || externHandles.length > 0) {
      await saveFileHandles(mainHandle, externHandles)
    }
  }

  // Clear all remembered files and directory
  async function clearRememberedFiles(): Promise<void> {
    try {
      localStorage.removeItem('d2hackmap-mainFile')
      localStorage.removeItem('d2hackmap-externFiles')
      localStorage.removeItem('d2hackmap-externHandleNames')
      localStorage.removeItem('d2hackmap-dirName')

      if (isFileSystemAccessSupported) {
        await clearHandles()
      }

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

  // Clear all storage (IndexedDB + localStorage for this app)
  async function clearAllStorage(): Promise<void> {
    try {
      // Clear all localStorage items for this app
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('d2hackmap-')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // Clear IndexedDB
      if (isFileSystemAccessSupported) {
        await clearHandles()
      }

      // Reset state
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
