<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div class="help-guide">
    <h2 class="help-title">{{ t('help.title') }}</h2>

    <!-- Getting Started -->
    <section class="help-section">
      <h3>{{ t('help.gettingStarted') }}</h3>
      <p>{{ t('help.gettingStartedContent') }}</p>
    </section>

    <!-- Config Chain -->
    <section class="help-section">
      <h3>{{ t('help.configChain') }}</h3>
      <p>{{ t('help.configChainContent') }}</p>
    </section>

    <!-- Item Types -->
    <section class="help-section">
      <h3>{{ t('help.itemTypes') }}</h3>
      <div class="help-list">
        <div class="help-item">
          <span class="help-item-label">{{ t('help.mainItem') }}</span>
          <span class="help-item-desc">{{ t('help.mainItemDesc') }}</span>
        </div>
        <div class="help-item">
          <span class="help-item-label item-extern">{{ t('help.externItem') }}</span>
          <span class="help-item-desc">{{ t('help.externItemDesc') }}</span>
        </div>
        <div class="help-item">
          <span class="help-item-label item-commented">{{ t('help.commentedItem') }}</span>
          <span class="help-item-desc">{{ t('help.commentedItemDesc') }}</span>
        </div>
        <div class="help-item">
          <span class="help-item-label item-deleted">{{ t('help.deletedItem') }}</span>
          <span class="help-item-desc">{{ t('help.deletedItemDesc') }}</span>
        </div>
      </div>
    </section>

    <!-- Actions -->
    <section class="help-section">
      <h3>{{ t('help.actions') }}</h3>
      <ul class="help-action-list">
        <li>{{ t('help.actionAdd') }}</li>
        <li>{{ t('help.actionCopy') }}</li>
        <li>{{ t('help.actionComment') }}</li>
        <li>{{ t('help.actionDelete') }}</li>
        <li>{{ t('help.actionRestore') }}</li>
        <li>{{ t('help.actionCopyToMain') }}</li>
        <li>{{ t('help.actionJumpToMain') }}</li>
      </ul>
    </section>

    <!-- Batch Operations -->
    <section class="help-section">
      <h3>{{ t('help.batchOps') }}</h3>
      <p>{{ t('help.batchOpsContent') }}</p>
      <p>{{ t('help.copyAllExtern') }}</p>
    </section>

    <!-- Drag and Drop -->
    <section class="help-section">
      <h3>{{ t('help.dragDrop') }}</h3>
      <p>{{ t('help.dragDropContent') }}</p>
    </section>

    <!-- Color Config -->
    <section class="help-section">
      <h3>{{ t('help.colorConfig') }}</h3>
      <p>{{ t('help.colorConfigContent') }}</p>
    </section>

    <!-- Filters -->
    <section class="help-section">
      <h3>{{ t('help.filters') }}</h3>
      <p>{{ t('help.filtersContent') }}</p>
    </section>

    <!-- Validation -->
    <section class="help-section">
      <h3>{{ t('help.validation') }}</h3>
      <p>{{ t('help.validationContent') }}</p>
    </section>

    <!-- Tips -->
    <section class="help-section">
      <h3>{{ t('help.tips') }}</h3>
      <ul class="help-tips-list">
        <li>{{ t('help.tip1') }}</li>
        <li>{{ t('help.tip2') }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.help-guide {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  line-height: 1.6;
}

.help-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--text-primary);
  border-bottom: 2px solid var(--accent-color);
  padding-bottom: 12px;
}

.help-section {
  margin-bottom: 28px;
}

.help-section h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  padding-left: 12px;
  border-left: 3px solid var(--accent-color);
}

.help-section p {
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.help-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.help-item-label {
  flex-shrink: 0;
  min-width: 100px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--bg-primary);
}

.help-item-label.item-extern {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.help-item-label.item-commented {
  opacity: 0.6;
  background: var(--bg-tertiary);
}

.help-item-label.item-deleted {
  opacity: 0.5;
  text-decoration: line-through;
  background: var(--bg-tertiary);
}

.help-item-desc {
  color: var(--text-secondary);
  flex: 1;
}

.help-action-list,
.help-tips-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.help-action-list li,
.help-tips-list li {
  padding: 8px 12px;
  color: var(--text-secondary);
  border-left: 2px solid var(--border-color);
  margin-bottom: 4px;
}

.help-action-list li:hover,
.help-tips-list li:hover {
  border-left-color: var(--accent-color);
  background: var(--bg-secondary);
}
</style>
