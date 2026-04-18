<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../i18n'
import { parseRange, buildRange } from '../utils/rangeParser'
import RUNES from '../../data/runes.json'

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

interface Rune {
  id: number
  name: string
  code: string
}

const MAX_RUNE = RUNES.length

const showPicker = ref<boolean>(false)
const searchQuery = ref<string>('')
const manualInput = ref<string>('')
const showSelectedOnly = ref<boolean>(false)

// Sync manualInput with modelValue when picker opens
watch(showPicker, (val) => {
  if (val) {
    manualInput.value = props.modelValue || ''
  }
})

// Parse selected IDs from manualInput (live editing)
const selectedIds = computed(() => {
  if (!manualInput.value) return new Set()
  return parseRange(manualInput.value, MAX_RUNE)
})

// Display text
const displayText = computed(() => {
  if (!props.modelValue) return props.placeholder || t('runePicker.placeholder')
  return props.modelValue
})

// Filtered runes based on search and selected filter
const filteredRunes = computed(() => {
  let result = RUNES

  // Filter by selected only
  if (showSelectedOnly.value) {
    result = result.filter(rune => selectedIds.value.has(rune.id))
  }

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(rune =>
      rune.id.toString().includes(q) ||
      rune.name.toLowerCase().includes(q) ||
      rune.code.toLowerCase().includes(q)
    )
  }

  return result
})

// Check if a rune is selected
function isSelected(id: number): boolean {
  return selectedIds.value.has(id)
}

// Toggle rune selection
function toggleRune(id: number): void {
  if (props.readonly) return
  const selected = new Set(selectedIds.value)
  if (selected.has(id)) {
    selected.delete(id)
  } else {
    selected.add(id)
  }
  manualInput.value = buildRange(selected, MAX_RUNE)
}

// Select all visible runes
function selectAll(): void {
  if (props.readonly) return
  if (!searchQuery.value) {
    manualInput.value = `1-${MAX_RUNE}`
  } else {
    const selected = new Set(selectedIds.value)
    for (const rune of filteredRunes.value) {
      selected.add(rune.id)
    }
    manualInput.value = buildRange(selected, MAX_RUNE)
  }
}

// Clear all selections
function selectNone(): void {
  if (props.readonly) return
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
  if (props.readonly) return
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

// Get rune by ID
function getRuneById(id: number): Rune | undefined {
  return (RUNES as Rune[]).find(r => r.id === id)
}

// Generate tooltip showing selected rune names
const selectedTooltip = computed(() => {
  const placeholder = props.placeholder || t('runePicker.placeholder')
  if (!props.modelValue) return placeholder
  const ids = parseRange(props.modelValue, MAX_RUNE)
  if (ids.size === 0) return placeholder
  const names = Array.from(ids)
    .slice(0, 5)
    .map(id => {
      const rune = getRuneById(id)
      return rune ? `${rune.code} ${rune.name}` : `#${id}`
    })
  if (ids.size > 5) {
    names.push(t('runePicker.moreItems', { count: ids.size - 5 }))
  }
  return names.join('\n')
})
</script>

<template>
  <div class="rune-picker" :class="{ disabled }">
    <div
      class="rune-display"
      @click="openPicker"
      :title="selectedTooltip"
    >
      {{ displayText }}
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="cancelSelection">
        <div class="picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('runePicker.title') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div v-if="!readonly" class="picker-actions">
              <button class="btn btn-small btn-secondary" @click="selectAll">{{ t('runePicker.selectAll') }}</button>
              <button class="btn btn-small btn-secondary" @click="selectNone">{{ t('runePicker.clear') }}</button>
            </div>
          </div>

          <!-- Manual input box -->
          <div class="manual-input-box">
            <label class="input-label">{{ t('runePicker.idRange') }} ({{ t('runePicker.idRangeHint') }})</label>
            <input
              v-model="manualInput"
              type="text"
              :placeholder="t('runePicker.inputPlaceholder')"
              :readonly="readonly"
              class="manual-input"
            />
          </div>

          <!-- Search box and filter -->
          <div class="search-row">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('runePicker.searchPlaceholder')"
              class="search-input"
            />
            <button
              class="btn btn-small"
              :class="showSelectedOnly ? 'btn-primary' : 'btn-secondary'"
              @click="showSelectedOnly = !showSelectedOnly"
              :title="t('runePicker.showSelected')"
            >
              {{ t('runePicker.selected', { count: selectedIds.size }) }}
            </button>
          </div>

          <!-- Rune list -->
          <div class="rune-list">
            <div v-if="filteredRunes.length === 0" class="empty-hint">
              {{ t('runePicker.noMatch') }}
            </div>
            <label
              v-for="rune in filteredRunes"
              :key="rune.id"
              class="rune-option"
              :class="{ selected: isSelected(rune.id), readonly }"
            >
              <input
              type="checkbox"
              :checked="isSelected(rune.id)"
              :disabled="readonly"
              @change="toggleRune(rune.id)"
            />
              <span class="rune-id">{{ rune.id }}</span>
              <span class="rune-code">{{ rune.code }}</span>
              <span class="rune-name">{{ rune.name }}</span>
            </label>
          </div>

          <div class="picker-footer">
            <span class="selected-count">{{ t('runePicker.selected', { count: selectedIds.size }) }}</span>
            <div class="footer-actions">
              <button class="btn btn-small btn-secondary" @click="cancelSelection">{{ t('runePicker.cancel') }}</button>
              <button v-if="!readonly" class="btn btn-small btn-primary" @click="confirmSelection">{{ t('runePicker.confirm') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.rune-picker {
  display: inline-block;
}

.rune-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.rune-display {
  min-width: 80px;
  max-width: 120px;
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

.rune-display:hover {
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

.rune-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
}

.empty-hint {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.rune-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.rune-option:last-child {
  border-bottom: none;
}

.rune-option:hover {
  background: var(--bg-tertiary);
}

.rune-option.readonly {
  cursor: default;
}

.rune-option.selected {
  background: rgba(var(--accent-rgb, 74, 144, 226), 0.15);
}

.rune-option input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.rune-option.readonly input[type="checkbox"] {
  cursor: default;
}

.rune-id {
  font-size: 14px;
  color: var(--text-muted);
  min-width: 24px;
}

.rune-code {
  font-size: 14px;
  color: var(--accent-color);
  min-width: 32px;
}

.rune-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
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
