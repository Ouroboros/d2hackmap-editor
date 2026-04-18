<script setup lang="ts">
import { computed } from 'vue'
import { TEXT_COLORS } from '../configDefs'
import { useI18n } from '../i18n'

const { t } = useI18n()

interface Props {
  textColor?: string | number
  mapColor?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  textColor: '-1',
  mapColor: '-1'
})

// Get RGB for text color
const textColorRgb = computed(() => {
  const id = parseInt(String(props.textColor))
  if (id === -2) return null // Hidden
  if (id === -1) return '#FFFFFF' // Default
  const color = TEXT_COLORS.find(c => c.id === id)
  return color?.rgb || '#FFFFFF'
})

// Get RGB for map color (palette index)
const mapColorRgb = computed(() => {
  const val = props.mapColor
  if (val === '-1' || val === '-2' || val === -1 || val === -2) return null

  // For now, use a simple conversion. Full palette will be loaded from external file.
  // Parse hex like "0x84" or decimal
  let index
  if (typeof val === 'string' && val.startsWith('0x')) {
    index = parseInt(val, 16)
  } else {
    index = parseInt(val)
  }

  if (isNaN(index)) return null

  // Simple placeholder - map some common colors
  const PALETTE_SAMPLES = {
    0x20: '#FFFFFF',
    0x50: '#00FF00',
    0x60: '#808080',
    0x63: '#C7B377',
    0x7a: '#FF0000',
    0x84: '#FF6666',
    0x8f: '#8B008B',
    0x99: '#87CEEB',
    0xcc: '#90EE90'
  }

  return PALETTE_SAMPLES[index] || `hsl(${(index * 137) % 360}, 60%, 50%)`
})

const isHidden = computed(() => parseInt(String(props.textColor)) === -2)
</script>

<template>
  <div class="color-preview">
    <span v-if="isHidden" class="hidden-label">{{ t('colorPreview.hidden') }}</span>
    <span v-else-if="textColorRgb" class="text-sample" :style="{ color: textColorRgb }">
      {{ t('colorPreview.sample') }}
    </span>
    <div
      v-if="mapColorRgb"
      class="map-color-block"
      :style="{ backgroundColor: mapColorRgb }"
    ></div>
  </div>
</template>

<style scoped>
.color-preview {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
}

.hidden-label {
  color: var(--text-muted);
  font-size: 12px;
}

.text-sample {
  font-weight: 600;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
}

.map-color-block {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
}
</style>
