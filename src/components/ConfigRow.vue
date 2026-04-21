<script setup lang="ts">
import { computed } from 'vue'
import type { BaseConfigItem } from '../types'

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
}>()

const computedRowClasses = computed(() => ({
  ...props.rowClasses,
  'row-dragging': props.isDragging,
  'row-dragover': props.isDragOver
}))

const canDrag = computed(() =>
  props.showDrag && !props.isReadOnly && !props.isDisabled
)

function handleDragStart(e: DragEvent) {
  if (!canDrag.value) {
    e.preventDefault()
    return
  }
  emit('dragstart', e, props.index)
}
</script>

<template>
  <div
    class="config-row"
    :class="computedRowClasses"
    :data-index="index"
    @dragover="(e) => emit('dragover', e, index)"
    @dragleave="emit('dragleave')"
    @drop="(e) => emit('drop', e, index)"
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
      :draggable="canDrag"
      @dragstart="handleDragStart"
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
