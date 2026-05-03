<script setup lang="ts">
import { useI18n } from '../i18n'

const emit = defineEmits<{
  (e: 'saveUser'): void
  (e: 'saveProfile'): void
  (e: 'saveProfileAs'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="profile-toolbar">
    <button class="btn btn-secondary" @click="emit('saveUser')">{{ t('profile.saveUser') }}</button>
    <button class="btn btn-secondary" @click="emit('saveProfile')">{{ t('profile.saveCurrent') }}</button>
    <button class="btn btn-secondary" @click="emit('saveProfileAs')">{{ t('profile.saveAs') }}</button>
  </div>
</template>

<style scoped>
.profile-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}
</style>
