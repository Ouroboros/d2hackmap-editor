<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { parseRange, buildRange, toggleInRange } from '../utils/rangeParser'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref<boolean>(false)
const isLightTheme = ref<boolean>(false)

// Quality definitions (1-8)
const qualities = computed(() => [
  { value: 1, label: t('quality.1'), color: '#808080' },
  { value: 2, label: t('quality.2'), color: '#FFFFFF' },
  { value: 3, label: t('quality.3'), color: '#FFFFFF' },
  { value: 4, label: t('quality.4'), color: '#6969FF' },
  { value: 5, label: t('quality.5'), color: '#00FF00' },
  { value: 6, label: t('quality.6'), color: '#FFFF00' },
  { value: 7, label: t('quality.7'), color: '#C7B377' },
  { value: 8, label: t('quality.8'), color: '#FFA500' },
])

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

const MAX_QUALITY = 8

const selectedQualities = computed(() => parseRange(props.modelValue, MAX_QUALITY))

const displayText = computed(() => {
  const sel = selectedQualities.value
  if (sel.size === 0) return t('quality.any')
  if (sel.size === MAX_QUALITY) return t('quality.all')
  return props.modelValue || t('quality.any')
})

function isSelected(value: number): boolean {
  return selectedQualities.value.has(value)
}

function toggleQuality(value: number): void {
  if (props.readonly) return
  const newValue = toggleInRange(props.modelValue, value, MAX_QUALITY)
  emit('update:modelValue', newValue)
}

function selectAll(): void {
  if (props.readonly) return
  emit('update:modelValue', `1-${MAX_QUALITY}`)
}

function selectNone(): void {
  if (props.readonly) return
  emit('update:modelValue', '')
}

function togglePicker(): void {
  if (!props.disabled) {
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
        <div class="picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('quality.selectTitle') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div v-if="!readonly" class="picker-actions">
              <button class="btn btn-small btn-secondary" @click="selectAll">{{ t('quality.selectAll') }}</button>
              <button class="btn btn-small btn-secondary" @click="selectNone">{{ t('quality.clear') }}</button>
            </div>
          </div>
          <div class="quality-list">
            <label
              v-for="q in qualities"
              :key="q.value"
              class="quality-item"
              :class="{ readonly }"
              :style="{ '--quality-color': getDisplayColor(q.color) }"
            >
              <input
                type="checkbox"
                :checked="isSelected(q.value)"
                :disabled="readonly"
                @change="toggleQuality(q.value)"
              />
              <span class="quality-label">{{ q.value }}. {{ q.label }}</span>
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
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.picker-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: auto !important;
  height: auto !important;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 500;
}

.picker-actions {
  display: flex;
  gap: 4px;
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
