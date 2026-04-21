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
import { useI18n } from '../i18n'
import type { BaseConfigItem, CubeFormulaItem, DoTaskItem, ItemDescriptorItem, PreItemTaskItem } from '../types'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigTable from './ConfigTable.vue'
import ItemPicker from './ItemPicker.vue'
import QualityPicker from './QualityPicker.vue'
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

function estimateTextWidth(text: string): number {
  let width = 0
  for (const char of text) {
    width += char.charCodeAt(0) > 255 ? 14 : 8
  }
  return width
}

function fitTextColumnWidth(values: string[], header: string, minWidth: number): string {
  const widestText = values.reduce((max, value) => Math.max(max, estimateTextWidth(value)), estimateTextWidth(header))
  return `${Math.max(minWidth, widestText + 34)}px`
}

const itemDescriptorNameWidth = computed(() => {
  return fitTextColumnWidth(itemDescriptors.value.map(item => item.name), t('transmute.name'), 150)
})

const itemDescriptorLimitWidth = computed(() => {
  return fitTextColumnWidth(itemDescriptors.value.map(item => item.limitName), t('import.statGroup'), 120)
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
  const targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return

  moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'itemDescriptors')
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

const preItemTasks = computed(() => {
  const allItems = getAllTransmuteItems<PreItemTaskItem>('preItemTasks')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'itemId', 'comment')
})

const doTasks = computed(() => {
  const allItems = getAllTransmuteItems<DoTaskItem>('doTasks')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'name', 'preTask', 'comment')
})

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

function duplicateCubeFormulaToMain(formula: CubeFormulaItem) {
  if (!config.value || isReadOnly.value) return
  if (!isItemExtern(formula)) return

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
            </div>
          </div>
          <div class="text-muted">
            {{ formula.descriptors.join(', ') }}
          </div>
        </div>
      </div>
    </EditorPanel>

    <EditorPanel v-show="activeSubTab === 'preItemTasks'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
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
          </div>
        </div>
      </div>
    </EditorPanel>

    <EditorPanel v-show="activeSubTab === 'doTasks'">
      <template #tabs>
        <SubTabs v-model="activeSubTab" :tabs="subTabsConfig" />
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
            </div>
          </div>
          <div class="text-muted">
            {{ t('transmute.preTask') }}: {{ task.preTask }} | {{ t('transmute.formulas') }}: {{ task.formulas.join(', ') }}
          </div>
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
