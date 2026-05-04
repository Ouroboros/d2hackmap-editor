/**
 * Config keyword registry extracted from C++ source files
 * Source: D2Pipes/Src/HackMap/*.h
 *
 * This file is auto-generated from HMConfigItem* declarations
 */

// ========== Type Constants ==========

// Simple types (no indexes)
export const TYPE_TOGGLE = 'toggle' as const
export const TYPE_KEY = 'key' as const
export const TYPE_OPTION = 'option' as const
export const TYPE_INTEGER = 'integer' as const
export const TYPE_STRING = 'string' as const
export const TYPE_COLOR = 'color' as const
export const TYPE_SET = 'set' as const

// Set types (with indexes)
export const SET_ITEM_COLOR = 'itemColor' as const
export const SET_RUNE_COLOR = 'runeColor' as const
export const SET_GOLD_COLOR = 'goldColor' as const
export const SET_IMPORT_ITEM = 'importItem' as const
export const SET_STAT_LIMIT = 'statLimit' as const
export const SET_STAT_LIMIT_GROUP = 'statLimitGroup' as const
export const SET_ITEM_DESCRIPTOR = 'itemDescriptor' as const
export const SET_CUBE_FORMULA = 'cubeFormula' as const
export const SET_PRE_ITEM_TASK = 'preItemTask' as const
export const SET_DO_TASK = 'doTask' as const
export const SET_KEY_BINDING = 'keyBinding' as const
export const SET_MAGIC_BAG_NAME = 'magicBagName' as const
export const SET_IMPORT_CONFIG = 'importConfig' as const
export const SET_MONSTER_COLOR = 'monsterColor' as const
export const SET_SKILL_MISSILE_DRAW_MODE = 'skillMissileDrawMode' as const

// Type definitions
export type SimpleType =
  | typeof TYPE_TOGGLE
  | typeof TYPE_KEY
  | typeof TYPE_OPTION
  | typeof TYPE_INTEGER
  | typeof TYPE_STRING
  | typeof TYPE_COLOR
  | typeof TYPE_SET

export type SetType =
  | typeof SET_ITEM_COLOR
  | typeof SET_RUNE_COLOR
  | typeof SET_GOLD_COLOR
  | typeof SET_IMPORT_ITEM
  | typeof SET_STAT_LIMIT
  | typeof SET_STAT_LIMIT_GROUP
  | typeof SET_ITEM_DESCRIPTOR
  | typeof SET_CUBE_FORMULA
  | typeof SET_PRE_ITEM_TASK
  | typeof SET_DO_TASK
  | typeof SET_KEY_BINDING
  | typeof SET_MAGIC_BAG_NAME
  | typeof SET_IMPORT_CONFIG
  | typeof SET_MONSTER_COLOR
  | typeof SET_SKILL_MISSILE_DRAW_MODE

export const FIELD_BOOL = 'bool' as const
export const FIELD_HOTKEY = 'hotkey' as const
export const FIELD_INT = 'int' as const
export const FIELD_UINT = 'uint' as const
export const FIELD_STRING = 'string' as const
export const FIELD_TEXT_COLOR = 'textColor' as const
export const FIELD_BLOB_COLOR = 'blobColor' as const
export const FIELD_INDEX_RANGE = 'indexRange' as const
export const FIELD_ITEM_ID_RANGE = 'itemIdRange' as const
export const FIELD_QUALITY_RANGE = 'qualityRange' as const
export const FIELD_ETHEREAL_RANGE = 'etherealRange' as const
export const FIELD_SOCKET_RANGE = 'socketRange' as const
export const FIELD_STAT_ID = 'statId' as const
export const FIELD_RELATION = 'relation' as const
export const FIELD_PICKUP_MODE = 'pickupMode' as const
export const FIELD_PICKUP_HINT = 'pickupHint' as const
export const FIELD_PICKUP_UNUSED = 'pickupUnused' as const
export const FIELD_STAT_LIMIT_NAME = 'statLimitName' as const
export const FIELD_ITEM_DESCRIPTOR_NAME = 'itemDescriptorName' as const
export const FIELD_CUBE_FORMULA_NAME = 'cubeFormulaName' as const
export const FIELD_PRE_TASK_NAME = 'preTaskName' as const
export const FIELD_DO_ACTION = 'doAction' as const
export const FIELD_DRAW_MODE = 'drawMode' as const
export const FIELD_MONSTER_TYPE = 'monsterType' as const

export type FieldType =
  | typeof FIELD_BOOL
  | typeof FIELD_HOTKEY
  | typeof FIELD_INT
  | typeof FIELD_UINT
  | typeof FIELD_STRING
  | typeof FIELD_TEXT_COLOR
  | typeof FIELD_BLOB_COLOR
  | typeof FIELD_INDEX_RANGE
  | typeof FIELD_ITEM_ID_RANGE
  | typeof FIELD_QUALITY_RANGE
  | typeof FIELD_ETHEREAL_RANGE
  | typeof FIELD_SOCKET_RANGE
  | typeof FIELD_STAT_ID
  | typeof FIELD_RELATION
  | typeof FIELD_PICKUP_MODE
  | typeof FIELD_PICKUP_HINT
  | typeof FIELD_PICKUP_UNUSED
  | typeof FIELD_STAT_LIMIT_NAME
  | typeof FIELD_ITEM_DESCRIPTOR_NAME
  | typeof FIELD_CUBE_FORMULA_NAME
  | typeof FIELD_PRE_TASK_NAME
  | typeof FIELD_DO_ACTION
  | typeof FIELD_DRAW_MODE
  | typeof FIELD_MONSTER_TYPE

export interface ConfigFieldSchema {
  name: string
  type: FieldType
  optional?: boolean
  repeat?: boolean
}

export interface ConfigItemSchema {
  key: string
  cppClass: string
  indexes: readonly ConfigFieldSchema[]
  values: readonly ConfigFieldSchema[]
}

export interface Keywords {
  toggles: readonly string[]
  keys: readonly string[]
  options: readonly string[]
  integers: readonly string[]
  strings: readonly string[]
  colors: readonly string[]
  sets: Record<string, SetType>
}

const SIMPLE_SCHEMAS: Record<Exclude<SimpleType, typeof TYPE_SET>, Omit<ConfigItemSchema, 'key'>> = {
  [TYPE_TOGGLE]: {
    cppClass: 'HMConfigItemToggle',
    indexes: [],
    values: [
      { name: 'enabled', type: FIELD_BOOL },
      { name: 'hotkey', type: FIELD_HOTKEY },
      { name: 'value', type: FIELD_UINT, optional: true },
    ],
  },
  [TYPE_KEY]: {
    cppClass: 'HMConfigItemKey',
    indexes: [],
    values: [
      { name: 'hotkey', type: FIELD_HOTKEY },
    ],
  },
  [TYPE_OPTION]: {
    cppClass: 'HMConfigItemOption',
    indexes: [],
    values: [
      { name: 'enabled', type: FIELD_BOOL },
    ],
  },
  [TYPE_INTEGER]: {
    cppClass: 'HMConfigItemInt',
    indexes: [],
    values: [
      { name: 'value', type: FIELD_UINT },
    ],
  },
  [TYPE_STRING]: {
    cppClass: 'HMConfigItemString',
    indexes: [],
    values: [
      { name: 'value', type: FIELD_STRING },
    ],
  },
  [TYPE_COLOR]: {
    cppClass: 'HMConfigItemColorT',
    indexes: [],
    values: [
      { name: 'value', type: FIELD_BLOB_COLOR },
    ],
  },
}

const SET_SCHEMAS: Record<SetType, Omit<ConfigItemSchema, 'key'>> = {
  [SET_ITEM_COLOR]: {
    cppClass: 'HMConfigItemItemColorSetT',
    indexes: [
      { name: 'itemId', type: FIELD_ITEM_ID_RANGE },
      { name: 'quality', type: FIELD_QUALITY_RANGE, optional: true },
      { name: 'ethereal', type: FIELD_ETHEREAL_RANGE, optional: true },
      { name: 'sockets', type: FIELD_SOCKET_RANGE, optional: true },
    ],
    values: [
      { name: 'textColor', type: FIELD_TEXT_COLOR },
      { name: 'mapColor', type: FIELD_BLOB_COLOR },
      { name: 'mapText', type: FIELD_STRING, optional: true },
    ],
  },
  [SET_RUNE_COLOR]: {
    cppClass: 'HMConfigItemRuneColorSetT',
    indexes: [
      { name: 'range', type: FIELD_INDEX_RANGE },
    ],
    values: [
      { name: 'textColor', type: FIELD_TEXT_COLOR },
      { name: 'mapColor', type: FIELD_BLOB_COLOR },
      { name: 'mapText', type: FIELD_STRING, optional: true },
    ],
  },
  [SET_GOLD_COLOR]: {
    cppClass: 'HMConfigItemRuneColorSetT',
    indexes: [
      { name: 'range', type: FIELD_INDEX_RANGE },
    ],
    values: [
      { name: 'textColor', type: FIELD_TEXT_COLOR },
      { name: 'mapColor', type: FIELD_BLOB_COLOR },
      { name: 'mapText', type: FIELD_STRING, optional: true },
    ],
  },
  [SET_IMPORT_ITEM]: {
    cppClass: 'HMConfigItemAutoPickupSetT',
    indexes: [
      { name: 'itemId', type: FIELD_ITEM_ID_RANGE },
      { name: 'quality', type: FIELD_QUALITY_RANGE, optional: true },
      { name: 'ethereal', type: FIELD_ETHEREAL_RANGE, optional: true },
      { name: 'sockets', type: FIELD_SOCKET_RANGE, optional: true },
    ],
    values: [
      { name: 'method', type: FIELD_PICKUP_MODE },
      { name: 'hint', type: FIELD_PICKUP_HINT },
      { name: 'unused', type: FIELD_PICKUP_UNUSED, optional: true },
      { name: 'statLimit', type: FIELD_STAT_LIMIT_NAME, optional: true },
    ],
  },
  [SET_STAT_LIMIT]: {
    cppClass: 'HMConfigItemStatLimitSet',
    indexes: [
      { name: 'name', type: FIELD_STAT_LIMIT_NAME },
      { name: 'statId', type: FIELD_STAT_ID },
    ],
    values: [
      { name: 'layer', type: FIELD_INT },
      { name: 'min', type: FIELD_INT },
      { name: 'max', type: FIELD_INT },
    ],
  },
  [SET_STAT_LIMIT_GROUP]: {
    cppClass: 'HMConfigItemStatLimitGroupSet',
    indexes: [
      { name: 'name', type: FIELD_STAT_LIMIT_NAME },
      { name: 'relation', type: FIELD_RELATION, optional: true },
    ],
    values: [
      { name: 'statLimitName', type: FIELD_STAT_LIMIT_NAME },
    ],
  },
  [SET_ITEM_DESCRIPTOR]: {
    cppClass: 'HMConfigItemItemDescriptorSet',
    indexes: [
      { name: 'name', type: FIELD_ITEM_DESCRIPTOR_NAME },
      { name: 'itemId', type: FIELD_ITEM_ID_RANGE },
      { name: 'quality', type: FIELD_QUALITY_RANGE },
    ],
    values: [
      { name: 'statLimitName', type: FIELD_STAT_LIMIT_NAME },
      { name: 'count', type: FIELD_UINT },
    ],
  },
  [SET_CUBE_FORMULA]: {
    cppClass: 'HMConfigItemCubeFormulaSet',
    indexes: [
      { name: 'name', type: FIELD_CUBE_FORMULA_NAME },
    ],
    values: [
      { name: 'itemDescriptorName', type: FIELD_ITEM_DESCRIPTOR_NAME, repeat: true },
    ],
  },
  [SET_PRE_ITEM_TASK]: {
    cppClass: 'HMConfigItemPreItemTaskSetT',
    indexes: [
      { name: 'name', type: FIELD_PRE_TASK_NAME },
      { name: 'itemId', type: FIELD_ITEM_ID_RANGE },
      { name: 'quality', type: FIELD_QUALITY_RANGE },
    ],
    values: [
      { name: 'statLimitName', type: FIELD_STAT_LIMIT_NAME },
      { name: 'action', type: FIELD_DO_ACTION },
    ],
  },
  [SET_DO_TASK]: {
    cppClass: 'HMConfigItemDoTaskSet',
    indexes: [
      { name: 'name', type: FIELD_STRING },
    ],
    values: [
      { name: 'preTaskName', type: FIELD_PRE_TASK_NAME },
      { name: 'cubeFormulaName', type: FIELD_CUBE_FORMULA_NAME, repeat: true },
    ],
  },
  [SET_KEY_BINDING]: {
    cppClass: 'HMConfigItemKeyBinding',
    indexes: [
      { name: 'hotkey', type: FIELD_HOTKEY },
    ],
    values: [
      { name: 'command', type: FIELD_STRING },
    ],
  },
  [SET_MAGIC_BAG_NAME]: {
    cppClass: 'HMConfigItemMagicBagNameSet',
    indexes: [
      { name: 'index', type: FIELD_STRING },
    ],
    values: [
      { name: 'itemId', type: FIELD_INT },
      { name: 'name', type: FIELD_STRING },
    ],
  },
  [SET_IMPORT_CONFIG]: {
    cppClass: 'HMConfigItemOrderedStringSet',
    indexes: [],
    values: [
      { name: 'file', type: FIELD_STRING },
    ],
  },
  [SET_MONSTER_COLOR]: {
    cppClass: 'HMConfigMonsterColorSet',
    indexes: [
      { name: 'monsterId', type: FIELD_INDEX_RANGE },
    ],
    values: [
      { name: 'blobColor', type: FIELD_BLOB_COLOR },
      { name: 'monsterType', type: FIELD_MONSTER_TYPE, optional: true },
    ],
  },
  [SET_SKILL_MISSILE_DRAW_MODE]: {
    cppClass: 'HMConfigSkillMissileDrawModeSet',
    indexes: [
      { name: 'skillId', type: FIELD_INDEX_RANGE },
    ],
    values: [
      { name: 'drawMode', type: FIELD_DRAW_MODE },
    ],
  },
}

// ========== Aliases (for backward compatibility) ==========
// Maps old config key names to canonical names
export const ALIASES: Record<string, string> = {
  'Item Pick Gold Thershold': 'Item Pick Gold Threshold',
  'Auto Party Toggle': 'Auto Join Party Toggle',
  'Out Town Select Toggle': 'Outside Town Selection Toggle',
  'Infravision Toggle': 'WallHack Toggle',
  'Socket Numbers Toggle': 'Socket Count Toggle',
  'Item Levels Toggle': 'Item Level Toggle',
  'Item Indexs Toggle': 'Hackmap Item Index Toggle',
  'Item File Indexs Toggle': 'Item File Index Toggle',
  'Unit Numbers Toggle': 'Unit GUID Toggle',
  'Item Q Level Toggle': 'Item Base Level Toggle',
  'Item M Level Toggle': 'Item Magic Level Toggle',
  'Normal Monster Colour': 'Normal Monster Color',
  'Boss Monster Colour': 'Boss Monster Color',
  'Minion Monster Colour': 'Minion Monster Color',
  'Champion Monster Colour': 'Champion Monster Color',
  'Super Unique Colour': 'Super Unique Color',
  'Monster Desc Colour': 'Monster Desc Color',
  'Hostile Missile Colour': 'Hostile Missile Color',
  'Guided Missile Colour': 'Guided Missile Color',
  'Tracer Missile Colour': 'Tracer Missile Color',
  'Other Missile Colour': 'Other Missile Color',
  'Item Colours': 'Item Colors',
  'Rune Colours': 'Rune Colors',
}

/**
 * Resolve alias to canonical name
 * @param key - Config key name (may be alias)
 * @returns Canonical name if alias, otherwise original key
 */
export function resolveAlias(key: string): string {
  return ALIASES[key] || key
}

export const KEYWORDS: Keywords = {
  // ========== Simple Types (no indexes) ==========

  /**
   * HMConfigItemToggle - on/off with hotkey
   * Format: Key Name: <on|off>, <hotkey>, [value]
   */
  toggles: [
    'Auto Map Toggle',
    'Automap Level Names Toggle',
    'Auto Pick Item Toggle',
    'Import Item Info Toggle',
    'Auto Transmute Toggle',
    'Auto Transmute Fast Take Item Toggle',
    'Ctrl Click Swap Toggle',
    'Right Click Swap Toggle',
    'Auto Invite Toggle',
    'Auto Join Party Toggle',
    'Socket Protect Toggle',
    'Outside Town Selection Toggle',
    'Light Radius Toggle',
    'Perm Show Items Toggle',
    'Perm Show Orbs Toggle',
    'Show Ping Toggle',
    'Game Time Toggle',
    'Clock Toggle',
    'Layer Level No Toggle',
    'Distance to Cursor Toggle',
    'Area Level Toggle',
    'Mouse Position Toggle',
    'Show Exp Toggle',
    'Kill Count Toggle',
    'Automap Missiles Toggle',
    'Automap Corpses Toggle',
    'Hidden Items Toggle',
    'WallHack Toggle',
    'Socket Count Toggle',
    'Item Level Toggle',
    'Item Value Toggle',
    'Hackmap Item Index Toggle',
    'Item Quality Toggle',
    'Unit GUID Toggle',
    'Item Base Level Toggle',
    'Item Magic Level Toggle',
    'Show Base ED Toggle',
    'Item File Index Toggle',
    'Item Size Toggle',
    'Show Immunity Desc',
    'Show Effective Immunity Desc',
    'Smart Immunity Desc',
  ],

  /**
   * HMConfigItemKey - hotkey only
   * Format: Key Name: <hotkey>
   */
  keys: [
    'Auto Transmute Push Key',
    'Auto Transmute Clear Key',
    'Fast Transmute Key',
    'Fast Open Cube Key',
    'Fast Open Charm Cube Key',
    'Fast Drop Key',
    'Quick Back To Town Key',
    'Quick Next Game Key',
    'Quick Exit Next Game Key',
    'Quick Exit Game Key',
    'View Equipment Key',
    'Reload Config Key',
  ],

  /**
   * HMConfigItemOption - simple on/off
   * Format: Key Name: <0|1>
   */
  options: [
    'Auto Reveal Act',
    'Record Auto Pick Item',
  ],

  /**
   * HMConfigItemInt - integer value
   * Format: Key Name: <int>
   */
  integers: [
    'Item Pick Range',
    'Item Pick Gold Threshold',
  ],

  /**
   * HMConfigItemString - string value
   * Format: Key Name: <string>
   */
  strings: [
    'Staff Tomb Level Desc',
    'Default Game Name',
    'Default Game Password',
    'Physical Immunity Desc',
    'Magic Immunity Desc',
    'Fire Immunity Desc',
    'Lightning Immunity Desc',
    'Cold Immunity Desc',
    'Poison Immunity Desc',
    'Magic Resistant Desc',
    'Fire Enchanted Desc',
    'Lightning Enchanted Desc',
    'Cold Enchanted Desc',
    'Mana Burn Desc',
    'Player Blob File',
    'Monster Blob File',
    'Object Blob File',
    'Missile Blob File',
    'Item Blob File',
    'Boss Blob File',
    'Npc Blob File',
    'My Blob File',
    'Corpse Blob File',
  ],

  /**
   * HMConfigItemColor - color value
   * Format: Key Name: <color>
   */
  colors: [
    'Normal Monster Color',
    'Minion Monster Color',
    'Champion Monster Color',
    'Boss Monster Color',
    'Super Unique Color',
    'Monster Desc Color',
    'Hostile Missile Color',
    'Guided Missile Color',
    'Tracer Missile Color',
    'Other Missile Color',
  ],

  // ========== Set Types (with indexes) ==========

  /**
   * Set types map keyword to parser type
   */
  sets: {
    // HMConfigItemItemColorSet
    // Format: Item Colors[id][quality][eth][sockets]: textColor, blobColor, [name]
    'Item Colors': SET_ITEM_COLOR,

    // HMConfigItemRuneColorSet
    // Format: Rune Colors[range]: textColor, blobColor
    'Rune Colors': SET_RUNE_COLOR,

    // HMConfigItemGoldColorSet
    // Format: Gold Colors[range]: textColor, blobColor
    'Gold Colors': SET_GOLD_COLOR,

    // HMConfigItemAutoPickupSet
    // Format: Import Item[id][quality][eth][sockets]: action
    'Import Item': SET_IMPORT_ITEM,

    // HMConfigItemStatLimitSet
    // Format: Auto Transmute Stat Limit[name]: ...
    'Auto Transmute Stat Limit': SET_STAT_LIMIT,

    // HMConfigItemStatLimitGroupSet
    // Format: Auto Transmute Stat Limit Group[name]: ...
    'Auto Transmute Stat Limit Group': SET_STAT_LIMIT_GROUP,

    // HMConfigItemItemDescriptorSet
    // Format: Auto Transmute Item Descriptor[name]: ...
    'Auto Transmute Item Descriptor': SET_ITEM_DESCRIPTOR,

    // HMConfigItemCubeFormulaSet
    // Format: Auto Transmute Cube Formulas[name]: ...
    'Auto Transmute Cube Formulas': SET_CUBE_FORMULA,

    // HMConfigItemPreItemTaskSet
    // Format: Auto Transmute Pre Item Task[name]: ...
    'Auto Transmute Pre Item Task': SET_PRE_ITEM_TASK,

    // HMConfigItemDoTaskSet
    // Format: Auto Transmute Do Task[name]: ...
    'Auto Transmute Do Task': SET_DO_TASK,

    // HMConfigItemKeyBinding
    // Format: Auto Transmute Key Binding[name]: ...
    'Auto Transmute Key Binding': SET_KEY_BINDING,

    // HMConfigItemMagicBagNameSet
    // Format: Magic Bag Index Name[index]: ...
    'Magic Bag Index Name': SET_MAGIC_BAG_NAME,

    // HMConfigItemOrderedStringSet
    // Format: Import Config: ...
    'Import Config': SET_IMPORT_CONFIG,

    // HMConfigMonsterColorSet
    // Format: Monster Colors[id]: blobColor, [monsterType]
    'Monster Colors': SET_MONSTER_COLOR,

    // HMConfigSkillMissileDrawModeSet
    // Format: Skill Missile DrawMode[skillId]: drawMode
    'Skill Missile DrawMode': SET_SKILL_MISSILE_DRAW_MODE,
  }
}

/**
 * Get keyword type
 * @param key - Config key name
 * @returns Type name or null if unknown
 */
export function getKeywordType(key: string): SimpleType | null {
  const resolved = resolveAlias(key)
  if (KEYWORDS.toggles.includes(resolved)) return TYPE_TOGGLE
  if (KEYWORDS.keys.includes(resolved)) return TYPE_KEY
  if (KEYWORDS.options.includes(resolved)) return TYPE_OPTION
  if (KEYWORDS.integers.includes(resolved)) return TYPE_INTEGER
  if (KEYWORDS.strings.includes(resolved)) return TYPE_STRING
  if (KEYWORDS.colors.includes(resolved)) return TYPE_COLOR
  if (KEYWORDS.sets[resolved]) return TYPE_SET
  return null
}

/**
 * Get set parser type
 * @param key - Config key name
 * @returns Set parser type or null
 */
export function getSetType(key: string): SetType | null {
  const resolved = resolveAlias(key)
  return KEYWORDS.sets[resolved] || null
}

export function getConfigItemSchema(key: string): ConfigItemSchema | null {
  const resolved = resolveAlias(key)
  const simpleType = getKeywordType(resolved)
  if (simpleType && simpleType !== TYPE_SET) {
    return { key: resolved, ...SIMPLE_SCHEMAS[simpleType] }
  }

  const setType = getSetType(resolved)
  if (setType) {
    return { key: resolved, ...SET_SCHEMAS[setType] }
  }

  return null
}

/**
 * Check if keyword is known
 * @param key - Config key name
 */
export function isKnownKeyword(key: string): boolean {
  return getKeywordType(key) !== null
}
