<script setup lang="ts" generic="TItem extends BaseConfigItem">
import type { CSSProperties } from 'vue'
import type { BaseConfigItem } from '../types'
import type { ConfigTableColumn } from './configTable'
import ConfigHeader from './ConfigHeader.vue'
import ConfigRow from './ConfigRow.vue'

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
</script>

<template>
  <div v-if="items.length === 0" class="empty-state">
    <p>{{ emptyText }}</p>
  </div>

  <div v-else class="item-list" :class="listClass">
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
      @dragstart="(event, rowIndex) => emit('dragstart', event, rowIndex)"
      @dragover="(event, rowIndex) => emit('dragover', event, rowIndex)"
      @dragleave="emit('dragleave')"
      @drop="(event, rowIndex) => emit('drop', event, rowIndex)"
      @dragend="emit('dragend')"
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
