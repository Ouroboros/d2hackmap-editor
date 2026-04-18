/**
 * Config definitions for D2HackMap CFG Editor
 * Hardcoded definitions extracted from d2hackmap.default.cfg
 */

// Virtual Key Codes
export const VK_CODES: Record<string, number> = {
  'VK_BACK': 0x08,
  'VK_TAB': 0x09,
  'VK_RETURN': 0x0D,
  'VK_SHIFT': 0x10,
  'VK_CONTROL': 0x11,
  'VK_MENU': 0x12,
  'VK_PAUSE': 0x13,
  'VK_CAPITAL': 0x14,
  'VK_ESCAPE': 0x1B,
  'VK_SPACE': 0x20,
  'VK_PRIOR': 0x21,
  'VK_NEXT': 0x22,
  'VK_END': 0x23,
  'VK_HOME': 0x24,
  'VK_LEFT': 0x25,
  'VK_UP': 0x26,
  'VK_RIGHT': 0x27,
  'VK_DOWN': 0x28,
  'VK_INSERT': 0x2D,
  'VK_DELETE': 0x2E,
  'VK_0': 0x30,
  'VK_1': 0x31,
  'VK_2': 0x32,
  'VK_3': 0x33,
  'VK_4': 0x34,
  'VK_5': 0x35,
  'VK_6': 0x36,
  'VK_7': 0x37,
  'VK_8': 0x38,
  'VK_9': 0x39,
  'VK_A': 0x41,
  'VK_B': 0x42,
  'VK_C': 0x43,
  'VK_D': 0x44,
  'VK_E': 0x45,
  'VK_F': 0x46,
  'VK_G': 0x47,
  'VK_H': 0x48,
  'VK_I': 0x49,
  'VK_J': 0x4A,
  'VK_K': 0x4B,
  'VK_L': 0x4C,
  'VK_M': 0x4D,
  'VK_N': 0x4E,
  'VK_O': 0x4F,
  'VK_P': 0x50,
  'VK_Q': 0x51,
  'VK_R': 0x52,
  'VK_S': 0x53,
  'VK_T': 0x54,
  'VK_U': 0x55,
  'VK_V': 0x56,
  'VK_W': 0x57,
  'VK_X': 0x58,
  'VK_Y': 0x59,
  'VK_Z': 0x5A,
  'VK_NUMPAD0': 0x60,
  'VK_NUMPAD1': 0x61,
  'VK_NUMPAD2': 0x62,
  'VK_NUMPAD3': 0x63,
  'VK_NUMPAD4': 0x64,
  'VK_NUMPAD5': 0x65,
  'VK_NUMPAD6': 0x66,
  'VK_NUMPAD7': 0x67,
  'VK_NUMPAD8': 0x68,
  'VK_NUMPAD9': 0x69,
  'VK_MULTIPLY': 0x6A,
  'VK_ADD': 0x6B,
  'VK_SEPARATOR': 0x6C,
  'VK_SUBTRACT': 0x6D,
  'VK_DECIMAL': 0x6E,
  'VK_DIVIDE': 0x6F,
  'VK_F1': 0x70,
  'VK_F2': 0x71,
  'VK_F3': 0x72,
  'VK_F4': 0x73,
  'VK_F5': 0x74,
  'VK_F6': 0x75,
  'VK_F7': 0x76,
  'VK_F8': 0x77,
  'VK_F9': 0x78,
  'VK_F10': 0x79,
  'VK_F11': 0x7A,
  'VK_F12': 0x7B,
  'VK_NUMLOCK': 0x90,
  'VK_SCROLL': 0x91,
  'VK_OEM_1': 0xBA,
  'VK_OEM_PLUS': 0xBB,
  'VK_OEM_COMMA': 0xBC,
  'VK_OEM_MINUS': 0xBD,
  'VK_OEM_PERIOD': 0xBE,
  'VK_OEM_2': 0xBF,
  'VK_OEM_3': 0xC0,
  'VK_OEM_4': 0xDB,
  'VK_OEM_5': 0xDC,
  'VK_OEM_6': 0xDD,
  'VK_OEM_7': 0xDE,
}

// Quality option type
export interface QualityOption {
  value: string
  labelKey: string
}

// Quality types - labelKey is i18n key
export const QUALITIES: QualityOption[] = [
  { value: '1', labelKey: 'quality.1' },
  { value: '2', labelKey: 'quality.2' },
  { value: '3', labelKey: 'quality.3' },
  { value: '4', labelKey: 'quality.4' },
  { value: '5', labelKey: 'quality.5' },
  { value: '6', labelKey: 'quality.6' },
  { value: '7', labelKey: 'quality.7' },
  { value: '8', labelKey: 'quality.8' },
]

// Color constants
export const COLOR_NONE = '-1'  // No color / default / unset
export const COLOR_HIDDEN = '-2'  // Hidden (text color only)

// Text color type
export interface TextColor {
  id: number
  code?: string
  nameKey: string
  rgb: string | null
}

// Text colors (ÿc? format) - name is i18n key
export const TEXT_COLORS: TextColor[] = [
  { id: -2, nameKey: 'color.-2', rgb: null },
  { id: -1, nameKey: 'color.-1', rgb: '#FFFFFF' },
  { id: 0, code: '0', nameKey: 'color.0', rgb: '#FFFFFF' },
  { id: 1, code: '1', nameKey: 'color.1', rgb: '#FF0000' },
  { id: 2, code: '2', nameKey: 'color.2', rgb: '#00FF00' },
  { id: 3, code: '3', nameKey: 'color.3', rgb: '#6969FF' },
  { id: 4, code: '4', nameKey: 'color.4', rgb: '#C7B377' },
  { id: 5, code: '5', nameKey: 'color.5', rgb: '#808080' },
  { id: 6, code: '6', nameKey: 'color.6', rgb: '#000000' },
  { id: 7, code: '7', nameKey: 'color.7', rgb: '#D4A017' },
  { id: 8, code: '8', nameKey: 'color.8', rgb: '#FF8C00' },
  { id: 9, code: '9', nameKey: 'color.9', rgb: '#FFFF00' },
  { id: 10, code: ':', nameKey: 'color.10', rgb: '#008000' },
  { id: 11, code: ';', nameKey: 'color.11', rgb: '#8B008B' },
  { id: 12, code: '<', nameKey: 'color.12', rgb: '#006400' },
]

// Pickup mode option type
export interface PickupModeOption {
  value: string
  labelKey: string
}

// Pickup modes (from d2hackmap.default.cfg lines 331-339) - labelKey is i18n key
export const PICKUP_MODES: PickupModeOption[] = [
  { value: '0', labelKey: 'import.mode.0' },
  { value: '1', labelKey: 'import.mode.1' },
  { value: '2', labelKey: 'import.mode.2' },
  { value: '3', labelKey: 'import.mode.3' },
  { value: '10', labelKey: 'import.mode.10' },
  { value: '11', labelKey: 'import.mode.11' },
  { value: '12', labelKey: 'import.mode.12' },
  { value: '13', labelKey: 'import.mode.13' },
]

// Relation type option
export interface RelationTypeOption {
  value: string
  labelKey: string
}

// Stat Limit Group relation types - labelKey is i18n key
export const RELATION_TYPES: RelationTypeOption[] = [
  { value: '0', labelKey: 'relation.0' },
  { value: '1', labelKey: 'relation.1' },
  { value: '2', labelKey: 'relation.2' },
  { value: '3', labelKey: 'relation.3' },
]

// Action type option
export interface ActionTypeOption {
  value: string
  labelKey: string
}

// Pre Item Task action types - labelKey is i18n key
export const ACTION_TYPES: ActionTypeOption[] = [
  { value: '1', labelKey: 'action.1' },
  { value: '2', labelKey: 'action.2' },
  { value: '3', labelKey: 'action.3' },
  { value: '7', labelKey: 'action.7' },
]

// Toggle definition type
export interface ToggleDef {
  key: string
  labelKey: string
  category: string
}

// Common toggle definitions (from d2hackmap.default.cfg) - labelKey is i18n key
export const TOGGLE_DEFS: ToggleDef[] = [
  { key: 'Auto Map Toggle', labelKey: 'toggle.autoMap', category: 'display' },
  { key: 'Auto Pickup Toggle', labelKey: 'toggle.autoPickup', category: 'pickup' },
  { key: 'Light Radius Toggle', labelKey: 'toggle.lightRadius', category: 'display' },
  { key: 'Infravision Toggle', labelKey: 'toggle.infravision', category: 'display' },
  { key: 'Weather Toggle', labelKey: 'toggle.weather', category: 'display' },
  { key: 'Quick Cast Toggle', labelKey: 'toggle.quickCast', category: 'gameplay' },
  { key: 'Auto Transmute Toggle', labelKey: 'toggle.autoTransmute', category: 'transmute' },
  { key: 'Auto Transmute Fast Take Item Toggle', labelKey: 'toggle.autoTransmuteFast', category: 'transmute' },
]
