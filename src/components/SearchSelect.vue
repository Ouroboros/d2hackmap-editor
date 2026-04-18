<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Option {
  [key: string]: string | number | undefined
}

interface Props {
  modelValue?: string
  options?: Option[]
  placeholder?: string
  displayKey?: string
  valueKey?: string
  allowCustom?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  options: () => [],
  placeholder: '',
  displayKey: 'name',
  valueKey: 'id',
  allowCustom: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'search': [query: string]
}>()

const isOpen = ref<boolean>(false)
const searchQuery = ref<string>('')
const container = ref<HTMLElement | null>(null)
const highlightIndex = ref<number>(-1)

// Filter options based on search query
const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options.slice(0, 20)

  const q = searchQuery.value.toLowerCase()
  return props.options.filter(opt => {
    const display = opt[props.displayKey]?.toString().toLowerCase() || ''
    const value = opt[props.valueKey]?.toString().toLowerCase() || ''
    return display.includes(q) || value.includes(q)
  }).slice(0, 20)
})

// Get display text for current value
const displayText = computed(() => {
  const opt = props.options.find(o => o[props.valueKey]?.toString() === props.modelValue?.toString())
  if (opt) {
    return `${opt[props.valueKey]} - ${opt[props.displayKey]}`
  }
  return props.modelValue || ''
})

function openDropdown(): void {
  isOpen.value = true
  searchQuery.value = ''
  highlightIndex.value = -1
  emit('search', '')
}

function closeDropdown(): void {
  isOpen.value = false
}

function selectOption(opt: Option): void {
  emit('update:modelValue', opt[props.valueKey]?.toString() || '')
  closeDropdown()
}

function handleInput(e: Event): void {
  searchQuery.value = (e.target as HTMLInputElement).value
  emit('search', searchQuery.value)
  highlightIndex.value = -1
}

function handleKeydown(e: KeyboardEvent): void {
  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      openDropdown()
      e.preventDefault()
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      highlightIndex.value = Math.min(highlightIndex.value + 1, filteredOptions.value.length - 1)
      e.preventDefault()
      break
    case 'ArrowUp':
      highlightIndex.value = Math.max(highlightIndex.value - 1, -1)
      e.preventDefault()
      break
    case 'Enter':
      if (highlightIndex.value >= 0 && highlightIndex.value < filteredOptions.value.length) {
        selectOption(filteredOptions.value[highlightIndex.value])
      } else if (props.allowCustom && searchQuery.value) {
        emit('update:modelValue', searchQuery.value)
        closeDropdown()
      }
      e.preventDefault()
      break
    case 'Escape':
      closeDropdown()
      e.preventDefault()
      break
  }
}

function handleClickOutside(e: MouseEvent): void {
  if (container.value && !container.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="container" class="search-select">
    <input
      type="text"
      class="search-select-input"
      :value="isOpen ? searchQuery : displayText"
      :placeholder="placeholder || t('search.placeholder')"
      @focus="openDropdown"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <div v-show="isOpen" class="search-select-dropdown">
      <div
        v-for="(opt, index) in filteredOptions"
        :key="opt[valueKey]"
        class="search-select-option"
        :class="{ highlighted: index === highlightIndex }"
        @click="selectOption(opt)"
        @mouseenter="highlightIndex = index"
      >
        <span class="option-value">{{ opt[valueKey] }}</span>
        <span class="option-name">{{ opt[displayKey] }}</span>
      </div>
      <div v-if="filteredOptions.length === 0" class="search-select-empty">
        {{ t('search.noMatch') }}
        <span v-if="allowCustom && searchQuery">{{ t('search.pressEnterToUse', { value: searchQuery }) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-select {
  position: relative;
  display: inline-block;
}

.search-select-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-select-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.search-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.search-select-option {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
}

.search-select-option:hover,
.search-select-option.highlighted {
  background: var(--bg-secondary);
}

.option-value {
  font-weight: 600;
  color: var(--accent-color);
  min-width: 50px;
}

.option-name {
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-select-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
