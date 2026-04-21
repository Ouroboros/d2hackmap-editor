<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfig } from '../composables/useConfig'
import {
  useItemActions,
  refreshEffectiveStatus,
  getImportItemKey,
  getAllItems,
  addItemToEditable,
  deleteItemFromFile,
  buildCommentedMainMap,
  getJumpTargetIndex,
  scrollToIndex,
  scrollToMainItemInList
} from '../composables/useItemActions'
import { moveItemInFile } from '../utils/grouping'
import { log } from '../utils/log'
import { useI18n } from '../i18n'
import { useDebugMode } from '../composables/useDebugMode'
import { PICKUP_MODES } from '../configDefs'
import type { ImportItemItem } from '../types'
import DebugDrawer from './debug/DebugDrawer.vue'
import FlatListView from './debug/FlatListView.vue'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigTable from './ConfigTable.vue'
import ItemPicker from './ItemPicker.vue'
import QualityPicker from './QualityPicker.vue'
import StatGroupPicker from './StatGroupPicker.vue'
import type { ConfigTableColumn } from './configTable'

const { t } = useI18n()

interface Props {
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
})

const { config, exportSection, isReadOnly } = useConfig()
const { debugMode } = useDebugMode()
const { isItemDisabled, isItemExtern, getItemRowClasses } = useItemActions()

// Sub-tabs configuration (single tab for alignment)
const subTabsConfig = computed(() => [
  { id: 'importItems', label: t('subTab.importItems') }
])

// Selection state (store item references)
const selectedItems = ref<Set<ImportItemItem>>(new Set())

// Drag state
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function handleExport(): void {
  exportSection('importItems')
}

// Get all items for building data
const importItemsAll = computed(() => getAllItems<ImportItemItem>(config.value, 'importItems'))

// Filter items for display: main items (all) + extern items (only effective)
function filterForDisplay<T extends { sourceFile: string | null; isEffective?: boolean }>(items: T[]): T[] {
  return items.filter(item => item.sourceFile === null || item.isEffective)
}

// Get filtered items for display
const importItems = computed((): ImportItemItem[] => {
  let items = filterForDisplay(importItemsAll.value)
  if (!items.length) return []

  // Filter by search query
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.itemId.toLowerCase().includes(q) ||
      item.statGroup?.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    )
  }

  return items
})

// Build map for jump targets from DISPLAYED items (so indices match data-index)
const importItemsJumpMap = computed(() => buildCommentedMainMap(importItems.value, getImportItemKey))

// Get jump target for an item
function getItemJumpTarget(item: ImportItemItem): number | undefined {
  return getJumpTargetIndex(item, importItemsJumpMap.value, getImportItemKey)
}

function jumpToImportItem(index: number): void {
  scrollToIndex(index, '.import-items-list')
}

// Selectable count (non-extern items only)
const selectableItemsCount = computed(() => importItems.value.filter(item => !isItemExtern(item)).length)
const isAllSelected = computed(() => selectedItems.value.size === selectableItemsCount.value && selectableItemsCount.value > 0)

// Get merged display index for drag operations
function getMergedIndex(filteredIndex: number): number {
  if (filteredIndex < 0 || filteredIndex >= importItems.value.length) return -1

  const allItems = getAllItems<ImportItemItem>(config.value, 'importItems')
  const targetItem = importItems.value[filteredIndex]
  return allItems.indexOf(targetItem)
}

// Get the effective item at filtered index
function getItemAtIndex(filteredIndex: number): ImportItemItem | undefined {
  return importItems.value[filteredIndex]
}

function isReadonlyImportItem(item: ImportItemItem): boolean {
  return isReadOnly.value || isItemDisabled(item) || isItemExtern(item)
}

function isImportRowDisabled(item: ImportItemItem): boolean {
  return isItemDisabled(item) || isItemExtern(item)
}

const importItemColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'itemId', label: t('itemColors.itemId'), width: '150px' },
  { key: 'quality', label: t('itemColors.quality'), width: '80px' },
  { key: 'mode', label: t('import.mode'), width: '200px' },
  { key: 'statGroup', label: t('import.statGroup'), width: '120px' },
  { key: 'comment', label: t('itemColors.comment'), flex: '1 1 120px', className: 'col-comment' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

function updateItem(index: number, field: keyof ImportItemItem, value: string): void {
  const item = getItemAtIndex(index)
  if (!item || isReadonlyImportItem(item)) return
  if (item) {
    ;(item as ImportItemItem)[field] = value as never
  }
}

function addItem(): void {
  if (!config.value || isReadOnly.value) return
  const newItem: ImportItemItem = {
    itemId: '',
    quality: '',
    ethereal: '',
    sockets: '',
    mode: '1',
    showInfo: '0',
    unused: '0',
    statGroup: '',
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addItemToEditable(config.value, 'importItems', newItem)
  refreshEffectiveStatus(config.value)
}

function handleDelete(index: number): void {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index)
  if (!item || isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'importItems')
  refreshEffectiveStatus(config.value)
}

function handleComment(index: number): void {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index)
  if (!item || isItemExtern(item)) return

  item.isCommented = true
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function handleRestore(index: number): void {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index)
  if (!item || isItemExtern(item)) return

  item.isCommented = false
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

// Copy row - creates a new item with same content
function copyItem(index: number): void {
  if (!config.value || isReadOnly.value) return
  const original = getItemAtIndex(index)
  if (!original) return

  const copy: ImportItemItem = {
    itemId: original.itemId + '_copy',  // Append _copy to make it a new group
    quality: original.quality,
    ethereal: original.ethereal,
    sockets: original.sockets,
    mode: original.mode,
    showInfo: original.showInfo,
    unused: original.unused,
    statGroup: original.statGroup,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'importItems', copy)
  refreshEffectiveStatus(config.value)
}

function duplicateItemToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index)
  if (!original || !isItemExtern(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getImportItemKey(original)
  const allItems = getAllItems<ImportItemItem>(config.value, 'importItems')
  const hasMainItem = allItems.some(item => getImportItemKey(item) === key && item.sourceFile === null)
  if (hasMainItem) return false

  // Add new main item
  const newItem: ImportItemItem = {
    itemId: original.itemId,
    quality: original.quality,
    ethereal: original.ethereal,
    sockets: original.sockets,
    mode: original.mode,
    showInfo: original.showInfo,
    unused: original.unused,
    statGroup: original.statGroup,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'importItems', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => importItems.value, newItem, getImportItemKey, '.import-items-list')
  }
  return true
}

// Selection functions
function toggleSelectAll() {
  const items = importItems.value
  const selectableItems = items.filter(item => !isItemExtern(item))

  if (selectedItems.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedItems.value.clear()
  } else {
    selectedItems.value = new Set(selectableItems)
  }
}

function toggleSelect(item: ImportItemItem) {
  if (selectedItems.value.has(item)) {
    selectedItems.value.delete(item)
  } else {
    selectedItems.value.add(item)
  }
  selectedItems.value = new Set(selectedItems.value)
}

function isSelected(item: ImportItemItem) {
  return selectedItems.value.has(item)
}

function hasSelection() {
  return selectedItems.value.size > 0
}

// Batch operations
function batchDelete(): void {
  if (isReadOnly.value || !config.value) return

  // Delete selected items directly
  for (const item of selectedItems.value) {
    if (!isItemExtern(item)) {
      deleteItemFromFile(config.value, item, 'importItems')
    }
  }
  selectedItems.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchComment() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedItems.value) {
    if (!isItemExtern(item)) {
      item.isCommented = true
      item.isDeleted = false
    }
  }
  selectedItems.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestore() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedItems.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedItems.value.clear()
  refreshEffectiveStatus(config.value)
}

// Check if there are extern items
function hasExternItems() {
  return importItems.value.some(item => isItemExtern(item))
}

// Copy all extern items - use skipRefresh to avoid index shifting during batch
function copyAllExtern() {
  if (!config.value || isReadOnly.value) return

  // Collect extern indices first (snapshot)
  const externIndices: number[] = []
  importItems.value.forEach((item, index) => {
    if (isItemExtern(item)) externIndices.push(index)
  })

  let copied = 0
  for (const index of externIndices) {
    if (duplicateItemToMain(index, true)) copied++
  }

  // Refresh once after all copies
  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

// Drag and drop
function handleDragStart(e: DragEvent, index: number) {
  log(`[ImportItem handleDragStart] index=${index}`)
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function handleDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

function handleDragLeave() {
  dragOverIndex.value = null
}

function handleDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  log(`[ImportItem handleDrop] START: sourceIndex=${dragIndex.value}, targetIndex=${targetIndex}`)

  if (isReadOnly.value || !config.value) {
    log(`[ImportItem handleDrop] ABORT: isReadOnly=${isReadOnly.value}, config=${!!config.value}`)
    return
  }
  const sourceIndex = dragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    log(`[ImportItem handleDrop] ABORT: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`)
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }

  const item = getItemAtIndex(sourceIndex)
  if (!item) {
    log(`[ImportItem handleDrop] ABORT: item not found at sourceIndex=${sourceIndex}`)
    return
  }

  let targetMergedIdx = getMergedIndex(targetIndex)
  log(`[ImportItem handleDrop] targetMergedIdx=${targetMergedIdx}`)
  if (targetMergedIdx < 0) {
    log(`[ImportItem handleDrop] ABORT: targetMergedIdx < 0`)
    return
  }

  // When dragging down, insert AFTER the target item
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
    log(`[ImportItem handleDrop] drag-down: adjusted targetMergedIdx=${targetMergedIdx}`)
  }

  log(`[ImportItem handleDrop] calling moveItemInFile: targetMergedIdx=${targetMergedIdx}`)

  // Move item within its file
  const result = moveItemInFile(config.value, item, targetMergedIdx, 'importItems')
  log(`[ImportItem handleDrop] moveItemInFile returned: ${result}`)

  refreshEffectiveStatus(config.value)

  dragIndex.value = null
  dragOverIndex.value = null
}

function handleDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

// Get row classes
function getRowClasses(item: ImportItemItem, index: number) {
  return {
    ...getItemRowClasses(item),
    'row-dragover': dragOverIndex.value === index
  }
}

// Debug panel formatter
function formatImportItem(item: ImportItemItem): string {
  return `${item.itemId}|${item.quality}|${item.ethereal}|${item.sockets} → mode:${item.mode}${item.statGroup ? `, stat:${item.statGroup}` : ''}`
}

// Debug panel data (typed computed to avoid template type inference issues)
const debugImportItems = computed((): ImportItemItem[] => {
  return getAllItems<ImportItemItem>(config.value, 'importItems')
})
</script>

<template>
  <div class="import-item-editor">
    <EditorPanel>
      <template #tabs>
        <SubTabs :tabs="subTabsConfig" model-value="importItems" />
      </template>
      <template #batch-bar>
        <div v-if="hasSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedItems.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestore">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchComment">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDelete">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-primary btn-small" @click="addItem">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="importItems"
        :columns="importItemColumns"
        :empty-text="t('import.empty')"
        list-class="import-items-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="isAllSelected"
        :is-read-only="isReadOnly"
        :is-selected="isSelected"
        :is-disabled="isImportRowDisabled"
        :drag-over-index="dragOverIndex"
        :row-classes="getItemRowClasses"
        @select-all="toggleSelectAll"
        @select="toggleSelect"
        @dragstart="handleDragStart"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        @dragend="handleDragEnd"
      >
        <template #cell-itemId="{ item, index }">
          <ItemPicker
            :modelValue="item.itemId"
            :placeholder="t('itemColors.itemId')"
            :disabled="isReadOnly"
            :readonly="isReadonlyImportItem(item)"
            @update:modelValue="updateItem(index, 'itemId', $event)"
          />
        </template>
        <template #cell-quality="{ item, index }">
          <QualityPicker
            :modelValue="item.quality"
            :disabled="isReadOnly"
            :readonly="isReadonlyImportItem(item)"
            @update:modelValue="updateItem(index, 'quality', $event)"
          />
        </template>
        <template #cell-mode="{ item, index }">
          <select
            :value="item.mode"
            :disabled="isReadonlyImportItem(item)"
            @change="updateItem(index, 'mode', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="m in PICKUP_MODES" :key="m.value" :value="m.value">
              [{{ m.value }}] {{ t(m.labelKey) }}
            </option>
          </select>
        </template>
        <template #cell-statGroup="{ item, index }">
          <StatGroupPicker
            :modelValue="item.statGroup"
            :disabled="isReadOnly"
            :readonly="isReadonlyImportItem(item)"
            @update:modelValue="updateItem(index, 'statGroup', $event)"
          />
        </template>
        <template #cell-comment="{ item, index }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="item.comment"
            :readonly="isReadonlyImportItem(item)"
            :disabled="isReadOnly"
            @input="updateItem(index, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item, index }">
          <template v-if="isItemExtern(item)">
              <button
                v-if="getItemJumpTarget(item) !== undefined"
                class="btn btn-small btn-warning"
                @click="jumpToImportItem(getItemJumpTarget(item)!)"
                :title="t('action.jumpToMain')"
              >→</button>
              <button v-if="!isReadOnly && getItemJumpTarget(item) === undefined" class="btn btn-small btn-accent" @click="duplicateItemToMain(index)" :title="t('action.copyToMain')">
                +
              </button>
              <span class="status-tag tag-extern" :title="item.sourceFile ?? undefined">{{ item.sourceFile }}</span>
            </template>
            <template v-else-if="item.isCommented || item.isDeleted">
              <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestore(index)" :title="t('action.restore')">
                ↩
              </button>
              <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
              <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
            </template>
            <template v-else-if="!isReadOnly">
              <button class="btn btn-small btn-secondary" @click="copyItem(index)" :title="t('action.copy')">
                ⧉
              </button>
              <button class="btn btn-small btn-secondary" @click="handleComment(index)" :title="t('action.comment')">
                //
              </button>
              <button class="btn btn-small btn-danger" @click="handleDelete(index)" :title="t('action.delete')">
                ×
              </button>
            </template>
        </template>
      </ConfigTable>
    </EditorPanel>

    <!-- Debug Panel -->
    <DebugDrawer v-if="debugMode && debugImportItems.length">
      <FlatListView
        :items="debugImportItems"
        title="Import Items"
        :get-key="getImportItemKey"
        :format-item="formatImportItem"
      />
    </DebugDrawer>
  </div>
</template>

<style scoped>
.item-list {
  max-height: calc(70vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
}

.col-comment {
  flex: 1;
  min-width: 60px;
  max-width: 200px;
}

.comment-input {
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  padding: 2px 4px;
  width: 100%;
}

.comment-input:focus {
  border-color: var(--border-color);
  background: var(--bg-primary);
  outline: none;
}

.comment-input:disabled {
  opacity: 0.6;
}

/* Select hover highlight */
select:hover:not(:disabled) {
  border-color: var(--accent-color);
}
</style>
