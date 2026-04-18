import { ref, watch, computed, type Ref } from 'vue'
import { parseConfig } from '../parser'
import { generateConfig } from '../generator'
import { useI18n } from '../i18n'
import { refreshEffectiveStatus } from './useItemActions'
import { log } from '../utils/log'
import {
  createEmptyConfig,
  createEmptyConfigData,
  type Config,
  type ConfigData,
  type FileConfig,
  type ExternItem
} from '../types'

// Global config state
const config: Ref<Config | null> = ref(null)
const fileName = ref('')
const hasUnsavedChanges = ref(false)
const pendingExterns: Ref<ExternItem[]> = ref([])
const loadedFiles: Ref<Set<string>> = ref(new Set())
const configVersion = ref(0)  // Incremented when config changes significantly (e.g., extern loaded)
const isReadOnly = ref(false)  // Read-only mode for d2hackmap.default.cfg

// Files that are always read-only
const READ_ONLY_FILES = ['d2hackmap.default.cfg']

// Encoding detection result
interface EncodingResult {
  encoding: string
  bomLength: number
}

// Watch for changes (skip if read-only)
watch(config, () => {
  if (config.value && !isReadOnly.value) {
    hasUnsavedChanges.value = true
  }
}, { deep: true })

// Encoding detection
function detectEncoding(buffer: ArrayBuffer): EncodingResult {
  const bytes = new Uint8Array(buffer)

  // UTF-16 LE BOM: FF FE
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return { encoding: 'utf-16le', bomLength: 2 }
  }
  // UTF-16 BE BOM: FE FF
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return { encoding: 'utf-16be', bomLength: 2 }
  }
  // UTF-8 BOM: EF BB BF
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return { encoding: 'utf-8', bomLength: 3 }
  }
  // No BOM - fallback to GBK
  return { encoding: 'gbk', bomLength: 0 }
}

// Read file with encoding detection
async function readFile(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer()
  const { encoding, bomLength } = detectEncoding(buffer)

  // Skip BOM bytes
  const dataBuffer = bomLength > 0 ? buffer.slice(bomLength) : buffer

  const decoder = new TextDecoder(encoding)
  const text = decoder.decode(dataBuffer)
  return text.split(/\r?\n/)
}

// Save file as UTF-16 LE with BOM
function downloadFile(content: string, name: string): void {
  // UTF-16 LE BOM
  const bom = new Uint8Array([0xFF, 0xFE])

  // Encode as UTF-16 LE
  const textBytes = new Uint8Array(content.length * 2)
  for (let i = 0; i < content.length; i++) {
    const code = content.charCodeAt(i)
    textBytes[i * 2] = code & 0xFF
    textBytes[i * 2 + 1] = (code >> 8) & 0xFF
  }

  const blob = new Blob([bom, textBytes], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// Get editable file from config
function getEditableFile(cfg: Config): FileConfig | undefined {
  return cfg.files.find(f => f.isEditable)
}

// Get all includes from all files
function getAllIncludes(cfg: Config): ExternItem[] {
  const seen = new Set<string>()
  const result: ExternItem[] = []
  for (const fileConfig of cfg.files) {
    for (const inc of fileConfig.data.includes) {
      if (!seen.has(inc.file)) {
        seen.add(inc.file)
        result.push(inc)
      }
    }
  }
  return result
}

// Partial export generators
function generateTogglesExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const data of fileConfig.data.toggles) {
      if (data.isDeleted) continue
      if (data.isEffective === false) continue
      if (data.name.endsWith('Key')) {
        const hotkey = data.hotkey || '-1'
        const line = data.isCommented ? `// ${data.name}: ${hotkey}` : `${data.name}: ${hotkey}`
        lines.push(line)
      } else {
        const value = data.enabled ? '1' : '0'
        const hotkey = data.hotkey || '-1'
        const line = data.isCommented ? `// ${data.name}: ${value}, ${hotkey}` : `${data.name}: ${value}, ${hotkey}`
        lines.push(line)
      }
    }
  }
  return lines.join('\r\n')
}

function generateItemColorsExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const item of fileConfig.data.itemColors) {
      const params: string[] = [item.itemId]
      if (item.quality) params.push(item.quality)
      if (item.ethereal) params.push(item.ethereal)
      if (item.sockets) params.push(item.sockets)
      const paramStr = params.map(p => `[${p}]`).join('')
      const values: string[] = [item.textColor, item.mapColor]
      if (item.mapText) values.push(`"${item.mapText}"`)
      lines.push(`Item Colors${paramStr}: ${values.join(', ')}`)
    }
    for (const rune of fileConfig.data.runeColors) {
      const values: string[] = [rune.textColor, rune.mapColor]
      if (rune.mapText) values.push(`"${rune.mapText}"`)
      lines.push(`Rune Colors[${rune.range}]: ${values.join(', ')}`)
    }
  }
  return lines.join('\r\n')
}

function generateImportItemsExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const item of fileConfig.data.importItems) {
      const params: string[] = [item.itemId]
      if (item.quality) params.push(item.quality)
      if (item.ethereal) params.push(item.ethereal)
      if (item.sockets) params.push(item.sockets)
      const paramStr = params.map(p => `[${p}]`).join('')
      const values: string[] = [item.mode, item.showInfo, item.unused]
      if (item.statGroup) values.push(`"${item.statGroup}"`)
      lines.push(`Import Item${paramStr}: ${values.join(', ')}`)
    }
  }
  return lines.join('\r\n')
}

function generateTransmuteExport(cfg: Config): string {
  const lines: string[] = []

  for (const fileConfig of cfg.files) {
    const t = fileConfig.data.transmute

    // Stat Limits
    for (const stat of t.statLimits) {
      if (stat.isEffective === false) continue
      lines.push(`Auto Transmute Stat Limit[${stat.name}][${stat.statId}]: ${stat.param}, ${stat.min}, ${stat.max}`)
    }

    // Stat Limit Groups
    for (const group of t.statLimitGroups) {
      if (group.isEffective === false) continue
      for (const limitName of group.limits) {
        const relStr = group.relation !== '0' ? `[${group.relation}]` : ''
        lines.push(`Auto Transmute Stat Limit Group[${group.name}]${relStr}: "${limitName}"`)
      }
    }

    // Item Descriptors
    for (const desc of t.itemDescriptors) {
      if (desc.isEffective === false) continue
      const params: string[] = [desc.name, desc.itemId]
      if (desc.quality) params.push(desc.quality)
      const paramStr = params.map(p => `[${p}]`).join('')
      lines.push(`Auto Transmute Item Descriptor${paramStr}: ${desc.limitName}, ${desc.count}`)
    }

    // Cube Formulas
    for (const formula of t.cubeFormulas) {
      if (formula.isEffective === false) continue
      const values = formula.descriptors.map(d => `"${d}"`).join(', ')
      lines.push(`Auto Transmute Cube Formulas[${formula.name}]: ${values}`)
    }

    // Pre Item Tasks
    for (const task of t.preItemTasks) {
      if (task.isEffective === false) continue
      const params: string[] = [task.name, task.itemId]
      if (task.quality) params.push(task.quality)
      const paramStr = params.map(p => `[${p}]`).join('')
      lines.push(`Auto Transmute Pre Item Task${paramStr}: ${task.limitName}, ${task.action}`)
    }

    // Do Tasks
    for (const task of t.doTasks) {
      if (task.isEffective === false) continue
      const values = [task.preTask, ...task.formulas]
      lines.push(`Auto Transmute Do Task[${task.name}]: ${values.join(', ')}`)
    }

    // Key Bindings
    for (const binding of t.keyBindings) {
      if (binding.isEffective === false) continue
      lines.push(`Auto Transmute Key Binding[${binding.keyCode}]: "${binding.command}"`)
    }
  }

  return lines.join('\r\n')
}

export function useConfig() {
  async function openFile(file: File): Promise<void> {
    try {
      const lines = await readFile(file)
      // Parse as editable file (sourceFile = null)
      const configData = parseConfig(lines, null)

      // Create new config with this file
      const fileConfig: FileConfig = {
        file: file.name,
        isEditable: true,  // The opened file is always editable
        data: configData
      }

      config.value = {
        files: [fileConfig]
      }

      fileName.value = file.name
      hasUnsavedChanges.value = false

      // Check if file is read-only
      isReadOnly.value = READ_ONLY_FILES.includes(file.name.toLowerCase())

      // Reset extern tracking
      loadedFiles.value = new Set([file.name])

      // Collect pending externs from this file
      pendingExterns.value = configData.includes.filter(inc =>
        inc.file !== file.name && !loadedFiles.value.has(inc.file)
      )

      // Refresh effective status after loading
      refreshEffectiveStatus(config.value)
    } catch (e) {
      console.error('Failed to open file:', e)
      const { t } = useI18n()
      alert(t('error.openFailed', { message: (e as Error).message }))
    }
  }

  async function loadConfigFile(file: File, isEditable: boolean = false, skipRefresh: boolean = false): Promise<void> {
    log(`[loadConfigFile] file: ${file.name}, isEditable: ${isEditable}, skipRefresh: ${skipRefresh}`)
    if (config.value === null) return
    if (loadedFiles.value.has(file.name)) {
      log(`[loadConfigFile] skip: ${file.name} already loaded`)
      return
    }

    try {
      const lines = await readFile(file)
      // Parse with sourceFile = filename for extern, null for editable
      const sourceFile = isEditable ? null : file.name
      const configData = parseConfig(lines, sourceFile)

      // Create FileConfig for this extern file
      const fileConfig: FileConfig = {
        file: file.name,
        isEditable: isEditable,
        data: configData
      }

      // Mark as loaded
      loadedFiles.value.add(file.name)

      // Find and mark the extern as loaded in all files
      for (const fc of config.value.files) {
        const inc = fc.data.includes.find(i => i.file === file.name)
        if (inc) {
          inc.loaded = true
        }
      }

      // Add to files array (later loaded files go to the end)
      config.value.files.push(fileConfig)

      // Refresh effective status after adding (unless batch loading)
      if (!skipRefresh) {
        refreshEffectiveStatus(config.value)
      }

      // Bump config version to trigger validation refresh
      configVersion.value++

      // Update pending externs (collect from all files)
      const allIncludes = getAllIncludes(config.value)
      pendingExterns.value = allIncludes.filter(inc =>
        !loadedFiles.value.has(inc.file)
      )
    } catch (e) {
      console.error('Failed to load extern file:', e)
      const { t } = useI18n()
      alert(t('error.loadExternFailed', { message: (e as Error).message }))
    }
  }

  async function loadConfigFiles(files: File[]): Promise<void> {
    for (const file of files) {
      await loadConfigFile(file)
    }
  }

  function saveFile(): void {
    if (!config.value) return

    // Find the editable file
    const editableFile = getEditableFile(config.value)
    if (!editableFile) {
      console.error('No editable file found')
      return
    }

    const content = generateConfig(editableFile.data)
    const name = fileName.value || 'd2hackmap.cfg'
    downloadFile(content, name)
    hasUnsavedChanges.value = false
  }

  function newConfig(): void {
    const emptyData = createEmptyConfigData()
    const fileConfig: FileConfig = {
      file: '',
      isEditable: true,
      data: emptyData
    }
    config.value = {
      files: [fileConfig]
    }
    fileName.value = ''
    hasUnsavedChanges.value = false
    isReadOnly.value = false
    loadedFiles.value = new Set()
    pendingExterns.value = []
  }

  // Initialize for directory load (no empty editable file)
  function initForDirectoryLoad(): void {
    config.value = { files: [] }
    fileName.value = ''
    hasUnsavedChanges.value = false
    isReadOnly.value = false
    loadedFiles.value = new Set()
    pendingExterns.value = []
  }

  function closeConfig(): void {
    config.value = null
    fileName.value = ''
    hasUnsavedChanges.value = false
    isReadOnly.value = false
    loadedFiles.value = new Set()
    pendingExterns.value = []
  }

  function exportSection(section: string): void {
    if (!config.value) return

    let content = ''
    let exportName = ''

    switch (section) {
      case 'toggles':
        content = generateTogglesExport(config.value)
        exportName = 'toggles.cfg'
        break
      case 'itemColors':
        content = generateItemColorsExport(config.value)
        exportName = 'itemcolors.cfg'
        break
      case 'importItems':
        content = generateImportItemsExport(config.value)
        exportName = 'importitems.cfg'
        break
      case 'transmute':
        content = generateTransmuteExport(config.value)
        exportName = 'transmute.cfg'
        break
      default:
        return
    }

    if (content) {
      downloadFile(content, exportName)
    }
  }

  return {
    config,
    configVersion,
    fileName,
    hasUnsavedChanges,
    isReadOnly,
    pendingExterns,
    loadedFiles,
    openFile,
    saveFile,
    newConfig,
    initForDirectoryLoad,
    closeConfig,
    exportSection,
    loadConfigFile,
    loadConfigFiles
  }
}
