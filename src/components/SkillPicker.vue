<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useReferenceData, type ReferenceSkill } from '../composables/useReferenceData'
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

const { skills, loadReferenceData, getSkillById } = useReferenceData()

type ReferenceSkillWithId = ReferenceSkill & { id: number }

function hasSkillId(skill: ReferenceSkill): skill is ReferenceSkillWithId {
  return typeof skill.id === 'number'
}

const showPicker = ref<boolean>(false)
const searchQuery = ref<string>('')
const selectedId = ref<string>('')

onMounted(() => {
  loadReferenceData()
})

watch(showPicker, (val) => {
  if (val) {
    selectedId.value = props.modelValue || ''
  }
})

const displayText = computed(() => {
  if (!props.modelValue) return props.placeholder || t('skillPicker.placeholder')
  const skill = getSkillById(props.modelValue)
  if (skill) {
    return `${skill.id} - ${skill.name}`
  }
  return props.modelValue
})

const filteredSkills = computed<ReferenceSkillWithId[]>(() => {
  if (!skills.value || skills.value.length === 0) return []

  let result = skills.value.filter(hasSkillId)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(skill =>
      skill.id?.toString().includes(q) ||
      skill.name?.toLowerCase().includes(q) ||
      skill.classCode?.toLowerCase().includes(q)
    )
  }

  return result
})

function isSelected(id: string | number): boolean {
  return selectedId.value === id?.toString()
}

function selectSkill(id: string | number): void {
  if (props.readonly) return
  selectedId.value = id.toString()
}

function clearSelection(): void {
  if (props.readonly) return
  selectedId.value = ''
}

function openPicker(): void {
  if (!props.disabled) {
    showPicker.value = true
    searchQuery.value = ''
    selectedId.value = props.modelValue || ''
  }
}

function confirmSelection(): void {
  if (props.readonly) return
  emit('update:modelValue', selectedId.value)
  showPicker.value = false
}

function cancelSelection(): void {
  showPicker.value = false
}

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

const selectedTooltip = computed(() => {
  const placeholder = props.placeholder || t('skillPicker.placeholder')
  if (!props.modelValue) return placeholder
  const skill = getSkillById(props.modelValue)
  if (skill) {
    const classCode = skill.classCode ? `\n${skill.classCode}` : ''
    return `${skill.id} - ${skill.name}${classCode}`
  }
  return `ID: ${props.modelValue}`
})
</script>

<template>
  <div class="skill-picker" :class="{ disabled }">
    <div
      class="skill-display"
      @click="openPicker"
      :title="selectedTooltip"
    >
      {{ displayText }}
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @mousedown.self="cancelSelection">
        <div class="picker-popup skill-picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('skillPicker.title') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <div v-if="!readonly" class="picker-actions">
              <button class="btn btn-small btn-secondary" @click="clearSelection">{{ t('skillPicker.clear') }}</button>
            </div>
          </div>

          <div class="manual-input-box">
            <label class="input-label">{{ t('skillPicker.inputHint') }}</label>
            <input
              v-model="selectedId"
              type="text"
              :placeholder="t('skillPicker.inputPlaceholder')"
              :readonly="readonly"
              class="manual-input"
            />
          </div>

          <div class="search-row" v-if="skills.length > 0">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('skillPicker.searchPlaceholder')"
              class="search-input"
            />
          </div>

          <div class="skill-list" v-if="skills.length > 0">
            <div v-if="filteredSkills.length === 0" class="empty-hint">
              {{ t('skillPicker.noMatch') }}
            </div>
            <label
              v-for="skill in filteredSkills"
              :key="skill.id"
              class="skill-option"
              :class="{ selected: isSelected(skill.id), readonly }"
              @click="selectSkill(skill.id)"
            >
              <input
                type="radio"
                :checked="isSelected(skill.id)"
                :disabled="readonly"
                @change="selectSkill(skill.id)"
              />
              <span class="skill-id">{{ skill.id }}</span>
              <span class="skill-name">{{ skill.name }}</span>
              <span v-if="skill.classCode" class="skill-class">{{ skill.classCode }}</span>
            </label>
          </div>

          <div v-else class="no-data-hint">
            {{ t('skillPicker.noData') }}
          </div>

          <div class="picker-footer">
            <span class="selected-info">
              <template v-if="selectedId">
                {{ t('skillPicker.selected') }}: {{ selectedId }}
              </template>
              <template v-else>
                {{ t('skillPicker.notSelected') }}
              </template>
            </span>
            <div class="footer-actions">
              <button class="btn btn-small btn-secondary" @click="cancelSelection">{{ t('skillPicker.cancel') }}</button>
              <button v-if="!readonly" class="btn btn-small btn-primary" @click="confirmSelection">{{ t('skillPicker.confirm') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.skill-picker {
  display: inline-block;
  width: 100%;
}

.skill-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.skill-picker-popup {
  width: min(760px, calc(100vw - 96px));
  height: min(700px, calc(100vh - 96px));
}

.skill-display {
  width: 100%;
  box-sizing: border-box;
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

.skill-display:hover {
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

.skill-list {
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

.skill-option {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 7px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.skill-option:last-child {
  border-bottom: none;
}

.skill-option:hover {
  background: var(--bg-tertiary);
}

.skill-option.readonly {
  cursor: default;
}

.skill-option.selected {
  background: rgba(var(--accent-rgb, 74, 144, 226), 0.15);
}

.skill-option input[type="radio"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.skill-option.readonly input[type="radio"] {
  cursor: default;
}

.skill-id {
  font-size: 14px;
  color: var(--accent-color);
  min-width: 46px;
}

.skill-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-class {
  flex: 0 0 54px;
  font-size: 12px;
  color: var(--text-muted);
  padding: 1px 4px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  text-align: center;
  white-space: nowrap;
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
