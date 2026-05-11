<script setup lang="ts">
import { ref, computed, watch, onMounted, type Ref } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useFileStorage } from '../composables/useFileStorage'
import { useDisplayOrder } from '../composables/useDisplayOrder'
import {
  useItemActions,
  refreshEffectiveStatus,
  getItemColorKey,
  getRuneColorKey,
  getGoldColorKey,
  getMonsterColorKey,
  getSkillMissileDrawModeKey,
  getAllItems,
  canCopyItemToMain,
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
import { fitTextColumnWidth } from '../utils/columnWidth'
import { log } from '../utils/log'
import { COLOR_NONE, SKILL_MISSILE_DRAW_MODES } from '../configDefs'
import type { ItemColorItem, RuneColorItem, GoldColorItem, MonsterColorItem, SkillMissileDrawModeItem } from '../types'
import DebugDrawer from './debug/DebugDrawer.vue'
import FlatListView from './debug/FlatListView.vue'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigTable from './ConfigTable.vue'
import ItemPicker from './ItemPicker.vue'
import RunePicker from './RunePicker.vue'
import MapColorPicker from './MapColorPicker.vue'
import TextColorPicker from './TextColorPicker.vue'
import QualityPicker from './QualityPicker.vue'
import SkillPicker from './SkillPicker.vue'
import type { ConfigTableColumn } from './configTable'

const { t } = useI18n()

// Tab type constants
const TAB_ITEMS = 'items' as const
const TAB_RUNES = 'runes' as const
const TAB_GOLDS = 'golds' as const
const TAB_MONSTERS = 'monsters' as const
const TAB_SKILL_MISSILES = 'skillMissiles' as const

type TabType =
  | typeof TAB_ITEMS
  | typeof TAB_RUNES
  | typeof TAB_GOLDS
  | typeof TAB_MONSTERS
  | typeof TAB_SKILL_MISSILES
type ColorConfigItem = ItemColorItem | RuneColorItem | GoldColorItem | MonsterColorItem | SkillMissileDrawModeItem

interface Props {
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
})

const { config, exportSection, isReadOnly } = useConfig()
const { debugMode } = useDebugMode()
const { saveSubTab, loadSubTab } = useFileStorage()
const { applyDisplayOrder, sortByFileOrder, getRealDropTargetIndex } = useDisplayOrder()
const { isItemDisabled, isItemExtern, getItemRowClasses } = useItemActions()
const { itemsMap, getSkillById } = useReferenceData()

const activeTab = ref<TabType>(TAB_ITEMS)

// Sub-tabs configuration
const subTabsConfig = computed(() => [
  { id: TAB_ITEMS, label: t('subTab.items') },
  { id: TAB_RUNES, label: t('subTab.runes') },
  { id: TAB_GOLDS, label: t('subTab.golds') },
  { id: TAB_MONSTERS, label: t('subTab.monsters') },
  { id: TAB_SKILL_MISSILES, label: t('subTab.skillMissiles') }
])

// Selection state (store item references)
const selectedItems = ref<Set<ColorConfigItem>>(new Set())
const selectedRunes = ref<Set<ColorConfigItem>>(new Set())
const selectedGolds = ref<Set<ColorConfigItem>>(new Set())
const selectedMonsters = ref<Set<ColorConfigItem>>(new Set())
const selectedSkillMissiles = ref<Set<ColorConfigItem>>(new Set())

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
  selectedMonsters.value.clear()
  selectedSkillMissiles.value.clear()
})

// Load saved sub-tab on mount
onMounted(() => {
  const savedTab = loadSubTab('itemColors', TAB_ITEMS)
  activeTab.value = isTabType(savedTab) ? savedTab : TAB_ITEMS
})

function isTabType(value: string): value is TabType {
  return (
    value === TAB_ITEMS ||
    value === TAB_RUNES ||
    value === TAB_GOLDS ||
    value === TAB_MONSTERS ||
    value === TAB_SKILL_MISSILES
  )
}

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
const monsterColorsAll = computed(() => getAllItems<MonsterColorItem>(config.value, 'monsterColors'))
const skillMissileDrawModesAll = computed(() => getAllItems<SkillMissileDrawModeItem>(config.value, 'skillMissileDrawModes'))

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

  return applyDisplayOrder(items)
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

  return applyDisplayOrder(items)
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

  return applyDisplayOrder(items)
})

const monsterColors = computed(() => {
  let items = filterForDisplay(monsterColorsAll.value)
  if (!items.length) return []

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.monsterId.toLowerCase().includes(q) ||
      item.monsterType.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    )
  }

  if (mapColorFilter.value && mapColorFilter.value !== COLOR_NONE) {
    items = items.filter(item => item.blobColor === mapColorFilter.value)
  }

  return applyDisplayOrder(items)
})

const skillMissileDrawModes = computed(() => {
  let items = filterForDisplay(skillMissileDrawModesAll.value)
  if (!items.length) return []

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.skillId.toLowerCase().includes(q) ||
      item.drawMode.toLowerCase().includes(q) ||
      item.comment?.toLowerCase().includes(q)
    )
  }

  return applyDisplayOrder(items)
})

// Build jump maps from DISPLAYED items (so indices match data-index)
const itemColorsJumpMap = computed(() => buildCommentedMainMap(itemColors.value, getItemColorKey))
const runeColorsJumpMap = computed(() => buildCommentedMainMap(runeColors.value, getRuneColorKey))
const goldColorsJumpMap = computed(() => buildCommentedMainMap(goldColors.value, getGoldColorKey))
const monsterColorsJumpMap = computed(() => buildCommentedMainMap(monsterColors.value, getMonsterColorKey))
const skillMissileDrawModesJumpMap = computed(() =>
  buildCommentedMainMap(skillMissileDrawModes.value, getSkillMissileDrawModeKey)
)

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
function getMonsterJumpTarget(item: MonsterColorItem): number | undefined {
  return getJumpTargetIndex(item, monsterColorsJumpMap.value, getMonsterColorKey)
}
function getSkillMissileJumpTarget(item: SkillMissileDrawModeItem): number | undefined {
  return getJumpTargetIndex(item, skillMissileDrawModesJumpMap.value, getSkillMissileDrawModeKey)
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
function jumpToMonsterColor(index: number): void {
  scrollToIndex(index, '.monsters-color-list')
}
function jumpToSkillMissileDrawMode(index: number): void {
  scrollToIndex(index, '.skill-missiles-list')
}

// Get merged display index for drag operations
function getMergedIndex(filteredIndex: number, type: TabType): number {
  if (type === TAB_MONSTERS) {
    const item = monsterColors.value[filteredIndex]
    if (!item) return -1
    return getAllItems<MonsterColorItem>(config.value, 'monsterColors').indexOf(item)
  }
  if (type === TAB_GOLDS) {
    const item = goldColors.value[filteredIndex]
    if (!item) return -1
    return getAllItems<GoldColorItem>(config.value, 'goldColors').indexOf(item)
  }
  if (type === TAB_RUNES) {
    const item = runeColors.value[filteredIndex]
    if (!item) return -1
    return getAllItems<RuneColorItem>(config.value, 'runeColors').indexOf(item)
  }
  if (type === TAB_SKILL_MISSILES) {
    const item = skillMissileDrawModes.value[filteredIndex]
    if (!item) return -1
    return getAllItems<SkillMissileDrawModeItem>(config.value, 'skillMissileDrawModes').indexOf(item)
  }

  const item = itemColors.value[filteredIndex]
  if (!item) return -1
  return getAllItems<ItemColorItem>(config.value, 'itemColors').indexOf(item)
}

// Get the effective item at filtered index
function getItemAtIndex(filteredIndex: number, type: typeof TAB_ITEMS): ItemColorItem | undefined
function getItemAtIndex(filteredIndex: number, type: typeof TAB_RUNES): RuneColorItem | undefined
function getItemAtIndex(filteredIndex: number, type: typeof TAB_GOLDS): GoldColorItem | undefined
function getItemAtIndex(filteredIndex: number, type: typeof TAB_MONSTERS): MonsterColorItem | undefined
function getItemAtIndex(filteredIndex: number, type: typeof TAB_SKILL_MISSILES): SkillMissileDrawModeItem | undefined
function getItemAtIndex(filteredIndex: number, type: TabType): ColorConfigItem | undefined
function getItemAtIndex(filteredIndex: number, type: TabType): ColorConfigItem | undefined {
  if (type === TAB_MONSTERS) return monsterColors.value[filteredIndex]
  if (type === TAB_GOLDS) return goldColors.value[filteredIndex]
  if (type === TAB_RUNES) return runeColors.value[filteredIndex]
  if (type === TAB_SKILL_MISSILES) return skillMissileDrawModes.value[filteredIndex]
  return itemColors.value[filteredIndex]
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

const monsterIdWidth = computed(() =>
  fitTextColumnWidth(
    getAllItems<MonsterColorItem>(config.value, 'monsterColors').map(item => item.monsterId),
    t('itemColors.monsterId'),
    { min: 120, max: 260, padding: 34 }
  )
)

const monsterTypeWidth = computed(() =>
  fitTextColumnWidth(
    getAllItems<MonsterColorItem>(config.value, 'monsterColors').map(item => item.monsterType),
    t('itemColors.monsterType'),
    { min: 100, max: 220, padding: 34 }
  )
)

const skillMissileDrawModeWidth = computed(() =>
  fitTextColumnWidth(
    SKILL_MISSILE_DRAW_MODES.map(mode => `[${mode.value}] ${t(mode.labelKey)}`),
    t('itemColors.drawMode'),
    { min: 230, max: 360, padding: 70 }
  )
)

const skillMissileSkillIdWidth = computed(() =>
  fitTextColumnWidth(
    getAllItems<SkillMissileDrawModeItem>(config.value, 'skillMissileDrawModes')
      .map(item => getSkillDisplayText(item.skillId)),
    t('itemColors.skillId'),
    { min: 230, max: 560, padding: 34 }
  )
)

const itemColorColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'itemId', label: t('itemColors.itemId'), width: '150px' },
  { key: 'quality', label: t('itemColors.quality'), width: '80px' },
  { key: 'textColor', label: t('itemColors.textColor'), width: '32px' },
  { key: 'mapColor', label: t('itemColors.mapColor'), width: '32px' },
  { key: 'mapText', label: t('itemColors.mapText'), width: `${itemMapTextWidth.value}px` },
  { key: 'comment', label: t('itemColors.comment'), width: '180px', className: 'col-comment' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

const runeColorColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'range', label: t('itemColors.runeRange'), width: '120px' },
  { key: 'textColor', label: t('itemColors.textColor'), width: '32px' },
  { key: 'mapColor', label: t('itemColors.mapColor'), width: '32px' },
  { key: 'mapText', label: t('itemColors.mapText'), width: `${runeMapTextWidth.value}px` },
  { key: 'comment', label: t('itemColors.comment'), width: '180px', className: 'col-comment' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

const goldColorColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'range', label: t('itemColors.goldRange'), width: '120px' },
  { key: 'textColor', label: t('itemColors.textColor'), width: '32px' },
  { key: 'mapColor', label: t('itemColors.mapColor'), width: '32px' },
  { key: 'mapText', label: t('itemColors.mapText'), width: `${goldMapTextWidth.value}px` },
  { key: 'comment', label: t('itemColors.comment'), width: '180px', className: 'col-comment' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

const monsterColorColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'monsterId', label: t('itemColors.monsterId'), width: monsterIdWidth.value },
  { key: 'blobColor', label: t('itemColors.mapColor'), width: '32px' },
  { key: 'monsterType', label: t('itemColors.monsterType'), width: monsterTypeWidth.value },
  { key: 'comment', label: t('itemColors.comment'), width: '180px', className: 'col-comment' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

const skillMissileColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'skillId', label: t('itemColors.skillId'), width: skillMissileSkillIdWidth.value },
  { key: 'drawMode', label: t('itemColors.drawMode'), width: skillMissileDrawModeWidth.value },
  { key: 'comment', label: t('itemColors.comment'), width: '180px', className: 'col-comment' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

function getSkillDisplayText(skillId: string): string {
  if (!skillId) return ''
  const skill = getSkillById(skillId)
  return skill ? `${skill.id} - ${skill.name}` : skillId
}

function isColorRowDisabled(item: ColorConfigItem): boolean {
  return isItemDisabled(item) || isItemExtern(item)
}

function hasColorFields(item: ColorConfigItem): item is ItemColorItem | RuneColorItem | GoldColorItem {
  return 'textColor' in item && 'mapColor' in item
}

function hasBlobColorField(item: ColorConfigItem): item is MonsterColorItem {
  return 'blobColor' in item
}

// Selectable counts (non-extern items only)
const selectableItemsCount = computed(() => itemColors.value.filter(item => !isItemExtern(item)).length)
const selectableRunesCount = computed(() => runeColors.value.filter(item => !isItemExtern(item)).length)
const selectableGoldsCount = computed(() => goldColors.value.filter(item => !isItemExtern(item)).length)
const selectableMonstersCount = computed(() => monsterColors.value.filter(item => !isItemExtern(item)).length)
const selectableSkillMissilesCount = computed(() =>
  skillMissileDrawModes.value.filter(item => !isItemExtern(item)).length
)

// Selection helpers
function getSelectedSet(tabType: TabType): Ref<Set<ColorConfigItem>> {
  if (tabType === TAB_SKILL_MISSILES) return selectedSkillMissiles
  if (tabType === TAB_MONSTERS) return selectedMonsters
  return tabType === TAB_GOLDS ? selectedGolds
    : tabType === TAB_RUNES ? selectedRunes
    : selectedItems
}

function getDisplayItems(tabType: TabType): ColorConfigItem[] {
  if (tabType === TAB_SKILL_MISSILES) return skillMissileDrawModes.value
  if (tabType === TAB_MONSTERS) return monsterColors.value
  if (tabType === TAB_GOLDS) return goldColors.value
  if (tabType === TAB_RUNES) return runeColors.value
  return itemColors.value
}

function getFileOrderedItems(tabType: TabType): ColorConfigItem[] {
  if (tabType === TAB_SKILL_MISSILES) return skillMissileDrawModesAll.value
  if (tabType === TAB_MONSTERS) return monsterColorsAll.value
  if (tabType === TAB_GOLDS) return goldColorsAll.value
  if (tabType === TAB_RUNES) return runeColorsAll.value
  return itemColorsAll.value
}

// Selection functions
function toggleSelectAll(tabType: TabType): void {
  const items = getDisplayItems(tabType)
  const selected = getSelectedSet(tabType)

  // Only select non-extern items
  const selectableItems = items.filter(item => !isItemExtern(item))

  if (selected.value.size === selectableItems.length && selectableItems.length > 0) {
    selected.value.clear()
  } else {
    selected.value = new Set<ColorConfigItem>(selectableItems)
  }
}

function toggleSelect(item: ColorConfigItem, tabType: TabType): void {
  const selected = getSelectedSet(tabType)
  if (selected.value.has(item)) {
    selected.value.delete(item)
  } else {
    selected.value.add(item)
  }
  // Trigger reactivity
  selected.value = new Set<ColorConfigItem>(selected.value)
}

function isSelected(item: ColorConfigItem, tabType: TabType): boolean {
  const selected = getSelectedSet(tabType)
  return selected.value.has(item)
}

function hasSelection(tabType: TabType): boolean {
  return getSelectedSet(tabType).value.size > 0
}

function getArrayNameByTab(tabType: TabType): 'itemColors' | 'runeColors' | 'goldColors' | 'monsterColors' | 'skillMissileDrawModes' {
  if (tabType === TAB_SKILL_MISSILES) return 'skillMissileDrawModes'
  if (tabType === TAB_MONSTERS) return 'monsterColors'
  if (tabType === TAB_GOLDS) return 'goldColors'
  if (tabType === TAB_RUNES) return 'runeColors'
  return 'itemColors'
}

// Batch operations
function batchSetTextColor(color: string, tabType: TabType): void {
  if (isReadOnly.value) return
  const selected = getSelectedSet(tabType)

  for (const item of selected.value) {
    if (!isItemExtern(item) && hasColorFields(item)) {
      item.textColor = color
    }
  }
  selected.value.clear()
}

function batchSetMapColor(color: string, tabType: TabType): void {
  if (isReadOnly.value) return
  const selected = getSelectedSet(tabType)

  for (const item of selected.value) {
    if (!isItemExtern(item) && hasColorFields(item)) {
      item.mapColor = color
    } else if (!isItemExtern(item) && hasBlobColorField(item)) {
      item.blobColor = color
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

function batchComment(tabType: TabType): void {
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

function batchRestore(tabType: TabType): void {
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
    layer: 'user',
    saveTarget: 'user',
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
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'runeColors', copy)
  refreshEffectiveStatus(config.value)
}

// Check if there are extern items in current tab
function hasExternItems(tabType: TabType): boolean {
  const items = getDisplayItems(tabType)
  return items.some(item => isItemExtern(item))
}

// Copy all extern items - use skipRefresh to avoid index shifting during batch
function copyAllExtern(tabType: TabType): void {
  if (!config.value || isReadOnly.value) return

  const externItems = sortByFileOrder(
    getDisplayItems(tabType).filter(item => isItemExtern(item)),
    getFileOrderedItems(tabType)
  )

  let copied = 0
  for (const item of externItems) {
    let success = false
    if (tabType === TAB_GOLDS) {
      success = duplicateGoldColorItemToMain(item as GoldColorItem, true)
    } else if (tabType === TAB_RUNES) {
      success = duplicateRuneColorItemToMain(item as RuneColorItem, true)
    } else if (tabType === TAB_MONSTERS) {
      success = duplicateMonsterColorItemToMain(item as MonsterColorItem, true)
    } else if (tabType === TAB_SKILL_MISSILES) {
      success = duplicateSkillMissileDrawModeItemToMain(item as SkillMissileDrawModeItem, true)
    } else {
      success = duplicateItemColorItemToMain(item as ItemColorItem, true)
    }
    if (success) copied++
  }

  // Refresh once after all copies
  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

// Drag and drop
function handleDragStart(e: DragEvent, index: number, isRune = false): void {
  log(`[handleDragStart] index=${index}, isRune=${isRune}`)
  dragIndex.value = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
}

function handleDragOver(e: DragEvent, index: number): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function handleDragLeave() {
  dragOverIndex.value = null
}

function handleDrop(e: DragEvent, targetIndex: number, isRune = false): void {
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

  const targetRealIndex = getMergedIndex(targetIndex, type)
  log(`[handleDrop] targetRealIndex=${targetRealIndex}`)
  if (targetRealIndex < 0) {
    log(`[handleDrop] ABORT: targetRealIndex < 0`)
    return
  }
  const targetMergedIdx = getRealDropTargetIndex(sourceIndex, targetIndex, targetRealIndex)

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

function isReadonlyColorItem(item: ColorConfigItem): boolean {
  return isReadOnly.value || isItemDisabled(item) || isItemExtern(item)
}

function updateItemColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, 'items')
  if (!item || isReadonlyColorItem(item)) return
  if (item) {
    ;(item as unknown as Record<string, unknown>)[field] = value
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
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'itemColors', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => itemColors.value, newItem, getItemColorKey, '.items-color-list')
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
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'runeColors', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => runeColors.value, newItem, getRuneColorKey, '.runes-color-list')
}

function updateRuneColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, 'runes')
  if (!item || isReadonlyColorItem(item)) return
  if (item) {
    ;(item as unknown as Record<string, unknown>)[field] = value
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
  if (!original) return false
  return duplicateItemColorItemToMain(original, skipRefresh)
}

function duplicateItemColorItemToMain(original: ItemColorItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!canCopyItemToMain(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getItemColorKey(original)
  const allItems = getAllItems<ItemColorItem>(config.value, 'itemColors')
  const hasMainItem = allItems.some(item => getItemColorKey(item) === key && item.layer === 'user')
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
    layer: 'user',
    saveTarget: 'user',
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
  if (!original) return false
  return duplicateRuneColorItemToMain(original, skipRefresh)
}

function duplicateRuneColorItemToMain(original: RuneColorItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!canCopyItemToMain(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getRuneColorKey(original)
  const allItems = getAllItems<RuneColorItem>(config.value, 'runeColors')
  const hasMainItem = allItems.some(item => getRuneColorKey(item) === key && item.layer === 'user')
  if (hasMainItem) return false

  // Add new main item
  const newItem: RuneColorItem = {
    range: original.range,
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
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
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'goldColors', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => goldColors.value, newItem, getGoldColorKey, '.golds-color-list')
}

function updateGoldColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, 'golds')
  if (!item || isReadonlyColorItem(item)) return
  if (item) {
    ;(item as unknown as Record<string, unknown>)[field] = value
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
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'goldColors', copy)
  refreshEffectiveStatus(config.value)
}

function duplicateGoldColorToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index, 'golds')
  if (!original) return false
  return duplicateGoldColorItemToMain(original, skipRefresh)
}

function duplicateGoldColorItemToMain(original: GoldColorItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!canCopyItemToMain(original)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getGoldColorKey(original)
  const allItems = getAllItems<GoldColorItem>(config.value, 'goldColors')
  const hasMainItem = allItems.some(item => getGoldColorKey(item) === key && item.layer === 'user')
  if (hasMainItem) return false

  // Add new main item
  const newItem: GoldColorItem = {
    range: original.range,
    textColor: original.textColor,
    mapColor: original.mapColor,
    mapText: original.mapText,
    comment: original.comment,
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
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

function addMonsterColor() {
  if (!config.value || isReadOnly.value) return
  const newItem: MonsterColorItem = {
    monsterId: '',
    blobColor: COLOR_NONE,
    monsterType: '',
    comment: '',
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'monsterColors', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => monsterColors.value, newItem, getMonsterColorKey, '.monsters-color-list')
}

function updateMonsterColor(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, TAB_MONSTERS)
  if (!item || isReadonlyColorItem(item)) return
  ;(item as unknown as Record<string, unknown>)[field] = value
}

function handleDeleteMonsterColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, TAB_MONSTERS)
  if (!item || isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'monsterColors')
  refreshEffectiveStatus(config.value)
}

function handleCommentMonsterColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, TAB_MONSTERS)
  if (!item || isItemExtern(item)) return

  item.isCommented = true
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function handleRestoreMonsterColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, TAB_MONSTERS)
  if (!item || isItemExtern(item)) return

  item.isCommented = false
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function copyMonsterColor(index: number) {
  if (!config.value || isReadOnly.value) return
  const original = getItemAtIndex(index, TAB_MONSTERS)
  if (!original) return

  const copy: MonsterColorItem = {
    monsterId: original.monsterId + '_copy',
    blobColor: original.blobColor,
    monsterType: original.monsterType,
    comment: original.comment,
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'monsterColors', copy)
  refreshEffectiveStatus(config.value)
}

function duplicateMonsterColorToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index, TAB_MONSTERS)
  if (!original) return false
  return duplicateMonsterColorItemToMain(original, skipRefresh)
}

function duplicateMonsterColorItemToMain(original: MonsterColorItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!canCopyItemToMain(original)) return false

  const key = getMonsterColorKey(original)
  const allItems = getAllItems<MonsterColorItem>(config.value, 'monsterColors')
  const hasMainItem = allItems.some(item => getMonsterColorKey(item) === key && item.layer === 'user')
  if (hasMainItem) return false

  const newItem: MonsterColorItem = {
    monsterId: original.monsterId,
    blobColor: original.blobColor,
    monsterType: original.monsterType,
    comment: original.comment,
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'monsterColors', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => monsterColors.value, newItem, getMonsterColorKey, '.monsters-color-list')
  }
  return true
}

function addSkillMissileDrawMode() {
  if (!config.value || isReadOnly.value) return
  const newItem: SkillMissileDrawModeItem = {
    skillId: '',
    drawMode: '0',
    comment: '',
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'skillMissileDrawModes', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(
    () => skillMissileDrawModes.value,
    newItem,
    getSkillMissileDrawModeKey,
    '.skill-missiles-list'
  )
}

function updateSkillMissileDrawMode(index: number, field: string, value: string) {
  const item = getItemAtIndex(index, TAB_SKILL_MISSILES)
  if (!item || isReadonlyColorItem(item)) return
  ;(item as unknown as Record<string, unknown>)[field] = value
}

function handleDeleteSkillMissileDrawMode(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, TAB_SKILL_MISSILES)
  if (!item || isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'skillMissileDrawModes')
  refreshEffectiveStatus(config.value)
}

function handleCommentSkillMissileDrawMode(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, TAB_SKILL_MISSILES)
  if (!item || isItemExtern(item)) return

  item.isCommented = true
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function handleRestoreSkillMissileDrawMode(index: number) {
  if (!config.value || isReadOnly.value) return
  const item = getItemAtIndex(index, TAB_SKILL_MISSILES)
  if (!item || isItemExtern(item)) return

  item.isCommented = false
  item.isDeleted = false
  refreshEffectiveStatus(config.value)
}

function duplicateSkillMissileDrawModeToMain(index: number, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  const original = getItemAtIndex(index, TAB_SKILL_MISSILES)
  if (!original) return false
  return duplicateSkillMissileDrawModeItemToMain(original, skipRefresh)
}

function duplicateSkillMissileDrawModeItemToMain(original: SkillMissileDrawModeItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!canCopyItemToMain(original)) return false

  const key = getSkillMissileDrawModeKey(original)
  const allItems = getAllItems<SkillMissileDrawModeItem>(config.value, 'skillMissileDrawModes')
  const hasMainItem = allItems.some(item => getSkillMissileDrawModeKey(item) === key && item.layer === 'user')
  if (hasMainItem) return false

  const newItem: SkillMissileDrawModeItem = {
    skillId: original.skillId,
    drawMode: original.drawMode,
    comment: original.comment,
    sourceFile: null,
    layer: 'user',
    saveTarget: 'user',
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'skillMissileDrawModes', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(
      () => skillMissileDrawModes.value,
      newItem,
      getSkillMissileDrawModeKey,
      '.skill-missiles-list'
    )
  }
  return true
}

// Gold drag and drop
function handleDragStartGold(e: DragEvent, index: number): void {
  log(`[handleDragStartGold] index=${index}`)
  dragIndex.value = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
}

function handleDropGold(e: DragEvent, targetIndex: number): void {
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

  const targetRealIndex = getMergedIndex(targetIndex, 'golds')
  log(`[handleDropGold] targetRealIndex=${targetRealIndex}`)
  if (targetRealIndex < 0) {
    log(`[handleDropGold] ABORT: targetRealIndex < 0`)
    return
  }
  const targetMergedIdx = getRealDropTargetIndex(sourceIndex, targetIndex, targetRealIndex)

  log(`[handleDropGold] calling moveItemInFile: targetMergedIdx=${targetMergedIdx}`)

  // Move item within its file
  const result = moveItemInFile(config.value, item, targetMergedIdx, 'goldColors')
  log(`[handleDropGold] moveItemInFile returned: ${result}`)

  // Refresh effective status after reorder
  refreshEffectiveStatus(config.value)

  dragIndex.value = null
  dragOverIndex.value = null
}

function handleDragStartMonster(e: DragEvent, index: number): void {
  log(`[handleDragStartMonster] index=${index}`)
  dragIndex.value = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
}

function handleDropMonster(e: DragEvent, targetIndex: number): void {
  e.preventDefault()
  log(`[handleDropMonster] START: sourceIndex=${dragIndex.value}, targetIndex=${targetIndex}`)

  if (isReadOnly.value || !config.value) {
    log(`[handleDropMonster] ABORT: isReadOnly=${isReadOnly.value}, config=${!!config.value}`)
    return
  }
  const sourceIndex = dragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    log(`[handleDropMonster] ABORT: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`)
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }

  const item = getItemAtIndex(sourceIndex, TAB_MONSTERS)
  if (!item) {
    log(`[handleDropMonster] ABORT: item not found at sourceIndex=${sourceIndex}`)
    return
  }

  const targetRealIndex = getMergedIndex(targetIndex, TAB_MONSTERS)
  log(`[handleDropMonster] targetRealIndex=${targetRealIndex}`)
  if (targetRealIndex < 0) {
    log(`[handleDropMonster] ABORT: targetRealIndex < 0`)
    return
  }
  const targetMergedIdx = getRealDropTargetIndex(sourceIndex, targetIndex, targetRealIndex)

  log(`[handleDropMonster] calling moveItemInFile: targetMergedIdx=${targetMergedIdx}`)
  const result = moveItemInFile(config.value, item, targetMergedIdx, 'monsterColors')
  log(`[handleDropMonster] moveItemInFile returned: ${result}`)

  refreshEffectiveStatus(config.value)
  dragIndex.value = null
  dragOverIndex.value = null
}

function handleDragStartSkillMissile(e: DragEvent, index: number): void {
  log(`[handleDragStartSkillMissile] index=${index}`)
  dragIndex.value = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
}

function handleDropSkillMissile(e: DragEvent, targetIndex: number): void {
  e.preventDefault()
  log(`[handleDropSkillMissile] START: sourceIndex=${dragIndex.value}, targetIndex=${targetIndex}`)

  if (isReadOnly.value || !config.value) {
    log(`[handleDropSkillMissile] ABORT: isReadOnly=${isReadOnly.value}, config=${!!config.value}`)
    return
  }
  const sourceIndex = dragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    log(`[handleDropSkillMissile] ABORT: sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`)
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }

  const item = getItemAtIndex(sourceIndex, TAB_SKILL_MISSILES)
  if (!item) {
    log(`[handleDropSkillMissile] ABORT: item not found at sourceIndex=${sourceIndex}`)
    return
  }

  const targetRealIndex = getMergedIndex(targetIndex, TAB_SKILL_MISSILES)
  log(`[handleDropSkillMissile] targetRealIndex=${targetRealIndex}`)
  if (targetRealIndex < 0) {
    log(`[handleDropSkillMissile] ABORT: targetRealIndex < 0`)
    return
  }
  const targetMergedIdx = getRealDropTargetIndex(sourceIndex, targetIndex, targetRealIndex)

  log(`[handleDropSkillMissile] calling moveItemInFile: targetMergedIdx=${targetMergedIdx}`)
  const result = moveItemInFile(config.value, item, targetMergedIdx, 'skillMissileDrawModes')
  log(`[handleDropSkillMissile] moveItemInFile returned: ${result}`)

  refreshEffectiveStatus(config.value)
  dragIndex.value = null
  dragOverIndex.value = null
}

function clearFilters() {
  textColorFilter.value = ''
  mapColorFilter.value = ''
}

function getColorDebugKey(item: ColorConfigItem): string {
  if ('itemId' in item) return getItemColorKey(item)
  if ('monsterId' in item) return getMonsterColorKey(item)
  if ('skillId' in item) return getSkillMissileDrawModeKey(item)
  return item.range
}

function formatColorDebugItem(item: ColorConfigItem): string {
  if ('itemId' in item) {
    return `${item.itemId}|${item.quality}|${item.ethereal}|${item.sockets} → text:${item.textColor}, map:${item.mapColor}`
  }
  if ('skillId' in item) {
    return `${item.skillId} → drawMode:${item.drawMode}`
  }
  if ('monsterId' in item) {
    return `${item.monsterId} → color:${item.blobColor}, type:${item.monsterType}`
  }
  return `${item.range} → text:${item.textColor}, map:${item.mapColor}`
}

// Get current items for debug panel based on active tab
const currentDebugItems = computed<ColorConfigItem[]>(() => {
  if (activeTab.value === TAB_SKILL_MISSILES) {
    return getAllItems<SkillMissileDrawModeItem>(config.value, 'skillMissileDrawModes')
  }
  if (activeTab.value === TAB_MONSTERS) return getAllItems<MonsterColorItem>(config.value, 'monsterColors')
  if (activeTab.value === TAB_GOLDS) return getAllItems<GoldColorItem>(config.value, 'goldColors')
  if (activeTab.value === TAB_RUNES) return getAllItems<RuneColorItem>(config.value, 'runeColors')
  return getAllItems<ItemColorItem>(config.value, 'itemColors')
})

const currentDebugTitle = computed(() => {
  if (activeTab.value === TAB_SKILL_MISSILES) return 'Skill Missile DrawMode'
  if (activeTab.value === TAB_MONSTERS) return 'Monster Colors'
  if (activeTab.value === TAB_GOLDS) return 'Gold Colors'
  if (activeTab.value === TAB_RUNES) return 'Rune Colors'
  return 'Item Colors'
})

const currentDebugGetKey = computed(() => getColorDebugKey)

const currentFormatter = computed(() => formatColorDebugItem)
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
            v-if="activeTab !== TAB_SKILL_MISSILES && activeTab !== TAB_MONSTERS"
            :modelValue="COLOR_NONE"
            @update:modelValue="batchSetTextColor($event, activeTab)"
          />
          <MapColorPicker
            v-if="activeTab !== TAB_SKILL_MISSILES"
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
        <div v-if="activeTab !== TAB_SKILL_MISSILES && activeTab !== TAB_MONSTERS" class="filter-group">
          <span class="filter-label">{{ t('itemColors.filterTextColor') }}:</span>
          <TextColorPicker
            :modelValue="textColorFilter"
            @update:modelValue="textColorFilter = $event"
          />
          <button v-if="textColorFilter && textColorFilter !== '' && textColorFilter !== COLOR_NONE" class="btn btn-small btn-secondary" @click="textColorFilter = ''">×</button>
        </div>
        <div v-if="activeTab !== TAB_SKILL_MISSILES" class="filter-group">
          <span class="filter-label">{{ t('itemColors.filterMapColor') }}:</span>
          <MapColorPicker
            :modelValue="mapColorFilter"
            @update:modelValue="mapColorFilter = $event"
          />
          <button v-if="mapColorFilter && mapColorFilter !== COLOR_NONE" class="btn btn-small btn-secondary" @click="mapColorFilter = ''">×</button>
        </div>
        <button
          v-if="
            activeTab !== TAB_SKILL_MISSILES &&
            (
              (activeTab !== TAB_MONSTERS && textColorFilter && textColorFilter !== COLOR_NONE) ||
              (mapColorFilter && mapColorFilter !== COLOR_NONE)
            )
          "
          class="btn btn-small btn-secondary"
          @click="clearFilters"
        >
          {{ t('search.clear') }}
        </button>
        <button v-if="activeTab === TAB_ITEMS && !isReadOnly" class="btn btn-primary btn-small" @click="addItemColor">{{ t('btn.add') }}</button>
        <button v-if="activeTab === TAB_RUNES && !isReadOnly" class="btn btn-primary btn-small" @click="addRuneColor">{{ t('btn.add') }}</button>
        <button v-if="activeTab === TAB_GOLDS && !isReadOnly" class="btn btn-primary btn-small" @click="addGoldColor">{{ t('btn.add') }}</button>
        <button v-if="activeTab === TAB_MONSTERS && !isReadOnly" class="btn btn-primary btn-small" @click="addMonsterColor">{{ t('btn.add') }}</button>
        <button v-if="activeTab === TAB_SKILL_MISSILES && !isReadOnly" class="btn btn-primary btn-small" @click="addSkillMissileDrawMode">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <!-- Item Colors Tab -->
      <div v-show="activeTab === TAB_ITEMS" class="tab-content">
        <ConfigTable
          :items="itemColors"
          :columns="itemColorColumns"
          :empty-text="t('itemColors.empty')"
          list-class="color-list items-color-list"
          show-checkbox
          show-index
          show-drag
          :is-all-selected="selectedItems.size === selectableItemsCount && selectableItemsCount > 0"
          :is-read-only="isReadOnly"
          :is-selected="(item) => isSelected(item, TAB_ITEMS)"
          :is-disabled="isColorRowDisabled"
          :drag-over-index="dragOverIndex"
          :row-classes="getItemRowClasses"
          @select-all="toggleSelectAll(TAB_ITEMS)"
          @select="(item) => toggleSelect(item, TAB_ITEMS)"
          @dragstart="(event, index) => handleDragStart(event, index, false)"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="(event, index) => handleDrop(event, index, false)"
          @dragend="handleDragEnd"
        >
          <template #cell-itemId="{ item, index }">
            <ItemPicker
              :modelValue="item.itemId"
              :placeholder="t('itemColors.itemId')"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              :class="{ 'has-warning': hasInvalidIds(item.itemId) }"
              @update:modelValue="updateItemColor(index, 'itemId', $event)"
            />
          </template>
          <template #cell-quality="{ item, index }">
            <QualityPicker
              :modelValue="item.quality"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateItemColor(index, 'quality', $event)"
            />
          </template>
          <template #cell-textColor="{ item, index }">
            <TextColorPicker
              :modelValue="item.textColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateItemColor(index, 'textColor', $event)"
            />
          </template>
          <template #cell-mapColor="{ item, index }">
            <MapColorPicker
              :modelValue="item.mapColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateItemColor(index, 'mapColor', $event)"
            />
          </template>
          <template #cell-mapText="{ item, index }">
            <input
              type="text"
              :value="item.mapText"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateItemColor(index, 'mapText', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-comment="{ item, index }">
            <input
              type="text"
              class="comment-input"
              :placeholder="t('itemColors.comment')"
              :value="item.comment"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateItemColor(index, 'comment', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-actions="{ item, index }">
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
              </template>
              <template v-else-if="item.isCommented || item.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreItemColor(index)" :title="t('action.restore')">
                  ↩
                </button>
                <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button v-if="canCopyItemToMain(item)" class="btn btn-small btn-accent" @click="duplicateItemColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
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
        </ConfigTable>
      </div>

      <!-- Rune Colors Tab -->
      <div v-show="activeTab === TAB_RUNES" class="tab-content">
        <ConfigTable
          :items="runeColors"
          :columns="runeColorColumns"
          :empty-text="t('itemColors.runeEmpty')"
          list-class="color-list runes-color-list"
          show-checkbox
          show-index
          show-drag
          :is-all-selected="selectedRunes.size === selectableRunesCount && selectableRunesCount > 0"
          :is-read-only="isReadOnly"
          :is-selected="(item) => isSelected(item, TAB_RUNES)"
          :is-disabled="isColorRowDisabled"
          :drag-over-index="dragOverIndex"
          :row-classes="getItemRowClasses"
          @select-all="toggleSelectAll(TAB_RUNES)"
          @select="(item) => toggleSelect(item, TAB_RUNES)"
          @dragstart="(event, index) => handleDragStart(event, index, true)"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="(event, index) => handleDrop(event, index, true)"
          @dragend="handleDragEnd"
        >
          <template #cell-range="{ item, index }">
            <RunePicker
              :modelValue="item.range"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateRuneColor(index, 'range', $event)"
            />
          </template>
          <template #cell-textColor="{ item, index }">
            <TextColorPicker
              :modelValue="item.textColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateRuneColor(index, 'textColor', $event)"
            />
          </template>
          <template #cell-mapColor="{ item, index }">
            <MapColorPicker
              :modelValue="item.mapColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateRuneColor(index, 'mapColor', $event)"
            />
          </template>
          <template #cell-mapText="{ item, index }">
            <input
              type="text"
              :value="item.mapText"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateRuneColor(index, 'mapText', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-comment="{ item, index }">
            <input
              type="text"
              class="comment-input"
              :placeholder="t('itemColors.comment')"
              :value="item.comment"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateRuneColor(index, 'comment', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-actions="{ item, index }">
            <template v-if="isItemExtern(item)">
                <button
                  v-if="getRuneJumpTarget(item) !== undefined"
                  class="btn btn-small btn-warning"
                  @click="jumpToRuneColor(getRuneJumpTarget(item)!)"
                  :title="t('action.jumpToMain')"
                >→</button>
                <button v-if="!isReadOnly && getRuneJumpTarget(item) === undefined" class="btn btn-small btn-accent" @click="duplicateRuneColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
              </template>
              <template v-else-if="item.isCommented || item.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreRuneColor(index)" :title="t('action.restore')">
                  ↩
                </button>
                <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button v-if="canCopyItemToMain(item)" class="btn btn-small btn-accent" @click="duplicateRuneColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
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
        </ConfigTable>
      </div>

      <!-- Gold Colors Tab -->
      <div v-show="activeTab === TAB_GOLDS" class="tab-content">
        <ConfigTable
          :items="goldColors"
          :columns="goldColorColumns"
          :empty-text="t('itemColors.goldEmpty')"
          list-class="color-list golds-color-list"
          show-checkbox
          show-index
          show-drag
          :is-all-selected="selectedGolds.size === selectableGoldsCount && selectableGoldsCount > 0"
          :is-read-only="isReadOnly"
          :is-selected="(item) => isSelected(item, TAB_GOLDS)"
          :is-disabled="isColorRowDisabled"
          :drag-over-index="dragOverIndex"
          :row-classes="getItemRowClasses"
          @select-all="toggleSelectAll(TAB_GOLDS)"
          @select="(item) => toggleSelect(item, TAB_GOLDS)"
          @dragstart="(event, index) => handleDragStartGold(event, index)"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="(event, index) => handleDropGold(event, index)"
          @dragend="handleDragEnd"
        >
          <template #cell-range="{ item, index }">
            <input
              type="text"
              :placeholder="t('itemColors.goldRange')"
              :value="item.range"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateGoldColor(index, 'range', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-textColor="{ item, index }">
            <TextColorPicker
              :modelValue="item.textColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateGoldColor(index, 'textColor', $event)"
            />
          </template>
          <template #cell-mapColor="{ item, index }">
            <MapColorPicker
              :modelValue="item.mapColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateGoldColor(index, 'mapColor', $event)"
            />
          </template>
          <template #cell-mapText="{ item, index }">
            <input
              type="text"
              :value="item.mapText"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateGoldColor(index, 'mapText', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-comment="{ item, index }">
            <input
              type="text"
              class="comment-input"
              :placeholder="t('itemColors.comment')"
              :value="item.comment"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateGoldColor(index, 'comment', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-actions="{ item, index }">
            <template v-if="isItemExtern(item)">
                <button
                  v-if="getGoldJumpTarget(item) !== undefined"
                  class="btn btn-small btn-warning"
                  @click="jumpToGoldColor(getGoldJumpTarget(item)!)"
                  :title="t('action.jumpToMain')"
                >→</button>
                <button v-if="!isReadOnly && getGoldJumpTarget(item) === undefined" class="btn btn-small btn-accent" @click="duplicateGoldColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
              </template>
              <template v-else-if="item.isCommented || item.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreGoldColor(index)" :title="t('action.restore')">
                  ↩
                </button>
                <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button v-if="canCopyItemToMain(item)" class="btn btn-small btn-accent" @click="duplicateGoldColorToMain(index)" :title="t('action.copyToMain')">
                  +
                </button>
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
        </ConfigTable>
      </div>

      <!-- Monster Colors Tab -->
      <div v-show="activeTab === TAB_MONSTERS" class="tab-content">
        <ConfigTable
          :items="monsterColors"
          :columns="monsterColorColumns"
          :empty-text="t('itemColors.monsterEmpty')"
          list-class="color-list monsters-color-list"
          show-checkbox
          show-index
          show-drag
          :is-all-selected="selectedMonsters.size === selectableMonstersCount && selectableMonstersCount > 0"
          :is-read-only="isReadOnly"
          :is-selected="(item) => isSelected(item, TAB_MONSTERS)"
          :is-disabled="isColorRowDisabled"
          :drag-over-index="dragOverIndex"
          :row-classes="getItemRowClasses"
          @select-all="toggleSelectAll(TAB_MONSTERS)"
          @select="(item) => toggleSelect(item, TAB_MONSTERS)"
          @dragstart="(event, index) => handleDragStartMonster(event, index)"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="(event, index) => handleDropMonster(event, index)"
          @dragend="handleDragEnd"
        >
          <template #cell-monsterId="{ item, index }">
            <input
              type="text"
              :placeholder="t('itemColors.monsterId')"
              :value="item.monsterId"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateMonsterColor(index, 'monsterId', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-blobColor="{ item, index }">
            <MapColorPicker
              :modelValue="item.blobColor"
              :disabled="isReadOnly"
              :readonly="isReadonlyColorItem(item)"
              @update:modelValue="updateMonsterColor(index, 'blobColor', $event)"
            />
          </template>
          <template #cell-monsterType="{ item, index }">
            <input
              type="text"
              :placeholder="t('itemColors.monsterType')"
              :value="item.monsterType"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateMonsterColor(index, 'monsterType', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-comment="{ item, index }">
            <input
              type="text"
              class="comment-input"
              :placeholder="t('itemColors.comment')"
              :value="item.comment"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateMonsterColor(index, 'comment', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-actions="{ item, index }">
            <template v-if="isItemExtern(item)">
              <button
                v-if="getMonsterJumpTarget(item) !== undefined"
                class="btn btn-small btn-warning"
                @click="jumpToMonsterColor(getMonsterJumpTarget(item)!)"
                :title="t('action.jumpToMain')"
              >→</button>
              <button
                v-if="!isReadOnly && getMonsterJumpTarget(item) === undefined"
                class="btn btn-small btn-accent"
                @click="duplicateMonsterColorToMain(index)"
                :title="t('action.copyToMain')"
              >
                +
              </button>
            </template>
            <template v-else-if="item.isCommented || item.isDeleted">
              <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreMonsterColor(index)" :title="t('action.restore')">
                ↩
              </button>
              <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
              <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
            </template>
            <template v-else-if="!isReadOnly">
              <button v-if="canCopyItemToMain(item)" class="btn btn-small btn-accent" @click="duplicateMonsterColorToMain(index)" :title="t('action.copyToMain')">
                +
              </button>
              <button class="btn btn-small btn-secondary" @click="copyMonsterColor(index)" :title="t('action.copy')">
                ⧉
              </button>
              <button class="btn btn-small btn-secondary" @click="handleCommentMonsterColor(index)" :title="t('action.comment')">
                //
              </button>
              <button class="btn btn-small btn-danger" @click="handleDeleteMonsterColor(index)" :title="t('action.delete')">
                ×
              </button>
            </template>
          </template>
        </ConfigTable>
      </div>

      <!-- Skill Missile DrawMode Tab -->
      <div v-show="activeTab === TAB_SKILL_MISSILES" class="tab-content">
        <ConfigTable
          :items="skillMissileDrawModes"
          :columns="skillMissileColumns"
          :empty-text="t('itemColors.skillMissileEmpty')"
          list-class="color-list skill-missiles-list"
          show-checkbox
          show-index
          show-drag
          :is-all-selected="selectedSkillMissiles.size === selectableSkillMissilesCount && selectableSkillMissilesCount > 0"
          :is-read-only="isReadOnly"
          :is-selected="(item) => isSelected(item, TAB_SKILL_MISSILES)"
          :is-disabled="isColorRowDisabled"
          :drag-over-index="dragOverIndex"
          :row-classes="getItemRowClasses"
          @select-all="toggleSelectAll(TAB_SKILL_MISSILES)"
          @select="(item) => toggleSelect(item, TAB_SKILL_MISSILES)"
          @dragstart="(event, index) => handleDragStartSkillMissile(event, index)"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="(event, index) => handleDropSkillMissile(event, index)"
          @dragend="handleDragEnd"
        >
          <template #cell-skillId="{ item, index }">
            <SkillPicker
              :placeholder="t('itemColors.skillId')"
              :model-value="item.skillId"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @update:model-value="updateSkillMissileDrawMode(index, 'skillId', $event)"
            />
          </template>
          <template #cell-drawMode="{ item, index }">
            <select
              :value="item.drawMode"
              :disabled="isReadOnly || isReadonlyColorItem(item)"
              @change="updateSkillMissileDrawMode(index, 'drawMode', ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="mode in SKILL_MISSILE_DRAW_MODES"
                :key="mode.value"
                :value="mode.value"
              >
                [{{ mode.value }}] {{ t(mode.labelKey) }}
              </option>
            </select>
          </template>
          <template #cell-comment="{ item, index }">
            <input
              type="text"
              class="comment-input"
              :placeholder="t('itemColors.comment')"
              :value="item.comment"
              :readonly="isReadonlyColorItem(item)"
              :disabled="isReadOnly"
              @input="updateSkillMissileDrawMode(index, 'comment', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <template #cell-actions="{ item, index }">
            <template v-if="isItemExtern(item)">
              <button
                v-if="getSkillMissileJumpTarget(item) !== undefined"
                class="btn btn-small btn-warning"
                @click="jumpToSkillMissileDrawMode(getSkillMissileJumpTarget(item)!)"
                :title="t('action.jumpToMain')"
              >→</button>
              <button
                v-if="!isReadOnly && getSkillMissileJumpTarget(item) === undefined"
                class="btn btn-small btn-accent"
                @click="duplicateSkillMissileDrawModeToMain(index)"
                :title="t('action.copyToMain')"
              >
                +
              </button>
            </template>
            <template v-else-if="item.isCommented || item.isDeleted">
              <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestoreSkillMissileDrawMode(index)" :title="t('action.restore')">
                ↩
              </button>
              <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
              <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
            </template>
            <template v-else-if="!isReadOnly">
              <button v-if="canCopyItemToMain(item)" class="btn btn-small btn-accent" @click="duplicateSkillMissileDrawModeToMain(index)" :title="t('action.copyToMain')">
                +
              </button>
              <button class="btn btn-small btn-secondary" @click="handleCommentSkillMissileDrawMode(index)" :title="t('action.comment')">
                //
              </button>
              <button class="btn btn-small btn-danger" @click="handleDeleteSkillMissileDrawMode(index)" :title="t('action.delete')">
                ×
              </button>
            </template>
          </template>
        </ConfigTable>
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
