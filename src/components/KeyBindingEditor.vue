<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfig } from '../composables/useConfig'
import {
  useItemActions,
  scrollToMainItemInList,
  getKeyBindingKey
} from '../composables/useItemActions'
import { useTransmuteItems } from '../composables/useTransmuteItems'
import { moveTransmuteItemInFile } from '../utils/grouping'
import { fitTextColumnWidthNumber } from '../utils/columnWidth'
import { useI18n } from '../i18n'
import type { BaseConfigItem } from '../types'
import type { KeyBindingItem } from '../types'
import EditorPanel from './EditorPanel.vue'
import ConfigTable from './ConfigTable.vue'
import HotkeyInput from './HotkeyInput.vue'
import SubTabs from './SubTabs.vue'
import type { ConfigTableColumn } from './configTable'

interface Props {
  searchQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
})

const { t } = useI18n()
const { config, exportSection, isReadOnly } = useConfig()
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

const keyBindings = computed(() => {
  const allItems = getAllTransmuteItems<KeyBindingItem>('keyBindings')
  const items = allItems.filter(item => item.isEffective !== false || item.isCommented)
  return filterBySearch(items, props.searchQuery, 'keyCode', 'command', 'comment')
})

const hotkeyWidth = computed((): number => {
  return fitTextColumnWidthNumber(
    keyBindings.value.map(item => item.keyCode === '-1' ? '无' : item.keyCode),
    t('transmute.keyCode'),
    { min: 160, max: 260, padding: 20, asciiWidth: 6 }
  )
})

const keyBindingColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'keyCode', label: t('transmute.keyCode'), width: `${hotkeyWidth.value + 30}px` },
  { key: 'command', label: t('transmute.command'), width: '360px' },
  { key: 'comment', label: t('itemColors.comment'), width: '180px' },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

const subTabsConfig = computed(() => [
  { id: 'keyBindings', label: t('tab.keyBindings') }
])

const selectedKeyBindings = ref<Set<KeyBindingItem>>(new Set())
const keyBindingDragIndex = ref<number | null>(null)
const keyBindingDragOverIndex = ref<number | null>(null)

const selectableKeyBindingsCount = computed(() => {
  return keyBindings.value.filter(item => !isItemExtern(item)).length
})

function handleExport(): void {
  exportSection('transmute')
}

function isTransmuteRowDisabled(item: BaseConfigItem): boolean {
  return isItemDisabled(item) || isItemExtern(item)
}

function isReadonlyKeyBinding(binding: KeyBindingItem): boolean {
  return isReadOnly.value || isItemDisabled(binding) || isItemExtern(binding)
}

function updateKeyBinding(binding: KeyBindingItem, field: keyof KeyBindingItem, value: string) {
  if (!config.value || isReadonlyKeyBinding(binding)) return
  ;(binding as KeyBindingItem)[field] = value as never
}

function toggleKeyBindingSelectAll() {
  const selectableItems = keyBindings.value.filter(item => !isItemExtern(item))
  if (selectedKeyBindings.value.size === selectableItems.length && selectableItems.length > 0) {
    selectedKeyBindings.value.clear()
  } else {
    selectedKeyBindings.value = new Set(selectableItems)
  }
}

function toggleKeyBindingSelect(item: KeyBindingItem) {
  if (selectedKeyBindings.value.has(item)) {
    selectedKeyBindings.value.delete(item)
  } else {
    selectedKeyBindings.value.add(item)
  }
  selectedKeyBindings.value = new Set(selectedKeyBindings.value)
}

function isKeyBindingSelected(item: KeyBindingItem) {
  return selectedKeyBindings.value.has(item)
}

function hasKeyBindingSelection() {
  return selectedKeyBindings.value.size > 0
}

function batchDeleteKeyBindings() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedKeyBindings.value) {
    if (!isItemExtern(item)) {
      deleteTransmuteItemFromFile(item, 'keyBindings')
    }
  }
  selectedKeyBindings.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchRestoreKeyBindings() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedKeyBindings.value) {
    if (!isItemExtern(item)) {
      item.isCommented = false
      item.isDeleted = false
    }
  }
  selectedKeyBindings.value.clear()
  refreshEffectiveStatus(config.value)
}

function batchCommentKeyBindings() {
  if (isReadOnly.value || !config.value) return

  for (const item of selectedKeyBindings.value) {
    if (!isItemExtern(item) && !item.isCommented) {
      item.isCommented = true
    }
  }
  selectedKeyBindings.value.clear()
  refreshEffectiveStatus(config.value)
}

function handleKeyBindingDragStart(e: DragEvent, index: number) {
  keyBindingDragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function handleKeyBindingDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  keyBindingDragOverIndex.value = index
}

function handleKeyBindingDragLeave() {
  keyBindingDragOverIndex.value = null
}

function handleKeyBindingDrop(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (isReadOnly.value || !config.value) return
  const sourceIndex = keyBindingDragIndex.value
  if (sourceIndex === null || sourceIndex === targetIndex) {
    keyBindingDragIndex.value = null
    keyBindingDragOverIndex.value = null
    return
  }

  const filteredItems = keyBindings.value
  const sourceItem = filteredItems[sourceIndex]
  if (!sourceItem) return

  const allItems = getAllTransmuteItems<KeyBindingItem>('keyBindings')
  const targetItem = filteredItems[targetIndex]
  let targetMergedIdx = targetItem ? allItems.indexOf(targetItem) : -1
  if (targetMergedIdx < 0) return
  if (sourceIndex < targetIndex) {
    targetMergedIdx++
  }

  const moved = moveTransmuteItemInFile(config.value, sourceItem, targetMergedIdx, 'keyBindings')
  if (!moved) {
    keyBindingDragIndex.value = null
    keyBindingDragOverIndex.value = null
    return
  }
  refreshEffectiveStatus(config.value)

  keyBindingDragIndex.value = null
  keyBindingDragOverIndex.value = null
}

function handleKeyBindingDragEnd() {
  keyBindingDragIndex.value = null
  keyBindingDragOverIndex.value = null
}

function hasKeyBindingExternItems() {
  return keyBindings.value.some(item => isItemExtern(item))
}

function copyAllKeyBindingExtern() {
  if (!config.value || isReadOnly.value) return
  const externItems = keyBindings.value.filter(item => isItemExtern(item))

  let copied = 0
  for (const item of externItems) {
    if (duplicateKeyBindingToMain(item, true)) copied++
  }

  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

function duplicateKeyBindingToMain(binding: KeyBindingItem, skipRefresh = false): boolean {
  if (!config.value || isReadOnly.value) return false
  if (!isItemExtern(binding)) return false

  const newItem: KeyBindingItem = {
    keyCode: binding.keyCode,
    command: binding.command,
    comment: binding.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addTransmuteItemToEditable('keyBindings', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => keyBindings.value, newItem, getKeyBindingKey, '.key-bindings-list')
  }
  return true
}

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

function addKeyBinding() {
  if (!config.value || isReadOnly.value) return

  const newItem: KeyBindingItem = {
    keyCode: '',
    command: '',
    comment: '',
    sourceFile: null,
    isCommented: false,
    isNew: true
  }
  addTransmuteItemToEditable('keyBindings', newItem)
  refreshEffectiveStatus(config.value)
  scrollToMainItemInList(() => keyBindings.value, newItem, getKeyBindingKey, '.key-bindings-list')
}
</script>

<template>
  <div class="key-binding-editor">
    <EditorPanel>
      <template #tabs>
        <SubTabs :tabs="subTabsConfig" model-value="keyBindings" />
      </template>
      <template #batch-bar>
        <div v-if="hasKeyBindingSelection() && !isReadOnly" class="batch-bar">
          <span class="batch-info">{{ t('batch.selected', { count: selectedKeyBindings.size }) }}</span>
          <button class="btn btn-small btn-primary" @click="batchRestoreKeyBindings">{{ t('btn.restore') }}</button>
          <button class="btn btn-small btn-secondary" @click="batchCommentKeyBindings">{{ t('btn.comment') }}</button>
          <button class="btn btn-small btn-danger" @click="batchDeleteKeyBindings">{{ t('btn.delete') }}</button>
        </div>
      </template>
      <template #actions>
        <button
          v-if="hasKeyBindingExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllKeyBindingExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button v-if="!isReadOnly" class="btn btn-primary btn-small" @click="addKeyBinding">{{ t('btn.add') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="keyBindings"
        :columns="keyBindingColumns"
        :empty-text="t('transmute.empty.keyBindings')"
        list-class="key-bindings-list"
        show-checkbox
        show-index
        show-drag
        :is-all-selected="selectedKeyBindings.size === selectableKeyBindingsCount && selectableKeyBindingsCount > 0"
        :is-read-only="isReadOnly"
        :is-selected="isKeyBindingSelected"
        :is-disabled="isTransmuteRowDisabled"
        :drag-over-index="keyBindingDragOverIndex"
        :row-classes="getItemRowClasses"
        @select-all="toggleKeyBindingSelectAll"
        @select="toggleKeyBindingSelect"
        @dragstart="handleKeyBindingDragStart"
        @dragover="handleKeyBindingDragOver"
        @dragleave="handleKeyBindingDragLeave"
        @drop="handleKeyBindingDrop"
        @dragend="handleKeyBindingDragEnd"
      >
        <template #cell-keyCode="{ item: binding }">
          <HotkeyInput
            :model-value="binding.keyCode"
            :disabled="isReadonlyKeyBinding(binding)"
            :input-width="hotkeyWidth"
            @update:model-value="updateKeyBinding(binding, 'keyCode', $event)"
          />
        </template>
        <template #cell-command="{ item: binding }">
          <input
            type="text"
            :value="binding.command"
            :readonly="isReadonlyKeyBinding(binding)"
            :disabled="isReadOnly"
            @input="updateKeyBinding(binding, 'command', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-comment="{ item: binding }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="binding.comment"
            :readonly="isReadonlyKeyBinding(binding)"
            :disabled="isReadOnly"
            @input="updateKeyBinding(binding, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: binding }">
          <template v-if="isItemExtern(binding)">
            <button v-if="!isReadOnly" class="btn btn-small btn-accent" @click="duplicateKeyBindingToMain(binding)" :title="t('action.copyToMain')">+</button>
            <span class="status-tag tag-extern" :title="binding.sourceFile || undefined">{{ binding.sourceFile }}</span>
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

.key-bindings-list :deep(.col-actions) {
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
