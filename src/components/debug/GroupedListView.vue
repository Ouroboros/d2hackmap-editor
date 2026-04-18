<script setup lang="ts" generic="T extends BaseConfigItem">
import type { BaseConfigItem } from '../../types'
import type { ItemGroup } from '../../composables/useGroupedItems'
import { getEffective } from '../../composables/useGroupedItems'

const props = defineProps<{
  groups: ItemGroup<T>[]
  title: string
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
  if (item.isCommented) labels.push('(commented)')
  if (item.isDeleted) labels.push('(deleted)')
  return labels.join(' ')
}

function isEffective(group: ItemGroup<T>, item: T): boolean {
  return getEffective(group) === item
}
</script>

<template>
  <div class="grouped-list-view">
    <div class="grouped-list-title">{{ title }}</div>
    <div v-if="groups.length === 0" class="grouped-list-empty">
      No groups
    </div>
    <div v-else class="grouped-list-groups">
      <div v-for="(group, groupIndex) in groups" :key="group.key" class="group">
        <div class="group-header">
          <span class="group-index">#{{ groupIndex }}</span>
          <span class="group-key">{{ group.key }}</span>
          <span class="group-count">({{ group.items.length }} items)</span>
        </div>
        <div class="group-items">
          <div
            v-for="(item, itemIndex) in group.items"
            :key="itemIndex"
            class="item"
            :class="{ effective: isEffective(group, item), disabled: item.isCommented || item.isDeleted }"
          >
            <span class="item-marker">{{ isEffective(group, item) ? '*' : ' ' }}</span>
            <span class="item-source">{{ getSourceLabel(item) }}</span>
            <span class="item-status">{{ getStatusLabel(item) }}</span>
            <span class="item-content">{{ formatItem(item) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grouped-list-view {
  margin-bottom: 16px;
}

.grouped-list-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--accent-color);
}

.grouped-list-empty {
  color: var(--text-muted);
  font-style: italic;
}

.grouped-list-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  font-size: 11px;
}

.group-index {
  color: var(--text-muted);
}

.group-key {
  font-weight: 600;
  color: var(--text-primary);
}

.group-count {
  color: var(--text-muted);
}

.group-items {
  padding: 4px 0;
}

.item {
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
}

.item.disabled {
  opacity: 0.5;
}

.item.effective {
  background: rgba(var(--success-color-rgb, 56, 142, 60), 0.1);
}

.item-marker {
  width: 12px;
  color: var(--success-color);
  font-weight: bold;
}

.item-source {
  color: var(--accent-color);
  min-width: 80px;
}

.item-status {
  color: var(--warning-color);
  min-width: 80px;
}

.item-content {
  color: var(--text-primary);
  flex: 1;
}
</style>
