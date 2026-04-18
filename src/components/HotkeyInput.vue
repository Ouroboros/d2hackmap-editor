<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatHotkey, isEscapeKey } from '../utils/keymap'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  modelValue?: string
  disabled?: boolean
  inputWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  inputWidth: 80
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isRecording = ref<boolean>(false)
const inputRef = ref<HTMLInputElement | null>(null)

// Convert storage format to display format (only shorten modifiers)
function formatDisplay(value: string): string {
  return value
    .replace(/CTRL\+/g, '⌃+')
    .replace(/SHIFT\+/g, '⇧+')
    .replace(/ALT\+/g, '⌥+')
}

const displayValue = computed(() => {
  if (isRecording.value) {
    return t('hotkey.pressKey')
  }
  // "-1" means no hotkey
  if (!props.modelValue || props.modelValue === '-1') {
    return t('hotkey.none')
  }
  return formatDisplay(props.modelValue)
})

const hasValue = computed(() => {
  return props.modelValue && props.modelValue !== '-1'
})

function clearHotkey() {
  emit('update:modelValue', '-1')
}

function startRecording() {
  if (props.disabled) return
  isRecording.value = true
  // Focus to capture keyboard events
  inputRef.value?.focus()
}

function stopRecording() {
  isRecording.value = false
}

function handleKeyDown(event: KeyboardEvent): void {
  if (props.disabled) return

  event.preventDefault()
  event.stopPropagation()

  if (isEscapeKey(event)) {
    stopRecording()
    return
  }

  const vk = formatHotkey(event)
  if (vk) {
    emit('update:modelValue', vk)
    stopRecording()
  }
}

function handleBlur() {
  stopRecording()
}
</script>

<template>
  <div class="hotkey-input" :class="{ disabled, recording: isRecording }">
    <input
      ref="inputRef"
      type="text"
      class="hotkey-display"
      :value="displayValue"
      :disabled="disabled"
      :style="{ width: inputWidth + 'px' }"
      readonly
      @keydown="handleKeyDown"
      @blur="handleBlur"
      @click="startRecording"
    />
    <button
      type="button"
      class="hotkey-clear-btn"
      :disabled="disabled || !hasValue"
      :style="{ visibility: hasValue ? 'visible' : 'hidden' }"
      @click="clearHotkey"
      :title="t('hotkey.clear')"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.hotkey-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.hotkey-display {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
}

.hotkey-display:focus {
  outline: none;
  border-color: var(--accent-color);
}

.hotkey-input.recording .hotkey-display {
  border-color: var(--accent-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.hotkey-input.disabled .hotkey-display {
  cursor: not-allowed;
  opacity: 0.6;
}

.hotkey-clear-btn {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--danger-color);
  cursor: pointer;
  font-weight: bold;
}

.hotkey-clear-btn:hover {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}
</style>
