/**
 * CFG Generator - Generate D2HackMap configuration files
 * Generates config from a single ConfigData (the editable file)
 */

import { useI18n } from './i18n'
import { ANY_ETHEREAL_RANGE } from './configRanges'
import {
  OUTPUT_BLOB_COLOR,
  OUTPUT_BOOL,
  OUTPUT_HOTKEY,
  OUTPUT_INT,
  OUTPUT_DO_ACTION,
  OUTPUT_DRAW_MODE,
  OUTPUT_MONSTER_TYPE,
  OUTPUT_PICKUP_HINT,
  OUTPUT_PICKUP_MODE,
  OUTPUT_PICKUP_UNUSED,
  OUTPUT_QUOTED_STRING,
  OUTPUT_RAW,
  OUTPUT_STRING,
  OUTPUT_TEXT_COLOR,
  OUTPUT_UINT,
  getConfigItemSchema,
  type ConfigFieldSchema,
  type FieldOutputType
} from './keywords'
import type {
  ConfigData,
  ToggleItem,
  ItemColorItem,
  RuneColorItem,
  GoldColorItem,
  MonsterColorItem,
  SkillMissileDrawModeItem,
  MagicBagNameItem,
  ImportItemItem,
  StatLimitItem,
  StatLimitGroupItem,
  ItemDescriptorItem,
  CubeFormulaItem,
  PreItemTaskItem,
  DoTaskItem,
  KeyBindingItem,
  BaseConfigItem
} from './types'

// Default indent for all output lines
export const INDENT = '    '
const REQUIRED_QUALITY_RANGE = '1-8'

// Check if value needs quotes (not a number or hex)
function needsQuotes(value: string): boolean {
  if (!value || value === '-1' || value === '-2') return false
  // Number (including negative)
  if (/^-?\d+$/.test(value)) return false
  // Hex value
  if (/^0x[0-9a-fA-F]+$/i.test(value)) return false
  return true
}

// Format value, adding quotes if needed
function formatValue(value: string): string {
  return needsQuotes(value) ? `"${value}"` : value
}

function formatStringValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

function formatSchemaValue(value: string, outputType: FieldOutputType): string {
  if (outputType === OUTPUT_RAW) return value
  if (outputType === OUTPUT_STRING || outputType === OUTPUT_QUOTED_STRING) return formatStringValue(value)
  if (outputType === OUTPUT_BOOL) return value === '1' || value === 'true' ? '1' : '0'
  if (outputType === OUTPUT_HOTKEY) return value || '-1'
  if (
    outputType === OUTPUT_INT ||
    outputType === OUTPUT_UINT ||
    outputType === OUTPUT_TEXT_COLOR ||
    outputType === OUTPUT_BLOB_COLOR ||
    outputType === OUTPUT_PICKUP_MODE ||
    outputType === OUTPUT_PICKUP_HINT ||
    outputType === OUTPUT_PICKUP_UNUSED ||
    outputType === OUTPUT_DO_ACTION ||
    outputType === OUTPUT_DRAW_MODE ||
    outputType === OUTPUT_MONSTER_TYPE
  ) {
    return formatValue(value)
  }

  return value
}

function formatSchemaValues(values: string[], fields: readonly ConfigFieldSchema[]): string[] {
  const formatted: string[] = []
  let valueIndex = 0
  let hasRepeatField = false

  for (const field of fields) {
    if (field.repeat) {
      hasRepeatField = true
      while (valueIndex < values.length) {
        const value = values[valueIndex++]
        if (value !== '') formatted.push(formatSchemaValue(value, field.outputType))
      }
      break
    }

    const value = values[valueIndex++]
    if (value === undefined) {
      if (field.optional) continue
      throw new Error(`Missing required config value: ${field.name}`)
    }
    if (field.optional && value === '') continue
    formatted.push(formatSchemaValue(value, field.outputType))
  }

  if (!hasRepeatField && values.slice(valueIndex).some(value => value !== '')) {
    throw new Error(`Too many config values: expected ${fields.length}, got ${values.length}`)
  }

  return formatted
}

function formatSchemaLine(key: string, indexes: string[], values: string[], comment: string): string {
  const schema = getConfigItemSchema(key)
  if (!schema) throw new Error(`Unknown config item schema: ${key}`)

  const requiredIndexCount = schema.indexes.filter(field => !field.optional).length
  if (indexes.length < requiredIndexCount) {
    throw new Error(`Invalid config indexes for ${key}: expected at least ${requiredIndexCount}, got ${indexes.length}`)
  }

  const paramStr = indexes.map((value, index) => {
    const field = schema.indexes[index]
    return `[${formatSchemaValue(value, field?.outputType || OUTPUT_RAW)}]`
  }).join('')
  const formattedValues = formatSchemaValues(values, schema.values)
  const content = `${key}${paramStr}: ${formattedValues.join(', ')}`
  return formatLine(content, comment)
}

// Format line with optional comment
function formatLine(content: string, comment: string): string {
  if (comment) {
    return `${content}  // ${comment}`
  }
  return content
}

// Format toggle line (enabled, hotkey)
function formatToggleLine(key: string, data: ToggleItem): string {
  const value = data.enabled ? '1' : '0'
  const hotkey = data.hotkey || '-1'
  const values = [value, hotkey]
  if (data.value) values.push(data.value)
  return formatSchemaLine(key, [], values, data.comment)
}

// Format key line (only hotkey)
function formatKeyLine(key: string, data: ToggleItem): string {
  const hotkey = data.hotkey || '-1'
  return formatSchemaLine(key, [], [hotkey], data.comment)
}

function formatOptionLine(key: string, data: ToggleItem): string {
  return formatSchemaLine(key, [], [data.enabled ? '1' : '0'], data.comment)
}

function formatValueLine(key: string, data: ToggleItem): string {
  const value = data.value || ''
  return formatSchemaLine(key, [], [value], data.comment)
}

export function formatSimpleConfigLine(key: string, data: ToggleItem): string {
  const schema = getConfigItemSchema(key)
  if (!schema) throw new Error(`Unknown simple config item schema: ${key}`)

  if (schema.cppClass === 'HMConfigItemToggle') return formatToggleLine(key, data)
  if (schema.cppClass === 'HMConfigItemKey') return formatKeyLine(key, data)
  if (schema.cppClass === 'HMConfigItemOption') return formatOptionLine(key, data)
  if (
    schema.cppClass === 'HMConfigItemString' ||
    schema.cppClass === 'HMConfigItemInt' ||
    schema.cppClass === 'HMConfigItemColorT'
  ) {
    return formatValueLine(key, data)
  }

  throw new Error(`Config item is not a simple item: ${key}`)
}

// Format Item Colors line
export function formatItemColorLine(item: ItemColorItem): string {
  const params: string[] = [item.itemId]
  if (item.quality) params.push(item.quality)
  if (item.ethereal || item.sockets) params.push(item.ethereal || ANY_ETHEREAL_RANGE)
  if (item.sockets) params.push(item.sockets)

  return formatSchemaLine('Item Colors', params, [item.textColor, item.mapColor, item.mapText], item.comment)
}

// Format Rune Colors line
export function formatRuneColorLine(rune: RuneColorItem): string {
  return formatSchemaLine('Rune Colors', [rune.range], [rune.textColor, rune.mapColor, rune.mapText], rune.comment)
}

// Format Gold Colors line
export function formatGoldColorLine(gold: GoldColorItem): string {
  return formatSchemaLine('Gold Colors', [gold.range], [gold.textColor, gold.mapColor, gold.mapText], gold.comment)
}

export function formatMonsterColorLine(item: MonsterColorItem): string {
  const values = item.monsterType ? [item.blobColor, item.monsterType] : [item.blobColor]
  return formatSchemaLine('Monster Colors', [item.monsterId], values, item.comment)
}

export function formatSkillMissileDrawModeLine(item: SkillMissileDrawModeItem): string {
  return formatSchemaLine('Skill Missile DrawMode', [item.skillId], [item.drawMode], item.comment)
}

export function formatMagicBagNameLine(item: MagicBagNameItem): string {
  return formatSchemaLine('Magic Bag Index Name', [item.index], [item.itemId, item.name], item.comment)
}

// Format Import Item line
export function formatImportItemLine(item: ImportItemItem): string {
  const params: string[] = [item.itemId]
  if (item.quality) params.push(item.quality)
  if (item.ethereal || item.sockets) params.push(item.ethereal || ANY_ETHEREAL_RANGE)
  if (item.sockets) params.push(item.sockets)

  const values: string[] = [item.mode, item.showInfo, item.unused]
  if (item.statGroup) values.push(item.statGroup)

  return formatSchemaLine('Import Item', params, values, item.comment)
}

// Format Stat Limit line
export function formatStatLimitLine(name: string, stat: StatLimitItem): string {
  return formatSchemaLine(
    'Auto Transmute Stat Limit',
    [name, stat.statId],
    [stat.param, stat.min, stat.max],
    stat.comment
  )
}

// Format Stat Limit Group line
export function formatStatLimitGroupLine(name: string, relation: string, limitName: string, comment: string): string {
  const indexes = relation !== '0' ? [name, relation] : [name]
  return formatSchemaLine('Auto Transmute Stat Limit Group', indexes, [limitName], comment)
}

// Format Item Descriptor line
export function formatItemDescriptorLine(name: string, desc: ItemDescriptorItem): string {
  const params: string[] = [name, desc.itemId, desc.quality || REQUIRED_QUALITY_RANGE]

  return formatSchemaLine('Auto Transmute Item Descriptor', params, [desc.limitName, desc.count], desc.comment)
}

// Format Cube Formulas line
export function formatCubeFormulasLine(name: string, formula: CubeFormulaItem): string {
  return formatSchemaLine('Auto Transmute Cube Formulas', [name], formula.descriptors, formula.comment)
}

// Format Pre Item Task line
export function formatPreItemTaskLine(name: string, task: PreItemTaskItem): string {
  const params: string[] = [name, task.itemId, task.quality || REQUIRED_QUALITY_RANGE]

  return formatSchemaLine('Auto Transmute Pre Item Task', params, [task.limitName, task.action], task.comment)
}

// Format Do Task line
export function formatDoTaskLine(name: string, task: DoTaskItem): string {
  const values = [task.preTask, ...task.formulas]
  return formatSchemaLine('Auto Transmute Do Task', [name], values, task.comment)
}

// Format Key Binding line
export function formatKeyBindingLine(keyCode: string, binding: KeyBindingItem): string {
  return formatSchemaLine('Auto Transmute Key Binding', [keyCode], [binding.command], binding.comment)
}

// Check if item should be output (not deleted)
// All main items are saved (including duplicates) to preserve original file structure
function shouldOutput(item: BaseConfigItem): boolean {
  if (item.isDeleted) return false
  return true
}

// Format item with optional comment prefix for isCommented
// Use //- prefix for editor-generated commented items
function outputLine(line: string, isCommented: boolean): string {
  return isCommented ? `${INDENT}//- ${line}` : `${INDENT}${line}`
}

// Add section header with proper spacing
function addSectionHeader(sections: string[], title: string): void {
  if (sections.length > 0) {
    sections.push('')
    sections.push('')
  }
  sections.push(`${INDENT}// ========== ${title} ==========`)
  sections.push('')
}

/**
 * Generate config content from ConfigData (single file)
 */
export function generateConfig(configData: ConfigData): string {
  const { t } = useI18n()
  const sections: string[] = []

  // Toggles
  const toggleLines: string[] = []
  for (const data of configData.toggles) {
    if (shouldOutput(data)) {
      toggleLines.push(outputLine(formatSimpleConfigLine(data.name, data), data.isCommented))
    }
  }
  if (toggleLines.length > 0) {
    addSectionHeader(sections, t('gen.toggles'))
    sections.push(...toggleLines)
  }

  // ========== Item Colors ==========
  const itemColorLines: string[] = []
  for (const item of configData.itemColors) {
    if (shouldOutput(item)) {
      itemColorLines.push(outputLine(formatItemColorLine(item), item.isCommented))
    }
  }

  const runeColorLines: string[] = []
  for (const rune of configData.runeColors) {
    if (shouldOutput(rune)) {
      runeColorLines.push(outputLine(formatRuneColorLine(rune), rune.isCommented))
    }
  }

  const goldColorLines: string[] = []
  for (const gold of configData.goldColors) {
    if (shouldOutput(gold)) {
      goldColorLines.push(outputLine(formatGoldColorLine(gold), gold.isCommented))
    }
  }

  const monsterColorLines: string[] = []
  for (const item of configData.monsterColors) {
    if (shouldOutput(item)) {
      monsterColorLines.push(outputLine(formatMonsterColorLine(item), item.isCommented))
    }
  }

  const skillMissileDrawModeLines: string[] = []
  for (const item of configData.skillMissileDrawModes) {
    if (shouldOutput(item)) {
      skillMissileDrawModeLines.push(outputLine(formatSkillMissileDrawModeLine(item), item.isCommented))
    }
  }

  if (
    itemColorLines.length > 0 ||
    runeColorLines.length > 0 ||
    goldColorLines.length > 0 ||
    monsterColorLines.length > 0 ||
    skillMissileDrawModeLines.length > 0
  ) {
    addSectionHeader(sections, t('gen.itemColors'))
    if (itemColorLines.length > 0) {
      sections.push(...itemColorLines)
    }
    if (runeColorLines.length > 0) {
      if (itemColorLines.length > 0) sections.push('')
      sections.push(`// ${t('gen.runeColors')}`)
      sections.push(...runeColorLines)
    }
    if (goldColorLines.length > 0) {
      if (itemColorLines.length > 0 || runeColorLines.length > 0) sections.push('')
      sections.push(`// ${t('gen.goldColors')}`)
      sections.push(...goldColorLines)
    }
    if (monsterColorLines.length > 0) {
      if (itemColorLines.length > 0 || runeColorLines.length > 0 || goldColorLines.length > 0) sections.push('')
      sections.push(`// ${t('gen.monsterColors')}`)
      sections.push(...monsterColorLines)
    }
    if (skillMissileDrawModeLines.length > 0) {
      if (
        itemColorLines.length > 0 ||
        runeColorLines.length > 0 ||
        goldColorLines.length > 0 ||
        monsterColorLines.length > 0
      ) {
        sections.push('')
      }
      sections.push(`// ${t('gen.skillMissileDrawModes')}`)
      sections.push(...skillMissileDrawModeLines)
    }
  }

  const magicBagNameLines: string[] = []
  for (const item of configData.magicBagNames) {
    if (shouldOutput(item)) {
      magicBagNameLines.push(outputLine(formatMagicBagNameLine(item), item.isCommented))
    }
  }
  if (magicBagNameLines.length > 0) {
    addSectionHeader(sections, t('gen.magicBagNames'))
    sections.push(...magicBagNameLines)
  }

  // ========== Import Items ==========
  const importItemLines: string[] = []
  for (const item of configData.importItems) {
    if (shouldOutput(item)) {
      importItemLines.push(outputLine(formatImportItemLine(item), item.isCommented))
    }
  }
  if (importItemLines.length > 0) {
    addSectionHeader(sections, t('gen.importItems'))
    sections.push(...importItemLines)
  }

  // ========== Stat Limits ==========
  const statLimitLines: string[] = []
  for (const stat of configData.transmute.statLimits) {
    if (shouldOutput(stat)) {
      statLimitLines.push(outputLine(formatStatLimitLine(stat.name, stat), stat.isCommented))
    }
  }

  const statLimitGroupLines: string[] = []
  for (const group of configData.transmute.statLimitGroups) {
    if (shouldOutput(group)) {
      for (let i = 0; i < group.limits.length; i++) {
        const comment = group.comments?.[i] || ''
        statLimitGroupLines.push(outputLine(
          formatStatLimitGroupLine(group.name, group.relation, group.limits[i], comment),
          group.isCommented
        ))
      }
    }
  }

  if (statLimitLines.length > 0 || statLimitGroupLines.length > 0) {
    addSectionHeader(sections, t('gen.statLimits'))
    if (statLimitLines.length > 0) {
      sections.push(...statLimitLines)
    }
    if (statLimitGroupLines.length > 0) {
      if (statLimitLines.length > 0) sections.push('')
      sections.push(...statLimitGroupLines)
    }
  }

  // ========== Item Descriptors ==========
  const itemDescriptorLines: string[] = []
  for (const desc of configData.transmute.itemDescriptors) {
    if (shouldOutput(desc)) {
      itemDescriptorLines.push(outputLine(formatItemDescriptorLine(desc.name, desc), desc.isCommented))
    }
  }
  if (itemDescriptorLines.length > 0) {
    addSectionHeader(sections, t('gen.itemDescriptors'))
    sections.push(...itemDescriptorLines)
  }

  // ========== Auto Transmute ==========
  const cubeFormulaLines: string[] = []
  for (const formula of configData.transmute.cubeFormulas) {
    if (shouldOutput(formula)) {
      cubeFormulaLines.push(outputLine(formatCubeFormulasLine(formula.name, formula), formula.isCommented))
    }
  }

  const preItemTaskLines: string[] = []
  for (const task of configData.transmute.preItemTasks) {
    if (shouldOutput(task)) {
      preItemTaskLines.push(outputLine(formatPreItemTaskLine(task.name, task), task.isCommented))
    }
  }

  const doTaskLines: string[] = []
  for (const task of configData.transmute.doTasks) {
    if (shouldOutput(task)) {
      doTaskLines.push(outputLine(formatDoTaskLine(task.name, task), task.isCommented))
    }
  }

  if (cubeFormulaLines.length > 0 || preItemTaskLines.length > 0 || doTaskLines.length > 0) {
    addSectionHeader(sections, t('gen.autoTransmute'))
    if (cubeFormulaLines.length > 0) {
      sections.push(...cubeFormulaLines)
    }
    if (preItemTaskLines.length > 0) {
      if (cubeFormulaLines.length > 0) sections.push('')
      sections.push(...preItemTaskLines)
    }
    if (doTaskLines.length > 0) {
      if (cubeFormulaLines.length > 0 || preItemTaskLines.length > 0) sections.push('')
      sections.push(...doTaskLines)
    }
  }

  // ========== Key Bindings ==========
  const keyBindingLines: string[] = []
  for (const binding of configData.transmute.keyBindings) {
    if (shouldOutput(binding)) {
      keyBindingLines.push(outputLine(formatKeyBindingLine(binding.keyCode, binding), binding.isCommented))
    }
  }
  if (keyBindingLines.length > 0) {
    addSectionHeader(sections, t('gen.keyBindings'))
    sections.push(...keyBindingLines)
  }

  // Ensure file ends with empty line
  if (sections.length > 0) {
    sections.push('')
  }

  return sections.join('\r\n')
}
