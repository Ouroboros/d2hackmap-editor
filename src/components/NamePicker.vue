<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  modelValue?: string
  options?: string[]
  disabled?: boolean
  readonly?: boolean
  titleKey?: string
  placeholderKey?: string
  emptyKey?: string
  noMatchKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  options: () => [],
  disabled: false,
  readonly: false,
  titleKey: 'namePicker.title',
  placeholderKey: 'namePicker.placeholder',
  emptyKey: 'namePicker.empty',
  noMatchKey: 'namePicker.noMatch'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref(false)
const searchQuery = ref('')

const uniqueOptions = computed(() => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const option of props.options) {
    const name = option.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
})

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return uniqueOptions.value
  return uniqueOptions.value.filter(name => name.toLowerCase().includes(q))
})

watch(showPicker, (value) => {
  if (value) searchQuery.value = ''
})

function togglePicker(): void {
  if (props.disabled) return
  showPicker.value = !showPicker.value
}

function closePicker(): void {
  showPicker.value = false
}

function selectOption(name: string): void {
  if (props.readonly) return
  emit('update:modelValue', name)
  closePicker()
}

function clearSelection(): void {
  if (props.readonly) return
  emit('update:modelValue', '')
  closePicker()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && showPicker.value) {
    closePicker()
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
  <div class="name-picker" :class="{ disabled }">
    <div class="picker-trigger" :title="modelValue" @click="togglePicker">
      <input
        type="text"
        :value="modelValue"
        :placeholder="t(placeholderKey)"
        :disabled="disabled"
        :title="modelValue"
        readonly
      />
      <span class="picker-arrow">▼</span>
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="closePicker">
        <div class="name-picker-popup" @mousedown.stop>
          <div class="picker-header">
            <div class="picker-title">{{ t(titleKey) }}</div>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
          </div>

          <input
            v-if="!readonly"
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="t('namePicker.search')"
          />

          <div class="option-list">
            <div v-if="filteredOptions.length === 0" class="empty-hint">
              {{ searchQuery ? t(noMatchKey) : t(emptyKey) }}
            </div>
            <button
              v-for="name in filteredOptions"
              :key="name"
              type="button"
              class="option-item"
              :class="{ selected: name === modelValue, readonly }"
              :disabled="readonly"
              @click="selectOption(name)"
            >
              <span class="option-name">{{ name }}</span>
              <span v-if="name === modelValue" class="option-mark">{{ t('descriptorPicker.selected') }}</span>
            </button>
          </div>

          <div class="picker-footer">
            <button class="btn btn-small btn-secondary" @click="closePicker">{{ t('itemPicker.cancel') }}</button>
            <button v-if="!readonly" class="btn btn-small btn-secondary" @click="clearSelection">{{ t('statGroup.clear') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.name-picker {
  display: inline-block;
  width: 100%;
  max-width: 100%;
}

.name-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.picker-trigger {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
}

.picker-trigger input {
  width: 100%;
  padding-right: 28px;
  cursor: pointer;
  background: var(--bg-primary);
}

.picker-arrow {
  position: absolute;
  right: 10px;
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.name-picker-popup {
  display: flex;
  flex-direction: column;
  width: 420px;
  max-height: 620px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.picker-header,
.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.picker-header {
  margin-bottom: 12px;
}

.picker-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.search-input {
  margin-bottom: 8px;
}

.option-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.option-item:hover:not(:disabled),
.option-item.selected {
  background: var(--bg-tertiary);
}

.option-item.readonly {
  cursor: default;
}

.option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-mark {
  margin-left: 8px;
  color: var(--accent-color);
}

.empty-hint {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}

.picker-footer {
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
