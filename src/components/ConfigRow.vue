<script setup lang="ts">
import { computed } from 'vue'
import type { BaseConfigItem } from '../types'
import { log } from '../utils/log'

const props = defineProps<{
  item: BaseConfigItem
  index: number
  showCheckbox?: boolean
  showIndex?: boolean
  showDrag?: boolean
  isSelected?: boolean
  isDisabled?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  isReadOnly?: boolean
  showActions?: boolean
  rowClasses?: Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'select', item: BaseConfigItem): void
  (e: 'dragstart', event: DragEvent, index: number): void
  (e: 'dragover', event: DragEvent, index: number): void
  (e: 'dragleave'): void
  (e: 'drop', event: DragEvent, index: number): void
  (e: 'dragend'): void
  (e: 'pointerdragstart', event: PointerEvent, index: number): void
}>()

const computedRowClasses = computed(() => ({
  ...props.rowClasses,
  'row-dragging': props.isDragging,
  'row-dragover': props.isDragOver
}))

const canDrag = computed(() =>
  props.showDrag && !props.isReadOnly && !props.isDisabled
)

function logDrag(phase: string, e: DragEvent) {
  const target = e.target as HTMLElement | null
  const currentTarget = e.currentTarget as HTMLElement | null
  const types = e.dataTransfer ? Array.from(e.dataTransfer.types).join(',') : ''

  log(
    `[drag] ${phase} index=${props.index} showDrag=${!!props.showDrag} readOnly=${!!props.isReadOnly} ` +
      `disabled=${!!props.isDisabled} canDrag=${canDrag.value} target=${target?.className || target?.tagName || ''} ` +
      `currentTarget=${currentTarget?.className || currentTarget?.tagName || ''} ` +
      `effectAllowed=${e.dataTransfer?.effectAllowed || ''} dropEffect=${e.dataTransfer?.dropEffect || ''} types=${types}`
  )
}

function handleDragStart(e: DragEvent) {
  logDrag('start-before', e)
  if (!canDrag.value) {
    e.preventDefault()
    logDrag('start-prevented', e)
    return
  }
  e.stopPropagation()
  emit('dragstart', e, props.index)
  logDrag('start-after', e)
}

function handleDragOver(e: DragEvent) {
  logDrag('over-before', e)
  if (props.showDrag && !props.isReadOnly) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }
  emit('dragover', e, props.index)
  logDrag('over-after', e)
}

function handleDragEnter(e: DragEvent) {
  logDrag('enter-before', e)
  if (props.showDrag && !props.isReadOnly) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }
  logDrag('enter-after', e)
}

function handleDrop(e: DragEvent) {
  logDrag('drop-before', e)
  if (props.showDrag && !props.isReadOnly) {
    e.preventDefault()
  }
  emit('drop', e, props.index)
  logDrag('drop-after', e)
}

function handlePointerDragStart(e: PointerEvent) {
  if (!canDrag.value) return
  e.preventDefault()
  e.stopPropagation()
  emit('pointerdragstart', e, props.index)
}
</script>

<template>
  <div
    class="config-row"
    :class="computedRowClasses"
    :data-index="index"
    @dragenter.capture="handleDragEnter"
    @dragover.capture="handleDragOver"
    @dragleave="emit('dragleave')"
    @drop.capture="handleDrop"
    @dragend="emit('dragend')"
  >
    <input
      v-if="showCheckbox && !isReadOnly"
      type="checkbox"
      :checked="isSelected"
      :disabled="isDisabled"
      @change="emit('select', item)"
      class="row-checkbox"
    />
    <span v-else-if="showCheckbox" class="row-checkbox-placeholder" />

    <span v-if="showIndex" class="col-index">{{ index + 1 }}</span>

    <span
      v-if="showDrag"
      class="col-drag"
      :class="{ 'drag-hidden': isDisabled || isReadOnly }"
      :draggable="false"
      @dragstart="handleDragStart"
      @pointerdown="handlePointerDragStart"
    >⋮⋮</span>

    <slot :item="item" :index="index" :isDisabled="isDisabled" />

    <div v-if="showActions !== false" class="col-actions">
      <slot name="actions" :item="item" :index="index" :isDisabled="isDisabled" />
    </div>
  </div>
</template>

<style scoped>
.drag-hidden {
  visibility: hidden;
}

.col-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>
