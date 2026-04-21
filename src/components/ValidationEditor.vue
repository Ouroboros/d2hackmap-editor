<script setup lang="ts">
import { useValidation } from '../composables/useValidation'
import { useI18n } from '../i18n'
import EditorPanel from './EditorPanel.vue'

const { t } = useI18n()
const { transmuteValidation, validationSummary, refreshValidation } = useValidation()
</script>

<template>
  <div class="validation-editor">
    <EditorPanel>
      <template #tabs>
        <div class="validation-summary">
          <span v-if="validationSummary.errorCount > 0" class="text-danger">
            {{ validationSummary.errorCount }} {{ t('validation.error') }}
          </span>
          <span v-if="validationSummary.warningCount > 0" class="text-warning">
            {{ validationSummary.warningCount }} {{ t('validation.warning') }}
          </span>
          <span v-if="validationSummary.total === 0" class="text-success">
            {{ t('validation.valid') }}
          </span>
        </div>
      </template>
      <template #actions>
        <button class="btn btn-secondary btn-small" @click="refreshValidation" :title="t('validation.refresh')">
          {{ t('validation.refresh') }}
        </button>
      </template>

      <div v-if="transmuteValidation.errors.length === 0" class="empty-state">
        <p class="text-success">{{ t('validation.noErrors') }}</p>
      </div>
      <div v-else class="validation-list">
        <div
          v-for="(error, index) in transmuteValidation.errors"
          :key="index"
          class="validation-item"
          :class="error.type"
        >
          <span class="validation-type">{{ error.type === 'error' ? t('validation.error') : t('validation.warning') }}</span>
          <span class="validation-section">{{ error.section }}</span>
          <span class="validation-message">{{ error.message }}</span>
        </div>
      </div>
    </EditorPanel>
  </div>
</template>

<style scoped>
.validation-summary {
  display: flex;
  gap: 12px;
}

.validation-list {
  max-height: calc(60vh - var(--debug-drawer-height, 0px));
  overflow-y: auto;
}

.validation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-bottom: 8px;
}

.validation-item.error {
  border-left: 3px solid var(--danger-color);
}

.validation-item.warning {
  border-left: 3px solid var(--warning-color);
}

.validation-type {
  font-weight: 600;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 3px;
}

.validation-item.error .validation-type {
  background: var(--danger-color);
  color: white;
}

.validation-item.warning .validation-type {
  background: var(--warning-color);
  color: white;
}

.validation-section {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 120px;
}

.validation-message {
  flex: 1;
  color: var(--text-primary);
}
</style>
