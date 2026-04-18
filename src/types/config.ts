export interface BaseConfigItem {
  comment: string
  sourceFile: string | null  // null = editable file, string = extern file name
  isCommented: boolean
  isDeleted?: boolean
  isNew?: boolean
  isEffective?: boolean  // whether effective (not overridden)
}

export interface ToggleItem extends BaseConfigItem {
  name: string
  enabled: boolean
  hotkey: string
  value?: string
}

export interface ItemColorItem extends BaseConfigItem {
  itemId: string
  quality: string
  ethereal: string
  sockets: string
  textColor: string
  mapColor: string
  mapText: string
}

export interface RuneColorItem extends BaseConfigItem {
  range: string
  textColor: string
  mapColor: string
  mapText: string
}

export interface GoldColorItem extends BaseConfigItem {
  range: string
  textColor: string
  mapColor: string
  mapText: string
}

export interface ImportItemItem extends BaseConfigItem {
  itemId: string
  quality: string
  ethereal: string
  sockets: string
  mode: string
  showInfo: string
  unused: string
  statGroup: string
}

export interface StatLimitItem extends BaseConfigItem {
  name: string
  statId: string
  param: string
  min: string
  max: string
}

export interface StatLimitGroupItem extends BaseConfigItem {
  name: string
  relation: string
  limits: string[]
  comments: string[]
}

export interface ItemDescriptorItem extends BaseConfigItem {
  name: string
  itemId: string
  quality: string
  limitName: string
  count: string
}

export interface CubeFormulaItem extends BaseConfigItem {
  name: string
  descriptors: string[]
}

export interface PreItemTaskItem extends BaseConfigItem {
  name: string
  itemId: string
  quality: string
  limitName: string
  action: string
}

export interface DoTaskItem extends BaseConfigItem {
  name: string
  preTask: string
  formulas: string[]
}

export interface KeyBindingItem extends BaseConfigItem {
  keyCode: string
  command: string
}

export interface ExternItem {
  file: string
  loaded: boolean
}

export interface TransmuteConfig {
  statLimits: StatLimitItem[]
  statLimitGroups: StatLimitGroupItem[]
  itemDescriptors: ItemDescriptorItem[]
  cubeFormulas: CubeFormulaItem[]
  preItemTasks: PreItemTaskItem[]
  doTasks: DoTaskItem[]
  keyBindings: KeyBindingItem[]
}

// ConfigData: data for a single file
export interface ConfigData {
  toggles: ToggleItem[]
  itemColors: ItemColorItem[]
  runeColors: RuneColorItem[]
  goldColors: GoldColorItem[]
  importItems: ImportItemItem[]
  transmute: TransmuteConfig
  includes: ExternItem[]
}

// FileConfig: a loaded config file
export interface FileConfig {
  file: string         // filename, e.g. "d2hackmap.default.cfg"
  isEditable: boolean  // only main file is editable
  data: ConfigData
}

// Config: all loaded files
export interface Config {
  files: FileConfig[]  // ordered by load sequence (first loaded first)
}

export function createEmptyConfigData(): ConfigData {
  return {
    toggles: [],
    itemColors: [],
    runeColors: [],
    goldColors: [],
    importItems: [],
    transmute: {
      statLimits: [],
      statLimitGroups: [],
      itemDescriptors: [],
      cubeFormulas: [],
      preItemTasks: [],
      doTasks: [],
      keyBindings: []
    },
    includes: []
  }
}

export function createEmptyConfig(): Config {
  return {
    files: []
  }
}
