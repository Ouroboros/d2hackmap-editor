<script setup lang="ts" generic="T extends BaseConfigItem">
import type { BaseConfigItem } from '../../types'

const props = defineProps<{
  items: T[]
  title: string
  getKey: (item: T) => string
  formatItem: (item: T) => string
}>()

function getSourceLabel(item: BaseConfigItem): string {
  if (item.sourceFile === null) {
    return '[main]'
  }
  return `[extern:${item.sourceFile}]`
}

function getStatusLabel(item: BaseConfigItem): string {
  const labels: string[] = []
  if (item.isCommented) labels.push('commented')
  if (item.isDeleted) labels.push('deleted')
  if (item.isEffective) labels.push('effective')
  return labels.length > 0 ? `(${labels.join(', ')})` : ''
}
</script>

<template>
  <div class="flat-list-view">
    <div class="flat-list-title">{{ title }} ({{ items.length }} items)</div>
    <div v-if="items.length === 0" class="flat-list-empty">
      No items
    </div>
    <div v-else class="flat-list-items">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="item"
        :class="{ effective: item.isEffective, disabled: item.isCommented || item.isDeleted }"
      >
        <span class="item-index">#{{ index }}</span>
        <span class="item-key">{{ getKey(item) }}</span>
        <span class="item-source">{{ getSourceLabel(item) }}</span>
        <span class="item-status">{{ getStatusLabel(item) }}</span>
        <span class="item-content">{{ formatItem(item) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flat-list-view {
  margin-bottom: 16px;
}

.flat-list-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--accent-color);
}

.flat-list-empty {
  color: var(--text-muted);
  font-style: italic;
}

.flat-list-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 8px;
  font-size: 11px;
  border-left: 2px solid transparent;
}

.item.disabled {
  opacity: 0.5;
}

.item.effective {
  border-left-color: var(--success-color);
  background: rgba(var(--success-color-rgb, 56, 142, 60), 0.1);
}

.item-index {
  color: var(--text-muted);
  min-width: 30px;
}

.item-key {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 80px;
}

.item-source {
  color: var(--accent-color);
  min-width: 120px;
}

.item-status {
  color: var(--warning-color);
  min-width: 80px;
}

.item-content {
  color: var(--text-secondary);
  flex: 1;
}
</style>
