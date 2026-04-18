<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { getLogs, clearLogs } from '../../utils/log'
import { useDebugMode } from '../../composables/useDebugMode'

const STORAGE_KEY = 'hackmap-editor-debug-height'
const MIN_HEIGHT = 100
const MAX_HEIGHT_VH = 80

const { setDebugMode } = useDebugMode()
const height = ref(300) // default height in px

// Sync height to CSS variable for list max-height adjustment
watch(height, (val) => {
  document.documentElement.style.setProperty('--debug-drawer-height', val + 'px')
}, { immediate: true })
const isResizing = ref(false)
const activeTab = ref<'items' | 'logs'>('items')
const logs = getLogs()

function close(): void {
  setDebugMode(false)
}

function getMaxHeight(): number {
  return window.innerHeight * (MAX_HEIGHT_VH / 100)
}

function startResize(e: MouseEvent): void {
  e.preventDefault()
  isResizing.value = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent): void {
  if (!isResizing.value) return
  const newHeight = window.innerHeight - e.clientY
  height.value = Math.max(MIN_HEIGHT, Math.min(newHeight, getMaxHeight()))
}

function stopResize(): void {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  // Save to localStorage
  localStorage.setItem(STORAGE_KEY, String(height.value))
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed)) {
      height.value = Math.max(MIN_HEIGHT, Math.min(parsed, getMaxHeight()))
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.documentElement.style.removeProperty('--debug-drawer-height')
})
</script>

<template>
  <div
    class="debug-drawer"
    :class="{ resizing: isResizing }"
    :style="{ height: height + 'px' }"
  >
    <div
      class="debug-drawer-resize"
      @mousedown="startResize"
    ></div>
    <div class="debug-drawer-header">
      <div class="debug-drawer-tabs">
        <button
          class="debug-tab"
          :class="{ active: activeTab === 'items' }"
          @click.stop="activeTab = 'items'"
        >Items</button>
        <button
          class="debug-tab"
          :class="{ active: activeTab === 'logs' }"
          @click.stop="activeTab = 'logs'"
        >Logs ({{ logs.length }})</button>
        <button
          v-if="activeTab === 'logs'"
          class="debug-tab-action"
          @click.stop="clearLogs"
        >Clear</button>
      </div>
      <button class="debug-drawer-close" @click="close" title="Close">×</button>
    </div>
    <div class="debug-drawer-content">
      <div v-show="activeTab === 'items'">
        <slot></slot>
      </div>
      <div v-show="activeTab === 'logs'" class="logs-view">
        <div v-if="logs.length === 0" class="logs-empty">No logs yet</div>
        <div v-else class="logs-list">
          <div v-for="(log, i) in logs" :key="i" class="log-line">{{ log }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 2px solid var(--warning-color);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.debug-drawer.resizing {
  user-select: none;
}

.debug-drawer-resize {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  z-index: 1;
}

.debug-drawer-resize:hover,
.debug-drawer.resizing .debug-drawer-resize {
  background: var(--warning-color);
  opacity: 0.5;
}

.debug-drawer-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: var(--warning-color);
  color: white;
  user-select: none;
  flex-shrink: 0;
}

.debug-drawer-close {
  margin-left: auto;
  background: transparent;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.8;
}

.debug-drawer-close:hover {
  opacity: 1;
}

.debug-drawer-tabs {
  display: flex;
  gap: 4px;
}

.debug-tab {
  padding: 2px 10px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
}

.debug-tab:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.debug-tab.active {
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

.debug-tab-action {
  padding: 2px 10px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
}

.debug-tab-action:hover {
  background: rgba(220, 53, 69, 0.8);
  color: white;
}

.debug-drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
}

.logs-view {
  height: 100%;
}

.logs-empty {
  color: var(--text-muted);
  font-style: italic;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-line {
  padding: 2px 4px;
  background: var(--bg-primary);
  border-radius: 2px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
