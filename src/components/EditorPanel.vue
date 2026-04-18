<script setup lang="ts">
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <div class="title-group">
        <slot name="tabs"></slot>
        <slot name="batch-bar"></slot>
      </div>
      <div class="header-actions">
        <slot name="actions"></slot>
      </div>
    </div>
    <slot></slot>
  </div>
</template>

<style scoped>
.title-group {
  display: flex;
  align-items: center;
  position: relative;
  min-height: 32px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
