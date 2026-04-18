<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'
import { ChainStatus, type ChainNode } from '../composables/useConfigChain'

const { t } = useI18n()

interface Props {
  chainRoot: ChainNode | null
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
})

const emit = defineEmits<{
  'close': []
  'confirm': []
  'selectDir': [node: ChainNode]
  'skipNode': [node: ChainNode]
}>()

interface FlatNode {
  node: ChainNode
  level: number
}

// Flatten tree for display with indentation level
function flattenTree(node: ChainNode, level: number = 0, result: FlatNode[] = []): FlatNode[] {
  result.push({ node, level })
  for (const child of node.children) {
    flattenTree(child, level + 1, result)
  }
  return result
}

const flatNodes = computed((): FlatNode[] => {
  if (props.chainRoot === null) return []
  return flattenTree(props.chainRoot)
})

// Check if there are any pending nodes
const hasPending = computed((): boolean => {
  return flatNodes.value.some(({ node }) => node.status === ChainStatus.PENDING)
})

// Handle directory selection for pending node
function handleSelectDir(node: ChainNode): void {
  emit('selectDir', node)
}

// Handle skip for pending node
function handleSkipNode(node: ChainNode): void {
  emit('skipNode', node)
}

// Confirm and continue loading
function confirmAndContinue(): void {
  emit('confirm')
}

// Cancel and close
function cancel(): void {
  emit('close')
}

interface StatusInfo {
  class: string
  label: string
}

// Get status display info
function getStatusInfo(status: string): StatusInfo {
  switch (status) {
    case ChainStatus.LOADED:
      return { class: 'status-loaded', label: t('configChain.status.loaded') }
    case ChainStatus.PENDING:
      return { class: 'status-pending', label: t('configChain.status.pending') }
    case ChainStatus.SKIPPED:
      return { class: 'status-skipped', label: t('configChain.status.skipped') }
    case ChainStatus.MISSING:
      return { class: 'status-missing', label: t('configChain.status.missing') }
    case ChainStatus.CIRCULAR:
      return { class: 'status-circular', label: t('configChain.status.circular') }
    default:
      return { class: '', label: status }
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="chain-dialog-overlay" @mousedown.self="cancel">
      <div class="chain-dialog">
        <div class="chain-dialog-header">
          <h2>{{ t('configChain.title') }}</h2>
          <span class="chain-dialog-hint">{{ t('configChain.hint') }}</span>
        </div>

        <div class="chain-list">
          <div
            v-for="({ node, level }, index) in flatNodes"
            :key="index"
            class="chain-node"
            :class="[getStatusInfo(node.status).class]"
            :style="{ paddingLeft: `${level * 24 + 12}px` }"
          >
            <!-- Tree connector -->
            <span class="tree-icon">{{ level > 0 ? '└─' : '' }}</span>

            <!-- File name -->
            <span class="node-file">{{ node.file }}</span>

            <!-- Status tag -->
            <span class="node-status" :class="getStatusInfo(node.status).class">
              {{ getStatusInfo(node.status).label }}
            </span>

            <!-- Actions for pending nodes -->
            <template v-if="node.status === ChainStatus.PENDING">
              <button
                class="btn btn-small btn-primary"
                @click.stop="handleSelectDir(node)"
              >
                {{ t('configChain.selectDir') }}
              </button>
              <button
                class="btn btn-small btn-secondary"
                @click.stop="handleSkipNode(node)"
              >
                {{ t('configChain.skip') }}
              </button>
            </template>
          </div>
        </div>

        <div class="chain-dialog-footer">
          <div class="footer-actions">
            <button class="btn btn-secondary" @click="cancel">
              {{ t('configChain.cancel') }}
            </button>
            <button
              class="btn btn-primary"
              @click="confirmAndContinue"
            >
              {{ t('configChain.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.chain-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.chain-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.chain-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.chain-dialog-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.chain-dialog-hint {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.chain-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.chain-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: default;
}

.tree-icon {
  font-family: monospace;
  color: var(--text-muted);
  width: 24px;
  flex-shrink: 0;
}

.node-file {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.status-loaded {
  background: var(--success-color);
  color: white;
}

.status-pending {
  background: var(--warning-color);
  color: white;
}

.status-skipped {
  background: var(--text-muted);
  color: white;
}

.status-missing {
  background: var(--danger-color);
  color: white;
}

.status-circular {
  background: var(--warning-color);
  color: white;
}

.chain-node.status-skipped .node-file,
.chain-node.status-missing .node-file {
  opacity: 0.5;
  text-decoration: line-through;
}

.chain-dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.footer-actions {
  display: flex;
  gap: 8px;
}
</style>
