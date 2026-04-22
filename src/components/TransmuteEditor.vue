<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useFileStorage } from '../composables/useFileStorage'
import {
  useItemActions,
  scrollToMainItemInList,
  getItemDescriptorKey,
  getCubeFormulaKey,
  getPreItemTaskKey,
  getDoTaskKey
} from '../composables/useItemActions'
import { useTransmuteItems } from '../composables/useTransmuteItems'
import { moveTransmuteItemInFile } from '../utils/grouping'
import { fitTextColumnWidth } from '../utils/columnWidth'
import { useI18n } from '../i18n'
import { useDebugMode } from '../composables/useDebugMode'
import { ACTION_TYPES } from '../configDefs'
import type { BaseConfigItem, CubeFormulaItem, DoTaskItem, ItemDescriptorItem, PreItemTaskItem } from '../types'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigTable from './ConfigTable.vue'
import ItemPicker from './ItemPicker.vue'
import QualityPicker from './QualityPicker.vue'
import StatGroupPicker from './StatGroupPicker.vue'
import DescriptorListPicker from './DescriptorListPicker.vue'
import NamePicker from './NamePicker.vue'
import DebugDrawer from './debug/DebugDrawer.vue'
import FlatListView from './debug/FlatListView.vue'
import type { ConfigTableColumn } from './configTable'

interface Props {
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
})

const { t } = useI18n()
const { config, exportSection, isReadOnly } = useConfig()
const { saveSubTab, loadSubTab } = useFileStorage()
const { debugMode } = useDebugMode()
const {
  markCommented,
  markRestored,
  isItemDisabled,
  isItemExtern,
  getItemRowClasses,
  refreshEffectiveStatus
} = useItemActions()
const {
  getAllTransmuteItems,
  addTransmuteItemToEditable,
  deleteTransmuteItemFromFile,
  filterBySearch
} = useTransmuteItems()

const AUTO_SUB_TABS = new Set(['itemDescriptors', 'cubeFormulas', 'preItemTasks', 'doTasks'])
const activeSubTab = ref('itemDescriptors')

watch(activeSubTab, (newTab) => {
  saveSubTab('autoTransmute', newTab)
  selectedItemDescriptors.value.clear()
  selectedCubeFormulas.value.clear()
  selectedPreItemTasks.value.clear()
  selectedDoTasks.value.clear()
})

onMounted(() => {
  const saved = loadSubTab('autoTransmute', '')
  if (AUTO_SUB_TABS.has(saved)) {
    activeSubTab.value = saved
    return
  }

  const legacySaved = loadSubTab('transmute', '')
  if (!legacySaved) return
  try {
    const parsed = JSON.parse(legacySaved) as { autoTransmute?: string }
    if (parsed.autoTransmute && AUTO_SUB_TABS.has(parsed.autoTransmute)) {
      activeSubTab.value = parsed.autoTransmute
    }
  } catch (e) {
    // ignore legacy parse errors
  }
})

const subTabsConfig = computed(() => [
  { id: 'itemDescriptors', label: t('tab.itemDescriptors') },
  { id: 'cubeFormulas', label: t('subTab.cubeFormulas') },
  { id: 'preItemTasks', label: t('subTab.preItemTasks') },
  { id: 'doTasks', label: t('subTab.doTasks') }
])

function handleExport(): void {
  exportSection('transmute')
}

function isTransmuteRowDisabled(item: BaseConfigItem): boolean {
  return isItemDisabled(item) || isItemExtern(item)
}

const itemDescriptors = computed(() => {
  const allItems = getAllTransmuteItems<ItemDescriptorItem>('itemDescriptors')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'itemId', 'comment')
})

const itemDescriptorNameWidth = computed(() => {
  return fitTextColumnWidth(itemDescriptors.value.map(item => item.name), t('transmute.name'), { min: 150, max: 360 })
})

const itemDescriptorLimitWidth = computed(() => {
  return fitTextColumnWidth(itemDescriptors.value.map(item => item.limitName), t('import.statGroup'), { min: 120, max: 260 })
})

const itemDescriptorColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'name', label: t('transmute.name'), width: itemDescriptorNameWidth.value, className: 'item-descriptor-name-col' },
  { key: 'itemId', label: t('transmute.itemId'), width: '150px', className: 'item-descriptor-item-id-col' },
  { key: 'quality', label: t('itemColors.quality'), width: '80px', className: 'item-descriptor-quality-col' },
  { key: 'limitName', label: t('import.statGroup'), width: itemDescriptorLimitWidth.value, className: 'item-descriptor-limit-col' },
  { key: 'count', label: t('transmute.count'), width: '80px', className: 'item-descriptor-count-col' },
  { key: 'comment', label: t('itemColors.comment'), width: '150px', className: 'item-descriptor-comment-col' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'item-descriptor-actions-col col-actions' }
])

const selectedItemDescriptors = ref<Set<ItemDescriptorItem>>(new Set())
const itemDescriptorDragIndex = ref<number | null>(null)
const itemDescriptorDragOverIndex = ref<number | null>(null)

const selectableItemDescriptorsCount = computed(() => {
  return itemDescriptors.value.filter(item => !isItemExtern(item)).length
})

function isReadonlyItemDescriptor(desc: ItemDescriptorItem): boolean {
  return isReadOnly.value || isItemDisabled(desc) || isItemExtern(desc)
}

function updateItemDescriptor(desc: ItemDescriptorItem, field: keyof ItemDescriptorItem, value: string) {
  if (!config.value || isReadonlyItemDescriptor(desc)) return
  ;(desc as ItemDescriptorItem)[field] = value as never
}

function updateItemDescriptorCount(desc: ItemDescriptorItem, value: string) {
  if (!config.value || isReadonlyItemDescriptor(desc)) return
  desc.count = value.replace(/\D+/g, '')
}

function toggleItemDescriptorSelectAll() {
  const selectableItems = itemDescriptors.value.filter(item => !isItemExtern(item))
  if (selectedItemDescriptors.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedItemDescriptors.value.clear()
  } else {
    selectedItemDescriptors.value = new Set(selectableItems)
  }
}

function toggleItemDescriptorSelect(item: ItemDescriptorItem) {
  if (selectedItemDescriptors.value.has(item)) {
    selectedItemDescriptors.value.delete(item)
  } else {
    selectedItemDescriptors.value.add(item)
  }
  selectedItemDescriptors.value = new Set(selectedItemDescriptors.value)
}

function isItemDescriptorSelected(item: ItemDescriptorItem) {
  return selectedItemDescriptors.value.has(item)
}

function hasItemDescriptorSelection() {
  return selectedItemDescriptors.value.size > 0
}

function batchDeleteItemDescriptors() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedItemDescriptors.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'itemDescriptors')
    }
  }
  selectedItemDescriptors.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestoreItemDescriptors() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedItemDescriptors.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedItemDescriptors.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentItemDescriptors() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedItemDescriptors.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedItemDescriptors.value.clear()
  refreshEffectiveStatus(config.value)
}

function hasItemDescriptorExternItems() {
  return itemDescriptors.value.some(item => isItemExtern(item))
}

function copyAllItemDescriptorExtern() {
  if (!config.value || isReadOnly.value) return
  const externItems = itemDescriptors.value.filter(item => isItemExtern(item))

  let copied = 0
  for (const item of externItems) {
    if (duplicateItemDescriptorToMain(item, true)) copied++
  }

  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

function handleItemDescriptorDragStart(e: DragEvent, index: number) {
  itemDescriptorDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleItemDescriptorDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  itemDescriptorDragOverIndex.value = index
}

function handleItemDescriptorDragLeave() {
  itemDescriptorDragOverIndex.value = null
}

function handleItemDescriptorDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = itemDescriptorDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    itemDescriptorDragIndex.value = null
    itemDescriptorDragOverIndex.value = null
    return
  }

  const filteredItems = itemDescriptors.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  const allItems = getAllTransmuteItems<ItemDescriptorItem>('itemDescriptors')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'itemDescriptors')
  if (!moved) {
    itemDescriptorDragIndex.value = null
    itemDescriptorDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  itemDescriptorDragIndex.value = null
  itemDescriptorDragOverIndex.value = null
}

function handleItemDescriptorDragEnd() {
  itemDescriptorDragIndex.value = null
  itemDescriptorDragOverIndex.value = null
}

const cubeFormulas = computed(() => {
  const allItems = getAllTransmuteItems<CubeFormulaItem>('cubeFormulas')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'comment')
})

const cubeFormulaNameWidth = computed(() => {
  return fitTextColumnWidth(cubeFormulas.value.map(item => item.name), t('transmute.name'), { min: 180, max: 360 })
})

const cubeFormulaColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'name', label: t('transmute.name'), width: cubeFormulaNameWidth.value, className: 'cube-formula-name-col' },
  { key: 'descriptors', label: t('transmute.itemDescriptor'), width: '160px', className: 'cube-formula-descriptors-col' },
  { key: 'comment', label: t('itemColors.comment'), width: '180px', className: 'cube-formula-comment-col' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'cube-formula-actions-col col-actions' }
])

const itemDescriptorNames = computed(() => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of itemDescriptors.value) {
    const name = item.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
})

const cubeFormulaNames = computed(() => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of cubeFormulas.value) {
    const name = item.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
})

const selectedCubeFormulas = ref<Set<CubeFormulaItem>>(new Set())
const cubeFormulaDragIndex = ref<number | null>(null)
const cubeFormulaDragOverIndex = ref<number | null>(null)

const selectableCubeFormulasCount = computed(() => {
  return cubeFormulas.value.filter(item => !isItemExtern(item)).length
})

const preItemTasks = computed(() => {
  const allItems = getAllTransmuteItems<PreItemTaskItem>('preItemTasks')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'itemId', 'comment')
})

const preItemTaskNames = computed(() => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of preItemTasks.value) {
    const name = item.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
})

const doTasks = computed(() => {
  const allItems = getAllTransmuteItems<DoTaskItem>('doTasks')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'preTask', 'comment')
})

const preItemTaskNameWidth = computed(() => {
  return fitTextColumnWidth(preItemTasks.value.map(item => item.name), t('transmute.name'), { min: 150, max: 360 })
})

const preItemTaskLimitWidth = computed(() => {
  return fitTextColumnWidth(preItemTasks.value.map(item => item.limitName), t('import.statGroup'), { min: 120, max: 260 })
})

const preItemTaskActionWidth = computed(() => {
  return fitTextColumnWidth(
    ACTION_TYPES.map(action => `[${action.value}] ${t(action.labelKey)}`),
    t('transmute.action'),
    { min: 150, max: 190, padding: 64 }
  )
})

const preItemTaskColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'name', label: t('transmute.name'), width: preItemTaskNameWidth.value, className: 'pre-item-task-name-col' },
  { key: 'itemId', label: t('transmute.itemId'), width: '150px', className: 'pre-item-task-item-id-col' },
  { key: 'quality', label: t('itemColors.quality'), width: '80px', className: 'pre-item-task-quality-col' },
  { key: 'limitName', label: t('import.statGroup'), width: preItemTaskLimitWidth.value, className: 'pre-item-task-limit-col' },
  { key: 'action', label: t('transmute.action'), width: preItemTaskActionWidth.value, className: 'pre-item-task-action-col' },
  { key: 'comment', label: t('itemColors.comment'), width: '150px', className: 'pre-item-task-comment-col' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'pre-item-task-actions-col col-actions' }
])

const doTaskNameWidth = computed(() => {
  return fitTextColumnWidth(doTasks.value.map(item => item.name), t('transmute.name'), { min: 150, max: 360 })
})

const doTaskPreTaskWidth = computed(() => {
  return fitTextColumnWidth([...doTasks.value.map(item => item.preTask), ...preItemTaskNames.value], t('transmute.preTask'), {
    min: 150,
    max: 300
  })
})

const doTaskFormulaWidth = computed(() => {
  return fitTextColumnWidth(
    doTasks.value.map(item => t('formulaPicker.count', { count: item.formulas.length })),
    t('transmute.formulas'),
    { min: 160, max: 220 }
  )
})

const doTaskColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'name', label: t('transmute.name'), width: doTaskNameWidth.value, className: 'do-task-name-col' },
  { key: 'preTask', label: t('transmute.preTask'), width: doTaskPreTaskWidth.value, className: 'do-task-pre-task-col' },
  { key: 'formulas', label: t('transmute.formulas'), width: doTaskFormulaWidth.value, className: 'do-task-formulas-col' },
  { key: 'comment', label: t('itemColors.comment'), width: '150px', className: 'do-task-comment-col' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'do-task-actions-col col-actions' }
])

const preItemTaskDragIndex = ref<number | null>(null)
const preItemTaskDragOverIndex = ref<number | null>(null)
const selectedPreItemTasks = ref<Set<PreItemTaskItem>>(new Set())
const doTaskDragIndex = ref<number | null>(null)
const doTaskDragOverIndex = ref<number | null>(null)
const selectedDoTasks = ref<Set<DoTaskItem>>(new Set())

const selectablePreItemTasksCount = computed(() => {
  return preItemTasks.value.filter(item => !isItemExtern(item)).length
})

const selectableDoTasksCount = computed(() => {
  return doTasks.value.filter(item => !isItemExtern(item)).length
})

function nextUniqueName(existingNames: string[], baseName: string): string {
  let name = baseName
  let counter = 1
  while (existingNames.includes(name)) {
    name = `${baseName}${counter++}`
  }
  return name
}

function addItemDescriptor() {
  if (!config.value || isReadOnly.value) return
  const name = nextUniqueName(
    getAllTransmuteItems<ItemDescriptorItem>('itemDescriptors').map(item => item.name),
    t('transmute.newItemDescriptor')
  )
  const newItem: ItemDescriptorItem = {
    name,
    itemId: '',
    quality: '',
    limitName: '',
    count: '1',
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('itemDescriptors', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => itemDescriptors.value, newItem, getItemDescriptorKey, '.item-descriptors-list')
}

function addCubeFormula() {
  if (!config.value || isReadOnly.value) return
  const name = nextUniqueName(
    getAllTransmuteItems<CubeFormulaItem>('cubeFormulas').map(item => item.name),
    t('transmute.newCubeFormula')
  )
  const newItem: CubeFormulaItem = {
    name,
    descriptors: [],
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('cubeFormulas', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => cubeFormulas.value, newItem, getCubeFormulaKey, '.cube-formulas-list')
}

function addPreItemTask() {
  if (!config.value || isReadOnly.value) return
  const name = nextUniqueName(
    getAllTransmuteItems<PreItemTaskItem>('preItemTasks').map(item => item.name),
    t('transmute.newPreItemTask')
  )
  const newItem: PreItemTaskItem = {
    name,
    itemId: '',
    quality: '',
    limitName: '',
    action: '1',
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('preItemTasks', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => preItemTasks.value, newItem, getPreItemTaskKey, '.pre-item-tasks-list')
}

function addDoTask() {
  if (!config.value || isReadOnly.value) return
  const name = nextUniqueName(
    getAllTransmuteItems<DoTaskItem>('doTasks').map(item => item.name),
    t('transmute.newDoTask')
  )
  const newItem: DoTaskItem = {
    name,
    preTask: '',
    formulas: [],
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('doTasks', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => doTasks.value, newItem, getDoTaskKey, '.do-tasks-list')
}

function duplicateItemDescriptorToMain(desc: ItemDescriptorItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(desc)) return false

  const newItem: ItemDescriptorItem = {
    name: desc.name,
    itemId: desc.itemId,
    quality: desc.quality,
    limitName: desc.limitName,
    count: desc.count,
    comment: desc.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('itemDescriptors', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => itemDescriptors.value, newItem, getItemDescriptorKey, '.item-descriptors-list')
  }
  return true
}

function duplicateCubeFormulaToMain(formula: CubeFormulaItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(formula)) return false

  const newItem: CubeFormulaItem = {
    name: formula.name,
    descriptors: [...formula.descriptors],
    comment: formula.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('cubeFormulas', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => cubeFormulas.value, newItem, getCubeFormulaKey, '.cube-formulas-list')
  }
  return true
}

function duplicatePreItemTaskToMain(task: PreItemTaskItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(task)) return false

  const newItem: PreItemTaskItem = {
    name: task.name,
    itemId: task.itemId,
    quality: task.quality,
    limitName: task.limitName,
    action: task.action,
    comment: task.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('preItemTasks', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => preItemTasks.value, newItem, getPreItemTaskKey, '.pre-item-tasks-list')
  }
  return true
}

function duplicateDoTaskToMain(task: DoTaskItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(task)) return false

  const newItem: DoTaskItem = {
    name: task.name,
    preTask: task.preTask,
    formulas: [...task.formulas],
    comment: task.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('doTasks', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => doTasks.value, newItem, getDoTaskKey, '.do-tasks-list')
  }
  return true
}

function handleItemDescriptorComment(desc: ItemDescriptorItem) {
  if (!config.value || isReadOnly.value) return
  markCommented(desc)
  refreshEffectiveStatus(config.value)
}

function handleItemDescriptorDelete(desc: ItemDescriptorItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(desc)) return

  deleteTransmuteItemFromFile(desc, 'itemDescriptors')
  refreshEffectiveStatus(config.value)
}

function handleItemDescriptorRestore(desc: ItemDescriptorItem) {
  if (!config.value || isReadOnly.value) return
  markRestored(desc)
  refreshEffectiveStatus(config.value)
}

function handleCubeFormulaComment(formula: CubeFormulaItem) {
  if (!config.value || isReadOnly.value) return
  markCommented(formula)
  refreshEffectiveStatus(config.value)
}

function handleCubeFormulaDelete(formula: CubeFormulaItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(formula)) return

  deleteTransmuteItemFromFile(formula, 'cubeFormulas')
  refreshEffectiveStatus(config.value)
}

function handleCubeFormulaRestore(formula: CubeFormulaItem) {
  if (!config.value || isReadOnly.value) return
  markRestored(formula)
  refreshEffectiveStatus(config.value)
}

function isReadonlyCubeFormula(formula: CubeFormulaItem): boolean {
  return isReadOnly.value || isItemDisabled(formula) || isItemExtern(formula)
}

function updateCubeFormula(formula: CubeFormulaItem, field: 'name' | 'comment', value: string) {
  if (!config.value || isReadonlyCubeFormula(formula)) return
  formula[field] = value
}

function updateCubeFormulaDescriptors(formula: CubeFormulaItem, value: string[]) {
  if (!config.value || isReadonlyCubeFormula(formula)) return
  formula.descriptors = [...value]
}

function toggleCubeFormulaSelectAll() {
  const selectableItems = cubeFormulas.value.filter(item => !isItemExtern(item))
  if (selectedCubeFormulas.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedCubeFormulas.value.clear()
  } else {
    selectedCubeFormulas.value = new Set(selectableItems)
  }
}

function toggleCubeFormulaSelect(item: CubeFormulaItem) {
  if (selectedCubeFormulas.value.has(item)) {
    selectedCubeFormulas.value.delete(item)
  } else {
    selectedCubeFormulas.value.add(item)
  }
  selectedCubeFormulas.value = new Set(selectedCubeFormulas.value)
}

function isCubeFormulaSelected(item: CubeFormulaItem) {
  return selectedCubeFormulas.value.has(item)
}

function hasCubeFormulaSelection() {
  return selectedCubeFormulas.value.size > 0
}

function batchDeleteCubeFormulas() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedCubeFormulas.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'cubeFormulas')
    }
  }
  selectedCubeFormulas.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestoreCubeFormulas() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedCubeFormulas.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedCubeFormulas.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentCubeFormulas() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedCubeFormulas.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedCubeFormulas.value.clear()
  refreshEffectiveStatus(config.value)
}

function hasCubeFormulaExternItems() {
  return cubeFormulas.value.some(item => isItemExtern(item))
}

function copyAllCubeFormulaExtern() {
  if (!config.value || isReadOnly.value) return
  const externItems = cubeFormulas.value.filter(item => isItemExtern(item))

  let copied = 0
  for (const item of externItems) {
    if (duplicateCubeFormulaToMain(item, true)) copied++
  }

  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

function handleCubeFormulaDragStart(e: DragEvent, index: number) {
  cubeFormulaDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleCubeFormulaDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  cubeFormulaDragOverIndex.value = index
}

function handleCubeFormulaDragLeave() {
  cubeFormulaDragOverIndex.value = null
}

function handleCubeFormulaDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = cubeFormulaDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    cubeFormulaDragIndex.value = null
    cubeFormulaDragOverIndex.value = null
    return
  }

  const filteredItems = cubeFormulas.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  const allItems = getAllTransmuteItems<CubeFormulaItem>('cubeFormulas')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'cubeFormulas')
  if (!moved) {
    cubeFormulaDragIndex.value = null
    cubeFormulaDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  cubeFormulaDragIndex.value = null
  cubeFormulaDragOverIndex.value = null
}

function handleCubeFormulaDragEnd() {
  cubeFormulaDragIndex.value = null
  cubeFormulaDragOverIndex.value = null
}

function handlePreItemTaskDragStart(e: DragEvent, index: number) {
  preItemTaskDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handlePreItemTaskDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  preItemTaskDragOverIndex.value = index
}

function handlePreItemTaskDragLeave() {
  preItemTaskDragOverIndex.value = null
}

function handlePreItemTaskDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = preItemTaskDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    preItemTaskDragIndex.value = null
    preItemTaskDragOverIndex.value = null
    return
  }

  const filteredItems = preItemTasks.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  const allItems = getAllTransmuteItems<PreItemTaskItem>('preItemTasks')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'preItemTasks')
  if (!moved) {
    preItemTaskDragIndex.value = null
    preItemTaskDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  preItemTaskDragIndex.value = null
  preItemTaskDragOverIndex.value = null
}

function handlePreItemTaskDragEnd() {
  preItemTaskDragIndex.value = null
  preItemTaskDragOverIndex.value = null
}

function isReadonlyPreItemTask(task: PreItemTaskItem): boolean {
  return isReadOnly.value || isItemDisabled(task) || isItemExtern(task)
}

function updatePreItemTask(task: PreItemTaskItem, field: keyof PreItemTaskItem, value: string) {
  if (!config.value || isReadonlyPreItemTask(task)) return
  ;(task as PreItemTaskItem)[field] = value as never
}

function togglePreItemTaskSelectAll() {
  const selectableItems = preItemTasks.value.filter(item => !isItemExtern(item))
  if (selectedPreItemTasks.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedPreItemTasks.value.clear()
  } else {
    selectedPreItemTasks.value = new Set(selectableItems)
  }
}

function togglePreItemTaskSelect(item: PreItemTaskItem) {
  if (selectedPreItemTasks.value.has(item)) {
    selectedPreItemTasks.value.delete(item)
  } else {
    selectedPreItemTasks.value.add(item)
  }
  selectedPreItemTasks.value = new Set(selectedPreItemTasks.value)
}

function isPreItemTaskSelected(item: PreItemTaskItem) {
  return selectedPreItemTasks.value.has(item)
}

function hasPreItemTaskSelection() {
  return selectedPreItemTasks.value.size > 0
}

function batchDeletePreItemTasks() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedPreItemTasks.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'preItemTasks')
    }
  }
  selectedPreItemTasks.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestorePreItemTasks() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedPreItemTasks.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedPreItemTasks.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentPreItemTasks() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedPreItemTasks.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedPreItemTasks.value.clear()
  refreshEffectiveStatus(config.value)
}

function hasPreItemTaskExternItems() {
  return preItemTasks.value.some(item => isItemExtern(item))
}

function copyAllPreItemTaskExtern() {
  if (!config.value || isReadOnly.value) return
  const externItems = preItemTasks.value.filter(item => isItemExtern(item))

  let copied = 0
  for (const item of externItems) {
    if (duplicatePreItemTaskToMain(item, true)) copied++
  }

  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

function handleDoTaskDragStart(e: DragEvent, index: number) {
  doTaskDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleDoTaskDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  doTaskDragOverIndex.value = index
}

function handleDoTaskDragLeave() {
  doTaskDragOverIndex.value = null
}

function handleDoTaskDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = doTaskDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    doTaskDragIndex.value = null
    doTaskDragOverIndex.value = null
    return
  }

  const filteredItems = doTasks.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  const allItems = getAllTransmuteItems<DoTaskItem>('doTasks')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'doTasks')
  if (!moved) {
    doTaskDragIndex.value = null
    doTaskDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  doTaskDragIndex.value = null
  doTaskDragOverIndex.value = null
}

function handleDoTaskDragEnd() {
  doTaskDragIndex.value = null
  doTaskDragOverIndex.value = null
}

function isReadonlyDoTask(task: DoTaskItem): boolean {
  return isReadOnly.value || isItemDisabled(task) || isItemExtern(task)
}

function updateDoTask(task: DoTaskItem, field: 'name' | 'preTask' | 'comment', value: string) {
  if (!config.value || isReadonlyDoTask(task)) return
  task[field] = value
}

function updateDoTaskFormulas(task: DoTaskItem, value: string[]) {
  if (!config.value || isReadonlyDoTask(task)) return
  task.formulas = [...value]
}

function toggleDoTaskSelectAll() {
  const selectableItems = doTasks.value.filter(item => !isItemExtern(item))
  if (selectedDoTasks.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedDoTasks.value.clear()
  } else {
    selectedDoTasks.value = new Set(selectableItems)
  }
}

function toggleDoTaskSelect(item: DoTaskItem) {
  if (selectedDoTasks.value.has(item)) {
    selectedDoTasks.value.delete(item)
  } else {
    selectedDoTasks.value.add(item)
  }
  selectedDoTasks.value = new Set(selectedDoTasks.value)
}

function isDoTaskSelected(item: DoTaskItem) {
  return selectedDoTasks.value.has(item)
}

function hasDoTaskSelection() {
  return selectedDoTasks.value.size > 0
}

function batchDeleteDoTasks() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedDoTasks.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'doTasks')
    }
  }
  selectedDoTasks.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestoreDoTasks() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedDoTasks.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedDoTasks.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentDoTasks() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedDoTasks.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedDoTasks.value.clear()
  refreshEffectiveStatus(config.value)
}

function hasDoTaskExternItems() {
  return doTasks.value.some(item => isItemExtern(item))
}

function copyAllDoTaskExtern() {
  if (!config.value || isReadOnly.value) return
  const externItems = doTasks.value.filter(item => isItemExtern(item))

  let copied = 0
  for (const item of externItems) {
    if (duplicateDoTaskToMain(item, true)) copied++
  }

  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

function handlePreItemTaskComment(task: PreItemTaskItem) {
  if (!config.value || isReadOnly.value) return
  markCommented(task)
  refreshEffectiveStatus(config.value)
}

function handlePreItemTaskDelete(task: PreItemTaskItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(task)) return

  deleteTransmuteItemFromFile(task, 'preItemTasks')
  refreshEffectiveStatus(config.value)
}

function handlePreItemTaskRestore(task: PreItemTaskItem) {
  if (!config.value || isReadOnly.value) return
  markRestored(task)
  refreshEffectiveStatus(config.value)
}

function handleDoTaskComment(task: DoTaskItem) {
  if (!config.value || isReadOnly.value) return
  markCommented(task)
  refreshEffectiveStatus(config.value)
}

function handleDoTaskDelete(task: DoTaskItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(task)) return

  deleteTransmuteItemFromFile(task, 'doTasks')
  refreshEffectiveStatus(config.value)
}

function handleDoTaskRestore(task: DoTaskItem) {
  if (!config.value || isReadOnly.value) return
  markRestored(task)
  refreshEffectiveStatus(config.value)
}

type TransmuteDebugItem = ItemDescriptorItem | CubeFormulaItem | PreItemTaskItem | DoTaskItem

const currentDebugItems = computed<TransmuteDebugItem[]>(() => {
  if (activeSubTab.value === 'cubeFormulas') {
    return getAllTransmuteItems<CubeFormulaItem>('cubeFormulas')
  }
  if (activeSubTab.value === 'preItemTasks') {
    return getAllTransmuteItems<PreItemTaskItem>('preItemTasks')
  }
  if (activeSubTab.value === 'doTasks') {
    return getAllTransmuteItems<DoTaskItem>('doTasks')
  }
  return getAllTransmuteItems<ItemDescriptorItem>('itemDescriptors')
})

const currentDebugTitle = computed(() => {
  if (activeSubTab.value === 'cubeFormulas') return 'Cube Formulas'
  if (activeSubTab.value === 'preItemTasks') return 'Pre Item Tasks'
  if (activeSubTab.value === 'doTasks') return 'Do Tasks'
  return 'Item Descriptors'
})

function getCurrentDebugKey(item: TransmuteDebugItem): string {
  if (activeSubTab.value === 'cubeFormulas') {
    return getCubeFormulaKey(item as CubeFormulaItem)
  }
  if (activeSubTab.value === 'preItemTasks') {
    return getPreItemTaskKey(item as PreItemTaskItem)
  }
  if (activeSubTab.value === 'doTasks') {
    return getDoTaskKey(item as DoTaskItem)
  }
  return getItemDescriptorKey(item as ItemDescriptorItem)
}

function formatCurrentDebugItem(item: TransmuteDebugItem): string {
  if (activeSubTab.value === 'cubeFormulas') {
    const formula = item as CubeFormulaItem
    return `${formula.name}: ${formula.descriptors.join(', ')}`
  }
  if (activeSubTab.value === 'preItemTasks') {
    const task = item as PreItemTaskItem
    return `${task.name}: item=${task.itemId}, quality=${task.quality}, limit=${task.limitName}, action=${task.action}`
  }
  if (activeSubTab.value === 'doTasks') {
    const task = item as DoTaskItem
    return `${task.name}: pre=${task.preTask}, formulas=${task.formulas.join(', ')}`
  }
  const desc = item as ItemDescriptorItem
  return `${desc.name}: item=${desc.itemId}, quality=${desc.quality}, limit=${desc.limitName}, count=${desc.count}`
}
</script>

<template>
  <div class="transmute-editor">
    <EditorPanel v-show="activeSubTab === 'itemDescriptors'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
      </template>
      <template #batch-bar>
        <div v-if="hasItemDescriptorSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedItemDescriptors.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestoreItemDescriptors">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentItemDescriptors">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeleteItemDescriptors">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasItemDescriptorExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllItemDescriptorExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-primary btn-small" @click="addItemDescriptor">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="itemDescriptors"
        :columns="itemDescriptorColumns"
        :empty-text="t('transmute.empty.itemDescriptors')"
        list-class="item-descriptors-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedItemDescriptors.size === selectableItemDescriptorsCount && selectableItemDescriptorsCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isItemDescriptorSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="itemDescriptorDragOverIndex"
        :row-classes="getItemRowClasses"
        @select-all="toggleItemDescriptorSelectAll"
        @select="toggleItemDescriptorSelect"
        @dragstart="handleItemDescriptorDragStart"
        @dragover="handleItemDescriptorDragOver"
        @dragleave="handleItemDescriptorDragLeave"
        @drop="handleItemDescriptorDrop"
        @dragend="handleItemDescriptorDragEnd"
      >
        <template #cell-name="{ item: desc }">
          <input
            type="text"
            :value="desc.name"
            :readonly="isReadonlyItemDescriptor(desc)"
            :disabled="isReadOnly"
            @input="updateItemDescriptor(desc, 'name', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-itemId="{ item: desc }">
          <ItemPicker
            :modelValue="desc.itemId"
            :placeholder="t('transmute.itemId')"
            :disabled="isReadOnly"
            :readonly="isReadonlyItemDescriptor(desc)"
            @update:modelValue="updateItemDescriptor(desc, 'itemId', $event)"
          />
        </template>
        <template #cell-quality="{ item: desc }">
          <QualityPicker
            :modelValue="desc.quality"
            :disabled="isReadOnly"
            :readonly="isReadonlyItemDescriptor(desc)"
            @update:modelValue="updateItemDescriptor(desc, 'quality', $event)"
          />
        </template>
        <template #cell-limitName="{ item: desc }">
          <StatGroupPicker
            :modelValue="desc.limitName"
            :disabled="isReadOnly"
            :readonly="isReadonlyItemDescriptor(desc)"
            @update:modelValue="updateItemDescriptor(desc, 'limitName', $event)"
          />
        </template>
        <template #cell-count="{ item: desc }">
          <input
            type="number"
            min="0"
            step="1"
            :value="desc.count"
            :readonly="isReadonlyItemDescriptor(desc)"
            :disabled="isReadOnly"
            @input="updateItemDescriptorCount(desc, ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-comment="{ item: desc }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="desc.comment"
            :readonly="isReadonlyItemDescriptor(desc)"
            :disabled="isReadOnly"
            @input="updateItemDescriptor(desc, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: desc }">
          <template v-if="isItemExtern(desc)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateItemDescriptorToMain(desc)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="desc.sourceFile || undefined">{{ desc.sourceFile }}</span>
          </template>
          <template v-else-if="desc.isCommented || desc.isDeleted">
            <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleItemDescriptorRestore(desc)" :title="t('action.restore')">↩</button>
            <span v-if="desc.isCommented" class="status-tag tag-commented">//</span>
            <span v-if="desc.isDeleted" class="status-tag tag-deleted">×</span>
          </template>
          <template v-else-if="!isReadOnly">
            <button class="btn btn-small btn-secondary" @click="handleItemDescriptorComment(desc)" :title="t('action.comment')">//</button>
            <button class="btn btn-small btn-danger" @click="handleItemDescriptorDelete(desc)" :title="t('action.delete')">×</button>
          </template>
        </template>
      </ConfigTable>
    </EditorPanel>

    <EditorPanel v-show="activeSubTab === 'cubeFormulas'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
      </template>
      <template #batch-bar>
        <div v-if="hasCubeFormulaSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedCubeFormulas.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestoreCubeFormulas">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentCubeFormulas">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeleteCubeFormulas">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasCubeFormulaExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllCubeFormulaExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-primary btn-small" @click="addCubeFormula">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="cubeFormulas"
        :columns="cubeFormulaColumns"
        :empty-text="t('transmute.empty.cubeFormulas')"
        list-class="cube-formulas-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedCubeFormulas.size === selectableCubeFormulasCount && selectableCubeFormulasCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isCubeFormulaSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="cubeFormulaDragOverIndex"
        :row-classes="getItemRowClasses"
        @select-all="toggleCubeFormulaSelectAll"
        @select="toggleCubeFormulaSelect"
        @dragstart="handleCubeFormulaDragStart"
        @dragover="handleCubeFormulaDragOver"
        @dragleave="handleCubeFormulaDragLeave"
        @drop="handleCubeFormulaDrop"
        @dragend="handleCubeFormulaDragEnd"
      >
        <template #cell-name="{ item: formula }">
          <input
            type="text"
            :value="formula.name"
            :readonly="isReadonlyCubeFormula(formula)"
            :disabled="isReadOnly"
            @input="updateCubeFormula(formula, 'name', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-descriptors="{ item: formula }">
          <DescriptorListPicker
            :model-value="formula.descriptors"
            :options="itemDescriptorNames"
            :disabled="isReadOnly"
            :readonly="isReadonlyCubeFormula(formula)"
            @update:model-value="updateCubeFormulaDescriptors(formula, $event)"
          />
        </template>
        <template #cell-comment="{ item: formula }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="formula.comment"
            :readonly="isReadonlyCubeFormula(formula)"
            :disabled="isReadOnly"
            @input="updateCubeFormula(formula, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: formula }">
          <template v-if="isItemExtern(formula)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateCubeFormulaToMain(formula)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="formula.sourceFile || undefined">{{ formula.sourceFile }}</span>
          </template>
          <template v-else-if="formula.isCommented || formula.isDeleted">
            <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleCubeFormulaRestore(formula)" :title="t('action.restore')">↩</button>
            <span v-if="formula.isCommented" class="status-tag tag-commented">//</span>
            <span v-if="formula.isDeleted" class="status-tag tag-deleted">×</span>
          </template>
          <template v-else-if="!isReadOnly">
            <button class="btn btn-small btn-secondary" @click="handleCubeFormulaComment(formula)" :title="t('action.comment')">//</button>
            <button class="btn btn-small btn-danger" @click="handleCubeFormulaDelete(formula)" :title="t('action.delete')">×</button>
          </template>
        </template>
      </ConfigTable>
    </EditorPanel>

    <EditorPanel v-show="activeSubTab === 'preItemTasks'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
      </template>
      <template #batch-bar>
        <div v-if="hasPreItemTaskSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedPreItemTasks.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestorePreItemTasks">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentPreItemTasks">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeletePreItemTasks">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasPreItemTaskExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllPreItemTaskExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-primary btn-small" @click="addPreItemTask">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="preItemTasks"
        :columns="preItemTaskColumns"
        :empty-text="t('transmute.empty.preItemTasks')"
        list-class="pre-item-tasks-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedPreItemTasks.size === selectablePreItemTasksCount && selectablePreItemTasksCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isPreItemTaskSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="preItemTaskDragOverIndex"
        :row-classes="getItemRowClasses"
        :row-key="(task, index) => `${getPreItemTaskKey(task)}-${task.sourceFile || 'main'}-${index}`"
        @select-all="togglePreItemTaskSelectAll"
        @select="togglePreItemTaskSelect"
        @dragstart="handlePreItemTaskDragStart"
        @dragover="handlePreItemTaskDragOver"
        @dragleave="handlePreItemTaskDragLeave"
        @drop="handlePreItemTaskDrop"
        @dragend="handlePreItemTaskDragEnd"
      >
        <template #cell-name="{ item: task }">
          <input
            type="text"
            :value="task.name"
            :readonly="isReadonlyPreItemTask(task)"
            :disabled="isReadOnly"
            @input="updatePreItemTask(task, 'name', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-itemId="{ item: task }">
          <ItemPicker
            :modelValue="task.itemId"
            :placeholder="t('transmute.itemId')"
            :disabled="isReadOnly"
            :readonly="isReadonlyPreItemTask(task)"
            @update:modelValue="updatePreItemTask(task, 'itemId', $event)"
          />
        </template>
        <template #cell-quality="{ item: task }">
          <QualityPicker
            :modelValue="task.quality"
            :disabled="isReadOnly"
            :readonly="isReadonlyPreItemTask(task)"
            @update:modelValue="updatePreItemTask(task, 'quality', $event)"
          />
        </template>
        <template #cell-limitName="{ item: task }">
          <StatGroupPicker
            :modelValue="task.limitName"
            :disabled="isReadOnly"
            :readonly="isReadonlyPreItemTask(task)"
            @update:modelValue="updatePreItemTask(task, 'limitName', $event)"
          />
        </template>
        <template #cell-action="{ item: task }">
          <select
            :value="task.action"
            :disabled="isReadonlyPreItemTask(task)"
            @change="updatePreItemTask(task, 'action', ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="action in ACTION_TYPES"
              :key="action.value"
              :value="action.value"
            >[{{ action.value }}] {{ t(action.labelKey) }}</option>
          </select>
        </template>
        <template #cell-comment="{ item: task }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="task.comment"
            :readonly="isReadonlyPreItemTask(task)"
            :disabled="isReadOnly"
            @input="updatePreItemTask(task, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: task }">
          <template v-if="isItemExtern(task)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicatePreItemTaskToMain(task)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="task.sourceFile || undefined">{{ task.sourceFile }}</span>
          </template>
          <template v-else-if="task.isCommented || task.isDeleted">
            <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handlePreItemTaskRestore(task)" :title="t('action.restore')">↩</button>
            <span v-if="task.isCommented" class="status-tag tag-commented">//</span>
            <span v-if="task.isDeleted" class="status-tag tag-deleted">×</span>
          </template>
          <template v-else-if="!isReadOnly">
            <button class="btn btn-small btn-secondary" @click="handlePreItemTaskComment(task)" :title="t('action.comment')">//</button>
            <button class="btn btn-small btn-danger" @click="handlePreItemTaskDelete(task)" :title="t('action.delete')">×</button>
          </template>
        </template>
      </ConfigTable>
    </EditorPanel>

    <EditorPanel v-show="activeSubTab === 'doTasks'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
      </template>
      <template #batch-bar>
        <div v-if="hasDoTaskSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedDoTasks.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestoreDoTasks">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentDoTasks">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeleteDoTasks">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasDoTaskExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllDoTaskExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-primary btn-small" @click="addDoTask">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="doTasks"
        :columns="doTaskColumns"
        :empty-text="t('transmute.empty.doTasks')"
        list-class="do-tasks-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedDoTasks.size === selectableDoTasksCount && selectableDoTasksCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isDoTaskSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="doTaskDragOverIndex"
        :row-classes="getItemRowClasses"
        :row-key="(task, index) => `${getDoTaskKey(task)}-${task.sourceFile || 'main'}-${index}`"
        @select-all="toggleDoTaskSelectAll"
        @select="toggleDoTaskSelect"
        @dragstart="handleDoTaskDragStart"
        @dragover="handleDoTaskDragOver"
        @dragleave="handleDoTaskDragLeave"
        @drop="handleDoTaskDrop"
        @dragend="handleDoTaskDragEnd"
      >
        <template #cell-name="{ item: task }">
          <input
            type="text"
            :value="task.name"
            :readonly="isReadonlyDoTask(task)"
            :disabled="isReadOnly"
            @input="updateDoTask(task, 'name', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-preTask="{ item: task }">
          <NamePicker
            :model-value="task.preTask"
            :options="preItemTaskNames"
            :disabled="isReadOnly"
            :readonly="isReadonlyDoTask(task)"
            title-key="preTaskPicker.title"
            placeholder-key="preTaskPicker.placeholder"
            empty-key="preTaskPicker.empty"
            no-match-key="preTaskPicker.noMatch"
            @update:model-value="updateDoTask(task, 'preTask', $event)"
          />
        </template>
        <template #cell-formulas="{ item: task }">
          <DescriptorListPicker
            :model-value="task.formulas"
            :options="cubeFormulaNames"
            :disabled="isReadOnly"
            :readonly="isReadonlyDoTask(task)"
            title-key="formulaPicker.title"
            placeholder-key="formulaPicker.placeholder"
            available-key="formulaPicker.available"
            selected-list-key="formulaPicker.selectedList"
            count-key="formulaPicker.count"
            empty-key="formulaPicker.empty"
            no-match-key="formulaPicker.noMatch"
            no-selection-key="formulaPicker.noSelection"
            @update:model-value="updateDoTaskFormulas(task, $event)"
          />
        </template>
        <template #cell-comment="{ item: task }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="task.comment"
            :readonly="isReadonlyDoTask(task)"
            :disabled="isReadOnly"
            @input="updateDoTask(task, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: task }">
          <template v-if="isItemExtern(task)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateDoTaskToMain(task)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="task.sourceFile || undefined">{{ task.sourceFile }}</span>
          </template>
          <template v-else-if="task.isCommented || task.isDeleted">
            <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleDoTaskRestore(task)" :title="t('action.restore')">↩</button>
            <span v-if="task.isCommented" class="status-tag tag-commented">//</span>
            <span v-if="task.isDeleted" class="status-tag tag-deleted">×</span>
          </template>
          <template v-else-if="!isReadOnly">
            <button class="btn btn-small btn-secondary" @click="handleDoTaskComment(task)" :title="t('action.comment')">//</button>
            <button class="btn btn-small btn-danger" @click="handleDoTaskDelete(task)" :title="t('action.delete')">×</button>
          </template>
        </template>
      </ConfigTable>
    </EditorPanel>

    <DebugDrawer v-if="debugMode">
      <FlatListView
        :items="currentDebugItems"
        :title="currentDebugTitle"
        :get-key="getCurrentDebugKey"
        :format-item="formatCurrentDebugItem"
      />
    </DebugDrawer>
  </div>
</template>

<style scoped>
.config-list {
  max-height: calc(60vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
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

.item-descriptors-list .item-descriptor-name-col {
  flex: 0 0 150px;
  width: 150px;
}

.item-descriptors-list .item-descriptor-item-id-col {
  flex: 0 0 150px;
  width: 150px;
}

.item-descriptors-list :deep(.item-descriptor-item-id-col .item-display) {
  width: 100%;
  min-width: 0;
  max-width: none;
  box-sizing: border-box;
}

.item-descriptors-list .item-descriptor-quality-col {
  flex: 0 0 80px;
  width: 80px;
}

.item-descriptors-list .item-descriptor-limit-col {
  flex: 0 0 120px;
  width: 120px;
}

.item-descriptors-list .item-descriptor-count-col {
  flex: 0 0 80px;
  width: 80px;
}

.item-descriptors-list .item-descriptor-comment-col {
  flex: 0 0 150px;
  width: 150px;
  max-width: 150px;
}

.item-descriptors-list .item-descriptor-actions-col,
.item-descriptors-list :deep(.col-actions) {
  flex: 0 0 220px;
  width: 220px;
}

.cube-formulas-list .cube-formula-name-col {
  flex: 0 0 180px;
  width: 180px;
}

.cube-formulas-list .cube-formula-descriptors-col {
  flex: 0 0 160px;
  width: 160px;
}

.cube-formulas-list .cube-formula-comment-col {
  flex: 0 0 180px;
  width: 180px;
}

.cube-formulas-list .cube-formula-actions-col,
.cube-formulas-list :deep(.col-actions) {
  flex: 0 0 220px;
  width: 220px;
}

.comment-text {
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.config-row.flex-col {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.row-extern {
  background: var(--bg-tertiary);
}

.row-extern:hover {
  background: var(--bg-tertiary);
}

.row-commented {
  opacity: 0.6;
  background: var(--bg-tertiary);
}

.row-deleted {
  opacity: 0.5;
  background: var(--bg-tertiary);
  text-decoration: line-through;
}
</style>
