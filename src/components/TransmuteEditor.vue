<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useValidation } from '../composables/useValidation'
import { useFileStorage } from '../composables/useFileStorage'
import {
  useItemActions,
  getEditableFile,
  scrollToMainItemInList,
  getStatLimitKey,
  getStatLimitGroupKey,
  getItemDescriptorKey,
  getCubeFormulaKey,
  getPreItemTaskKey,
  getDoTaskKey,
  getKeyBindingKey
} from '../composables/useItemActions'
import { moveTransmuteItemInFile } from '../utils/grouping'
import { useI18n } from '../i18n'
import { RELATION_TYPES, ACTION_TYPES, VK_CODES } from '../configDefs'
import type { StatLimitItem, StatLimitGroupItem, ItemDescriptorItem, CubeFormulaItem, PreItemTaskItem, DoTaskItem, KeyBindingItem, BaseConfigItem } from '../types'

// Helper to get all transmute items from all files
type TransmuteArrayKey = 'statLimits' | 'statLimitGroups' | 'itemDescriptors' | 'cubeFormulas' | 'preItemTasks' | 'doTasks' | 'keyBindings'

function getAllTransmuteItems<T extends BaseConfigItem>(arrayName: TransmuteArrayKey): T[] {
  if (!config.value) return []
  const result: T[] = []
  for (const fileConfig of config.value.files) {
    const array = fileConfig.data.transmute[arrayName] as unknown as T[]
    result.push(...array)
  }
  return result
}

// Helper to add item to editable file's transmute array
function addTransmuteItemToEditable<T extends BaseConfigItem>(arrayName: TransmuteArrayKey, item: T): boolean {
  if (!config.value) return false
  const editableFile = getEditableFile(config.value)
  if (!editableFile) return false
  const array = editableFile.data.transmute[arrayName] as unknown as T[]
  array.push(item)
  return true
}

// Helper to delete item from transmute array
function deleteTransmuteItemFromFile<T extends BaseConfigItem>(item: T, arrayName: TransmuteArrayKey): boolean {
  if (!config.value) return false

  for (const fileConfig of config.value.files) {
    const array = fileConfig.data.transmute[arrayName] as unknown as T[]
    const index = array.indexOf(item)
    if (index === -1) continue

    // Can only delete from editable files
    if (!fileConfig.isEditable) return false

    if (item.isNew) {
      array.splice(index, 1)
    } else {
      item.isDeleted = true
      item.isCommented = false
    }
    return true
  }
  return false
}
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigHeader from './ConfigHeader.vue'
import ConfigRow from './ConfigRow.vue'
import StatPicker from './StatPicker.vue'

const { t } = useI18n()

interface Props {
  searchQuery?: string
  activeSection?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  activeSection: 'statLimitGroup'
})

const { config, exportSection, isReadOnly } = useConfig()
const { transmuteValidation, validationSummary, refreshValidation } = useValidation()
const { saveSubTab, loadSubTab } = useFileStorage()
const { markDeleted, markCommented, markRestored, isItemDisabled, isItemExtern, isItemEffective, getItemRowClasses, refreshEffectiveStatus } = useItemActions()

function handleExport(): void {
  exportSection('transmute')
}

interface SubTabState {
  statLimitGroup: string
  autoTransmute: string
  [key: string]: string
}

const activeSubTabs = ref<SubTabState>({
  statLimitGroup: 'statLimits',
  autoTransmute: 'cubeFormulas'
})

// Watch and save sub-tab changes
watch(activeSubTabs, (newTabs) => {
  saveSubTab('transmute', JSON.stringify(newTabs))
}, { deep: true })

// Load saved sub-tabs on mount
onMounted(() => {
  const saved = loadSubTab('transmute', '')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      Object.assign(activeSubTabs.value, parsed)
    } catch (e) {
      // ignore parse errors
    }
  }
})

const subTabsConfig = computed(() => ({
  statLimitGroup: [
    { id: 'statLimits', label: t('subTab.statLimits') },
    { id: 'statLimitGroups', label: t('subTab.statLimitGroups') }
  ],
  autoTransmute: [
    { id: 'cubeFormulas', label: t('subTab.cubeFormulas') },
    { id: 'preItemTasks', label: t('subTab.preItemTasks') },
    { id: 'doTasks', label: t('subTab.doTasks') }
  ]
}))

// Helper to filter by search query
function filterBySearch<T extends BaseConfigItem>(items: T[], ...fields: (keyof T)[]): T[] {
  if (!props.searchQuery) return items
  const q = props.searchQuery.toLowerCase()
  return items.filter(item =>
    fields.some(f => String(item[f] ?? '').toLowerCase().includes(q))
  )
}

// Stat Limits
const statLimits = computed(() => {
  const allItems = getAllTransmuteItems<StatLimitItem>('statLimits')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'name', 'statId', 'comment')
})

// Selection state for stat limits
const selectedStatLimits = ref<Set<StatLimitItem>>(new Set())

// Drag state for stat limits
const statLimitDragIndex = ref<number | null>(null)
const statLimitDragOverIndex = ref<number | null>(null)

// Selectable count (exclude extern items)
const selectableStatLimitsCount = computed(() => {
  return statLimits.value.filter(item => !isItemExtern(item)).length
})

// Selection functions
function toggleStatLimitSelectAll() {
  const selectableItems = statLimits.value.filter(item => !isItemExtern(item))
  if (selectedStatLimits.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedStatLimits.value.clear()
  } else {
    selectedStatLimits.value = new Set(selectableItems)
  }
}

function toggleStatLimitSelect(item: StatLimitItem) {
  if (selectedStatLimits.value.has(item)) {
    selectedStatLimits.value.delete(item)
  } else {
    selectedStatLimits.value.add(item)
  }
  // Trigger reactivity
  selectedStatLimits.value = new Set(selectedStatLimits.value)
}

function isStatLimitSelected(item: StatLimitItem) {
  return selectedStatLimits.value.has(item)
}

function hasStatLimitSelection() {
  return selectedStatLimits.value.size > 0
}

// Batch operations
function batchDeleteStatLimits() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedStatLimits.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'statLimits')
    }
  }
  selectedStatLimits.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestoreStatLimits() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedStatLimits.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedStatLimits.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentStatLimits() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedStatLimits.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedStatLimits.value.clear()
  refreshEffectiveStatus(config.value)
}

// Clear selection when switching tabs
watch(activeSubTabs, () => {
  selectedStatLimits.value.clear()
}, { deep: true })

// Drag and drop for stat limits
function handleStatLimitDragStart(e: DragEvent, index: number) {
  statLimitDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleStatLimitDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  statLimitDragOverIndex.value = index
}

function handleStatLimitDragLeave() {
  statLimitDragOverIndex.value = null
}

function handleStatLimitDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = statLimitDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    statLimitDragIndex.value = null
    statLimitDragOverIndex.value = null
    return
  }

  const filteredItems = statLimits.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  // Find target item's index in merged list
  const allItems = getAllTransmuteItems<StatLimitItem>('statLimits')
  const targetItem = filteredItems[targetIndex]
  const targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return

  // Move item within its file
  moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'statLimits')

  // Refresh effective status after reorder
  refreshEffectiveStatus(config.value)

  statLimitDragIndex.value = null
  statLimitDragOverIndex.value = null
}

function handleStatLimitDragEnd() {
  statLimitDragIndex.value = null
  statLimitDragOverIndex.value = null
}

// Calculate width for limit name column based on visible items
const limitNameWidth = computed(() => {
  const items = statLimits.value
  if (!items || items.length === 0) return '80px'
  let maxLen = 0
  for (const item of items) {
    const len = item.name?.length || 0
    if (len > maxLen) maxLen = len
  }
  // ~12px per char, min 80px, max 200px
  const width = Math.min(200, Math.max(80, maxLen * 12 + 16))
  return `${width}px`
})

// Stat Limit Groups
const statLimitGroups = computed(() => {
  const allItems = getAllTransmuteItems<StatLimitGroupItem>('statLimitGroups')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'name', 'comment')
})

// Item Descriptors
const itemDescriptors = computed(() => {
  const allItems = getAllTransmuteItems<ItemDescriptorItem>('itemDescriptors')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'name', 'itemId', 'comment')
})

// Cube Formulas
const cubeFormulas = computed(() => {
  const allItems = getAllTransmuteItems<CubeFormulaItem>('cubeFormulas')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'name', 'comment')
})

// Pre Item Tasks
const preItemTasks = computed(() => {
  const allItems = getAllTransmuteItems<PreItemTaskItem>('preItemTasks')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'name', 'itemId', 'comment')
})

// Do Tasks
const doTasks = computed(() => {
  const allItems = getAllTransmuteItems<DoTaskItem>('doTasks')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'name', 'preTask', 'comment')
})

// Key Bindings
const keyBindings = computed(() => {
  const allItems = getAllTransmuteItems<KeyBindingItem>('keyBindings')
  let items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, 'keyCode', 'command', 'comment')
})

// Duplicate functions - add item to editable file
function duplicateStatLimitToMain(item: StatLimitItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(item)) return false

  // Check for duplicate: skip if main config already has effective stat limit with same name
  const allItems = getAllTransmuteItems<StatLimitItem>('statLimits')
  const hasMainEffective = allItems.some(s =>
    s.name === item.name && s.sourceFile === null && isItemEffective(s)
  )
  if (hasMainEffective) return false

  // Add new main item
  const newItem: StatLimitItem = {
    name: item.name,
    statId: item.statId,
    param: item.param,
    min: item.min,
    max: item.max,
    comment: item.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('statLimits', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => statLimits.value, newItem, getStatLimitKey, '.stat-limits-list')
  }
  return true
}

function duplicateStatLimitGroupToMain(group: StatLimitGroupItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(group)) return false

  // Add new main item
  const newItem: StatLimitGroupItem = {
    name: group.name,
    relation: group.relation,
    limits: [...group.limits],
    comments: [...(group.comments || [])],
    comment: group.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('statLimitGroups', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => statLimitGroups.value, newItem, getStatLimitGroupKey, '.stat-limit-groups-list')
  }
  return true
}

function duplicateItemDescriptorToMain(desc: ItemDescriptorItem) {
  if (!config.value || isReadOnly.value) return
  if (!isItemExtern(desc)) return

  // Add new main item
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
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => itemDescriptors.value, newItem, getItemDescriptorKey, '.item-descriptors-list')
}

function duplicateCubeFormulaToMain(formula: CubeFormulaItem) {
  if (!config.value || isReadOnly.value) return
  if (!isItemExtern(formula)) return

  // Add new main item
  const newItem: CubeFormulaItem = {
    name: formula.name,
    descriptors: [...formula.descriptors],
    comment: formula.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('cubeFormulas', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => cubeFormulas.value, newItem, getCubeFormulaKey, '.cube-formulas-list')
}

function duplicatePreItemTaskToMain(task: PreItemTaskItem) {
  if (!config.value || isReadOnly.value) return
  if (!isItemExtern(task)) return

  // Add new main item
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
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => preItemTasks.value, newItem, getPreItemTaskKey, '.pre-item-tasks-list')
}

function duplicateDoTaskToMain(task: DoTaskItem) {
  if (!config.value || isReadOnly.value) return
  if (!isItemExtern(task)) return

  // Add new main item
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
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => doTasks.value, newItem, getDoTaskKey, '.do-tasks-list')
}

function duplicateKeyBindingToMain(binding: KeyBindingItem) {
  if (!config.value || isReadOnly.value) return
  if (!isItemExtern(binding)) return

  // Add new main item
  const newItem: KeyBindingItem = {
    keyCode: binding.keyCode,
    command: binding.command,
    comment: binding.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('keyBindings', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => keyBindings.value, newItem, getKeyBindingKey, '.key-bindings-list')
}

// Comment/Delete/Restore handlers for Stat Limits
function handleStatLimitComment(item: StatLimitItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(item)) return
  markCommented(item)
  refreshEffectiveStatus(config.value)
}

function handleStatLimitDelete(item: StatLimitItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(item)) return

  deleteTransmuteItemFromFile(item, 'statLimits')
  refreshEffectiveStatus(config.value)
}

function handleStatLimitRestore(item: StatLimitItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(item)) return
  markRestored(item)
  refreshEffectiveStatus(config.value)
}

function isReadonlyStatLimit(item: StatLimitItem): boolean {
  return isReadOnly.value || isItemDisabled(item) || isItemExtern(item)
}

function updateStatLimit(item: StatLimitItem, field: string, value: string) {
  if (!config.value || isReadonlyStatLimit(item)) return
  ;(item as any)[field] = value
}

function updateStatLimitName(item: StatLimitItem, newName: string) {
  if (!config.value || isReadonlyStatLimit(item)) return
  if (item.name === newName || !newName) return
  item.name = newName
  refreshEffectiveStatus(config.value)
}

// Add new stat limit
function addStatLimit() {
  if (!config.value || isReadOnly.value) return
  const allStatLimits = getAllTransmuteItems<StatLimitItem>('statLimits')

  // Generate unique name
  let baseName = t('transmute.newLimit')
  let name = baseName
  let counter = 1
  while (allStatLimits.some(s => s.name === name)) {
    name = `${baseName}${counter++}`
  }
  // Add new limit
  const newItem: StatLimitItem = {
    name,
    statId: '',
    param: '',
    min: '',
    max: '',
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('statLimits', newItem)
  refreshEffectiveStatus(config.value)
}

// Comment/Delete/Restore handlers for Stat Limit Groups
function handleStatLimitGroupComment(group: StatLimitGroupItem) {
  if (!config.value || isReadOnly.value) return
  markCommented(group)
  refreshEffectiveStatus(config.value)
}

function handleStatLimitGroupDelete(group: StatLimitGroupItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(group)) return

  deleteTransmuteItemFromFile(group, 'statLimitGroups')
  refreshEffectiveStatus(config.value)
}

function handleStatLimitGroupRestore(group: StatLimitGroupItem) {
  if (!config.value || isReadOnly.value) return
  markRestored(group)
  refreshEffectiveStatus(config.value)
}

// Comment/Delete/Restore handlers for Item Descriptors
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

// Comment/Delete/Restore handlers for Cube Formulas
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

// Comment/Delete/Restore handlers for Pre Item Tasks
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

// Comment/Delete/Restore handlers for Do Tasks
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

// Comment/Delete/Restore handlers for Key Bindings
function handleKeyBindingComment(binding: KeyBindingItem) {
  if (!config.value || isReadOnly.value) return
  markCommented(binding)
  refreshEffectiveStatus(config.value)
}

function handleKeyBindingDelete(binding: KeyBindingItem) {
  if (!config.value || isReadOnly.value) return
  if (isItemExtern(binding)) return

  deleteTransmuteItemFromFile(binding, 'keyBindings')
  refreshEffectiveStatus(config.value)
}

function handleKeyBindingRestore(binding: KeyBindingItem) {
  if (!config.value || isReadOnly.value) return
  markRestored(binding)
  refreshEffectiveStatus(config.value)
}

// Check if there are extern items in current statLimitGroup subTab
function hasExternItems() {
  if (activeSubTabs.value.statLimitGroup === 'statLimits') {
    return statLimits.value.some(item => isItemExtern(item))
  } else {
    return statLimitGroups.value.some(item => isItemExtern(item))
  }
}

// Copy all extern items in current statLimitGroup subTab - use skipRefresh to batch
function copyAllExtern() {
  if (!config.value || isReadOnly.value) return

  // Collect extern items first (snapshot)
  const itemsToCopy = activeSubTabs.value.statLimitGroup === 'statLimits'
    ? statLimits.value.filter(item => isItemExtern(item))
    : statLimitGroups.value.filter(group => isItemExtern(group))

  let copied = 0
  if (activeSubTabs.value.statLimitGroup === 'statLimits') {
    for (const item of itemsToCopy) {
      if (duplicateStatLimitToMain(item as StatLimitItem, true)) copied++
    }
  } else {
    for (const group of itemsToCopy) {
      if (duplicateStatLimitGroupToMain(group as StatLimitGroupItem, true)) copied++
    }
  }

  // Refresh once after all copies
  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}
</script>

<template>
  <div class="transmute-editor">
    <!-- Stat Limits -->
    <EditorPanel v-show="activeSection === 'statLimitGroup' && activeSubTabs.statLimitGroup === 'statLimits'">
      <template #tabs>
        <SubTabs v-model="activeSubTabs.statLimitGroup" :tabs="subTabsConfig.statLimitGroup" />
      </template>
      <template #batch-bar>
        <div v-if="hasStatLimitSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedStatLimits.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestoreStatLimits">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentStatLimits">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeleteStatLimits">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="addStatLimit">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="statLimits.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.statLimits') }}</p>
      </div>
      <div v-else class="item-list stat-limits-list">
        <!-- Header -->
        <ConfigHeader
          :show-checkbox="true"
          :show-index="true"
          :show-drag="true"
          :is-all-selected="selectedStatLimits.size === selectableStatLimitsCount && selectableStatLimitsCount > 0"
          :is-read-only="isReadOnly"
          @select-all="toggleStatLimitSelectAll"
        >
          <span :style="{ width: limitNameWidth }">{{ t('transmute.limitName') }}</span>
          <span style="width: 150px;">{{ t('transmute.statId') }}</span>
          <span style="width: 60px;">{{ t('transmute.param') }}</span>
          <span style="width: 80px;">{{ t('transmute.min') }}</span>
          <span style="width: 80px;">{{ t('transmute.max') }}</span>
          <span style="width: 150px;">{{ t('itemColors.comment') }}</span>
          <span style="width: 80px;">{{ t('itemColors.actions') }}</span>
        </ConfigHeader>
        <!-- Rows -->
        <ConfigRow
          v-for="(item, index) in statLimits"
          :key="index"
          :item="item"
          :index="index"
          :show-checkbox="true"
          :show-index="true"
          :show-drag="true"
          :is-selected="isStatLimitSelected(item)"
          :is-disabled="isItemDisabled(item) || isItemExtern(item)"
          :is-drag-over="statLimitDragOverIndex === index"
          :is-read-only="isReadOnly"
          :row-classes="getItemRowClasses(item)"
          @select="toggleStatLimitSelect(item)"
          @dragstart="handleStatLimitDragStart($event, index)"
          @dragover="handleStatLimitDragOver($event, index)"
          @dragleave="handleStatLimitDragLeave"
          @drop="handleStatLimitDrop($event, index)"
          @dragend="handleStatLimitDragEnd"
        >
          <input
            type="text"
            :value="item.name"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimitName(item, $event.target.value)"
            :style="{ width: limitNameWidth, fontWeight: 500 }"
          />
          <StatPicker
            :modelValue="item.statId"
            :disabled="isReadOnly"
            :readonly="isReadonlyStatLimit(item)"
            @update:modelValue="updateStatLimit(item, 'statId', $event)"
          />
          <input
            type="text"
            :value="item.param"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'param', $event.target.value)"
            style="width: 60px;"
          />
          <input
            type="text"
            :value="item.min"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'min', $event.target.value)"
            style="width: 80px;"
          />
          <input
            type="text"
            :value="item.max"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'max', $event.target.value)"
            style="width: 80px;"
          />
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="item.comment"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'comment', $event.target.value)"
            style="width: 150px;"
          />

          <template #actions>
            <template v-if="isItemExtern(item)">
              <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateStatLimitToMain(item)" :title="t('action.copyToMain')">+</button>
              <span class="status-tag tag-extern" :title="item.sourceFile">{{ item.sourceFile }}</span>
            </template>
            <template v-else-if="item.isCommented || item.isDeleted">
              <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleStatLimitRestore(item)" :title="t('action.restore')">↩</button>
              <span v-if="item.isCommented" class="status-tag tag-commented">//</span>
              <span v-if="item.isDeleted" class="status-tag tag-deleted">×</span>
            </template>
            <template v-else-if="!isReadOnly">
              <button class="btn btn-small btn-secondary" @click="handleStatLimitComment(item)" :title="t('action.comment')">//</button>
              <button class="btn btn-small btn-danger" @click="handleStatLimitDelete(item)" :title="t('action.delete')">×</button>
            </template>
          </template>
        </ConfigRow>
      </div>
    </EditorPanel>

    <!-- Stat Limit Groups -->
    <EditorPanel v-show="activeSection === 'statLimitGroup' && activeSubTabs.statLimitGroup === 'statLimitGroups'">
      <template #tabs>
        <SubTabs v-model="activeSubTabs.statLimitGroup" :tabs="subTabsConfig.statLimitGroup" />
      </template>
      <template #actions>
        <button
          v-if="hasExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="statLimitGroups.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.statLimitGroups') }}</p>
      </div>
      <div v-else class="config-list stat-limit-groups-list">
        <div v-for="(group, index) in statLimitGroups" :key="index" class="config-row flex-col" :class="getItemRowClasses(group)" :data-index="index">
          <div class="flex items-center gap-sm">
            <span class="col-index">{{ index + 1 }}</span>
            <span class="label" style="min-width: 150px;">{{ group.name }}</span>
            <span>{{ t(`relation.${group.relation}`) }}</span>
            <div class="col-actions">
              <template v-if="isItemExtern(group)">
                <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateStatLimitGroupToMain(group)" :title="t('action.copyToMain')">+</button>
                <span class="status-tag tag-extern" :title="group.sourceFile">{{ group.sourceFile }}</span>
              </template>
              <template v-else-if="group.isCommented || group.isDeleted">
                <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleStatLimitGroupRestore(group)" :title="t('action.restore')">↩</button>
                <span v-if="group.isCommented" class="status-tag tag-commented">//</span>
                <span v-if="group.isDeleted" class="status-tag tag-deleted">×</span>
              </template>
              <template v-else-if="!isReadOnly">
                <button class="btn btn-small btn-secondary" @click="handleStatLimitGroupComment(group)" :title="t('action.comment')">//</button>
                <button class="btn btn-small btn-danger" @click="handleStatLimitGroupDelete(group)" :title="t('action.delete')">×</button>
              </template>
            </div>
          </div>
          <div class="text-muted" style="margin-left: 150px;">
            {{ group.limits.join(', ') }}
          </div>
        </div>
      </div>
    </EditorPanel>

    <!-- Item Descriptors -->
    <EditorPanel v-show="activeSection === 'itemDescriptors'">
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="itemDescriptors.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.itemDescriptors') }}</p>
      </div>
      <div v-else class="config-list item-descriptors-list">
        <div v-for="(desc, index) in itemDescriptors" :key="index" class="config-row" :class="getItemRowClasses(desc)" :data-index="index">
          <span class="col-index">{{ index + 1 }}</span>
          <span class="label" style="min-width: 150px;">{{ desc.name }}</span>
          <span>{{ t('transmute.itemId') }}: {{ desc.itemId }}</span>
          <span v-if="desc.quality">{{ t('itemColors.quality') }}: {{ desc.quality }}</span>
          <span>{{ t('transmute.limit') }}: {{ desc.limitName }}</span>
          <span>{{ t('transmute.count') }}: {{ desc.count }}</span>
          <span v-if="desc.comment" class="comment-text" :title="desc.comment">{{ desc.comment }}</span>
          <div class="col-actions">
            <template v-if="isItemExtern(desc)">
              <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateItemDescriptorToMain(desc)" :title="t('action.copyToMain')">+</button>
              <span class="status-tag tag-extern" :title="desc.sourceFile">{{ desc.sourceFile }}</span>
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
          </div>
        </div>
      </div>
    </EditorPanel>

    <!-- Cube Formulas -->
    <EditorPanel v-show="activeSection === 'autoTransmute' && activeSubTabs.autoTransmute === 'cubeFormulas'">
      <template #tabs>
        <SubTabs v-model="activeSubTabs.autoTransmute" :tabs="subTabsConfig.autoTransmute" />
      </template>
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="cubeFormulas.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.cubeFormulas') }}</p>
      </div>
      <div v-else class="config-list cube-formulas-list">
        <div v-for="(formula, index) in cubeFormulas" :key="index" class="config-row flex-col" :class="getItemRowClasses(formula)" :data-index="index">
          <div class="flex items-center gap-sm">
            <span class="col-index">{{ index + 1 }}</span>
            <span class="label">{{ formula.name }}</span>
            <span v-if="formula.comment" class="comment-text" :title="formula.comment">{{ formula.comment }}</span>
            <div class="col-actions">
              <template v-if="isItemExtern(formula)">
                <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateCubeFormulaToMain(formula)" :title="t('action.copyToMain')">+</button>
                <span class="status-tag tag-extern" :title="formula.sourceFile">{{ formula.sourceFile }}</span>
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
            </div>
          </div>
          <div class="text-muted">
            {{ formula.descriptors.join(', ') }}
          </div>
        </div>
      </div>
    </EditorPanel>

    <!-- Pre Item Tasks -->
    <EditorPanel v-show="activeSection === 'autoTransmute' && activeSubTabs.autoTransmute === 'preItemTasks'">
      <template #tabs>
        <SubTabs v-model="activeSubTabs.autoTransmute" :tabs="subTabsConfig.autoTransmute" />
      </template>
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="preItemTasks.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.preItemTasks') }}</p>
      </div>
      <div v-else class="config-list pre-item-tasks-list">
        <div v-for="(task, index) in preItemTasks" :key="index" class="config-row" :class="getItemRowClasses(task)" :data-index="index">
          <span class="col-index">{{ index + 1 }}</span>
          <span class="label" style="min-width: 150px;">{{ task.name }}</span>
          <span>{{ t('transmute.itemId') }}: {{ task.itemId }}</span>
          <span v-if="task.quality">{{ t('itemColors.quality') }}: {{ task.quality }}</span>
          <span>{{ t('transmute.limit') }}: {{ task.limitName }}</span>
          <span>{{ t('transmute.action') }}: {{ t(`action.${task.action}`) }}</span>
          <span v-if="task.comment" class="comment-text" :title="task.comment">{{ task.comment }}</span>
          <div class="col-actions">
            <template v-if="isItemExtern(task)">
              <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicatePreItemTaskToMain(task)" :title="t('action.copyToMain')">+</button>
              <span class="status-tag tag-extern" :title="task.sourceFile">{{ task.sourceFile }}</span>
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
          </div>
        </div>
      </div>
    </EditorPanel>

    <!-- Do Tasks -->
    <EditorPanel v-show="activeSection === 'autoTransmute' && activeSubTabs.autoTransmute === 'doTasks'">
      <template #tabs>
        <SubTabs v-model="activeSubTabs.autoTransmute" :tabs="subTabsConfig.autoTransmute" />
      </template>
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="doTasks.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.doTasks') }}</p>
      </div>
      <div v-else class="config-list do-tasks-list">
        <div v-for="(task, index) in doTasks" :key="index" class="config-row flex-col" :class="getItemRowClasses(task)" :data-index="index">
          <div class="flex items-center gap-sm">
            <span class="col-index">{{ index + 1 }}</span>
            <span class="label">{{ task.name }}</span>
            <span v-if="task.comment" class="comment-text" :title="task.comment">{{ task.comment }}</span>
            <div class="col-actions">
              <template v-if="isItemExtern(task)">
                <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateDoTaskToMain(task)" :title="t('action.copyToMain')">+</button>
                <span class="status-tag tag-extern" :title="task.sourceFile">{{ task.sourceFile }}</span>
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
            </div>
          </div>
          <div class="text-muted">
            {{ t('transmute.preTask') }}: {{ task.preTask }} | {{ t('transmute.formulas') }}: {{ task.formulas.join(', ') }}
          </div>
        </div>
      </div>
    </EditorPanel>

    <!-- Key Bindings -->
    <EditorPanel v-show="activeSection === 'keyBindings'">
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <div v-if="keyBindings.length === 0" class="empty-state">
        <p>{{ t('transmute.empty.keyBindings') }}</p>
      </div>
      <div v-else class="config-list key-bindings-list">
        <div v-for="(binding, index) in keyBindings" :key="index" class="config-row" :class="getItemRowClasses(binding)" :data-index="index">
          <span class="col-index">{{ index + 1 }}</span>
          <span class="label" style="min-width: 150px;">{{ binding.keyCode }}</span>
          <span>{{ binding.command }}</span>
          <span v-if="binding.comment" class="comment-text" :title="binding.comment">{{ binding.comment }}</span>
          <div class="col-actions">
            <template v-if="isItemExtern(binding)">
              <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateKeyBindingToMain(binding)" :title="t('action.copyToMain')">+</button>
              <span class="status-tag tag-extern" :title="binding.sourceFile">{{ binding.sourceFile }}</span>
            </template>
            <template v-else-if="binding.isCommented || binding.isDeleted">
              <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleKeyBindingRestore(binding)" :title="t('action.restore')">↩</button>
              <span v-if="binding.isCommented" class="status-tag tag-commented">//</span>
              <span v-if="binding.isDeleted" class="status-tag tag-deleted">×</span>
            </template>
            <template v-else-if="!isReadOnly">
              <button class="btn btn-small btn-secondary" @click="handleKeyBindingComment(binding)" :title="t('action.comment')">//</button>
              <button class="btn btn-small btn-danger" @click="handleKeyBindingDelete(binding)" :title="t('action.delete')">×</button>
            </template>
          </div>
        </div>
      </div>
    </EditorPanel>

    <!-- Validation -->
    <EditorPanel v-show="activeSection === 'validation'">
      <template #tabs>
        <div class="validation-summary">
          <span v-if="validationSummary.errorCount > 0" class="text-danger">
            {{ validationSummary.errorCount }} {{ t('validation.error') }}
          </span>
          <span v-if="validationSummary.warningCount > 0" class="text-warning">
            {{ validationSummary.warningCount }} {{ t('validation.warning') }}
          </span>
          <span v-if="validationSummary.total === 0" class="text-success">
            {{ t('validation.valid') }}
          </span>
        </div>
      </template>
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="refreshValidation" :title="t('validation.refresh')">
          {{ t('validation.refresh') }}
        </button>
      </template>

      <div v-if="transmuteValidation.errors.length === 0" class="empty-state">
        <p class="text-success">{{ t('validation.noErrors') }}</p>
      </div>
      <div v-else class="validation-list">
        <div
          v-for="(error, index) in transmuteValidation.errors"
          :key="index"
          class="validation-item"
          :class="error.type"
        >
          <span class="validation-type">{{ error.type === 'error' ? t('validation.error') : t('validation.warning') }}</span>
          <span class="validation-section">{{ error.section }}</span>
          <span class="validation-message">{{ error.message }}</span>
        </div>
      </div>
    </EditorPanel>
  </div>
</template>

<style scoped>
.config-list {
  max-height: calc(60vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
}

.item-list {
  max-height: calc(70vh - var(--debug-drawer-height, 0px));
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

.validation-summary {
  display: flex;
  gap: 12px;
}

.validation-list {
  max-height: calc(60vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 8px;
}

.validation-item.error {
  border-left: 3px solid var(--danger-color);
}

.validation-item.warning {
  border-left: 3px solid var(--warning-color);
}

.validation-type {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
}

.validation-item.error .validation-type {
  background: var(--danger-color);
  color: white;
}

.validation-item.warning .validation-type {
  background: var(--warning-color);
  color: white;
}

.validation-section {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 120px;
}

.validation-message {
  flex: 1;
  color: var(--text-primary);
}

/* Row state styling */
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
