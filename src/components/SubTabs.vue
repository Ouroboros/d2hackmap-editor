<script setup lang="ts">
export interface SubTab {
  id: string
  label: string
}

const props = defineProps<{
  tabs: SubTab[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function selectTab(tabId: string) {
  emit('update:modelValue', tabId)
}
</script>

<template>
  <div class="sub-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="sub-tab"
      :class="{ active: modelValue === tab.id }"
      @click="selectTab(tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
