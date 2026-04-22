// Debug log collector with reactive state
import { ref, type Ref } from 'vue'
import { appendDebugLog, isTauriRuntime } from '../services/tauriApi'

const debugLogs: Ref<string[]> = ref([])
let fileLogFailed = false

export function log(msg: string): void {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
  const line = `[${timestamp}] ${msg}`

  debugLogs.value.push(line)
  // Keep last 200 logs
  if (debugLogs.value.length > 200) {
    debugLogs.value.shift()
  }

  if (isTauriRuntime()) {
    void appendDebugLog(line).catch((err) => {
      if (fileLogFailed) return
      fileLogFailed = true
      console.warn('Failed to write debug log file:', err)
    })
  }
}

export function getLogs(): Ref<string[]> {
  return debugLogs
}

export function clearLogs(): void {
  debugLogs.value = []
}

export function downloadLog(): void {
  const content = debugLogs.value.join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'debug.log'
  a.click()
  URL.revokeObjectURL(url)
}

// Expose to window for debugging
;(window as unknown as { downloadLog: typeof downloadLog }).downloadLog = downloadLog
