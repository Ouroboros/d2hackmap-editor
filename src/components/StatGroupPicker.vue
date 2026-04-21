<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useConfig } from '../composables/useConfig'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
  excludeName?: string
  displayTextOverride?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  readonly: false,
  placeholder: '',
  excludeName: '',
  displayTextOverride: '',
  compact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { config } = useConfig()

const showPicker = ref<boolean>(false)
const activeTab = ref<'limits' | 'groups'>('limits')
const searchQuery = ref<string>('')
const showSelectedOnly = ref<boolean>(false)
const originalValue = ref<string>('')

// Parse selected items from comma-separated string
const selectedItems = computed(() => {
  if (!props.modelValue) return new Set()
  return new Set(props.modelValue.split(',').map(s => s.trim()).filter(s => s))
})

const hoverText = computed(() => {
  if (!props.modelValue) return ''
  return props.modelValue
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n')
})

// Reset search when picker opens, save original value for cancel
watch(showPicker, (val) => {
  if (val) {
    searchQuery.value = ''
    showSelectedOnly.value = false
    originalValue.value = props.modelValue
  }
})

// Get stat limits from transmute config
const statLimits = computed(() => {
  const limits = config.value?.files.flatMap(file => file.data.transmute.statLimits) || []
  return [...new Set(limits
    .filter(item => item.isEffective !== false || item.isCommented)
    .map(item => item.name)
    .filter(Boolean))]
    .sort()
})

// Get stat limit groups from transmute config
const statLimitGroups = computed(() => {
  const groups = config.value?.files.flatMap(file => file.data.transmute.statLimitGroups) || []
  return [...new Set(groups
    .filter(item => item.isEffective !== false || item.isCommented)
    .map(item => item.name)
    .filter(Boolean))]
    .sort()
})

// Filtered stat limits (exclude names that exist in stat limit groups - groups take priority)
const filteredLimits = computed(() => {
  const groupNames = new Set(statLimitGroups.value)
  let result = statLimits.value.filter(name => !groupNames.has(name))
  // Filter by selected only
  if (showSelectedOnly.value) {
    result = result.filter(name => selectedItems.value.has(name))
  }
  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(name => name.toLowerCase().includes(q))
  }
  return result
})

// Filtered stat limit groups
const filteredGroups = computed(() => {
  let result = statLimitGroups.value
  if (props.excludeName) {
    result = result.filter(name => name !== props.excludeName)
  }
  // Filter by selected only
  if (showSelectedOnly.value) {
    result = result.filter(name => selectedItems.value.has(name))
  }
  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(name => name.toLowerCase().includes(q))
  }
  return result
})

// Check if an item is selected
function isSelected(name: string): boolean {
  return selectedItems.value.has(name)
}

// Toggle selection of an item
function toggleItem(name: string): void {
  if (props.readonly) return
  const items = new Set(selectedItems.value)
  if (items.has(name)) {
    items.delete(name)
  } else {
    items.add(name)
  }
  emit('update:modelValue', Array.from(items).join(','))
}

function selectAll(): void {
  if (props.readonly) return
  // Select all items from current tab's filtered list
  const items = new Set(selectedItems.value)
  const toAdd = activeTab.value === 'limits' ? filteredLimits.value : filteredGroups.value
  toAdd.forEach(name => items.add(name))
  emit('update:modelValue', Array.from(items).join(','))
}

function clearSelection(): void {
  if (props.readonly) return
  emit('update:modelValue', '')
}

function cancelSelection(): void {
  if (props.readonly) {
    showPicker.value = false
    return
  }
  emit('update:modelValue', originalValue.value)
  showPicker.value = false
}

function confirmSelection(): void {
  showPicker.value = false
}

function togglePicker(): void {
  if (!props.disabled) {
    showPicker.value = !showPicker.value
  }
}

function closePicker(): void {
  showPicker.value = false
}

// Handle ESC key to close picker
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && showPicker.value) {
    cancelSelection()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Display text for current value
const displayText = computed(() => {
  if (props.displayTextOverride) return props.displayTextOverride
  const count = selectedItems.value.size
  if (count === 0) return ''
  if (count === 1) return Array.from(selectedItems.value)[0]
  return t('statGroup.multiSelected', { count })
})
</script>

<template>
  <div class="stat-group-picker" :class="{ disabled, compact }">
    <div class="picker-input" :title="hoverText" @click="togglePicker">
      <input
        type="text"
        :value="displayText"
        :placeholder="placeholder || t('statGroup.placeholder')"
        :disabled="disabled"
        :title="hoverText"
        readonly
      />
      <span class="picker-arrow">▼</span>
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="closePicker">
        <div class="stat-group-popup" @click.stop>
          <div class="picker-header">
            <div class="picker-tabs">
              <button
                class="picker-tab"
                :class="{ active: activeTab === 'limits' }"
                @click="activeTab = 'limits'"
              >
                {{ t('statGroup.tabLimits') }} ({{ filteredLimits.length }})
              </button>
              <button
                class="picker-tab"
                :class="{ active: activeTab === 'groups' }"
                @click="activeTab = 'groups'"
              >
                {{ t('statGroup.tabGroups') }} ({{ filteredGroups.length }})
              </button>
            </div>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div v-if="!readonly" class="header-actions">
              <button class="btn btn-small btn-secondary" @click="selectAll">
                {{ t('quality.selectAll') }}
              </button>
              <button class="btn btn-small btn-secondary" @click="clearSelection">
                {{ t('statGroup.clear') }}
              </button>
            </div>
          </div>

          <!-- Search box with selected filter -->
          <div class="search-row">
            <input
              type="text"
              v-model="searchQuery"
              :placeholder="t('statGroup.search')"
              class="search-input"
            />
            <button
              class="btn btn-small"
              :class="showSelectedOnly ? 'btn-primary' : 'btn-secondary'"
              @click="showSelectedOnly = !showSelectedOnly"
              :title="t('statGroup.showSelected')"
            >
              {{ t('statGroup.selectedCount', { count: selectedItems.size }) }}
            </button>
          </div>

          <!-- Selected items preview -->
          <div class="selected-preview">
            <span class="preview-text" v-if="selectedItems.size > 0">{{ Array.from(selectedItems).join(', ') }}</span>
            <span class="preview-text preview-empty" v-else>{{ t('statGroup.noSelection') }}</span>
          </div>

          <!-- Stat Limits Tab -->
          <div v-show="activeTab === 'limits'" class="picker-content">
            <div v-if="filteredLimits.length === 0" class="empty-hint">
              {{ searchQuery ? t('statGroup.noMatch') : t('statGroup.emptyLimits') }}
            </div>
            <div v-else class="picker-list">
              <div
                v-for="name in filteredLimits"
                :key="name"
                class="picker-item"
                :class="{ selected: isSelected(name), readonly }"
                @click="toggleItem(name)"
              >
                <input type="checkbox" :checked="isSelected(name)" :disabled="readonly" @click.stop />
                <span>{{ name }}</span>
              </div>
            </div>
          </div>

          <!-- Stat Limit Groups Tab -->
          <div v-show="activeTab === 'groups'" class="picker-content">
            <div v-if="filteredGroups.length === 0" class="empty-hint">
              {{ searchQuery ? t('statGroup.noMatch') : t('statGroup.emptyGroups') }}
            </div>
            <div v-else class="picker-list">
              <div
                v-for="name in filteredGroups"
                :key="name"
                class="picker-item"
                :class="{ selected: isSelected(name), readonly }"
                @click="toggleItem(name)"
              >
                <input type="checkbox" :checked="isSelected(name)" :disabled="readonly" @click.stop />
                <span>{{ name }}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="picker-footer">
            <span class="selected-count">{{ t('statGroup.selectedCount', { count: selectedItems.size }) }}</span>
            <div class="footer-actions">
              <button class="btn btn-small btn-secondary" @click="cancelSelection">{{ t('itemPicker.cancel') }}</button>
              <button v-if="!readonly" class="btn btn-small btn-primary" @click="confirmSelection">{{ t('statGroup.confirm') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.stat-group-picker {
  display: inline-block;
  width: 100%;
  max-width: 100%;
}

.stat-group-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.picker-input {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
}

.picker-input input {
  width: 100%;
  padding-right: 24px;
  cursor: pointer;
  background: var(--bg-primary);
}

.picker-input input:hover:not(:disabled) {
  border-color: var(--accent-color);
}

.picker-input input:disabled {
  cursor: not-allowed;
}

.stat-group-picker.compact .picker-input input {
  height: auto;
  padding: 8px 40px 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.stat-group-picker.compact .picker-input input:hover:not(:disabled) {
  border-color: var(--accent-color);
  background: var(--bg-secondary);
}

.stat-group-picker.compact .picker-arrow {
  right: 14px;
  color: var(--text-secondary);
}

.picker-arrow {
  position: absolute;
  right: 8px;
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.stat-group-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 480px;
  height: 650px;
  display: flex;
  flex-direction: column;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.picker-tabs {
  display: flex;
  gap: 4px;
}

.picker-tab {
  padding: 6px 16px;
  font-size: 13px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
}

.picker-tab:hover {
  background: var(--border-color);
}

.picker-tab.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.selected-preview {
  margin-bottom: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  max-height: 60px;
  overflow-y: auto;
}

.preview-text {
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.preview-empty {
  color: var(--text-muted);
  font-style: italic;
}

.picker-content {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
}

.picker-list {
  display: flex;
  flex-direction: column;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
}

.picker-item:last-child {
  border-bottom: none;
}

.picker-item:hover {
  background: var(--bg-tertiary);
}

.picker-item.readonly {
  cursor: default;
}

.picker-item.selected {
  background: var(--accent-color);
  color: white;
}

.picker-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.picker-item.readonly input[type="checkbox"] {
  cursor: default;
}

.empty-hint {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.selected-count {
  font-size: 13px;
  color: var(--text-muted);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.readonly-badge {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: auto;
  margin-right: 8px;
}
</style>
