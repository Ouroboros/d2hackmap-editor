<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useReferenceData } from '../composables/useReferenceData'
import { useI18n } from '../i18n'
import { parseRange, buildRange } from '../utils/rangeParser'

const { t } = useI18n()

interface Props {
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  readonly: false,
  placeholder: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { items, loadReferenceData, getItemById } = useReferenceData()

const showPicker = ref<boolean>(false)
const searchQuery = ref<string>('')
const manualInput = ref<string>('')
const showSelectedOnly = ref<boolean>(false)

// Load reference data on mount
onMounted(() => {
  loadReferenceData()
})

// Sync manualInput with modelValue when picker opens
watch(showPicker, (val) => {
  if (val) {
    manualInput.value = props.modelValue || ''
  }
})

// Parse selected IDs from manualInput (live editing)
const selectedIds = computed(() => {
  if (!manualInput.value) return new Set()
  return parseRange(manualInput.value, 99999)
})

// Display text - just show the ID string
const displayText = computed(() => {
  if (!props.modelValue) return props.placeholder || t('itemColors.itemId')
  return props.modelValue
})

// Filtered items based on search and selected filter
const filteredItems = computed(() => {
  if (!items.value || items.value.length === 0) return []

  let result = items.value

  // Filter by selected only
  if (showSelectedOnly.value) {
    result = result.filter(item => selectedIds.value.has(item.id))
  }

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(item =>
      item.id?.toString().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.code?.toLowerCase().includes(q)
    )
  }

  return result
})

// Check if an item is selected
function isSelected(id: number): boolean {
  return selectedIds.value.has(id)
}

// Toggle item selection
function toggleItem(id: number): void {
  const selected = new Set(selectedIds.value)
  if (selected.has(id)) {
    selected.delete(id)
  } else {
    selected.add(id)
  }
  // Build optimized range string
  manualInput.value = buildRange(selected, 99999)
}

// Select all visible items
function selectAll(): void {
  // If no search filter, use "1+" to represent all items
  if (!searchQuery.value && items.value.length > 0) {
    manualInput.value = '1+'
  } else {
    const selected = new Set(selectedIds.value)
    for (const item of filteredItems.value) {
      selected.add(item.id)
    }
    manualInput.value = buildRange(selected, 99999)
  }
}

// Clear all selections
function selectNone(): void {
  manualInput.value = ''
}

// Open picker
function openPicker(): void {
  if (!props.disabled) {
    showPicker.value = true
    searchQuery.value = ''
    manualInput.value = props.modelValue || ''
  }
}

// Confirm and emit value
function confirmSelection(): void {
  emit('update:modelValue', manualInput.value)
  showPicker.value = false
}

// Cancel and close
function cancelSelection(): void {
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

// Get item name by ID for tooltip
function getItemName(id: number): string {
  const item = getItemById(id)
  return item ? item.name : `ID: ${id}`
}

// Generate tooltip showing selected item names
const selectedTooltip = computed(() => {
  const placeholder = props.placeholder || t('itemColors.itemId')
  if (!props.modelValue) return placeholder
  const ids = parseRange(props.modelValue, 99999)
  if (ids.size === 0) return placeholder
  const names = Array.from(ids)
    .slice(0, 5)
    .map(id => getItemName(id))
  if (ids.size > 5) {
    names.push(t('itemPicker.moreItems', { count: ids.size - 5 }))
  }
  return names.join('\n')
})
</script>

<template>
  <div class="item-picker" :class="{ disabled }">
    <div
      class="item-display"
      @click="openPicker"
      :title="selectedTooltip"
    >
      {{ displayText }}
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="cancelSelection">
        <div class="picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('itemPicker.title') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div class="picker-actions">
              <button class="btn btn-small btn-secondary" @click="selectAll" :disabled="filteredItems.length === 0">{{ t('itemPicker.selectAll') }}</button>
              <button class="btn btn-small btn-secondary" @click="selectNone">{{ t('itemPicker.clear') }}</button>
            </div>
          </div>

          <!-- Manual input box -->
          <div class="manual-input-box">
            <label class="input-label">{{ t('itemPicker.idRange') }} ({{ t('itemPicker.idRangeHint') }})</label>
            <input
              v-model="manualInput"
              type="text"
              :placeholder="t('itemPicker.inputPlaceholder')"
              class="manual-input"
            />
          </div>

          <!-- Search box and filter for item list -->
          <div class="search-row" v-if="items.length > 0">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('itemPicker.searchPlaceholder')"
              class="search-input"
            />
            <button
              class="btn btn-small"
              :class="showSelectedOnly ? 'btn-primary' : 'btn-secondary'"
              @click="showSelectedOnly = !showSelectedOnly"
              :title="t('itemPicker.showSelected')"
            >
              {{ t('itemPicker.selected', { count: selectedIds.size }) }}
            </button>
          </div>

          <!-- Item list (only show if has items) -->
          <div class="item-list" v-if="items.length > 0">
            <div v-if="filteredItems.length === 0" class="empty-hint">
              {{ t('itemPicker.noMatch') }}
            </div>
            <label
              v-for="item in filteredItems"
              :key="item.id"
              class="item-option"
              :class="{ selected: isSelected(item.id) }"
            >
              <input
                type="checkbox"
                :checked="isSelected(item.id)"
                @change="toggleItem(item.id)"
              />
              <span class="item-id">{{ item.id }}</span>
              <span class="item-name">{{ item.name }}</span>
              <span v-if="item.code" class="item-code">{{ item.code }}</span>
            </label>
          </div>

          <div v-else class="no-data-hint">
            {{ t('itemPicker.noData') }}
          </div>

          <div class="picker-footer">
            <span class="selected-count">{{ t('itemPicker.selected', { count: selectedIds.size }) }}</span>
            <div class="footer-actions">
              <button class="btn btn-small btn-secondary" @click="cancelSelection">{{ t('itemPicker.cancel') }}</button>
              <button v-if="!readonly" class="btn btn-small btn-primary" @click="confirmSelection">{{ t('itemPicker.confirm') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.item-picker {
  display: inline-block;
}

.item-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.item-display {
  min-width: 100px;
  max-width: 150px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--bg-primary);
}

.item-display:hover {
  border-color: var(--accent-color);
}

.manual-input-box {
  margin-bottom: 12px;
}

.input-label {
  display: block;
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.manual-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.manual-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.search-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.item-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
}

.empty-hint,
.no-data-hint {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.no-data-hint {
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 12px;
}

.item-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.item-option:last-child {
  border-bottom: none;
}

.item-option:hover {
  background: var(--bg-tertiary);
}

.item-option.selected {
  background: rgba(var(--accent-rgb, 74, 144, 226), 0.15);
}

.item-option input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.item-id {
  font-size: 14px;
  color: var(--accent-color);
  min-width: 50px;
}

.item-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.item-code {
  font-size: 12px;
  color: var(--text-muted);
  padding: 1px 4px;
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.selected-count {
  font-size: 14px;
  color: var(--text-secondary);
}

.readonly-badge {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
}
</style>
