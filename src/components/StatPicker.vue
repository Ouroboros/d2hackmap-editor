<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useReferenceData } from '../composables/useReferenceData'
import { useI18n } from '../i18n'

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

const { stats, loadReferenceData, getStatById } = useReferenceData()

const showPicker = ref<boolean>(false)
const searchQuery = ref<string>('')
const selectedId = ref<string>('')

// Load reference data on mount
onMounted(() => {
  loadReferenceData()
})

// Sync selectedId with modelValue when picker opens
watch(showPicker, (val) => {
  if (val) {
    selectedId.value = props.modelValue || ''
  }
})

// Display text
const displayText = computed(() => {
  if (!props.modelValue) return props.placeholder || t('statPicker.placeholder')
  const stat = getStatById(props.modelValue)
  if (stat) {
    return `${stat.id} - ${stat.name}`
  }
  return props.modelValue
})

// Filtered stats based on search
const filteredStats = computed(() => {
  if (!stats.value || stats.value.length === 0) return []

  let result = stats.value

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(stat =>
      stat.id?.toString().includes(q) ||
      stat.name?.toLowerCase().includes(q) ||
      stat.code?.toLowerCase().includes(q)
    )
  }

  return result
})

// Check if a stat is selected
function isSelected(id: string | number): boolean {
  return selectedId.value === id?.toString()
}

// Select a stat
function selectStat(id: string | number): void {
  if (props.readonly) return
  selectedId.value = id?.toString()
}

// Clear selection
function clearSelection(): void {
  if (props.readonly) return
  selectedId.value = ''
}

// Open picker
function openPicker(): void {
  if (!props.disabled) {
    showPicker.value = true
    searchQuery.value = ''
    selectedId.value = props.modelValue || ''
  }
}

// Confirm and emit value
function confirmSelection(): void {
  if (props.readonly) return
  emit('update:modelValue', selectedId.value)
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

// Generate tooltip
const selectedTooltip = computed(() => {
  const placeholder = props.placeholder || t('statPicker.placeholder')
  if (!props.modelValue) return placeholder
  const stat = getStatById(props.modelValue)
  if (stat) {
    return `${stat.id} - ${stat.name}\n${t('statPicker.range')}: ${stat.min} ~ ${stat.max}`
  }
  return `ID: ${props.modelValue}`
})
</script>

<template>
  <div class="stat-picker" :class="{ disabled }">
    <div
      class="stat-display"
      @click="openPicker"
      :title="selectedTooltip"
    >
      {{ displayText }}
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="cancelSelection">
        <div class="picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('statPicker.title') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div v-if="!readonly" class="picker-actions">
              <button class="btn btn-small btn-secondary" @click="clearSelection">{{ t('statPicker.clear') }}</button>
            </div>
          </div>

          <!-- Manual input box -->
          <div class="manual-input-box">
            <label class="input-label">{{ t('statPicker.inputHint') }}</label>
            <input
              v-model="selectedId"
              type="text"
              :placeholder="t('statPicker.inputPlaceholder')"
              :readonly="readonly"
              class="manual-input"
            />
          </div>

          <!-- Search box -->
          <div class="search-row" v-if="stats.length > 0">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('statPicker.searchPlaceholder')"
              class="search-input"
            />
          </div>

          <!-- Stat list -->
          <div class="stat-list" v-if="stats.length > 0">
            <div v-if="filteredStats.length === 0" class="empty-hint">
              {{ t('statPicker.noMatch') }}
            </div>
            <label
              v-for="stat in filteredStats"
              :key="stat.id"
              class="stat-option"
              :class="{ selected: isSelected(stat.id), readonly }"
              @click="selectStat(stat.id)"
            >
              <input
                type="radio"
                :checked="isSelected(stat.id)"
                :disabled="readonly"
                @change="selectStat(stat.id)"
              />
              <span class="stat-id">{{ stat.id }}</span>
              <span class="stat-name">{{ stat.name }}</span>
              <span class="stat-range">{{ stat.min }} ~ {{ stat.max }}</span>
              <span v-if="stat.code" class="stat-code">{{ stat.code }}</span>
            </label>
          </div>

          <div v-else class="no-data-hint">
            {{ t('statPicker.noData') }}
          </div>

          <div class="picker-footer">
            <span class="selected-info">
              <template v-if="selectedId">
                {{ t('statPicker.selected') }}: {{ selectedId }}
              </template>
              <template v-else>
                {{ t('statPicker.notSelected') }}
              </template>
            </span>
            <div class="footer-actions">
              <button class="btn btn-small btn-secondary" @click="cancelSelection">{{ t('statPicker.cancel') }}</button>
              <button v-if="!readonly" class="btn btn-small btn-primary" @click="confirmSelection">{{ t('statPicker.confirm') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.stat-picker {
  display: inline-block;
}

.stat-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.stat-display {
  width: 150px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
  background: var(--bg-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-display:hover {
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

.stat-list {
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

.stat-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.stat-option:last-child {
  border-bottom: none;
}

.stat-option:hover {
  background: var(--bg-tertiary);
}

.stat-option.readonly {
  cursor: default;
}

.stat-option.selected {
  background: rgba(var(--accent-rgb, 74, 144, 226), 0.15);
}

.stat-option input[type="radio"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.stat-option.readonly input[type="radio"] {
  cursor: default;
}

.stat-id {
  font-size: 14px;
  color: var(--accent-color);
  min-width: 40px;
}

.stat-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.stat-range {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.stat-code {
  font-size: 12px;
  color: var(--text-muted);
  padding: 1px 4px;
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.selected-info {
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
