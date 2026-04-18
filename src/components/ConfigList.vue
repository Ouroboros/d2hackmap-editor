<script setup lang="ts">
import { provide, toRef, watch } from 'vue'
import { useConfigList, type ConfigListState, type UseConfigListOptions } from '../composables/useConfigList'
import type { BaseConfigItem } from '../types'

const props = defineProps<{
  items: BaseConfigItem[]
  isReadOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'reorder', fromIndex: number, toIndex: number): void
}>()

const listState = useConfigList({
  items: () => props.items,
  isReadOnly: () => props.isReadOnly ?? false,
  onReorder: (from, to) => emit('reorder', from, to)
})

// Provide state to child components
provide('configListState', listState)

// Expose state for parent access
defineExpose(listState)
</script>

<template>
  <div class="config-list">
    <slot name="header" :state="listState" />
    <slot :state="listState" />
  </div>
</template>

<style scoped>
.config-list {
  max-height: calc(70vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
}
</style>
