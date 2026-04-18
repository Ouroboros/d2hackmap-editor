import { ref } from 'vue'

const STORAGE_KEY = 'hackmap-editor-debug'
const debugMode = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')

export function useDebugMode() {
  function toggleDebugMode(): void {
    debugMode.value = !debugMode.value
    localStorage.setItem(STORAGE_KEY, String(debugMode.value))
  }

  function setDebugMode(value: boolean): void {
    debugMode.value = value
    localStorage.setItem(STORAGE_KEY, String(value))
  }

  return { debugMode, toggleDebugMode, setDebugMode }
}
