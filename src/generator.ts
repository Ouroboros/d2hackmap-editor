/**
 * CFG Generator - Generate D2HackMap configuration files
 * Generates config from a single ConfigData (the editable file)
 */

import { useI18n } from './i18n'
import type {
  ConfigData,
  ToggleItem,
  ItemColorItem,
  RuneColorItem,
  GoldColorItem,
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
  const content = `${key}: ${value}, ${hotkey}`
  return formatLine(content, data.comment)
}

// Format key line (only hotkey)
function formatKeyLine(key: string, data: ToggleItem): string {
  const hotkey = data.hotkey || '-1'
  const content = `${key}: ${hotkey}`
  return formatLine(content, data.comment)
}

// Format Item Colors line
function formatItemColorLine(item: ItemColorItem): string {
  const params: string[] = [item.itemId]
  if (item.quality) params.push(item.quality)
  if (item.ethereal) params.push(item.ethereal)
  if (item.sockets) params.push(item.sockets)

  const paramStr = params.map(p => `[${p}]`).join('')
  const values: string[] = [formatValue(item.textColor), formatValue(item.mapColor)]
  if (item.mapText) values.push(`"${item.mapText}"`)

  const content = `Item Colors${paramStr}: ${values.join(', ')}`
  return formatLine(content, item.comment)
}

// Format Rune Colors line
function formatRuneColorLine(rune: RuneColorItem): string {
  const values: string[] = [formatValue(rune.textColor), formatValue(rune.mapColor)]
  if (rune.mapText) values.push(`"${rune.mapText}"`)

  const content = `Rune Colors[${rune.range}]: ${values.join(', ')}`
  return formatLine(content, rune.comment)
}

// Format Gold Colors line
function formatGoldColorLine(gold: GoldColorItem): string {
  const values: string[] = [formatValue(gold.textColor), formatValue(gold.mapColor)]
  if (gold.mapText) values.push(`"${gold.mapText}"`)

  const content = `Gold Colors[${gold.range}]: ${values.join(', ')}`
  return formatLine(content, gold.comment)
}

// Format Import Item line
function formatImportItemLine(item: ImportItemItem): string {
  const params: string[] = [item.itemId]
  if (item.quality) params.push(item.quality)
  if (item.ethereal) params.push(item.ethereal)
  if (item.sockets) params.push(item.sockets)

  const paramStr = params.map(p => `[${p}]`).join('')
  const values: string[] = [item.mode, item.showInfo, item.unused]
  if (item.statGroup) values.push(`"${item.statGroup}"`)

  const content = `Import Item${paramStr}: ${values.join(', ')}`
  return formatLine(content, item.comment)
}

// Format Stat Limit line
function formatStatLimitLine(name: string, stat: StatLimitItem): string {
  const content = `Auto Transmute Stat Limit[${name}][${stat.statId}]: ${stat.param}, ${stat.min}, ${stat.max}`
  return formatLine(content, stat.comment)
}

// Format Stat Limit Group line
function formatStatLimitGroupLine(name: string, relation: string, limitName: string, comment: string): string {
  const relStr = relation !== '0' ? `[${relation}]` : ''
  const content = `Auto Transmute Stat Limit Group[${name}]${relStr}: "${limitName}"`
  return formatLine(content, comment)
}

// Format Item Descriptor line
function formatItemDescriptorLine(name: string, desc: ItemDescriptorItem): string {
  const params: string[] = [name, desc.itemId]
  if (desc.quality) params.push(desc.quality)

  const paramStr = params.map(p => `[${p}]`).join('')
  const content = `Auto Transmute Item Descriptor${paramStr}: ${desc.limitName}, ${desc.count}`
  return formatLine(content, desc.comment)
}

// Format Cube Formulas line
function formatCubeFormulasLine(name: string, formula: CubeFormulaItem): string {
  const values = formula.descriptors.map(d => `"${d}"`).join(', ')
  const content = `Auto Transmute Cube Formulas[${name}]: ${values}`
  return formatLine(content, formula.comment)
}

// Format Pre Item Task line
function formatPreItemTaskLine(name: string, task: PreItemTaskItem): string {
  const params: string[] = [name, task.itemId]
  if (task.quality) params.push(task.quality)

  const paramStr = params.map(p => `[${p}]`).join('')
  const content = `Auto Transmute Pre Item Task${paramStr}: ${task.limitName}, ${task.action}`
  return formatLine(content, task.comment)
}

// Format Do Task line
function formatDoTaskLine(name: string, task: DoTaskItem): string {
  const values = [task.preTask, ...task.formulas]
  const content = `Auto Transmute Do Task[${name}]: ${values.join(', ')}`
  return formatLine(content, task.comment)
}

// Format Key Binding line
function formatKeyBindingLine(keyCode: string, binding: KeyBindingItem): string {
  const content = `Auto Transmute Key Binding[${keyCode}]: "${binding.command}"`
  return formatLine(content, binding.comment)
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
      const formatFn = data.name.endsWith('Key') ? formatKeyLine : formatToggleLine
      toggleLines.push(outputLine(formatFn(data.name, data), data.isCommented))
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

  if (itemColorLines.length > 0 || runeColorLines.length > 0 || goldColorLines.length > 0) {
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
