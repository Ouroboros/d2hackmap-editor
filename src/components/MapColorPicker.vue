<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../i18n'
import { COLOR_NONE } from '../configDefs'

const { t } = useI18n()

interface Props {
  modelValue?: string
  disabled?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: COLOR_NONE,
  disabled: false,
  readonly: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref<boolean>(false)

// D2 Map Color Palette - units.pal (0x00 - 0xE0, 225 colors)
// 16 columns x 15 rows (last row partial)
const palette = [
  // Row 0 (0x00-0x0F)
  { index: 0x00, hex: '#000000' }, { index: 0x01, hex: '#240000' }, { index: 0x02, hex: '#1C1808' }, { index: 0x03, hex: '#2C2410' },
  { index: 0x04, hex: '#3C3418' }, { index: 0x05, hex: '#5C0000' }, { index: 0x06, hex: '#484020' }, { index: 0x07, hex: '#544828' },
  { index: 0x08, hex: '#900000' }, { index: 0x09, hex: '#8C4810' }, { index: 0x0A, hex: '#BC0000' }, { index: 0x0B, hex: '#D08420' },
  { index: 0x0C, hex: '#F4C46C' }, { index: 0x0D, hex: '#8C7C50' }, { index: 0x0E, hex: '#AC9C64' }, { index: 0x0F, hex: '#0C0C08' },
  // Row 1 (0x10-0x1F)
  { index: 0x10, hex: '#141010' }, { index: 0x11, hex: '#1C1C1C' }, { index: 0x12, hex: '#28241C' }, { index: 0x13, hex: '#2C2C2C' },
  { index: 0x14, hex: '#3C3830' }, { index: 0x15, hex: '#383838' }, { index: 0x16, hex: '#484848' }, { index: 0x17, hex: '#585048' },
  { index: 0x18, hex: '#645834' }, { index: 0x19, hex: '#585858' }, { index: 0x1A, hex: '#74643C' }, { index: 0x1B, hex: '#646464' },
  { index: 0x1C, hex: '#7C7470' }, { index: 0x1D, hex: '#848484' }, { index: 0x1E, hex: '#9C9894' }, { index: 0x1F, hex: '#C4C4C4' },
  // Row 2 (0x20-0x2F)
  { index: 0x20, hex: '#F4F4F4' }, { index: 0x21, hex: '#080404' }, { index: 0x22, hex: '#100400' }, { index: 0x23, hex: '#180804' },
  { index: 0x24, hex: '#181008' }, { index: 0x25, hex: '#1C1410' }, { index: 0x26, hex: '#240C04' }, { index: 0x27, hex: '#20180C' },
  { index: 0x28, hex: '#201814' }, { index: 0x29, hex: '#2C1008' }, { index: 0x2A, hex: '#241C10' }, { index: 0x2B, hex: '#28200C' },
  { index: 0x2C, hex: '#380804' }, { index: 0x2D, hex: '#301C10' }, { index: 0x2E, hex: '#302814' }, { index: 0x2F, hex: '#40140C' },
  // Row 3 (0x30-0x3F)
  { index: 0x30, hex: '#382810' }, { index: 0x31, hex: '#480C04' }, { index: 0x32, hex: '#38281C' }, { index: 0x33, hex: '#4C200C' },
  { index: 0x34, hex: '#442C14' }, { index: 0x35, hex: '#402C20' }, { index: 0x36, hex: '#581008' }, { index: 0x37, hex: '#483420' },
  { index: 0x38, hex: '#443428' }, { index: 0x39, hex: '#54281C' }, { index: 0x3A, hex: '#5C1C14' }, { index: 0x3B, hex: '#5C2408' },
  { index: 0x3C, hex: '#543818' }, { index: 0x3D, hex: '#543824' }, { index: 0x3E, hex: '#6C1810' }, { index: 0x3F, hex: '#682C10' },
  // Row 4 (0x40-0x4F)
  { index: 0x40, hex: '#5C4424' }, { index: 0x41, hex: '#702418' }, { index: 0x42, hex: '#683C24' }, { index: 0x43, hex: '#7C2C0C' },
  { index: 0x44, hex: '#644C2C' }, { index: 0x45, hex: '#704808' }, { index: 0x46, hex: '#802818' }, { index: 0x47, hex: '#745028' },
  { index: 0x48, hex: '#883024' }, { index: 0x49, hex: '#6C5040' }, { index: 0x4A, hex: '#8C340C' }, { index: 0x4B, hex: '#702068' },
  { index: 0x4C, hex: '#785844' }, { index: 0x4D, hex: '#8C4040' }, { index: 0x4E, hex: '#845C30' }, { index: 0x4F, hex: '#9C3424' },
  // Row 5 (0x50-0x5F)
  { index: 0x50, hex: '#A42818' }, { index: 0x51, hex: '#A44814' }, { index: 0x52, hex: '#8C6440' }, { index: 0x53, hex: '#8C7038' },
  { index: 0x54, hex: '#8C6850' }, { index: 0x55, hex: '#B04434' }, { index: 0x56, hex: '#B44C20' }, { index: 0x57, hex: '#987058' },
  { index: 0x58, hex: '#A07840' }, { index: 0x59, hex: '#BC601C' }, { index: 0x5A, hex: '#9C8448' }, { index: 0x5B, hex: '#C45454' },
  { index: 0x5C, hex: '#C86C20' }, { index: 0x5D, hex: '#AC7C58' }, { index: 0x5E, hex: '#B08848' }, { index: 0x5F, hex: '#C87C54' },
  // Row 6 (0x60-0x6F)
  { index: 0x60, hex: '#E07020' }, { index: 0x61, hex: '#B89C54' }, { index: 0x62, hex: '#FC2C00' }, { index: 0x63, hex: '#C08C70' },
  { index: 0x64, hex: '#CC9850' }, { index: 0x65, hex: '#E48430' }, { index: 0x66, hex: '#E07070' }, { index: 0x67, hex: '#D09878' },
  { index: 0x68, hex: '#F8883C' }, { index: 0x69, hex: '#ECA038' }, { index: 0x6A, hex: '#D8B864' }, { index: 0x6B, hex: '#E0A484' },
  { index: 0x6C, hex: '#F0B444' }, { index: 0x6D, hex: '#F4C04C' }, { index: 0x6E, hex: '#F0B08C' }, { index: 0x6F, hex: '#FCD45C' },
  // Row 7 (0x70-0x7F)
  { index: 0x70, hex: '#FCB0B0' }, { index: 0x71, hex: '#042410' }, { index: 0x72, hex: '#142418' }, { index: 0x73, hex: '#203C18' },
  { index: 0x74, hex: '#18480C' }, { index: 0x75, hex: '#004430' }, { index: 0x76, hex: '#186408' }, { index: 0x77, hex: '#245C24' },
  { index: 0x78, hex: '#385C24' }, { index: 0x79, hex: '#086C44' }, { index: 0x7A, hex: '#287C14' }, { index: 0x7B, hex: '#407434' },
  { index: 0x7C, hex: '#587830' }, { index: 0x7D, hex: '#349C1C' }, { index: 0x7E, hex: '#708438' }, { index: 0x7F, hex: '#48A034' },
  // Row 8 (0x80-0x8F)
  { index: 0x80, hex: '#58904C' }, { index: 0x81, hex: '#44BC28' }, { index: 0x82, hex: '#849848' }, { index: 0x83, hex: '#60B84C' },
  { index: 0x84, hex: '#18FC00' }, { index: 0x85, hex: '#74DC5C' }, { index: 0x86, hex: '#8CD07C' }, { index: 0x87, hex: '#A0FC88' },
  { index: 0x88, hex: '#0C0C28' }, { index: 0x89, hex: '#181848' }, { index: 0x8A, hex: '#000058' }, { index: 0x8B, hex: '#381444' },
  { index: 0x8C, hex: '#102468' }, { index: 0x8D, hex: '#283C64' }, { index: 0x8E, hex: '#282878' }, { index: 0x8F, hex: '#4C1080' },
  // Row 9 (0x90-0x9F)
  { index: 0x90, hex: '#384C84' }, { index: 0x91, hex: '#303094' }, { index: 0x92, hex: '#48608C' }, { index: 0x93, hex: '#385CA0' },
  { index: 0x94, hex: '#5050AC' }, { index: 0x95, hex: '#4C6CAC' }, { index: 0x96, hex: '#5478BC' }, { index: 0x97, hex: '#2460D8' },
  { index: 0x98, hex: '#6478D0' }, { index: 0x99, hex: '#6490E0' }, { index: 0x9A, hex: '#80A0DC' }, { index: 0x9B, hex: '#A420FC' },
  { index: 0x9C, hex: '#8484F0' }, { index: 0x9D, hex: '#A0A0FC' }, { index: 0x9E, hex: '#90B8FC' }, { index: 0x9F, hex: '#588C90' },
  // Row 10 (0xA0-0xAF)
  { index: 0xA0, hex: '#68A0A4' }, { index: 0xA1, hex: '#84C0C4' }, { index: 0xA2, hex: '#98D0D4' }, { index: 0xA3, hex: '#A8CCFC' },
  { index: 0xA4, hex: '#CCF4F4' }, { index: 0xA5, hex: '#C0A080' }, { index: 0xA6, hex: '#C4C0A8' }, { index: 0xA7, hex: '#E0C494' },
  { index: 0xA8, hex: '#FCE874' }, { index: 0xA9, hex: '#C4FCB0' }, { index: 0xAA, hex: '#FCE4A4' }, { index: 0xAB, hex: '#FCFCC4' },
  { index: 0xAC, hex: '#040404' }, { index: 0xAD, hex: '#080808' }, { index: 0xAE, hex: '#0C0C0C' }, { index: 0xAF, hex: '#101010' },
  // Row 11 (0xB0-0xBF)
  { index: 0xB0, hex: '#141414' }, { index: 0xB1, hex: '#181818' }, { index: 0xB2, hex: '#241C18' }, { index: 0xB3, hex: '#202020' },
  { index: 0xB4, hex: '#242424' }, { index: 0xB5, hex: '#282828' }, { index: 0xB6, hex: '#302820' }, { index: 0xB7, hex: '#303030' },
  { index: 0xB8, hex: '#383028' }, { index: 0xB9, hex: '#343434' }, { index: 0xBA, hex: '#34383C' }, { index: 0xBB, hex: '#443834' },
  { index: 0xBC, hex: '#3C3C3C' }, { index: 0xBD, hex: '#4C3C30' }, { index: 0xBE, hex: '#404040' }, { index: 0xBF, hex: '#44403C' },
  // Row 12 (0xC0-0xCF)
  { index: 0xC0, hex: '#444444' }, { index: 0xC1, hex: '#50483C' }, { index: 0xC2, hex: '#584438' }, { index: 0xC3, hex: '#4C4C4C' },
  { index: 0xC4, hex: '#604C3C' }, { index: 0xC5, hex: '#34585C' }, { index: 0xC6, hex: '#505050' }, { index: 0xC7, hex: '#545454' },
  { index: 0xC8, hex: '#5C5C5C' }, { index: 0xC9, hex: '#685C50' }, { index: 0xCA, hex: '#606060' }, { index: 0xCB, hex: '#447074' },
  { index: 0xCC, hex: '#7C6450' }, { index: 0xCD, hex: '#686868' }, { index: 0xCE, hex: '#6C6C6C' }, { index: 0xCF, hex: '#786C60' },
  // Row 13 (0xD0-0xDF)
  { index: 0xD0, hex: '#707070' }, { index: 0xD1, hex: '#747474' }, { index: 0xD2, hex: '#7C7C7C' }, { index: 0xD3, hex: '#948064' },
  { index: 0xD4, hex: '#908474' }, { index: 0xD5, hex: '#AC8870' }, { index: 0xD6, hex: '#909090' }, { index: 0xD7, hex: '#9C9484' },
  { index: 0xD8, hex: '#8094B8' }, { index: 0xD9, hex: '#A0A0A0' }, { index: 0xDA, hex: '#B0AC98' }, { index: 0xDB, hex: '#ACACAC' },
  { index: 0xDC, hex: '#B8B8B8' }, { index: 0xDD, hex: '#CCCCCC' }, { index: 0xDE, hex: '#D8D8D8' }, { index: 0xDF, hex: '#CCCCFC' },
  // Row 14 (0xE0 only, rest are black/unused)
  { index: 0xE0, hex: '#E4E4E4' },
]

const currentColor = computed(() => {
  const val = props.modelValue
  // Parse both decimal and hex formats (0x00, 0X00)
  let index
  if (typeof val === 'string' && val.toLowerCase().startsWith('0x')) {
    index = parseInt(val, 16)
  } else {
    index = parseInt(val)
  }
  if (index < 0 || index >= palette.length || isNaN(index)) {
    return null
  }
  return palette[index]
})

const displayColor = computed(() => {
  return currentColor.value?.hex || '#888888'
})

interface PaletteColor {
  index: number
  hex: string
}

function selectColor(color: PaletteColor): void {
  if (props.readonly) return
  // Output as hex format: 0x00, 0x10, etc.
  const hex = '0x' + color.index.toString(16).toUpperCase().padStart(2, '0')
  emit('update:modelValue', hex)
  showPicker.value = false
}

function clearColor(): void {
  if (props.readonly) return
  emit('update:modelValue', COLOR_NONE)
  showPicker.value = false
}

function togglePicker(): void {
  if (!props.disabled) {
    showPicker.value = !showPicker.value
  }
}

function closePicker(e: MouseEvent): void {
  // Close when clicking outside
  if (!(e.target as HTMLElement).closest('.map-color-picker')) {
    showPicker.value = false
  }
}

// Handle ESC key to close picker
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && showPicker.value) {
    showPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Check if a color is selected (handle both decimal and hex formats)
function isColorSelected(colorIndex: number): boolean {
  const val = props.modelValue
  if (!val || val === COLOR_NONE) return false

  let selectedIndex: number
  if (typeof val === 'string' && val.toLowerCase().startsWith('0x')) {
    selectedIndex = parseInt(val, 16)
  } else {
    selectedIndex = parseInt(val)
  }
  return selectedIndex === colorIndex
}
</script>

<template>
  <div class="map-color-picker" :class="{ disabled }">
    <div
      class="color-display"
      :style="{ backgroundColor: displayColor }"
      :class="{ 'no-color': !currentColor }"
      @click="togglePicker"
      :title="currentColor ? t('mapColor.title', { value: modelValue, index: currentColor.index }) : t('mapColor.none')"
    >
      <span v-if="!currentColor" class="no-color-text">-</span>
    </div>

    <Teleport to="body">
      <div v-if="showPicker" class="picker-overlay" @click="closePicker">
        <div class="picker-popup" @click.stop>
          <div class="picker-header">
            <span>{{ t('mapColor.selectTitle') }}</span>
            <span v-if="readonly" class="readonly-badge">{{ t('status.readOnly') }}</span>
            <button v-if="!readonly" class="btn btn-small btn-secondary" @click="clearColor">{{ t('mapColor.clear') }}</button>
          </div>
          <div class="palette-grid">
            <div
              v-for="color in palette"
              :key="color.index"
              class="palette-cell"
              :style="{ backgroundColor: color.hex }"
              :class="{ selected: isColorSelected(color.index), readonly }"
              :title="`${color.index}: ${color.hex}`"
              @click="selectColor(color)"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.map-color-picker {
  display: inline-block;
}

.map-color-picker.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.color-display {
  width: 32px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-display:hover {
  border-color: var(--accent-color);
}

.color-display.no-color {
  background: repeating-linear-gradient(
    45deg,
    var(--bg-tertiary),
    var(--bg-tertiary) 4px,
    var(--bg-secondary) 4px,
    var(--bg-secondary) 8px
  ) !important;
}

.no-color-text {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: bold;
}

.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.picker-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: auto;
  height: auto;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
  position: relative !important;
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(16, 24px);
  gap: 2px;
}

.palette-cell {
  width: 24px;
  height: 24px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 2px;
}

.palette-cell:hover {
  border-color: white;
  transform: scale(1.2);
  z-index: 1;
  position: relative;
}

.palette-cell.readonly {
  cursor: default;
}

.palette-cell.readonly:hover {
  transform: none;
}

.palette-cell.selected {
  border: 2px solid white;
  box-shadow: 0 0 0 1px var(--accent-color);
}

.readonly-badge {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
  position: absolute !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
}
</style>
