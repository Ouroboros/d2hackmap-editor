<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useFileStorage } from '../composables/useFileStorage'
import {
  useItemActions,
  refreshEffectiveStatus,
  getItemColorKey,
  getRuneColorKey,
  getGoldColorKey,
  getAllItems,
  getEditableFile,
  addItemToEditable,
  deleteItemFromFile,
  buildCommentedMainMap,
  getJumpTargetIndex,
  scrollToIndex,
  scrollToMainItemInList
} from '../composables/useItemActions'
import { moveItemInFile } from '../utils/grouping'
import { useReferenceData } from '../composables/useReferenceData'
import { useI18n } from '../i18n'
import { useDebugMode } from '../composables/useDebugMode'
import { IdRange } from '../utils/IdRange'
import { log } from '../utils/log'
import { COLOR_NONE } from '../configDefs'
import type { ItemColorItem, RuneColorItem, GoldColorItem } from '../types'
import DebugDrawer from './debug/DebugDrawer.vue'
import FlatListView from './debug/FlatListView.vue'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigHeader from './ConfigHeader.vue'
import ConfigRow from './ConfigRow.vue'
import ItemPicker from './ItemPicker.vue'
import RunePicker from './RunePicker.vue'
import MapColorPicker from './MapColorPicker.vue'
import TextColorPicker from './TextColorPicker.vue'
import QualityPicker from './QualityPicker.vue'

const { t } = useI18n()

// Tab type constants
const TAB_ITEMS = 'items' as const
const TAB_RUNES = 'runes' as const
const TAB_GOLDS = 'golds' as const

type TabType = typeof TAB_ITEMS | typeof TAB_RUNES | typeof TAB_GOLDS

interface Props {
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
})

const { config, exportSection, isReadOnly } = useConfig()
const { debugMode } = useDebugMode()
const { saveSubTab, loadSubTab } = useFileStorage()
const { isItemDisabled, isItemExtern, getItemRowClasses } = useItemActions()
const { itemsMap } = useReferenceData()

const activeTab = ref<TabType>(TAB_ITEMS)

// Sub-tabs configuration
const subTabsConfig = computed(() => [
  { id: TAB_ITEMS, label: t('subTab.items') },
  { id: TAB_RUNES, label: t('subTab.runes') },
  { id: TAB_GOLDS, label: t('subTab.golds') }
])

// Selection state (store item references)
const selectedItems = ref<Set<ItemColorItem>>(new Set())
const selectedRunes = ref<Set<RuneColorItem>>(new Set())
const selectedGolds = ref<Set<GoldColorItem>>(new Set())

// Color filter state
const textColorFilter = ref<string>('')
const mapColorFilter = ref<string>('')

// Drag state
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// Watch and save sub-tab changes
watch(activeTab, (newTab) => {
  saveSubTab('itemColors', newTab)
  // Clear selections when switching tabs
  selectedItems.value.clear()
  selectedRunes.value.clear()
  selectedGolds.value.clear()
})

// Load saved sub-tab on mount
onMounted(() => {
  activeTab.value = loadSubTab('itemColors', TAB_ITEMS)
})

function handleExport(): void {
  exportSection('itemColors')
}

// Check for invalid item IDs
function hasInvalidIds(itemId: string): boolean {
  if (!itemId || !itemsMap.value || itemsMap.value.size === 0) return false
  const range = new IdRange(itemId)
  return range.hasInvalid(itemsMap.value)
}

// Get all items for building data
const itemColorsAll = computed(() => getAllItems<ItemColorItem>(config.value, 'itemColors'))
const runeColorsAll = computed(() => getAllItems<RuneColorItem>(config.value, 'runeColors'))
const goldColorsAll = computed(() => getAllItems<GoldColorItem>(config.value, 'goldColors'))

// Filter items for display: main items (all) + extern items (only effective)
function filterForDisplay<T extends { sourceFile: string | null; isEffective?: boolean }>(items: T[]): T[] {
  return items.filter(item => item.sourceFile === null || item.isEffective)
}

// Displayed items (filtered)
const itemColors = computed(() => {
  let items = filterForDisplay(itemColorsAll.value)
  if (!items.length) return []

  // Apply search filter
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.itemId.toLowerCase().includes(q) ||
      item.mapText?.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    )
  }

  // Apply color filters
  if (textColorFilter.value && textColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.textColor === textColorFilter.value)
  }
  if (mapColorFilter.value && mapColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.mapColor === mapColorFilter.value)
  }

  return items
})

const runeColors = computed(() => {
  let items = filterForDisplay(runeColorsAll.value)
  if (!items.length) return []

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.range.toLowerCase().includes(q) ||
      item.mapText?.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    )
  }

  // Apply color filters
  if (textColorFilter.value && textColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.textColor === textColorFilter.value)
  }
  if (mapColorFilter.value && mapColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.mapColor === mapColorFilter.value)
  }

  return items
})

const goldColors = computed(() => {
  let items = filterForDisplay(goldColorsAll.value)
  if (!items.length) return []

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.range.toLowerCase().includes(q) ||
      item.mapText?.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    )
  }

  // Apply color filters
  if (textColorFilter.value && textColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.textColor === textColorFilter.value)
  }
  if (mapColorFilter.value && mapColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.mapColor === mapColorFilter.value)
  }

  return items
})

// Build jump maps from DISPLAYED items (so indices match data-index)
const itemColorsJumpMap = computed(() => buildCommentedMainMap(itemColors.value, getItemColorKey))
const runeColorsJumpMap = computed(() => buildCommentedMainMap(runeColors.value, getRuneColorKey))
const goldColorsJumpMap = computed(() => buildCommentedMainMap(goldColors.value, getGoldColorKey))

// Get jump target for an item
function getItemJumpTarget(item: ItemColorItem): number | undefined {
  return getJumpTargetIndex(item, itemColorsJumpMap.value, getItemColorKey)
}
function getRuneJumpTarget(item: RuneColorItem): number | undefined {
  return getJumpTargetIndex(item, runeColorsJumpMap.value, getRuneColorKey)
}
function getGoldJumpTarget(item: GoldColorItem): number | undefined {
  return getJumpTargetIndex(item, goldColorsJumpMap.value, getGoldColorKey)
}

// Jump to index with container selector (to avoid conflicts between tabs)
function jumpToItemColor(index: number): void {
  scrollToIndex(index, '.items-color-list')
}
function jumpToRuneColor(index: number): void {
  scrollToIndex(index, '.runes-color-list')
}
function jumpToGoldColor(index: number): void {
  scrollToIndex(index, '.golds-color-list')
}

// Get merged display index for drag operations
function getMergedIndex(filteredIndex: number, type: 'items' | 'runes' | 'golds'): number {
  const items = type === 'golds' ? goldColors.value
    : type === 'runes' ? runeColors.value
    : itemColors.value

  if (filteredIndex < 0 || filteredIndex >= items.length) return -1

  const allItems = type === 'golds' ? getAllItems<GoldColorItem>(config.value, 'goldColors')
    : type === 'runes' ? getAllItems<RuneColorItem>(config.value, 'runeColors')
    : getAllItems<ItemColorItem>(config.value, 'itemColors')

  const targetItem = items[filteredIndex]
  return allItems.indexOf(targetItem)
}

// Get the effective item at filtered index
function getItemAtIndex(filteredIndex: number, type: 'items' | 'runes' | 'golds') {
  const items = type === 'golds' ? goldColors.value
    : type === 'runes' ? runeColors.value
    : itemColors.value
  return items[filteredIndex]
}

// Calculate dynamic width for mapText column based on longest text
const itemMapTextWidth = computed(() => {
  const items = getAllItems<ItemColorItem>(config.value, 'itemColors')
  if (!items.length) return 120
  const maxLen = Math.max(0, ...items.map(item => (item.mapText || '').length))
  return Math.max(120, maxLen * 8 + 24)
})

const runeMapTextWidth = computed(() => {
  const items = getAllItems<RuneColorItem>(config.value, 'runeColors')
  if (!items.length) return 120
  const maxLen = Math.max(0, ...items.map(item => (item.mapText || '').length))
  return Math.max(120, maxLen * 8 + 24)
})

const goldMapTextWidth = computed(() => {
  const items = getAllItems<GoldColorItem>(config.value, 'goldColors')
  if (!items.length) return 120
  const maxLen = Math.max(0, ...items.map(item => (item.mapText || '').length))
  return Math.max(120, maxLen * 8 + 24)
})

// Selectable counts (non-extern items only)
const selectableItemsCount = computed(() => itemColors.value.filter(item => !isItemExtern(item)).length)
const selectableRunesCount = computed(() => runeColors.value.filter(item => !isItemExtern(item)).length)
const selectableGoldsCount = computed(() => goldColors.value.filter(item => !isItemExtern(item)).length)

// Selection helpers
function getSelectedSet(tabType) {
  return tabType === TAB_GOLDS ? selectedGolds
    : tabType === TAB_RUNES ? selectedRunes
    : selectedItems
}

// Selection functions
function toggleSelectAll(tabType) {
  const items = tabType === TAB_GOLDS ? goldColors.value
    : tabType === TAB_RUNES ? runeColors.value
    : itemColors.value
  const selected = getSelectedSet(tabType)

  // Only select non-extern items
  const selectableItems = items.filter(item => !isItemExtern(item))

  if (selected.value.size === selectableItems.length && selectableItems.length > 0) {
    selected.value.clear()
  } else {
    selected.value = new Set(selectableItems)
  }
}

function toggleSelect(item, tabType) {
  const selected = getSelectedSet(tabType)
  if (selected.value.has(item)) {
    selected.value.delete(item)
  } else {
    selected.value.add(item)
  }
  // Trigger reactivity
  selected.value = new Set(selected.value)
}

function isSelected(item, tabType) {
  const selected = getSelectedSet(tabType)
  return selected.value.has(item)
}

function hasSelection(tabType) {
  return getSelectedSet(tabType).value.size > 0
}

function getArrayNameByTab(tabType: TabType): 'itemColors' | 'runeColors' | 'goldColors' {
  if (tabType === TAB_GOLDS) return 'goldColors'
  if (tabType === TAB_RUNES) return 'runeColors'
  return 'itemColors'
}

// Batch operations
function batchSetTextColor(color, tabType) {
  if (isReadOnly.value) return
  const selected = getSelectedSet(tabType)

  for (const item of selected.value) {
    if (!isItemExtern(item)) {
      item.textColor = color
    }
  }
  selected.value.clear()
}

function batchSetMapColor(color, tabType) {
  if (isReadOnly.value) return
  const selected = getSelectedSet(tabType)

  for (const item of selected.value) {
    if (!isItemExtern(item)) {
      item.mapColor = color
    }
  }
  selected.value.clear()
}

function batchDelete(tabType: TabType) {
  if (isReadOnly.value || !config.value) return
  const selected = getSelectedSet(tabType)
  const arrayName = getArrayNameByTab(tabType)

  // Delete selected items directly
  for (const item of selected.value) {
    if (!isItemExtern(item)) {
      deleteItemFromFile(config.value, item, arrayName)
    }
  }
  selected.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchComment(tabType) {
  if (isReadOnly.value || !config.value) return
  const selected = getSelectedSet(tabType)

  for (const item of selected.value) {
    if (!isItemExtern(item)) {
      item.isCommented = true
      item.isDeleted = false
    }
  }
  selected.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestore(tabType) {
  if (isReadOnly.value || !config.value) return
  const selected = getSelectedSet(tabType)

  for (const item of selected.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selected.value.clear()
  refreshEffectiveStatus(config.value)
}

// Copy row - creates a new item with same content
function copyItemColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const original = getItemAtIndex(index, 'items')
  if (!original) return

  const copy: ItemColorItem = {
    itemId: original.itemId + '_copy',  // Append _copy to make it a new group
    quality: original.quality,
    ethereal: original.ethereal,
    sockets: original.sockets,
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'itemColors', copy)
  refreshEffectiveStatus(config.value)
}

function copyRuneColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const original = getItemAtIndex(index, 'runes')
  if (!original) return

  const copy: RuneColorItem = {
    range: original.range + '_copy',  // Append _copy to make it a new group
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'runeColors', copy)
  refreshEffectiveStatus(config.value)
}

// Check if there are extern items in current tab
function hasExternItems(tabType) {
  const items = tabType === TAB_GOLDS ? goldColors.value
    : tabType === TAB_RUNES ? runeColors.value
    : itemColors.value
  return items.some(item => isItemExtern(item))
}

// Copy all extern items - use skipRefresh to avoid index shifting during batch
function copyAllExtern(tabType) {
  if (!config.value || isReadOnly.value) return

  const items = tabType === TAB_GOLDS ? goldColors.value
    : tabType === TAB_RUNES ? runeColors.value
    : itemColors.value

  // Collect extern indices first (snapshot)
  const externIndices: number[] = []
  items.forEach((item, index) => {
    if (isItemExtern(item)) externIndices.push(index)
  })

  let copied = 0
  for (const index of externIndices) {
    let success = false
    if (tabType === TAB_GOLDS) {
      success = duplicateGoldColorToMain(index, true)
    } else if (tabType === TAB_RUNES) {
      success = duplicateRuneColorToMain(index, true)
    } else {
      success = duplicateItemColorToMain(index, true)
    }
    if (success) copied++
  }

  // Refresh once after all copies
  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

// Drag and drop
function handleDragStart(e, index, isRune = false) {
  log(`[handleDragStart] index=${index}, isRune=${isRune}`)
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', index)
}

function handleDragOver(e, index) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function handleDragLeave() {
  dragOverIndex.value = null
}

function handleDrop(e, targetIndex, isRune = false) {
  e.preventDefault()
  const type = isRune ? 'runes' : 'items'
  log(`[handleDrop] START: sourceIndex=${dragIndex.value}, targetIndex=${targetIndex}, type=${type}`)

  if (isReadOnly.value || !config.value) {
    log(`[handleDrop] ABORT: isReadOnly=${isReadOnly.value}, config=${!!config.value}`)
    return
  }
  const sourceIndex = dragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    log(`[handleDrop] ABORT: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`)
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }

  const item = getItemAtIndex(sourceIndex, type)
  if (!item) {
    log(`[handleDrop] ABORT: item not found at sourceIndex=${sourceIndex}`)
    return
  }

  let targetMergedIdx = getMergedIndex(targetIndex, type)
  log(`[handleDrop] targetMergedIdx=${targetMergedIdx}`)
  if (targetMergedIdx < 0) {
    log(`[handleDrop] ABORT: targetMergedIdx < 0`)
    return
  }

  // When dragging down, insert AFTER the target item
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
    log(`[handleDrop] drag-down: adjusted targetMergedIdx=${targetMergedIdx}`)
  }

  const arrayName = isRune ? 'runeColors' : 'itemColors'
  log(`[handleDrop] calling moveItemInFile: arrayName=${arrayName}, targetMergedIdx=${targetMergedIdx}`)

  // Move item within its file
  const result = moveItemInFile(config.value, item, targetMergedIdx, arrayName)
  log(`[handleDrop] moveItemInFile returned: ${result}`)

  // Refresh effective status after reorder
  refreshEffectiveStatus(config.value)

  dragIndex.value = null
  dragOverIndex.value = null
}

function handleDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

function isReadonlyColorItem(item: ItemColorItem | RuneColorItem | GoldColorItem): boolean {
  return isReadOnly.value || isItemDisabled(item) || isItemExtern(item)
}

function updateItemColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, 'items')
  if (!item || isReadonlyColorItem(item)) return
  if (item) {
    (item as Record<string, unknown>)[field] = value
  }
}

function addItemColor() {
  if (!config.value || isReadOnly.value) return
  const newItem: ItemColorItem = {
    itemId: '',
    quality: '',
    ethereal: '',
    sockets: '',
    textColor: COLOR_NONE,
    mapColor: COLOR_NONE,
    mapText: '',
    comment: '',
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'itemColors', newItem)
  refreshEffectiveStatus(config.value)
}

function handleDeleteItemColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'items')
  if (!item || isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'itemColors')
  refreshEffectiveStatus(config.value)
}

function handleCommentItemColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'items')
  if (!item || isItemExtern(item)) return

  item.isCommented = true
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function handleRestoreItemColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'items')
  if (!item || isItemExtern(item)) return

  item.isCommented = false
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

// Rune Colors functions
function addRuneColor() {
  if (!config.value || isReadOnly.value) return
  const newItem: RuneColorItem = {
    range: '',
    textColor: COLOR_NONE,
    mapColor: COLOR_NONE,
    mapText: '',
    comment: '',
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'runeColors', newItem)
  refreshEffectiveStatus(config.value)
}

function updateRuneColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, 'runes')
  if (!item || isReadonlyColorItem(item)) return
  if (item) {
    (item as Record<string, unknown>)[field] = value
  }
}

function handleDeleteRuneColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'runes')
  if (!item || isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'runeColors')
  refreshEffectiveStatus(config.value)
}

function handleCommentRuneColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'runes')
  if (!item || isItemExtern(item)) return

  item.isCommented = true
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function handleRestoreRuneColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'runes')
  if (!item || isItemExtern(item)) return

  item.isCommented = false
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function duplicateItemColorToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index, 'items')
  if (!original || !isItemExtern(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getItemColorKey(original)
  const allItems = getAllItems<ItemColorItem>(config.value, 'itemColors')
  const hasMainItem = allItems.some(item => getItemColorKey(item) === key && item.sourceFile === null)
  if (hasMainItem) return false

  // Add new main item
  const newItem: ItemColorItem = {
    itemId: original.itemId,
    quality: original.quality,
    ethereal: original.ethereal,
    sockets: original.sockets,
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'itemColors', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => itemColors.value, newItem, getItemColorKey, '.items-color-list')
  }
  return true
}

function duplicateRuneColorToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index, 'runes')
  if (!original || !isItemExtern(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getRuneColorKey(original)
  const allItems = getAllItems<RuneColorItem>(config.value, 'runeColors')
  const hasMainItem = allItems.some(item => getRuneColorKey(item) === key && item.sourceFile === null)
  if (hasMainItem) return false

  // Add new main item
  const newItem: RuneColorItem = {
    range: original.range,
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'runeColors', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => runeColors.value, newItem, getRuneColorKey, '.runes-color-list')
  }
  return true
}

// Gold Colors functions
function addGoldColor() {
  if (!config.value || isReadOnly.value) return
  const newItem: GoldColorItem = {
    range: '',
    textColor: COLOR_NONE,
    mapColor: COLOR_NONE,
    mapText: '',
    comment: '',
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'goldColors', newItem)
  refreshEffectiveStatus(config.value)
}

function updateGoldColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, 'golds')
  if (!item || isReadonlyColorItem(item)) return
  if (item) {
    (item as Record<string, unknown>)[field] = value
  }
}

function handleDeleteGoldColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'golds')
  if (!item || isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'goldColors')
  refreshEffectiveStatus(config.value)
}

function handleCommentGoldColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'golds')
  if (!item || isItemExtern(item)) return

  item.isCommented = true
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function handleRestoreGoldColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, 'golds')
  if (!item || isItemExtern(item)) return

  item.isCommented = false
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function copyGoldColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const original = getItemAtIndex(index, 'golds')
  if (!original) return

  const copy: GoldColorItem = {
    range: original.range + '_copy',  // Append _copy to make it a new group
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'goldColors', copy)
  refreshEffectiveStatus(config.value)
}

function duplicateGoldColorToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index, 'golds')
  if (!original || !isItemExtern(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getGoldColorKey(original)
  const allItems = getAllItems<GoldColorItem>(config.value, 'goldColors')
  const hasMainItem = allItems.some(item => getGoldColorKey(item) === key && item.sourceFile === null)
  if (hasMainItem) return false

  // Add new main item
  const newItem: GoldColorItem = {
    range: original.range,
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'goldColors', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => goldColors.value, newItem, getGoldColorKey, '.golds-color-list')
  }
  return true
}

// Gold drag and drop
function handleDragStartGold(e, index) {
  log(`[handleDragStartGold] index=${index}`)
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', index)
}

function handleDropGold(e, targetIndex) {
  e.preventDefault()
  log(`[handleDropGold] START: sourceIndex=${dragIndex.value}, targetIndex=${targetIndex}`)

  if (isReadOnly.value || !config.value) {
    log(`[handleDropGold] ABORT: isReadOnly=${isReadOnly.value}, config=${!!config.value}`)
    return
  }
  const sourceIndex = dragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    log(`[handleDropGold] ABORT: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`)
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }

  const item = getItemAtIndex(sourceIndex, 'golds')
  if (!item) {
    log(`[handleDropGold] ABORT: item not found at sourceIndex=${sourceIndex}`)
    return
  }

  let targetMergedIdx = getMergedIndex(targetIndex, 'golds')
  log(`[handleDropGold] targetMergedIdx=${targetMergedIdx}`)
  if (targetMergedIdx < 0) {
    log(`[handleDropGold] ABORT: targetMergedIdx < 0`)
    return
  }

  // When dragging down, insert AFTER the target item
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
    log(`[handleDropGold] drag-down: adjusted targetMergedIdx=${targetMergedIdx}`)
  }

  log(`[handleDropGold] calling moveItemInFile: targetMergedIdx=${targetMergedIdx}`)

  // Move item within its file
  const result = moveItemInFile(config.value, item, targetMergedIdx, 'goldColors')
  log(`[handleDropGold] moveItemInFile returned: ${result}`)

  // Refresh effective status after reorder
  refreshEffectiveStatus(config.value)

  dragIndex.value = null
  dragOverIndex.value = null
}

function clearFilters() {
  textColorFilter.value = ''
  mapColorFilter.value = ''
}

// Debug panel formatters
function formatItemColor(item: ItemColorItem): string {
  return `${item.itemId}|${item.quality}|${item.ethereal}|${item.sockets} → text:${item.textColor}, map:${item.mapColor}`
}

function formatRuneColor(item: RuneColorItem): string {
  return `${item.range} → text:${item.textColor}, map:${item.mapColor}`
}

function formatGoldColor(item: GoldColorItem): string {
  return `${item.range} → text:${item.textColor}, map:${item.mapColor}`
}

// Get current items for debug panel based on active tab
const currentDebugItems = computed(() => {
  if (activeTab.value === TAB_GOLDS) return getAllItems<GoldColorItem>(config.value, 'goldColors')
  if (activeTab.value === TAB_RUNES) return getAllItems<RuneColorItem>(config.value, 'runeColors')
  return getAllItems<ItemColorItem>(config.value, 'itemColors')
})

const currentDebugTitle = computed(() => {
  if (activeTab.value === TAB_GOLDS) return 'Gold Colors'
  if (activeTab.value === TAB_RUNES) return 'Rune Colors'
  return 'Item Colors'
})

const currentDebugGetKey = computed(() => {
  if (activeTab.value === TAB_GOLDS) return getGoldColorKey
  if (activeTab.value === TAB_RUNES) return getRuneColorKey
  return getItemColorKey
})

const currentFormatter = computed(() => {
  if (activeTab.value === TAB_GOLDS) return formatGoldColor
  if (activeTab.value === TAB_RUNES) return formatRuneColor
  return formatItemColor
})
</script>

<template>
  <div class="item-color-editor">
    <EditorPanel>
      <template #tabs>
        <SubTabs v-model="activeTab" :tabs="subTabsConfig" />
      </template>
      <template #batch-bar>
        <div v-if="hasSelection(activeTab) && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: getSelectedSet(activeTab).value.size }) }}</span>
          <TextColorPicker
            :modelValue="COLOR_NONE"
            @update:modelValue="batchSetTextColor($event, activeTab)"
          />
          <MapColorPicker
            :modelValue="COLOR_NONE"
            @update:modelValue="batchSetMapColor($event, activeTab)"
          />
          <button class="btn btn-small btn-primary" @click="batchRestore(activeTab)">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchComment(activeTab)">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDelete(activeTab)">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasExternItems(activeTab) && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllExtern(activeTab)"
        >{{ t('batch.copyAllExtern') }}</button>
        <!-- Color Filters -->
        <div class="filter-group">
          <span class="filter-label">{{ t('itemColors.filterTextColor') }}:</span>
          <TextColorPicker
            :modelValue="textColorFilter"
            @update:modelValue="textColorFilter = $event"
          />
          <button v-if="textColorFilter && textColorFilter !== '' && textColorFilter !== COLOR_NONE" class="btn btn-small btn-secondary" @click="textColorFilter = ''">×</button>
        </div>
        <div class="filter-group">
          <span class="filter-label">{{ t('itemColors.filterMapColor') }}:</span>
          <MapColorPicker
            :modelValue="mapColorFilter"
            @update:modelValue="mapColorFilter = $event"
          />
          <button v-if="mapColorFilter && mapColorFilter !== COLOR_NONE" class="btn btn-small btn-secondary" @click="mapColorFilter = ''">×</button>
        </div>
        <button v-if="(textColorFilter && textColorFilter !== COLOR_NONE) || (mapColorFilter && mapColorFilter !== COLOR_NONE)" class="btn btn-small btn-secondary" @click="clearFilters">
          {{ t('search.clear') }}
        </button>
        <button v-if="activeTab === TAB_ITEMS && !isReadOnly" class="btn btn-primary btn-small" @click="addItemColor">{{ t('btn.add') }}</button>
        <button v-if="activeTab === TAB_RUNES && !isReadOnly" class="btn btn-primary btn-small" @click="addRuneColor">{{ t('btn.add') }}</button>
        <button v-if="activeTab === TAB_GOLDS && !isReadOnly" class="btn btn-primary btn-small" @click="addGoldColor">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <!-- Item Colors Tab -->
      <div v-show="activeTab === TAB_ITEMS" class="tab-content">
        <div v-if="itemColors.length === 0" class="empty-state">
          <p>{{ t('itemColors.empty') }}</p>
        </div>

        <div v-else class="color-list items-color-list">
          <!-- Header -->
          <ConfigHeader
            :show-checkbox="true"
            :show-index="true"
            :show-drag="true"
            :is-all-selected="selectedItems.size === selectableItemsCount && selectableItemsCount > 0"
            :is-read-only="isReadOnly"
            @select-all="toggleSelectAll(TAB_ITEMS)"
          >
            <span style="width: 150px;">{{ t('itemColors.itemId') }}</span>
            <span style="width: 80px;">{{ t('itemColors.quality') }}</span>
            <span style="width: 32px;">{{ t('itemColors.textColor') }}</span>
            <span style="width: 32px;">{{ t('itemColors.mapColor') }}</span>
            <span :style="{ width: itemMapTextWidth + 'px' }">{{ t('itemColors.mapText') }}</span>
            <span class="col-comment">{{ t('itemColors.comment') }}</span>
            <span class="col-actions">{{ t('itemColors.actions') }}</span>
          </ConfigHeader>
          <!-- Rows -->
          <ConfigRow
            v-for="(item, index) in itemColors"
            :key="index"
            :item="item"
            :index="index"
            :show-checkbox="true"
            :show-index="true"
            :show-drag="true"
            :is-selected="isSelected(item, TAB_ITEMS)"
            :is-disabled="isItemDisabled(item) || isItemExtern(item)"
            :is-drag-over="dragOverIndex === index"
            :is-read-only="isReadOnly"
            :row-classes="getItemRowClasses(item)"
            @select="toggleSelect(item, TAB_ITEMS)"
            @dragstart="handleDragStart($event, index, false)"
            @dragover="handleDragOver($event, index)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, index, false)"
            @dragend="handleDragEnd"
          >
            <ItemPicker
              :modelValue="item.itemId"
              :placeholder="t('itemColors.itemId')"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              :class="{ 'has-warning': hasInvalidIds(item.itemId) }"
              @update:modelValue="updateItemColor(index, 'itemId', $event)"
              style="width: 150px;"
            />
            <QualityPicker
              :modelValue="item.quality"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateItemColor(index, 'quality', $event)"
              style="width: 80px;"
            />
            <TextColorPicker
              :modelValue="item.textColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateItemColor(index, 'textColor', $event)"
            />
            <MapColorPicker
              :modelValue="item.mapColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateItemColor(index, 'mapColor', $event)"
            />
            <input
              type="text"
              :value="item.mapText"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateItemColor(index, 'mapText', $event.target.value)"
              :style="{ width: itemMapTextWidth + 'px' }"
            />
            <input
              type="text"
              class="col-comment comment-input"
              :placeholder="t('itemColors.comment')"
              :value="item.comment"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateItemColor(index, 'comment', $event.target.value)"
            />

            <template #actions>
              <template v-if="isItemExtern(item)">
                <button
                  v-if="getItemJumpTarget(item) !== undefined"
                  class="btn btn-small btn-warning"
                  @click="jumpToItemColor(getItemJumpTarget(item)!)"
                  :title="t('action.jumpToMain')"
                >→</button>
                <button v-if="!isReadOnly && getItemJumpTarget(item) === undefined" class="btn btn-small btn-accent" @click="duplicateItemColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
                <span class="status-tag tag-extern" :title="item.sourceFile">{{ item.sourceFile }}</span>
              </template>
              <template v-else-if="item.isCommented || item.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreItemColor(index)" :title="t('action.restore')">
                  ↩
                </button>
                <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button class="btn btn-small btn-secondary" @click="copyItemColor(index)" :title="t('action.copy')">
                  ⧉
                </button>
                <button class="btn btn-small btn-secondary" @click="handleCommentItemColor(index)" :title="t('action.comment')">
                  //
                </button>
                <button class="btn btn-small btn-danger" @click="handleDeleteItemColor(index)" :title="t('action.delete')">
                  ×
                </button>
              </template>
            </template>
          </ConfigRow>
        </div>
      </div>

      <!-- Rune Colors Tab -->
      <div v-show="activeTab === TAB_RUNES" class="tab-content">
        <div v-if="runeColors.length === 0" class="empty-state">
          <p>{{ t('itemColors.runeEmpty') }}</p>
        </div>

        <div v-else class="color-list runes-color-list">
          <!-- Header -->
          <ConfigHeader
            :show-checkbox="true"
            :show-index="true"
            :show-drag="true"
            :is-all-selected="selectedRunes.size === selectableRunesCount && selectableRunesCount > 0"
            :is-read-only="isReadOnly"
            @select-all="toggleSelectAll(TAB_RUNES)"
          >
            <span style="width: 120px;">{{ t('itemColors.runeRange') }}</span>
            <span style="width: 32px;">{{ t('itemColors.textColor') }}</span>
            <span style="width: 32px;">{{ t('itemColors.mapColor') }}</span>
            <span :style="{ width: runeMapTextWidth + 'px' }">{{ t('itemColors.mapText') }}</span>
            <span class="col-comment">{{ t('itemColors.comment') }}</span>
            <span class="col-actions">{{ t('itemColors.actions') }}</span>
          </ConfigHeader>
          <!-- Rows -->
          <ConfigRow
            v-for="(rune, index) in runeColors"
            :key="index"
            :item="rune"
            :index="index"
            :show-checkbox="true"
            :show-index="true"
            :show-drag="true"
            :is-selected="isSelected(rune, TAB_RUNES)"
            :is-disabled="isItemDisabled(rune) || isItemExtern(rune)"
            :is-drag-over="dragOverIndex === index"
            :is-read-only="isReadOnly"
            :row-classes="getItemRowClasses(rune)"
            @select="toggleSelect(rune, TAB_RUNES)"
            @dragstart="handleDragStart($event, index, true)"
            @dragover="handleDragOver($event, index)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, index, true)"
            @dragend="handleDragEnd"
          >
            <RunePicker
              :modelValue="rune.range"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(rune)"
              @update:modelValue="updateRuneColor(index, 'range', $event)"
              style="width: 120px;"
            />
            <TextColorPicker
              :modelValue="rune.textColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(rune)"
              @update:modelValue="updateRuneColor(index, 'textColor', $event)"
            />
            <MapColorPicker
              :modelValue="rune.mapColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(rune)"
              @update:modelValue="updateRuneColor(index, 'mapColor', $event)"
            />
            <input
              type="text"
              :value="rune.mapText"
              :readonly="isReadonlyColorItem(rune)"
              :disabled="isReadOnly"
              @input="updateRuneColor(index, 'mapText', $event.target.value)"
              :style="{ width: runeMapTextWidth + 'px' }"
            />
            <input
              type="text"
              class="col-comment comment-input"
              :placeholder="t('itemColors.comment')"
              :value="rune.comment"
              :readonly="isReadonlyColorItem(rune)"
              :disabled="isReadOnly"
              @input="updateRuneColor(index, 'comment', $event.target.value)"
            />

            <template #actions>
              <template v-if="isItemExtern(rune)">
                <button
                  v-if="getRuneJumpTarget(rune) !== undefined"
                  class="btn btn-small btn-warning"
                  @click="jumpToRuneColor(getRuneJumpTarget(rune)!)"
                  :title="t('action.jumpToMain')"
                >→</button>
                <button v-if="!isReadOnly && getRuneJumpTarget(rune) === undefined" class="btn btn-small btn-accent" @click="duplicateRuneColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
                <span class="status-tag tag-extern" :title="rune.sourceFile">{{ rune.sourceFile }}</span>
              </template>
              <template v-else-if="rune.isCommented || rune.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreRuneColor(index)" :title="t('action.restore')">
                  ↩
                </button>
                <span v-if="rune.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="rune.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button class="btn btn-small btn-secondary" @click="copyRuneColor(index)" :title="t('action.copy')">
                  ⧉
                </button>
                <button class="btn btn-small btn-secondary" @click="handleCommentRuneColor(index)" :title="t('action.comment')">
                  //
                </button>
                <button class="btn btn-small btn-danger" @click="handleDeleteRuneColor(index)" :title="t('action.delete')">
                  ×
                </button>
              </template>
            </template>
          </ConfigRow>
        </div>
      </div>

      <!-- Gold Colors Tab -->
      <div v-show="activeTab === TAB_GOLDS" class="tab-content">
        <div v-if="goldColors.length === 0" class="empty-state">
          <p>{{ t('itemColors.goldEmpty') }}</p>
        </div>

        <div v-else class="color-list golds-color-list">
          <!-- Header -->
          <ConfigHeader
            :show-checkbox="true"
            :show-index="true"
            :show-drag="true"
            :is-all-selected="selectedGolds.size === selectableGoldsCount && selectableGoldsCount > 0"
            :is-read-only="isReadOnly"
            @select-all="toggleSelectAll(TAB_GOLDS)"
          >
            <span style="width: 120px;">{{ t('itemColors.goldRange') }}</span>
            <span style="width: 32px;">{{ t('itemColors.textColor') }}</span>
            <span style="width: 32px;">{{ t('itemColors.mapColor') }}</span>
            <span :style="{ width: goldMapTextWidth + 'px' }">{{ t('itemColors.mapText') }}</span>
            <span class="col-comment">{{ t('itemColors.comment') }}</span>
            <span class="col-actions">{{ t('itemColors.actions') }}</span>
          </ConfigHeader>
          <!-- Rows -->
          <ConfigRow
            v-for="(gold, index) in goldColors"
            :key="index"
            :item="gold"
            :index="index"
            :show-checkbox="true"
            :show-index="true"
            :show-drag="true"
            :is-selected="isSelected(gold, TAB_GOLDS)"
            :is-disabled="isItemDisabled(gold) || isItemExtern(gold)"
            :is-drag-over="dragOverIndex === index"
            :is-read-only="isReadOnly"
            :row-classes="getItemRowClasses(gold)"
            @select="toggleSelect(gold, TAB_GOLDS)"
            @dragstart="handleDragStartGold($event, index)"
            @dragover="handleDragOver($event, index)"
            @dragleave="handleDragLeave"
            @drop="handleDropGold($event, index)"
            @dragend="handleDragEnd"
          >
            <input
              type="text"
              :placeholder="t('itemColors.goldRange')"
              :value="gold.range"
              :readonly="isReadonlyColorItem(gold)"
              :disabled="isReadOnly"
              @input="updateGoldColor(index, 'range', $event.target.value)"
              style="width: 120px;"
            />
            <TextColorPicker
              :modelValue="gold.textColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(gold)"
              @update:modelValue="updateGoldColor(index, 'textColor', $event)"
            />
            <MapColorPicker
              :modelValue="gold.mapColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(gold)"
              @update:modelValue="updateGoldColor(index, 'mapColor', $event)"
            />
            <input
              type="text"
              :value="gold.mapText"
              :readonly="isReadonlyColorItem(gold)"
              :disabled="isReadOnly"
              @input="updateGoldColor(index, 'mapText', $event.target.value)"
              :style="{ width: goldMapTextWidth + 'px' }"
            />
            <input
              type="text"
              class="col-comment comment-input"
              :placeholder="t('itemColors.comment')"
              :value="gold.comment"
              :readonly="isReadonlyColorItem(gold)"
              :disabled="isReadOnly"
              @input="updateGoldColor(index, 'comment', $event.target.value)"
            />

            <template #actions>
              <template v-if="isItemExtern(gold)">
                <button
                  v-if="getGoldJumpTarget(gold) !== undefined"
                  class="btn btn-small btn-warning"
                  @click="jumpToGoldColor(getGoldJumpTarget(gold)!)"
                  :title="t('action.jumpToMain')"
                >→</button>
                <button v-if="!isReadOnly && getGoldJumpTarget(gold) === undefined" class="btn btn-small btn-accent" @click="duplicateGoldColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
                <span class="status-tag tag-extern" :title="gold.sourceFile">{{ gold.sourceFile }}</span>
              </template>
              <template v-else-if="gold.isCommented || gold.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreGoldColor(index)" :title="t('action.restore')">
                  ↩
                </button>
                <span v-if="gold.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="gold.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button class="btn btn-small btn-secondary" @click="copyGoldColor(index)" :title="t('action.copy')">
                  ⧉
                </button>
                <button class="btn btn-small btn-secondary" @click="handleCommentGoldColor(index)" :title="t('action.comment')">
                  //
                </button>
                <button class="btn btn-small btn-danger" @click="handleDeleteGoldColor(index)" :title="t('action.delete')">
                  ×
                </button>
              </template>
            </template>
          </ConfigRow>
        </div>
      </div>
    </EditorPanel>

    <!-- Debug Panel -->
    <DebugDrawer v-if="debugMode && currentDebugItems.length > 0">
      <FlatListView
        :items="currentDebugItems"
        :title="currentDebugTitle"
        :get-key="currentDebugGetKey"
        :format-item="currentFormatter"
      />
    </DebugDrawer>
  </div>
</template>

<style scoped>
.tab-content {
  margin-top: 12px;
}

.color-list {
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

.filter-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.has-warning {
  outline: 2px dashed var(--warning-color);
}
</style>
