<script setup lang="ts">
defineProps<{
  showCheckbox?: boolean
  showIndex?: boolean
  showDrag?: boolean
  isAllSelected?: boolean
  isReadOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'selectAll'): void
}>()
</script>

<template>
  <div class="config-header">
    <input
      v-if="showCheckbox && !isReadOnly"
      type="checkbox"
      :checked="isAllSelected"
      @change="emit('selectAll')"
      class="row-checkbox"
    />
    <span v-else-if="showCheckbox" class="row-checkbox-placeholder" />

    <span v-if="showIndex" class="col-index">#</span>
    <span v-if="showDrag" class="col-drag" />

    <slot />
  </div>
</template>
