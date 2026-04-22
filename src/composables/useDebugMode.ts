import { ref } from 'vue'

const STORAGE_KEY = 'hackmap-editor-debug'
export const isDebugUiEnabled = import.meta.env.DEV
const debugMode = ref<boolean>(isDebugUiEnabled && localStorage.getItem(STORAGE_KEY) === 'true')

export function useDebugMode() {
  function toggleDebugMode(): void {
    if (!isDebugUiEnabled) return
    debugMode.value = !debugMode.value
    localStorage.setItem(STORAGE_KEY, String(debugMode.value))
  }

  function setDebugMode(value: boolean): void {
    if (!isDebugUiEnabled) {
      debugMode.value = false
      return
    }
    debugMode.value = value
    localStorage.setItem(STORAGE_KEY, String(value))
  }

  return { debugMode, isDebugUiEnabled, toggleDebugMode, setDebugMode }
}
