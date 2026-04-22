<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useFileStorage } from '../composables/useFileStorage'
import {
  useItemActions,
  scrollToMainItemInList,
  getStatLimitKey,
  getStatLimitGroupKey
} from '../composables/useItemActions'
import { useTransmuteItems } from '../composables/useTransmuteItems'
import { moveTransmuteItemInFile } from '../utils/grouping'
import { fitTextColumnWidth } from '../utils/columnWidth'
import { useI18n } from '../i18n'
import { RELATION_TYPES } from '../configDefs'
import type { BaseConfigItem, StatLimitGroupItem, StatLimitItem } from '../types'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigTable from './ConfigTable.vue'
import StatPicker from './StatPicker.vue'
import StatGroupPicker from './StatGroupPicker.vue'
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
const {
  markCommented,
  markRestored,
  isItemDisabled,
  isItemExtern,
  isItemEffective,
  getItemRowClasses,
  refreshEffectiveStatus
} = useItemActions()
const {
  getAllTransmuteItems,
  addTransmuteItemToEditable,
  deleteTransmuteItemFromFile,
  filterBySearch
} = useTransmuteItems()

const activeSubTab = ref('statLimits')

watch(activeSubTab, (newTab) => {
  saveSubTab('statLimitGroup', newTab)
  selectedStatLimits.value.clear()
  selectedStatLimitGroups.value.clear()
})

onMounted(() => {
  activeSubTab.value = loadSubTab('statLimitGroup', 'statLimits')
})

const subTabsConfig = computed(() => [
  { id: 'statLimits', label: t('subTab.statLimits') },
  { id: 'statLimitGroups', label: t('subTab.statLimitGroups') }
])

function handleExport(): void {
  exportSection('transmute')
}

const statLimits = computed(() => {
  const allItems = getAllTransmuteItems<StatLimitItem>('statLimits')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'statId', 'comment')
})

const selectedStatLimits = ref<Set<StatLimitItem>>(new Set())
const statLimitDragIndex = ref<number | null>(null)
const statLimitDragOverIndex = ref<number | null>(null)

const selectableStatLimitsCount = computed(() => {
  return statLimits.value.filter(item => !isItemExtern(item)).length
})

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
  selectedStatLimits.value = new Set(selectedStatLimits.value)
}

function isStatLimitSelected(item: StatLimitItem) {
  return selectedStatLimits.value.has(item)
}

function hasStatLimitSelection() {
  return selectedStatLimits.value.size > 0
}

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

  const allItems = getAllTransmuteItems<StatLimitItem>('statLimits')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'statLimits')
  if (!moved) {
    statLimitDragIndex.value = null
    statLimitDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  statLimitDragIndex.value = null
  statLimitDragOverIndex.value = null
}

function handleStatLimitDragEnd() {
  statLimitDragIndex.value = null
  statLimitDragOverIndex.value = null
}

const limitNameWidth = computed(() => {
  return fitTextColumnWidth(statLimits.value.map(item => item.name), t('transmute.limitName'), {
    min: 80,
    max: 220,
    padding: 16,
    asciiWidth: 12,
    wideWidth: 14
  })
})

function isTransmuteRowDisabled(item: BaseConfigItem): boolean {
  return isItemDisabled(item) || isItemExtern(item)
}

const statLimitColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'name', label: t('transmute.limitName'), width: limitNameWidth.value },
  { key: 'statId', label: t('transmute.statId'), width: '150px' },
  { key: 'param', label: t('transmute.param'), width: '60px' },
  { key: 'min', label: t('transmute.min'), width: '80px' },
  { key: 'max', label: t('transmute.max'), width: '80px' },
  { key: 'comment', label: t('itemColors.comment'), width: '150px' },
  { key: 'actions', label: t('itemColors.actions'), width: '80px', className: 'col-actions' }
])

const statLimitGroupColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'name', label: t('transmute.name'), width: '360px' },
  { key: 'relation', label: t('transmute.relation'), width: '180px' },
  { key: 'limits', label: t('transmute.statLimitList'), width: '120px' },
  { key: 'comment', label: t('itemColors.comment'), width: '150px' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

const statLimitGroups = computed(() => {
  const allItems = getAllTransmuteItems<StatLimitGroupItem>('statLimitGroups')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'comment')
})

const selectedStatLimitGroups = ref<Set<StatLimitGroupItem>>(new Set())
const statLimitGroupDragIndex = ref<number | null>(null)
const statLimitGroupDragOverIndex = ref<number | null>(null)

const selectableStatLimitGroupsCount = computed(() => {
  return statLimitGroups.value.filter(item => !isItemExtern(item)).length
})

function toggleStatLimitGroupSelectAll() {
  const selectableItems = statLimitGroups.value.filter(item => !isItemExtern(item))
  if (selectedStatLimitGroups.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedStatLimitGroups.value.clear()
  } else {
    selectedStatLimitGroups.value = new Set(selectableItems)
  }
}

function toggleStatLimitGroupSelect(item: StatLimitGroupItem) {
  if (selectedStatLimitGroups.value.has(item)) {
    selectedStatLimitGroups.value.delete(item)
  } else {
    selectedStatLimitGroups.value.add(item)
  }
  selectedStatLimitGroups.value = new Set(selectedStatLimitGroups.value)
}

function isStatLimitGroupSelected(item: StatLimitGroupItem) {
  return selectedStatLimitGroups.value.has(item)
}

function hasStatLimitGroupSelection() {
  return selectedStatLimitGroups.value.size > 0
}

function batchDeleteStatLimitGroups() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedStatLimitGroups.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'statLimitGroups')
    }
  }
  selectedStatLimitGroups.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestoreStatLimitGroups() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedStatLimitGroups.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedStatLimitGroups.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentStatLimitGroups() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedStatLimitGroups.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedStatLimitGroups.value.clear()
  refreshEffectiveStatus(config.value)
}

function handleStatLimitGroupDragStart(e: DragEvent, index: number) {
  statLimitGroupDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleStatLimitGroupDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  statLimitGroupDragOverIndex.value = index
}

function handleStatLimitGroupDragLeave() {
  statLimitGroupDragOverIndex.value = null
}

function handleStatLimitGroupDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = statLimitGroupDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    statLimitGroupDragIndex.value = null
    statLimitGroupDragOverIndex.value = null
    return
  }

  const filteredItems = statLimitGroups.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  const allItems = getAllTransmuteItems<StatLimitGroupItem>('statLimitGroups')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'statLimitGroups')
  if (!moved) {
    statLimitGroupDragIndex.value = null
    statLimitGroupDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  statLimitGroupDragIndex.value = null
  statLimitGroupDragOverIndex.value = null
}

function handleStatLimitGroupDragEnd() {
  statLimitGroupDragIndex.value = null
  statLimitGroupDragOverIndex.value = null
}

function duplicateStatLimitToMain(item: StatLimitItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(item)) return false

  const allItems = getAllTransmuteItems<StatLimitItem>('statLimits')
  const hasMainEffective = allItems.some(s =>
    s.name === item.name && s.sourceFile === null && isItemEffective(s)
  )
  if (hasMainEffective) return false

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

function addStatLimit() {
  if (!config.value || isReadOnly.value) return
  const allStatLimits = getAllTransmuteItems<StatLimitItem>('statLimits')

  const baseName = t('transmute.newLimit')
  let name = baseName
  let counter = 1
  while (allStatLimits.some(s => s.name === name)) {
    name = `${baseName}${counter++}`
  }

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
  scrollToMainItemInList(() => statLimits.value, newItem, getStatLimitKey, '.stat-limits-list')
}

function addStatLimitGroup() {
  if (!config.value || isReadOnly.value) return
  const allGroups = getAllTransmuteItems<StatLimitGroupItem>('statLimitGroups')

  const baseName = t('transmute.newLimitGroup')
  let name = baseName
  let counter = 1
  while (allGroups.some(group => group.name === name)) {
    name = `${baseName}${counter++}`
  }

  const newItem: StatLimitGroupItem = {
    name,
    relation: '0',
    limits: [],
    comments: [],
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('statLimitGroups', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => statLimitGroups.value, newItem, getStatLimitGroupKey, '.stat-limit-groups-list')
}

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

function updateStatLimitGroup(group: StatLimitGroupItem, field: 'name' | 'relation', value: string) {
  if (!config.value || isReadOnly.value || isItemDisabled(group) || isItemExtern(group)) return
  group[field] = value
  refreshEffectiveStatus(config.value)
}

function updateStatLimitGroupLimits(group: StatLimitGroupItem, value: string) {
  if (!config.value || isReadOnly.value || isItemDisabled(group) || isItemExtern(group)) return
  const commentByLimit = new Map(group.limits.map((limit, index) => [limit, group.comments[index] || '']))
  group.limits = value.split(',').map(limit => limit.trim()).filter(Boolean)
  group.comments = group.limits.map(limit => commentByLimit.get(limit) || '')
}

function getStatLimitGroupComment(group: StatLimitGroupItem): string {
  return group.comments.find(comment => comment.trim()) || ''
}

function updateStatLimitGroupComment(group: StatLimitGroupItem, value: string) {
  if (!config.value || isReadOnly.value || isItemDisabled(group) || isItemExtern(group)) return
  const index = group.comments.findIndex(comment => comment.trim())
  const targetIndex = index >= 0 ? index : 0
  while (group.comments.length <= targetIndex) {
    group.comments.push('')
  }
  group.comments[targetIndex] = value
}

function hasExternItems() {
  if (activeSubTab.value === 'statLimits') {
    return statLimits.value.some(item => isItemExtern(item))
  }
  return statLimitGroups.value.some(item => isItemExtern(item))
}

function copyAllExtern() {
  if (!config.value || isReadOnly.value) return

  const itemsToCopy = activeSubTab.value === 'statLimits'
    ? statLimits.value.filter(item => isItemExtern(item))
    : statLimitGroups.value.filter(group => isItemExtern(group))

  let copied = 0
  if (activeSubTab.value === 'statLimits') {
    for (const item of itemsToCopy) {
      if (duplicateStatLimitToMain(item as StatLimitItem, true)) copied++
    }
  } else {
    for (const group of itemsToCopy) {
      if (duplicateStatLimitGroupToMain(group as StatLimitGroupItem, true)) copied++
    }
  }

  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}
</script>

<template>
  <div class="stat-limit-editor">
    <EditorPanel v-show="activeSubTab === 'statLimits'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
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

      <ConfigTable
        :items="statLimits"
        :columns="statLimitColumns"
        :empty-text="t('transmute.empty.statLimits')"
        list-class="stat-limits-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedStatLimits.size === selectableStatLimitsCount && selectableStatLimitsCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isStatLimitSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="statLimitDragOverIndex"
        :row-classes="getItemRowClasses"
        @select-all="toggleStatLimitSelectAll"
        @select="toggleStatLimitSelect"
        @dragstart="handleStatLimitDragStart"
        @dragover="handleStatLimitDragOver"
        @dragleave="handleStatLimitDragLeave"
        @drop="handleStatLimitDrop"
        @dragend="handleStatLimitDragEnd"
      >
        <template #cell-name="{ item }">
          <input
            type="text"
            :value="item.name"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimitName(item, ($event.target as HTMLInputElement).value)"
            style="font-weight: 500;"
          />
        </template>
        <template #cell-statId="{ item }">
          <StatPicker
            :modelValue="item.statId"
            :disabled="isReadOnly"
            :readonly="isReadonlyStatLimit(item)"
            @update:modelValue="updateStatLimit(item, 'statId', $event)"
          />
        </template>
        <template #cell-param="{ item }">
          <input
            type="text"
            :value="item.param"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'param', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-min="{ item }">
          <input
            type="text"
            :value="item.min"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'min', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-max="{ item }">
          <input
            type="text"
            :value="item.max"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'max', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-comment="{ item }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="item.comment"
            :readonly="isReadonlyStatLimit(item)"
            :disabled="isReadOnly"
            @input="updateStatLimit(item, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item }">
          <template v-if="isItemExtern(item)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateStatLimitToMain(item)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="item.sourceFile || undefined">{{ item.sourceFile }}</span>
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
      </ConfigTable>
    </EditorPanel>

    <EditorPanel v-show="activeSubTab === 'statLimitGroups'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
      </template>
      <template #batch-bar>
        <div v-if="hasStatLimitGroupSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedStatLimitGroups.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestoreStatLimitGroups">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentStatLimitGroups">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeleteStatLimitGroups">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="addStatLimitGroup">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="statLimitGroups"
        :columns="statLimitGroupColumns"
        :empty-text="t('transmute.empty.statLimitGroups')"
        list-class="stat-limit-groups-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedStatLimitGroups.size === selectableStatLimitGroupsCount && selectableStatLimitGroupsCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isStatLimitGroupSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="statLimitGroupDragOverIndex"
        :row-classes="getItemRowClasses"
        @select-all="toggleStatLimitGroupSelectAll"
        @select="toggleStatLimitGroupSelect"
        @dragstart="handleStatLimitGroupDragStart"
        @dragover="handleStatLimitGroupDragOver"
        @dragleave="handleStatLimitGroupDragLeave"
        @drop="handleStatLimitGroupDrop"
        @dragend="handleStatLimitGroupDragEnd"
      >
        <template #cell-name="{ item: group }">
          <input
            type="text"
            :value="group.name"
            :readonly="isItemDisabled(group) || isItemExtern(group)"
            :disabled="isReadOnly"
            @change="updateStatLimitGroup(group, 'name', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-relation="{ item: group }">
          <select
            :value="group.relation"
            :disabled="isReadOnly || isItemDisabled(group) || isItemExtern(group)"
            @change="updateStatLimitGroup(group, 'relation', ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="relation in RELATION_TYPES"
              :key="relation.value"
              :value="relation.value"
            >
              [{{ relation.value }}] {{ t(relation.labelKey) }}
            </option>
          </select>
        </template>
        <template #cell-limits="{ item: group }">
          <StatGroupPicker
            :modelValue="group.limits.join(',')"
            :disabled="isReadOnly"
            :readonly="isItemDisabled(group) || isItemExtern(group)"
            :excludeName="group.name"
            :displayTextOverride="t('transmute.limitRefCount', { count: group.limits.filter(Boolean).length })"
            compact
            @update:modelValue="updateStatLimitGroupLimits(group, $event)"
          />
        </template>
        <template #cell-comment="{ item: group }">
          <input
            type="text"
            class="comment-input stat-group-comment-input"
            :placeholder="t('itemColors.comment')"
            :value="getStatLimitGroupComment(group)"
            :readonly="isItemDisabled(group) || isItemExtern(group)"
            :disabled="isReadOnly"
            @input="updateStatLimitGroupComment(group, ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: group }">
          <template v-if="isItemExtern(group)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateStatLimitGroupToMain(group)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="group.sourceFile || undefined">{{ group.sourceFile }}</span>
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
        </template>
      </ConfigTable>
    </EditorPanel>
  </div>
</template>

<style scoped>
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

.stat-group-comment-input {
  flex: 0 0 150px;
  width: 150px;
}

.stat-limit-groups-list :deep(.col-actions) {
  flex: 0 0 220px;
  width: 220px;
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
