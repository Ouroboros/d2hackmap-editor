<script setup lang="ts">
import { computed } from 'vue'
import { useConfig } from '../composables/useConfig'
import {
  useItemActions,
  refreshEffectiveStatus,
  getToggleKey,
  getAllItems,
  addItemToEditable,
  deleteItemFromFile,
  buildCommentedMainMap,
  getJumpTargetIndex,
  scrollToIndex,
  scrollToMainItemInList
} from '../composables/useItemActions'
import { useI18n } from '../i18n'
import { useDebugMode } from '../composables/useDebugMode'
import type { ToggleItem } from '../types'
import DebugDrawer from './debug/DebugDrawer.vue'
import FlatListView from './debug/FlatListView.vue'
import EditorPanel from './EditorPanel.vue'
import SubTabs from './SubTabs.vue'
import ConfigTable from './ConfigTable.vue'
import HotkeyInput from './HotkeyInput.vue'
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
const { markDeleted, markCommented, markRestored, isItemDisabled, isItemExtern, getItemRowClasses } = useItemActions()

// Sub-tabs configuration (single tab for alignment)
const subTabsConfig = computed(() => [
  { id: 'toggles', label: t('subTab.toggles') }
])

function handleExport(): void {
  exportSection('toggles')
}

// Get all items for building data
const togglesAll = computed(() => getAllItems<ToggleItem>(config.value, 'toggles'))

// Filter items for display: main items (all) + extern items (only effective)
function filterForDisplay<T extends { sourceFile: string | null; isEffective?: boolean }>(items: T[]): T[] {
  return items.filter(item => item.sourceFile === null || item.isEffective)
}

// Get filtered items for display
const toggles = computed((): ToggleItem[] => {
  let items = filterForDisplay(togglesAll.value)
  if (!items.length) return []

  // Filter by search query
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase()
    items = items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.comment.toLowerCase().includes(q)
    )
  }

  return items
})

// Build map for jump targets from DISPLAYED items (so indices match data-index)
const togglesJumpMap = computed(() => buildCommentedMainMap(toggles.value, getToggleKey))

// Get jump target for an item
function getToggleJumpTarget(item: ToggleItem): number | undefined {
  return getJumpTargetIndex(item, togglesJumpMap.value, getToggleKey)
}

function jumpToToggle(index: number): void {
  scrollToIndex(index, '.toggle-list')
}

// Calculate dynamic width for name column based on longest text
const nameWidth = computed((): number => {
  const items = getAllItems<ToggleItem>(config.value, 'toggles')
  if (!items.length) return 120
  const maxLen = Math.max(0, ...items.map(item => item.name.length))
  return Math.max(120, maxLen * 7 + 24)
})

// Calculate dynamic width for hotkey column based on longest text
const hotkeyWidth = computed((): number => {
  const items = getAllItems<ToggleItem>(config.value, 'toggles')
  if (!items.length) return 160
  const maxLen = Math.max(0, ...items.map(item => {
    const hk = item.hotkey || ''
    return hk === '-1' ? 2 : hk.length
  }))
  return Math.max(160, maxLen * 6 + 20)
})

// Calculate dynamic width for comment column based on longest text
const commentWidth = computed((): number => {
  const items = getAllItems<ToggleItem>(config.value, 'toggles')
  if (!items.length) return 80
  const maxLen = Math.max(0, ...items.map(item => (item.comment || '').length))
  return Math.max(80, maxLen * 7 + 24)
})

const toggleColumns = computed<ConfigTableColumn[]>(() => [
  { key: 'enabled', label: t('toggle.enabled'), width: '40px' },
  { key: 'name', label: t('toggle.name'), width: `${nameWidth.value}px` },
  { key: 'hotkey', label: t('toggle.hotkey'), width: `${hotkeyWidth.value + 30}px` },
  { key: 'comment', label: t('itemColors.comment'), width: `${commentWidth.value}px` },
  { key: 'actions', label: t('itemColors.actions'), width: '220px', className: 'col-actions' }
])

function updateToggle(item: ToggleItem, field: string, value: unknown): void {
  if (isReadOnly.value) return
  ;(item as Record<string, unknown>)[field] = value
}

function handleDelete(item: ToggleItem): void {
  if (isReadOnly.value || !config.value) return
  if (isItemExtern(item)) return

  deleteItemFromFile(config.value, item, 'toggles')
  refreshEffectiveStatus(config.value)
}

function handleComment(item: ToggleItem): void {
  if (isReadOnly.value || !config.value) return
  markCommented(item)
  refreshEffectiveStatus(config.value)
}

function handleRestore(item: ToggleItem): void {
  if (isReadOnly.value || !config.value) return
  markRestored(item)
  refreshEffectiveStatus(config.value)
}

function duplicateToMain(item: ToggleItem, skipRefresh = false): boolean {
  if (isReadOnly.value || !config.value) return false
  if (!isItemExtern(item)) return false

  // Check for duplicate: skip if main config already has item with same key
  const key = getToggleKey(item)
  const allItems = getAllItems<ToggleItem>(config.value, 'toggles')
  const hasMainItem = allItems.some(i => getToggleKey(i) === key && i.sourceFile === null)
  if (hasMainItem) return false

  // Add new main item
  const newItem: ToggleItem = {
    name: item.name,
    enabled: item.enabled,
    hotkey: item.hotkey,
    comment: item.comment,
    sourceFile: null,
    isNew: true,
    isCommented: false
  }
  addItemToEditable(config.value, 'toggles', newItem)
  if (!skipRefresh) {
    refreshEffectiveStatus(config.value)
    scrollToMainItemInList(() => toggles.value, newItem, getToggleKey, '.toggle-list')
  }
  return true
}

// Check if there are extern items
function hasExternItems(): boolean {
  return toggles.value.some(item => isItemExtern(item))
}

// Copy all extern items - use skipRefresh to avoid index shifting during batch
function copyAllExtern(): void {
  if (!config.value || isReadOnly.value) return

  // Collect extern items first (snapshot)
  const externItems = toggles.value.filter(item => isItemExtern(item))

  let copied = 0
  for (const item of externItems) {
    if (duplicateToMain(item, true)) copied++
  }

  // Refresh once after all copies
  if (copied > 0) {
    refreshEffectiveStatus(config.value)
  }
}

// Debug panel formatter
function formatToggle(item: ToggleItem): string {
  return `${item.name}: ${item.enabled ? 'ON' : 'OFF'}${item.hotkey ? ` (${item.hotkey})` : ''}`
}
</script>

<template>
  <div class="toggle-editor">
    <EditorPanel>
      <template #tabs>
        <SubTabs :tabs="subTabsConfig" model-value="toggles" />
      </template>
      <template #actions>
        <button
          v-if="hasExternItems() && !isReadOnly"
          class="btn btn-small btn-accent"
          @click="copyAllExtern"
        >{{ t('batch.copyAllExtern') }}</button>
        <button class="btn btn-secondary btn-small" @click="handleExport" :title="t('btn.export')">{{ t('btn.export') }}</button>
      </template>

      <ConfigTable
        :items="toggles"
        :columns="toggleColumns"
        :empty-text="t('toggle.empty')"
        list-class="toggle-list"
        show-index
        :is-read-only="isReadOnly"
        :is-disabled="isItemDisabled"
        :row-classes="getItemRowClasses"
        :row-key="(toggle, index) => `${toggle.name}-${index}`"
      >
        <template #cell-enabled="{ item: toggle }">
          <label>
            <input
              type="checkbox"
              :checked="toggle.enabled"
              :disabled="isItemDisabled(toggle) || isItemExtern(toggle) || isReadOnly"
              @change="updateToggle(toggle, 'enabled', ($event.target as HTMLInputElement).checked)"
            />
          </label>
        </template>
        <template #cell-name="{ item: toggle }">
          <span class="col-name">{{ toggle.name }}</span>
        </template>
        <template #cell-hotkey="{ item: toggle }">
          <HotkeyInput
            :model-value="toggle.hotkey"
            :disabled="isItemDisabled(toggle) || isItemExtern(toggle) || isReadOnly"
            :input-width="hotkeyWidth"
            @update:model-value="updateToggle(toggle, 'hotkey', $event)"
          />
        </template>
        <template #cell-comment="{ item: toggle }">
          <input
            type="text"
            class="comment-input"
            :placeholder="t('itemColors.comment')"
            :value="toggle.comment"
            :disabled="isItemDisabled(toggle) || isItemExtern(toggle) || isReadOnly"
            @input="updateToggle(toggle, 'comment', ($event.target as HTMLInputElement).value)"
          />
        </template>
        <template #cell-actions="{ item: toggle }">
          <template v-if="isItemExtern(toggle)">
              <button
                v-if="getToggleJumpTarget(toggle) !== undefined"
                class="btn btn-small btn-warning"
                @click="jumpToToggle(getToggleJumpTarget(toggle)!)"
                :title="t('action.jumpToMain')"
              >→</button>
              <button v-if="!isReadOnly && getToggleJumpTarget(toggle) === undefined" class="btn btn-small btn-accent" @click="duplicateToMain(toggle)" :title="t('action.copyToMain')">
                +
              </button>
              <span class="status-tag tag-extern" :title="toggle.sourceFile || undefined">{{ toggle.sourceFile }}</span>
            </template>
            <template v-else-if="toggle.isDeleted || toggle.isCommented">
              <button v-if="!isReadOnly" class="btn btn-small btn-primary" @click="handleRestore(toggle)" :title="t('action.restore')">
                ↩
              </button>
              <span v-if="toggle.isCommented" class="status-tag tag-commented">//</span>
              <span v-if="toggle.isDeleted" class="status-tag tag-deleted">×</span>
            </template>
            <template v-else-if="!isReadOnly">
              <button class="btn btn-small btn-secondary" @click="handleComment(toggle)" :title="t('action.comment')">
                //
              </button>
              <button class="btn btn-small btn-danger" @click="handleDelete(toggle)" :title="t('action.delete')">
                ×
              </button>
            </template>
        </template>
      </ConfigTable>
    </EditorPanel>

    <!-- Debug Panel -->
    <DebugDrawer v-if="debugMode && getAllItems(config, 'toggles').length">
      <FlatListView
        :items="getAllItems(config, 'toggles')"
        title="Toggles"
        :get-key="getToggleKey"
        :format-item="formatToggle"
      />
    </DebugDrawer>
  </div>
</template>

<style scoped>
.toggle-list {
  max-height: calc(70vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
}

.toggle-list :deep(.config-header),
.toggle-list :deep(.config-row) {
  gap: 16px;
}

.col-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.comment-input {
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid transparent;
  padding: 2px 4px;
  flex-shrink: 0;
}

.comment-input:focus {
  border-color: var(--border-color);
  background: var(--bg-primary);
  outline: none;
}

.comment-input:disabled {
  opacity: 0.6;
}
</style>
