<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { TEXT_COLORS, COLOR_NONE } from '../configDefs'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  modelValue?: string | number
  disabled?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: COLOR_NONE,
  disabled: false,
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref<boolean>(false)

const currentColor = computed(() => {
  const id = parseInt(String(props.modelValue))
  return TEXT_COLORS.find(c => c.id === id) || null
})

const displayColor = computed(() => {
  if (!currentColor.value) return '#888888'
  if (currentColor.value.id === -2) return '#333333'
  return currentColor.value.rgb || '#888888'
})

interface ColorOption {
  id: number
  nameKey: string
  rgb?: string
}

function selectColor(color: ColorOption): void {
  if (props.readonly) return
  emit('update:modelValue', String(color.id))
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
    showPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="text-color-picker" :class="{ disabled }">
    <div
      class="color-display"
      :style="{ backgroundColor: displayColor }"
      :class="{ 'hidden-color': currentColor?.id === -2 }"
      @click="togglePicker"
      :title="currentColor ? `${t(currentColor.nameKey)} (${modelValue})` : t('textColor.unknown')"
    >
      <span v-if="currentColor?.id === -2" class="hidden-icon">×</span>
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="closePicker">
        <div class="picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('textColor.selectTitle') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
          </div>
          <div class="color-list">
            <div
              v-for="color in TEXT_COLORS"
              :key="color.id"
              class="color-item"
              :class="{ selected: String(color.id) === String(modelValue), readonly }"
              @click="selectColor(color)"
            >
              <div
                class="color-swatch"
                :style="{ backgroundColor: color.rgb || '#333333' }"
                :class="{ 'hidden-swatch': color.id === -2 }"
              >
                <span v-if="color.id === -2" class="hidden-icon">×</span>
              </div>
              <span class="color-name">{{ t(color.nameKey) }}</span>
              <span class="color-id">({{ color.id }})</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.text-color-picker {
  display: inline-block;
}

.text-color-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.color-display {
  width: 32px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-display:hover {
  border-color: var(--accent-color);
}

.color-display.hidden-color {
  background: repeating-linear-gradient(
    45deg,
    #333333,
    #333333 4px,
    #222222 4px,
    #222222 8px
  ) !important;
}

.hidden-icon {
  color: #FF4444;
  font-size: 14px;
  font-weight: bold;
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
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 200px;
}

.picker-header {
  font-weight: 500;
  margin-bottom: 12px;
}

.color-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.color-item:hover {
  background: var(--bg-tertiary);
}

.color-item.readonly {
  cursor: default;
}

.color-item.selected {
  background: var(--accent-color);
  color: white;
}

.color-swatch {
  width: 24px;
  height: 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-swatch.hidden-swatch {
  background: repeating-linear-gradient(
    45deg,
    #333333,
    #333333 3px,
    #222222 3px,
    #222222 6px
  ) !important;
}

.color-name {
  flex: 1;
}

.color-id {
  font-size: 12px;
  color: var(--text-muted);
}

.color-item.selected .color-id {
  color: rgba(255, 255, 255, 0.7);
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
