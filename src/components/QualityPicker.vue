<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { parseRange, buildRange, toggleInRange } from '../utils/rangeParser'
import { useI18n } from '../i18n'

const { t } = useI18n()

export interface PickerOption {
  value: number
  label: string
  color?: string
}

interface Props {
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
  title?: string
  options?: PickerOption[]
  maxValue?: number
  allValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  readonly: false,
  title: '',
  options: undefined,
  maxValue: undefined,
  allValue: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref<boolean>(false)
const isLightTheme = ref<boolean>(false)
const pickerPosition = ref<{ left: number; top: number }>({ left: 0, top: 0 })

// Quality definitions (1-8)
const defaultQualities = computed<PickerOption[]>(() => [
  { value: 1, label: t('quality.1'), color: '#808080' },
  { value: 2, label: t('quality.2'), color: '#FFFFFF' },
  { value: 3, label: t('quality.3'), color: '#FFFFFF' },
  { value: 4, label: t('quality.4'), color: '#6969FF' },
  { value: 5, label: t('quality.5'), color: '#00FF00' },
  { value: 6, label: t('quality.6'), color: '#FFFF00' },
  { value: 7, label: t('quality.7'), color: '#C7B377' },
  { value: 8, label: t('quality.8'), color: '#FFA500' },
])

const options = computed(() => props.options?.length ? props.options : defaultQualities.value)
const maxValue = computed(() => props.maxValue ?? Math.max(...options.value.map(option => option.value)))
const allValue = computed(() => props.allValue ?? `1-${maxValue.value}`)
const selectTitle = computed(() => props.title || t('quality.selectTitle'))

// Get display color (adjust bright colors for light theme)
function getDisplayColor(color: string): string {
  if (isLightTheme.value) {
    const lightThemeColors: Record<string, string> = {
      '#FFFFFF': '#333333',
      '#00FF00': '#228B22',
      '#FFFF00': '#B8860B',
    }
    return lightThemeColors[color] || color
  }
  return color
}

// Watch for theme changes
function checkTheme(): void {
  isLightTheme.value = document.documentElement.classList.contains('light')
}

// Handle ESC key to close picker
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && showPicker.value) {
    showPicker.value = false
  }
}

let observer: MutationObserver | null = null
onMounted(() => {
  checkTheme()
  observer = new MutationObserver(checkTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  document.removeEventListener('keydown', handleKeydown)
})

const selectedQualities = computed(() => parseRange(props.modelValue, maxValue.value))
const allSelected = computed(() => options.value.every(option => selectedQualities.value.has(option.value)))

const displayText = computed(() => {
  const sel = selectedQualities.value
  if (sel.size === 0) return t('quality.any')
  if (allSelected.value) return t('quality.all')
  return props.modelValue || t('quality.any')
})

function isSelected(value: number): boolean {
  return selectedQualities.value.has(value)
}

function toggleQuality(value: number): void {
  if (props.readonly) return
  const selected = parseRange(toggleInRange(props.modelValue, value, maxValue.value), maxValue.value)
  const optionValues = new Set(options.value.map(option => option.value))
  const filtered = new Set(Array.from(selected).filter(item => optionValues.has(item)))
  const isAllSelected = options.value.every(option => filtered.has(option.value))
  emit('update:modelValue', isAllSelected ? allValue.value : buildRange(filtered, maxValue.value))
}

function selectAll(): void {
  if (props.readonly) return
  emit('update:modelValue', allValue.value)
}

function selectNone(): void {
  if (props.readonly) return
  emit('update:modelValue', '')
}

function updatePickerPosition(target: HTMLElement): void {
  const rect = target.getBoundingClientRect()
  const popupWidth = 260
  const gap = 8
  const popupHeight = Math.min(640, window.innerHeight - gap * 2)
  let left = rect.right + gap
  let top = rect.top

  if (left + popupWidth > window.innerWidth - gap) {
    left = rect.left - popupWidth - gap
  }
  if (top + popupHeight > window.innerHeight - gap) {
    top = window.innerHeight - popupHeight - gap
  }
  if (top < gap) top = gap
  if (left < gap) left = gap

  pickerPosition.value = { left, top }
}

function togglePicker(event: MouseEvent): void {
  if (!props.disabled) {
    updatePickerPosition(event.currentTarget as HTMLElement)
    showPicker.value = !showPicker.value
  }
}

function closePicker(): void {
  showPicker.value = false
}
</script>

<template>
  <div class="quality-picker" :class="{ disabled }">
    <div
      class="quality-display"
      @click="togglePicker"
      :title="displayText"
    >
      {{ displayText }}
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="closePicker">
        <div class="picker-popup quality-picker-popup" :style="{ left: `${pickerPosition.left}px`, top: `${pickerPosition.top}px` }" @click.stop>
          <div class="picker-header">
            <span>{{ selectTitle }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div v-if="!readonly" class="picker-actions">
              <button class="btn btn-small btn-secondary" @click="selectAll">{{ t('quality.selectAll') }}</button>
              <button class="btn btn-small btn-secondary" @click="selectNone">{{ t('quality.clear') }}</button>
            </div>
          </div>
          <div class="quality-list">
            <label
              v-for="q in options"
              :key="q.value"
              class="quality-item"
              :class="{ readonly }"
              :style="{ '--quality-color': getDisplayColor(q.color || 'var(--text-primary)') }"
            >
              <input
                type="checkbox"
                :checked="isSelected(q.value)"
                :disabled="readonly"
                @change="toggleQuality(q.value)"
              />
              <span class="quality-label">{{ q.label === String(q.value) ? q.label : `${q.value}. ${q.label}` }}</span>
            </label>
          </div>
          <div class="picker-footer">
            <span class="result-preview">{{ modelValue || `(${t('quality.any')})` }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.quality-picker {
  display: inline-block;
  width: 100%;
}

.quality-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.quality-display {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--bg-primary);
  box-sizing: border-box;
}

.quality-display:hover {
  border-color: var(--accent-color);
}

.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.picker-popup {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: auto !important;
  height: auto !important;
  max-height: min(640px, calc(100vh - 16px));
  overflow-y: auto;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-weight: 500;
}

.picker-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.quality-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quality-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.quality-item:hover {
  background: var(--bg-tertiary);
}

.quality-item.readonly {
  cursor: default;
}

.quality-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.quality-item.readonly input[type="checkbox"] {
  cursor: default;
}

.quality-label {
  color: var(--quality-color);
}

.picker-footer {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.result-preview {
  font-size: 14px;
  color: var(--text-muted);
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
