/**
 * Composable for config list selection and drag-and-drop
 * Provides unified state management for ConfigList component
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { isItemDisabled, isItemExtern, getItemRowClasses } from './useItemActions'
import type { BaseConfigItem } from '../types'

export interface UseConfigListOptions<T extends BaseConfigItem> {
  items: () => T[]
  isReadOnly?: () => boolean
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export interface ConfigListState<T extends BaseConfigItem> {
  // Selection state
  selectedItems: Ref<Set<T>>
  selectableCount: ComputedRef<number>
  isAllSelected: ComputedRef<boolean>

  // Selection methods
  toggleSelect: (item: T) => void
  toggleSelectAll: () => void
  isSelected: (item: T) => boolean
  hasSelection: () => boolean
  clearSelection: () => void

  // Drag state
  dragIndex: Ref<number | null>
  dragOverIndex: Ref<number | null>

  // Drag methods
  handleDragStart: (e: DragEvent, index: number) => void
  handleDragOver: (e: DragEvent, index: number) => void
  handleDragLeave: () => void
  handleDrop: (e: DragEvent, toIndex: number) => void
  handleDragEnd: () => void

  // Row helpers
  getRowClasses: (item: T, index: number) => Record<string, boolean>
  isItemDisabled: (item: T) => boolean
  isReadOnly: () => boolean
}

export function useConfigList<T extends BaseConfigItem>(
  options: UseConfigListOptions<T>
): ConfigListState<T> {
  const { items, isReadOnly = () => false, onReorder } = options

  // ========== Selection State ==========

  const selectedItems = ref<Set<T>>(new Set()) as Ref<Set<T>>

  const selectableItems = computed(() =>
    items().filter(item => !isItemDisabled(item))
  )

  const selectableCount = computed(() => selectableItems.value.length)

  const isAllSelected = computed(() =>
    selectableCount.value > 0 &&
    selectedItems.value.size === selectableCount.value
  )

  function toggleSelect(item: T) {
    if (isItemDisabled(item)) return
    if (selectedItems.value.has(item)) {
      selectedItems.value.delete(item)
    } else {
      selectedItems.value.add(item)
    }
    // Trigger reactivity
    selectedItems.value = new Set(selectedItems.value)
  }

  function toggleSelectAll() {
    if (isAllSelected.value) {
      selectedItems.value.clear()
    } else {
      selectedItems.value = new Set(selectableItems.value)
    }
    // Trigger reactivity
    selectedItems.value = new Set(selectedItems.value)
  }

  function isSelected(item: T): boolean {
    return selectedItems.value.has(item)
  }

  function hasSelection(): boolean {
    return selectedItems.value.size > 0
  }

  function clearSelection() {
    selectedItems.value.clear()
    selectedItems.value = new Set(selectedItems.value)
  }

  // ========== Drag State ==========

  const dragIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)

  function handleDragStart(e: DragEvent, index: number) {
    if (isReadOnly()) {
      e.preventDefault()
      return
    }

    const item = items()[index]
    if (isItemDisabled(item)) {
      e.preventDefault()
      return
    }

    dragIndex.value = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex.value !== null && dragIndex.value !== index) {
      dragOverIndex.value = index
    }
  }

  function handleDragLeave() {
    dragOverIndex.value = null
  }

  function handleDrop(e: DragEvent, toIndex: number) {
    e.preventDefault()
    if (dragIndex.value !== null && dragIndex.value !== toIndex) {
      onReorder?.(dragIndex.value, toIndex)
    }
    dragIndex.value = null
    dragOverIndex.value = null
  }

  function handleDragEnd() {
    dragIndex.value = null
    dragOverIndex.value = null
  }

  // ========== Row Helpers ==========

  function getRowClasses(item: T, index: number): Record<string, boolean> {
    return {
      ...getItemRowClasses(item),
      'row-dragging': dragIndex.value === index,
      'row-dragover': dragOverIndex.value === index
    }
  }

  return {
    // Selection
    selectedItems,
    selectableCount,
    isAllSelected,
    toggleSelect,
    toggleSelectAll,
    isSelected,
    hasSelection,
    clearSelection,

    // Drag
    dragIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,

    // Helpers
    getRowClasses,
    isItemDisabled,
    isReadOnly
  }
}
