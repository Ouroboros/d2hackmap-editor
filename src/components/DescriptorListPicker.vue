<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../i18n'
import { log } from '../utils/log'

const { t } = useI18n()

interface Props {
  modelValue?: string[]
  options?: string[]
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  titleKey?: string
  placeholderKey?: string
  availableKey?: string
  selectedListKey?: string
  countKey?: string
  emptyKey?: string
  noMatchKey?: string
  noSelectionKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  options: () => [],
  disabled: false,
  readonly: false,
  placeholder: '',
  titleKey: 'descriptorPicker.title',
  placeholderKey: 'descriptorPicker.placeholder',
  availableKey: 'descriptorPicker.available',
  selectedListKey: 'descriptorPicker.selectedList',
  countKey: 'descriptorPicker.count',
  emptyKey: 'descriptorPicker.empty',
  noMatchKey: 'descriptorPicker.noMatch',
  noSelectionKey: 'descriptorPicker.noSelection'
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const showPicker = ref(false)
const searchQuery = ref('')
const workingItems = ref<string[]>([])
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const selectedListEl = ref<HTMLElement | null>(null)
let pointerDragActive = false
let lastDragOverLogIndex: number | null = null
let lastDragOverLogAt = 0

const selectedSet = computed(() => new Set(workingItems.value))

const uniqueOptions = computed(() => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const option of props.options) {
    const name = option.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
})

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return uniqueOptions.value
  return uniqueOptions.value.filter(name => name.toLowerCase().includes(q))
})

const displayText = computed(() => {
  const count = props.modelValue.length
  if (count === 0) return ''
  return t(props.countKey, { count })
})

const hoverText = computed(() => props.modelValue.filter(Boolean).join('\n'))

watch(showPicker, (val) => {
  if (!val) return
  searchQuery.value = ''
  workingItems.value = [...props.modelValue]
  dragIndex.value = null
  dragOverIndex.value = null
})

function togglePicker(): void {
  if (props.disabled) return
  showPicker.value = !showPicker.value
}

function closePicker(): void {
  showPicker.value = false
}

function cancelSelection(): void {
  closePicker()
}

function confirmSelection(): void {
  if (!props.readonly) {
    emit('update:modelValue', [...workingItems.value])
  }
  closePicker()
}

function addItem(name: string): void {
  if (props.readonly || selectedSet.value.has(name)) return
  workingItems.value = [...workingItems.value, name]
}

function removeItemByName(name: string): void {
  if (props.readonly) return
  workingItems.value = workingItems.value.filter(item => item !== name)
}

function toggleAvailableItem(name: string): void {
  if (selectedSet.value.has(name)) {
    removeItemByName(name)
  } else {
    addItem(name)
  }
}

function addAllVisibleItems(): void {
  if (props.readonly) return
  const next = [...workingItems.value]
  const selected = new Set(next)
  for (const name of filteredOptions.value) {
    if (selected.has(name)) continue
    selected.add(name)
    next.push(name)
  }
  workingItems.value = next
}

function removeItem(index: number): void {
  if (props.readonly) return
  workingItems.value = workingItems.value.filter((_, i) => i !== index)
}

function removeAllItems(): void {
  if (props.readonly) return
  workingItems.value = []
}

function moveItem(index: number, direction: -1 | 1): void {
  if (props.readonly) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= workingItems.value.length) return

  const next = [...workingItems.value]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  workingItems.value = next
}

function logDescriptorDrag(phase: string, e: DragEvent, extra = ''): void {
  if (phase === 'document-over' || phase === 'list-over' || phase === 'pointer-over') {
    const indexMatch = extra.match(/index=([0-9]+)/)
    const index = indexMatch ? Number(indexMatch[1]) : null
    const now = Date.now()
    if (index === lastDragOverLogIndex && now - lastDragOverLogAt < 250) return
    lastDragOverLogIndex = index
    lastDragOverLogAt = now
  }

  const target = e.target as HTMLElement | null
  const currentTarget = e.currentTarget as HTMLElement | null
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types).join(',') : ''

  log(
    `[descriptor-drag] ${phase} readonly=${props.readonly} disabled=${props.disabled} ` +
      `dragIndex=${dragIndex.value ?? ''} target=${target?.className || target?.tagName || ''} ` +
      `currentTarget=${currentTarget?.className || currentTarget?.tagName || ''} ` +
      `effectAllowed=${e.dataTransfer?.effectAllowed || ''} dropEffect=${e.dataTransfer?.dropEffect || ''} ` +
      `types=${types}${extra ? ` ${extra}` : ''}`
  )
}

function handleDragStart(e: DragEvent, index: number): void {
  logDescriptorDrag('start-before', e, `index=${index}`)
  if (props.readonly || props.disabled) {
    e.preventDefault()
    logDescriptorDrag('start-prevented', e, `index=${index}`)
    return
  }
  e.stopPropagation()
  dragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
  logDescriptorDrag('start-after', e, `index=${index}`)
}

function handlePointerDragStart(e: PointerEvent, index: number): void {
  if (props.readonly || props.disabled) return
  e.preventDefault()
  e.stopPropagation()
  pointerDragActive = true
  dragIndex.value = index
  dragOverIndex.value = index
  lastDragOverLogIndex = null
  lastDragOverLogAt = 0
  log(
    `[descriptor-pointer-drag] start index=${index} target=${(e.target as HTMLElement | null)?.className || ''} ` +
      `x=${e.clientX} y=${e.clientY}`
  )
  window.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('pointerup', handlePointerUp, true)
  window.addEventListener('pointercancel', handlePointerCancel, true)
}

function getTargetIndexFromPoint(clientX: number, clientY: number): number | null {
  const list = selectedListEl.value
  if (!list || workingItems.value.length === 0) return null

  const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  const item = target?.closest('.selected-item') as HTMLElement | null
  if (item && list.contains(item)) {
    const index = Number(item.dataset.index)
    return Number.isFinite(index) ? index : null
  }

  const listRect = list.getBoundingClientRect()
  if (
    clientX < listRect.left ||
    clientX > listRect.right ||
    clientY < listRect.top ||
    clientY > listRect.bottom
  ) {
    return null
  }

  const items = Array.from(list.querySelectorAll<HTMLElement>('.selected-item'))
  if (items.length === 0) return null
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return i
  }
  return items.length - 1
}

function handleDragOver(e: DragEvent, index: number): void {
  logDescriptorDrag('over-before', e, `index=${index}`)
  e.preventDefault()
  e.stopPropagation()
  if (props.readonly || props.disabled) return
  e.dataTransfer!.dropEffect = 'move'
  dragOverIndex.value = index
  logDescriptorDrag('over-after', e, `index=${index}`)
}

function handleListDragOver(e: DragEvent): void {
  const index = getTargetIndexFromPoint(e.clientX, e.clientY)
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = index === null ? 'none' : 'move'
  }
  if (index !== null && !props.readonly && !props.disabled) {
    dragOverIndex.value = index
  }
  logDescriptorDrag('list-over', e, `index=${index ?? ''}`)
}

function handleDragLeave(): void {
  dragOverIndex.value = null
}

function handleDrop(e: DragEvent, targetIndex: number): void {
  logDescriptorDrag('drop-before', e, `targetIndex=${targetIndex}`)
  e.preventDefault()
  e.stopPropagation()
  if (props.readonly || props.disabled) return
  const moved = moveDraggedItem(targetIndex)
  if (!moved) {
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }
  logDescriptorDrag('drop-after', e, `targetIndex=${targetIndex}`)
}

function moveDraggedItem(targetIndex: number): boolean {
  if (props.readonly || props.disabled) return false
  const sourceIndex = dragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) return false
  const next = [...workingItems.value]
  const [item] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, item)
  workingItems.value = next
  dragIndex.value = null
  dragOverIndex.value = null
  return true
}

function handleListDrop(e: DragEvent): void {
  if (dragIndex.value === null) return
  const index = getTargetIndexFromPoint(e.clientX, e.clientY)
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = index === null ? 'none' : 'move'
  }
  logDescriptorDrag('list-drop', e, `index=${index ?? ''}`)
  if (index !== null) {
    handleDrop(e, index)
  } else {
    dragIndex.value = null
    dragOverIndex.value = null
  }
}

function handleDocumentDragOver(e: DragEvent): void {
  if (dragIndex.value === null || !showPicker.value) return
  const index = getTargetIndexFromPoint(e.clientX, e.clientY)
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = index === null ? 'none' : 'move'
  }
  if (index !== null && !props.readonly && !props.disabled) {
    dragOverIndex.value = index
  }
  logDescriptorDrag('document-over', e, `index=${index ?? ''}`)
}

function handleDocumentDrop(e: DragEvent): void {
  if (dragIndex.value === null || !showPicker.value) return
  handleListDrop(e)
}

function handlePointerMove(e: PointerEvent): void {
  if (!pointerDragActive) return
  e.preventDefault()
  e.stopPropagation()
  const index = getTargetIndexFromPoint(e.clientX, e.clientY)
  if (index !== null) {
    dragOverIndex.value = index
  }
  const now = Date.now()
  if (index !== lastDragOverLogIndex || now - lastDragOverLogAt >= 250) {
    lastDragOverLogIndex = index
    lastDragOverLogAt = now
    log(
      `[descriptor-pointer-drag] over index=${index ?? ''} dragIndex=${dragIndex.value ?? ''} ` +
        `target=${(e.target as HTMLElement | null)?.className || ''} x=${e.clientX} y=${e.clientY}`
    )
  }
}

function handlePointerUp(e: PointerEvent): void {
  if (!pointerDragActive) return
  e.preventDefault()
  e.stopPropagation()
  const index = getTargetIndexFromPoint(e.clientX, e.clientY)
  log(
    `[descriptor-pointer-drag] drop index=${index ?? ''} dragIndex=${dragIndex.value ?? ''} ` +
      `target=${(e.target as HTMLElement | null)?.className || ''} x=${e.clientX} y=${e.clientY}`
  )
  if (index !== null) {
    moveDraggedItem(index)
  } else {
    dragIndex.value = null
    dragOverIndex.value = null
  }
  finishPointerDrag()
}

function handlePointerCancel(e: PointerEvent): void {
  if (!pointerDragActive) return
  log(
    `[descriptor-pointer-drag] cancel dragIndex=${dragIndex.value ?? ''} ` +
      `target=${(e.target as HTMLElement | null)?.className || ''} x=${e.clientX} y=${e.clientY}`
  )
  dragIndex.value = null
  dragOverIndex.value = null
  finishPointerDrag()
}

function finishPointerDrag(): void {
  pointerDragActive = false
  window.removeEventListener('pointermove', handlePointerMove, true)
  window.removeEventListener('pointerup', handlePointerUp, true)
  window.removeEventListener('pointercancel', handlePointerCancel, true)
}

function handleDragEnd(): void {
  dragIndex.value = null
  dragOverIndex.value = null
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && showPicker.value) {
    cancelSelection()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('dragover', handleDocumentDragOver, true)
  document.addEventListener('drop', handleDocumentDrop, true)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('dragover', handleDocumentDragOver, true)
  document.removeEventListener('drop', handleDocumentDrop, true)
  finishPointerDrag()
})
</script>

<template>
  <div class="descriptor-list-picker" :class="{ disabled }">
    <div class="picker-trigger" :title="hoverText" @click="togglePicker">
      <input
        type="text"
        :value="displayText"
        :placeholder="placeholder || t(placeholderKey)"
        :disabled="disabled"
        :title="hoverText"
        readonly
      />
      <span class="picker-arrow">▼</span>
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="cancelSelection">
        <div class="descriptor-popup" @mousedown.stop>
          <div class="picker-header">
            <div class="picker-title">{{ t(titleKey) }}</div>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
          </div>

          <div v-if="!readonly" class="search-row">
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              :placeholder="t('descriptorPicker.search')"
            />
          </div>

          <div class="picker-body" :class="{ readonly }">
            <section v-if="!readonly" class="picker-panel">
              <div class="panel-title">
                <span>{{ t(availableKey) }}</span>
                <button
                  type="button"
                  class="panel-action-btn"
                  :disabled="filteredOptions.every(name => selectedSet.has(name))"
                  @click="addAllVisibleItems"
                >
                  {{ t('descriptorPicker.addAll') }}
                </button>
              </div>
              <div class="option-list">
                <div v-if="filteredOptions.length === 0" class="empty-hint">
                  {{ searchQuery ? t(noMatchKey) : t(emptyKey) }}
                </div>
                <button
                  v-for="name in filteredOptions"
                  :key="name"
                  type="button"
                  class="option-item"
                  :class="{ selected: selectedSet.has(name) }"
                  @click="toggleAvailableItem(name)"
                >
                  <span class="option-name">{{ name }}</span>
                  <span class="option-action">{{ selectedSet.has(name) ? t('descriptorPicker.selected') : '+' }}</span>
                </button>
              </div>
            </section>

            <section class="picker-panel selected-panel">
              <div class="panel-title">
                <span>
                  {{ t(selectedListKey) }}
                  <span class="panel-count">{{ t(countKey, { count: workingItems.length }) }}</span>
                </span>
                <button
                  v-if="!readonly"
                  type="button"
                  class="panel-action-btn danger"
                  :disabled="workingItems.length === 0"
                  @click="removeAllItems"
                >
                  {{ t('descriptorPicker.removeAll') }}
                </button>
              </div>
              <div
                ref="selectedListEl"
                class="selected-list"
                @dragenter.capture="handleListDragOver"
                @dragover.capture="handleListDragOver"
                @drop.capture="handleListDrop"
              >
                <div v-if="workingItems.length === 0" class="empty-hint">
                  {{ t(noSelectionKey) }}
                </div>
                <div
                  v-for="(name, index) in workingItems"
                  :key="`${name}-${index}`"
                  class="selected-item"
                  :data-index="index"
                  :class="{ dragover: dragOverIndex === index, readonly }"
                  :draggable="false"
                  @dragstart="handleDragStart($event, index)"
                  @dragenter.capture="handleListDragOver"
                  @dragover.capture="handleDragOver($event, index)"
                  @dragleave="handleDragLeave"
                  @drop.capture="handleDrop($event, index)"
                  @dragend="handleDragEnd"
                >
                  <span class="drag-handle" @pointerdown="handlePointerDragStart($event, index)">⋮⋮</span>
                  <span class="order-index">{{ index + 1 }}</span>
                  <span class="selected-name">{{ name }}</span>
                  <template v-if="!readonly">
                    <button
                      type="button"
                      class="mini-btn"
                      :disabled="index === 0"
                      :title="t('descriptorPicker.moveUp')"
                      @click="moveItem(index, -1)"
                    >↑</button>
                    <button
                      type="button"
                      class="mini-btn"
                      :disabled="index === workingItems.length - 1"
                      :title="t('descriptorPicker.moveDown')"
                      @click="moveItem(index, 1)"
                    >↓</button>
                    <button
                      type="button"
                      class="mini-btn danger"
                      :title="t('descriptorPicker.remove')"
                      @click="removeItem(index)"
                    >×</button>
                  </template>
                </div>
              </div>
            </section>
          </div>

          <div class="picker-footer">
            <span class="selected-count">{{ t(countKey, { count: workingItems.length }) }}</span>
            <div class="footer-actions">
              <button class="btn btn-small btn-secondary" @click="cancelSelection">{{ t('itemPicker.cancel') }}</button>
              <button v-if="!readonly" class="btn btn-small btn-primary" @click="confirmSelection">{{ t('itemPicker.confirm') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.descriptor-list-picker {
  display: inline-block;
  width: 100%;
  max-width: 100%;
}

.descriptor-list-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.picker-trigger {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
}

.picker-trigger input {
  width: 100%;
  padding-right: 28px;
  cursor: pointer;
  background: var(--bg-primary);
}

.picker-trigger input:hover:not(:disabled) {
  border-color: var(--accent-color);
}

.picker-arrow {
  position: absolute;
  right: 10px;
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.descriptor-popup {
  display: flex;
  flex-direction: column;
  width: 760px;
  height: 620px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.picker-header,
.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-header {
  margin-bottom: 12px;
}

.picker-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.readonly-badge,
.selected-count,
.panel-count {
  font-size: 12px;
  color: var(--text-muted);
}

.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.picker-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.picker-body.readonly {
  grid-template-columns: 1fr;
}

.picker-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.panel-action-btn {
  padding: 3px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.panel-action-btn:hover:not(:disabled) {
  color: white;
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.panel-action-btn.danger {
  color: var(--danger-color);
}

.panel-action-btn.danger:hover:not(:disabled) {
  color: white;
  background: var(--danger-color);
  border-color: var(--danger-color);
}

.panel-action-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.option-list,
.selected-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.option-item,
.selected-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 34px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-primary);
  border: 0;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
}

.option-item {
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
}

.option-item:hover:not(:disabled),
.selected-item:hover:not(.readonly) {
  background: var(--bg-tertiary);
}

.option-item:disabled {
  cursor: default;
  color: var(--text-muted);
}

.option-item.selected {
  background: var(--bg-tertiary);
}

.option-name,
.selected-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-action {
  flex: 0 0 auto;
  margin-left: 8px;
  color: var(--accent-color);
}

.selected-item {
  gap: 8px;
}

.selected-item.dragover {
  outline: 1px solid var(--accent-color);
  outline-offset: -1px;
}

.selected-item.readonly {
  cursor: default;
}

.drag-handle {
  flex: 0 0 auto;
  color: var(--text-muted);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.selected-item.readonly .drag-handle {
  cursor: default;
}

.order-index {
  flex: 0 0 28px;
  color: var(--text-muted);
  text-align: right;
}

.selected-name {
  flex: 1;
}

.mini-btn {
  flex: 0 0 auto;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.mini-btn:hover:not(:disabled) {
  color: white;
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.mini-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.mini-btn.danger {
  color: var(--danger-color);
}

.mini-btn.danger:hover:not(:disabled) {
  color: white;
  background: var(--danger-color);
  border-color: var(--danger-color);
}

.empty-hint {
  padding: 40px 20px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.picker-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.footer-actions {
  display: flex;
  gap: 8px;
}
</style>
