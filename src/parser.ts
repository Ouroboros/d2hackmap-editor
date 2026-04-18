/**
 * CFG Parser - Parse D2HackMap configuration files
 */

import {
  getKeywordType, getSetType,
  TYPE_TOGGLE, TYPE_KEY, TYPE_OPTION, TYPE_INTEGER, TYPE_STRING, TYPE_COLOR,
  SET_ITEM_COLOR, SET_RUNE_COLOR, SET_GOLD_COLOR, SET_IMPORT_ITEM, SET_STAT_LIMIT, SET_STAT_LIMIT_GROUP,
  SET_ITEM_DESCRIPTOR, SET_CUBE_FORMULA, SET_PRE_ITEM_TASK, SET_DO_TASK, SET_KEY_BINDING,
  SET_IMPORT_CONFIG
} from './keywords'
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
  ExternItem
} from './types'

// Parsed config line
interface ParsedLine {
  key: string
  params: string[]
  values: string[]
  comment: string
  raw: string
}

// Parse array parameters like [a][b][c]
function parseArrayParams(str: string): string[] {
  const regex = /\[([^\]]*)\]/g
  const params: string[] = []
  let match
  while ((match = regex.exec(str)) !== null) {
    params.push(match[1])
  }
  return params
}

// Parse a single config line
function parseConfigLine(line: string): ParsedLine | null {
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) return null

  const keyPart = line.substring(0, colonIndex).trim()
  let valuePart = line.substring(colonIndex + 1).trim()

  // Extract inline comment (last // on the line)
  let comment = ''
  const commentMatch = valuePart.match(/\/\/\s*(.*)$/)
  if (commentMatch) {
    comment = commentMatch[1].trim()
    valuePart = valuePart.substring(0, valuePart.lastIndexOf('//')).trim()
  }

  // Extract base key and array parameters
  const bracketIndex = keyPart.indexOf('[')
  let key: string
  let params: string[]
  if (bracketIndex !== -1) {
    key = keyPart.substring(0, bracketIndex).trim()
    params = parseArrayParams(keyPart.substring(bracketIndex))
  } else {
    key = keyPart
    params = []
  }

  // Parse values (handle quoted strings)
  const values = parseValues(valuePart)

  return { key, params, values, comment, raw: line }
}

// Parse comma-separated values, handling quoted strings
function parseValues(str: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]

    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true
      quoteChar = ch
    } else if (inQuote && ch === quoteChar) {
      inQuote = false
      quoteChar = ''
    } else if (!inQuote && ch === ',') {
      values.push(current.trim())
      current = ''
    } else if (!inQuote && ch === '/' && str[i + 1] === '/') {
      // Comment starts, stop parsing
      break
    } else {
      current += ch
    }
  }

  if (current.trim()) {
    values.push(current.trim())
  }

  // Clean up quoted values
  return values.map(v => {
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1)
    }
    return v
  })
}

// Check if line is a regular comment (not editor-commented config)
function isComment(line: string): boolean {
  const trimmed = line.trim()
  // //- is editor-commented config, not a regular comment
  if (trimmed.startsWith('//-')) return false
  return trimmed.startsWith('//')
}

// Check if line is an editor-commented config item
function isEditorCommented(line: string): boolean {
  return line.trim().startsWith('//-')
}

// Extract content from editor-commented line
function getEditorCommentedContent(line: string): string {
  const trimmed = line.trim()
  return trimmed.slice(3).trim() // Remove '//- ' prefix
}

// Check if line is blank
function isBlank(line: string): boolean {
  return line.trim() === ''
}

/**
 * Parse config lines into structured ConfigData (single file)
 * @param lines Lines to parse
 * @param sourceFile null for editable file, filename for extern file
 */
export function parseConfig(lines: string[], sourceFile: string | null = null): ConfigData {
  const config: ConfigData = {
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (isBlank(line) || isComment(line)) {
      continue
    }

    // Check for editor-commented config item (//-  prefix)
    let isCommented = false
    let lineToParse = line
    if (isEditorCommented(line)) {
      lineToParse = getEditorCommentedContent(line)
      isCommented = true
    }

    const parsed = parseConfigLine(lineToParse)
    if (!parsed) continue

    const { key, params, values, comment } = parsed

    // Get keyword type from registry
    const keyType = getKeywordType(key)
    const setType = getSetType(key)

    // Route to appropriate handler based on keyword type
    if (setType === SET_IMPORT_CONFIG) {
      // Import Config directive
      const fileName = values[0] || ''
      if (fileName) {
        const externItem: ExternItem = { file: fileName, loaded: false }
        config.includes.push(externItem)
      }
    } else if (keyType === TYPE_TOGGLE) {
      // Toggle config: enabled, hotkey
      const toggleItem: ToggleItem = {
        name: key,
        enabled: values[0] === '1' || values[0] === 'true',
        hotkey: values[1] || '-1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.toggles.push(toggleItem)
    } else if (keyType === TYPE_KEY) {
      // Key config: only hotkey (always enabled)
      const toggleItem: ToggleItem = {
        name: key,
        enabled: true,
        hotkey: values[0] || '-1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.toggles.push(toggleItem)
    } else if (keyType === TYPE_OPTION) {
      // Option config: simple on/off
      const toggleItem: ToggleItem = {
        name: key,
        enabled: values[0] === '1' || values[0] !== '0',
        hotkey: '-1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.toggles.push(toggleItem)
    } else if (keyType === TYPE_INTEGER || keyType === TYPE_STRING || keyType === TYPE_COLOR) {
      // Simple value types stored in toggles for now
      const toggleItem: ToggleItem = {
        name: key,
        enabled: true,
        value: values[0] || '',
        hotkey: '-1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.toggles.push(toggleItem)
    } else if (setType === SET_ITEM_COLOR) {
      const itemColor: ItemColorItem = {
        itemId: params[0] || '',
        quality: params[1] || '',
        ethereal: params[2] || '',
        sockets: params[3] || '',
        textColor: values[0] || '-1',
        mapColor: values[1] || '-1',
        mapText: values[2] || '',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.itemColors.push(itemColor)
    } else if (setType === SET_RUNE_COLOR) {
      const runeColor: RuneColorItem = {
        range: params[0] || '',
        textColor: values[0] || '-1',
        mapColor: values[1] || '-1',
        mapText: values[2] || '',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.runeColors.push(runeColor)
    } else if (setType === SET_GOLD_COLOR) {
      const goldColor: GoldColorItem = {
        range: params[0] || '-1',
        textColor: values[0] || '-1',
        mapColor: values[1] || '-1',
        mapText: values[2] || '',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.goldColors.push(goldColor)
    } else if (setType === SET_IMPORT_ITEM) {
      const importItem: ImportItemItem = {
        itemId: params[0] || '',
        quality: params[1] || '',
        ethereal: params[2] || '',
        sockets: params[3] || '',
        mode: values[0] || '0',
        showInfo: values[1] || '0',
        unused: values[2] || '0',
        statGroup: values[3] || '',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.importItems.push(importItem)
    } else if (setType === SET_STAT_LIMIT) {
      const name = params[0] || ''
      const statId = params[1] || ''
      const statLimit: StatLimitItem = {
        name,
        statId,
        param: values[0] || '0',
        min: values[1] || '-1',
        max: values[2] || '-1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.transmute.statLimits.push(statLimit)
    } else if (setType === SET_STAT_LIMIT_GROUP) {
      const name = params[0] || ''
      const relation = params[1] || '0'
      // Find existing group with same name or create new one
      let existingGroup = config.transmute.statLimitGroups.find(g => g.name === name)
      if (!existingGroup) {
        existingGroup = {
          name,
          relation,
          limits: [],
          comments: [],
          comment: '',
          sourceFile,
          isCommented
        }
        config.transmute.statLimitGroups.push(existingGroup)
      }
      existingGroup.limits.push(values[0] || '')
      existingGroup.comments.push(comment || '')
    } else if (setType === SET_ITEM_DESCRIPTOR) {
      const name = params[0] || ''
      const itemDescriptor: ItemDescriptorItem = {
        name,
        itemId: params[1] || '',
        quality: params[2] || '',
        limitName: values[0] || '',
        count: values[1] || '1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.transmute.itemDescriptors.push(itemDescriptor)
    } else if (setType === SET_CUBE_FORMULA) {
      const name = params[0] || ''
      const cubeFormula: CubeFormulaItem = {
        name,
        descriptors: values,
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.transmute.cubeFormulas.push(cubeFormula)
    } else if (setType === SET_PRE_ITEM_TASK) {
      const name = params[0] || ''
      const preItemTask: PreItemTaskItem = {
        name,
        itemId: params[1] || '',
        quality: params[2] || '',
        limitName: values[0] || '',
        action: values[1] || '1',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.transmute.preItemTasks.push(preItemTask)
    } else if (setType === SET_DO_TASK) {
      const name = params[0] || ''
      const doTask: DoTaskItem = {
        name,
        preTask: values[0] || '',
        formulas: values.slice(1),
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.transmute.doTasks.push(doTask)
    } else if (setType === SET_KEY_BINDING) {
      const keyCode = params[0] || ''
      const keyBinding: KeyBindingItem = {
        keyCode,
        command: values[0] || '',
        comment: comment || '',
        sourceFile,
        isCommented
      }
      config.transmute.keyBindings.push(keyBinding)
    } else if (keyType === null && setType === null) {
      // Unknown keyword - report error
      console.error(`[Parser] Unknown config key: ${key}`)
    }
  }

  return config
}
