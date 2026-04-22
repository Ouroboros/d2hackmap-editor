<script setup lang="ts" generic="TItem extends BaseConfigItem">
import { onMounted, onUnmounted, ref, type CSSProperties } from 'vue'
import type { BaseConfigItem } from '../types'
import type { ConfigTableColumn } from './configTable'
import ConfigHeader from './ConfigHeader.vue'
import ConfigRow from './ConfigRow.vue'
import { log } from '../utils/log'

const props = withDefaults(defineProps<{
  items: TItem[]
  columns: ConfigTableColumn[]
  emptyText: string
  listClass?: string
  showCheckbox?: boolean
  showIndex?: boolean
  showDrag?: boolean
  isAllSelected?: boolean
  isReadOnly?: boolean
  dragOverIndex?: number | null
  rowKey?: (item: TItem, index: number) => string | number
  isSelected?: (item: TItem) => boolean
  isDisabled?: (item: TItem) => boolean
  rowClasses?: (item: TItem) => Record<string, boolean>
}>(), {
  listClass: '',
  showCheckbox: false,
  showIndex: true,
  showDrag: false,
  isAllSelected: false,
  isReadOnly: false,
  dragOverIndex: null,
  rowKey: undefined,
  isSelected: undefined,
  isDisabled: undefined,
  rowClasses: undefined
})

defineSlots<{
  [key: `cell-${string}`]: (props: { item: TItem; index: number; column: ConfigTableColumn; isDisabled: boolean }) => unknown
}>()

const emit = defineEmits<{
  (e: 'selectAll'): void
  (e: 'select', item: TItem): void
  (e: 'dragstart', event: DragEvent, index: number): void
  (e: 'dragover', event: DragEvent, index: number): void
  (e: 'dragleave'): void
  (e: 'drop', event: DragEvent, index: number): void
  (e: 'dragend'): void
}>()

const listEl = ref<HTMLElement | null>(null)
const internalDragActive = ref(false)
const pointerDragActive = ref(false)
let pointerDataTransfer: DataTransfer | null = null
let lastDragOverLogIndex: number | null = null
let lastDragOverLogAt = 0

function columnStyle(column: ConfigTableColumn): CSSProperties {
  return {
    width: column.width,
    flex: column.flex ?? (column.width ? `0 0 ${column.width}` : undefined)
  }
}

function itemKey(item: TItem, index: number): string | number {
  return props.rowKey ? props.rowKey(item, index) : index
}

function itemSelected(item: TItem): boolean {
  return props.isSelected ? props.isSelected(item) : false
}

function itemDisabled(item: TItem): boolean {
  return props.isDisabled ? props.isDisabled(item) : false
}

function itemRowClasses(item: TItem): Record<string, boolean> {
  return props.rowClasses ? props.rowClasses(item) : {}
}

function getTargetIndexFromPoint(clientX: number, clientY: number): number | null {
  const list = listEl.value
  if (!list || props.items.length === 0) return null

  const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  const row = target?.closest('.config-row') as HTMLElement | null
  if (row && list.contains(row)) {
    const index = Number(row.dataset.index)
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

  const rows = Array.from(list.querySelectorAll<HTMLElement>('.config-row'))
  if (rows.length === 0) return null

  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return i
  }
  return rows.length - 1
}

function logTableDrag(phase: string, e: DragEvent, index: number | null): void {
  if (phase === 'over' || phase === 'pointer-over') {
    const now = Date.now()
    if (index === lastDragOverLogIndex && now - lastDragOverLogAt < 250) return
    lastDragOverLogIndex = index
    lastDragOverLogAt = now
  }

  const target = e.target as HTMLElement | null
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types).join(',') : ''
  log(
    `[table-drag] ${phase} index=${index ?? ''} active=${internalDragActive.value} ` +
      `target=${target?.className || target?.tagName || ''} ` +
      `x=${e.clientX} y=${e.clientY} dropEffect=${e.dataTransfer?.dropEffect || ''} types=${types}`
  )
}

function acceptDragEvent(e: DragEvent, index: number | null): void {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = index === null ? 'none' : 'move'
  }
}

function createSyntheticDataTransfer(): DataTransfer {
  const store = new Map<string, string>()
  const dataTransfer = {
    dropEffect: 'move',
    effectAllowed: 'move',
    files: [],
    items: [],
    types: [] as string[],
    clearData(format?: string) {
      if (format) {
        store.delete(format)
      } else {
        store.clear()
      }
      this.types = Array.from(store.keys())
    },
    getData(format: string) {
      return store.get(format) ?? ''
    },
    setData(format: string, data: string) {
      store.set(format, data)
      this.types = Array.from(store.keys())
    },
    setDragImage() {}
  }
  return dataTransfer as unknown as DataTransfer
}

function syntheticDragEvent(e: PointerEvent): DragEvent {
  return {
    preventDefault: () => e.preventDefault(),
    stopPropagation: () => e.stopPropagation(),
    clientX: e.clientX,
    clientY: e.clientY,
    target: e.target,
    currentTarget: e.currentTarget,
    dataTransfer: pointerDataTransfer
  } as unknown as DragEvent
}

function handleRowDragStart(event: DragEvent, index: number): void {
  internalDragActive.value = true
  lastDragOverLogIndex = null
  lastDragOverLogAt = 0
  logTableDrag('start', event, index)
  emit('dragstart', event, index)
}

function handlePointerDragStart(event: PointerEvent, index: number): void {
  if (!props.showDrag || props.isReadOnly) return
  event.preventDefault()
  event.stopPropagation()

  pointerDragActive.value = true
  internalDragActive.value = true
  pointerDataTransfer = createSyntheticDataTransfer()
  lastDragOverLogIndex = null
  lastDragOverLogAt = 0

  const synthetic = syntheticDragEvent(event)
  logTableDrag('pointer-start', synthetic, index)
  emit('dragstart', synthetic, index)

  window.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('pointerup', handlePointerUp, true)
  window.addEventListener('pointercancel', handlePointerCancel, true)
}

function handlePointerMove(event: PointerEvent): void {
  if (!pointerDragActive.value) return
  const index = getTargetIndexFromPoint(event.clientX, event.clientY)
  const synthetic = syntheticDragEvent(event)
  acceptDragEvent(synthetic, index)
  logTableDrag('pointer-over', synthetic, index)
  if (index !== null) {
    emit('dragover', synthetic, index)
  }
}

function handlePointerUp(event: PointerEvent): void {
  if (!pointerDragActive.value) return
  const index = getTargetIndexFromPoint(event.clientX, event.clientY)
  const synthetic = syntheticDragEvent(event)
  acceptDragEvent(synthetic, index)
  logTableDrag('pointer-drop', synthetic, index)
  if (index !== null) {
    emit('drop', synthetic, index)
  } else {
    emit('dragleave')
  }
  finishPointerDrag()
}

function handlePointerCancel(event: PointerEvent): void {
  if (!pointerDragActive.value) return
  const synthetic = syntheticDragEvent(event)
  logTableDrag('pointer-cancel', synthetic, null)
  emit('dragleave')
  finishPointerDrag()
}

function finishPointerDrag(): void {
  const wasActive = pointerDragActive.value
  pointerDragActive.value = false
  internalDragActive.value = false
  pointerDataTransfer = null
  window.removeEventListener('pointermove', handlePointerMove, true)
  window.removeEventListener('pointerup', handlePointerUp, true)
  window.removeEventListener('pointercancel', handlePointerCancel, true)
  if (wasActive) {
    emit('dragend')
  }
}

function handleDragOverCapture(event: DragEvent): void {
  if (!internalDragActive.value || !props.showDrag || props.isReadOnly) return
  const index = getTargetIndexFromPoint(event.clientX, event.clientY)
  acceptDragEvent(event, index)
  logTableDrag('over', event, index)
  if (index !== null) {
    emit('dragover', event, index)
  }
}

function handleDropCapture(event: DragEvent): void {
  if (!internalDragActive.value || !props.showDrag || props.isReadOnly) return
  const index = getTargetIndexFromPoint(event.clientX, event.clientY)
  acceptDragEvent(event, index)
  logTableDrag('drop', event, index)
  if (index !== null) {
    emit('drop', event, index)
  } else {
    emit('dragleave')
  }
  internalDragActive.value = false
}

function handleRowDragEnd(): void {
  if (pointerDragActive.value) return
  internalDragActive.value = false
  emit('dragend')
}

onMounted(() => {
  document.addEventListener('dragover', handleDragOverCapture, true)
  document.addEventListener('drop', handleDropCapture, true)
})

onUnmounted(() => {
  finishPointerDrag()
  document.removeEventListener('dragover', handleDragOverCapture, true)
  document.removeEventListener('drop', handleDropCapture, true)
})
</script>

<template>
  <div v-if="items.length === 0" class="empty-state">
    <p>{{ emptyText }}</p>
  </div>

  <div v-else ref="listEl" class="item-list" :class="listClass">
    <ConfigHeader
      :show-checkbox="showCheckbox"
      :show-index="showIndex"
      :show-drag="showDrag"
      :is-all-selected="isAllSelected"
      :is-read-only="isReadOnly"
      @select-all="emit('selectAll')"
    >
      <span
        v-for="column in columns"
        :key="column.key"
        class="config-cell config-header-cell"
        :class="column.className"
        :style="columnStyle(column)"
      >
        {{ column.label }}
      </span>
    </ConfigHeader>

    <ConfigRow
      v-for="(item, index) in items"
      :key="itemKey(item, index)"
      :item="item"
      :index="index"
      :show-checkbox="showCheckbox"
      :show-index="showIndex"
      :show-drag="showDrag"
      :show-actions="false"
      :is-selected="itemSelected(item)"
      :is-disabled="itemDisabled(item)"
      :is-drag-over="dragOverIndex === index"
      :is-read-only="isReadOnly"
      :row-classes="itemRowClasses(item)"
      @select="emit('select', item)"
      @dragstart="handleRowDragStart"
      @dragover="(event, rowIndex) => emit('dragover', event, rowIndex)"
      @dragleave="emit('dragleave')"
      @drop="(event, rowIndex) => emit('drop', event, rowIndex)"
      @dragend="handleRowDragEnd"
      @pointerdragstart="handlePointerDragStart"
    >
      <div
        v-for="column in columns"
        :key="column.key"
        class="config-cell"
        :class="column.className"
        :style="columnStyle(column)"
      >
        <slot
          :name="`cell-${column.key}`"
          :item="item"
          :index="index"
          :column="column"
          :is-disabled="itemDisabled(item)"
        />
      </div>
    </ConfigRow>
  </div>
</template>

<style scoped>
.config-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
}

.config-header-cell {
  white-space: nowrap;
}

.config-cell.col-actions {
  gap: 4px;
}

.config-cell :deep(input:not([type="checkbox"]):not([type="radio"])),
.config-cell :deep(select),
.config-cell :deep(.item-picker),
.config-cell :deep(.rune-picker),
.config-cell :deep(.quality-picker),
.config-cell :deep(.text-color-picker),
.config-cell :deep(.map-color-picker),
.config-cell :deep(.stat-picker),
.config-cell :deep(.stat-group-picker),
.config-cell :deep(.item-display),
.config-cell :deep(.rune-display),
.config-cell :deep(.quality-display),
.config-cell :deep(.stat-display),
.config-cell :deep(.picker-input),
.config-cell :deep(.picker-trigger),
.config-cell :deep(.color-display),
.config-cell :deep(.color-button) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
</style>
