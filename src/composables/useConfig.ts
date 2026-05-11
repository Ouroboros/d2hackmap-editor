import { ref, watch, computed, type Ref } from 'vue'
import { parseConfig } from '../parser'
import {
  formatCubeFormulasLine,
  formatDoTaskLine,
  formatGoldColorLine,
  formatImportItemLine,
  formatItemColorLine,
  formatItemDescriptorLine,
  formatKeyBindingLine,
  formatMagicBagNameLine,
  formatMonsterColorLine,
  formatPreItemTaskLine,
  formatRuneColorLine,
  formatSimpleConfigLine,
  formatSkillMissileDrawModeLine,
  formatStatLimitGroupLine,
  formatStatLimitLine,
  generateConfig
} from '../generator'
import { useI18n } from '../i18n'
import { refreshEffectiveStatus } from './useItemActions'
import { log } from '../utils/log'
import { isEditableLayer } from '../profile/profileLayers'
import { parseProfileName } from '../profile/profileHeader'
import {
  createEmptyConfig,
  createEmptyConfigData,
  type Config,
  type ConfigData,
  type FileConfig,
  type ExternItem,
  type ConfigLayer
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
function formatExportLine(line: string, isCommented: boolean): string {
  return isCommented ? `// ${line}` : line
}

function generateTogglesExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const data of fileConfig.data.toggles) {
      if (data.isDeleted) continue
      if (data.isEffective === false) continue
      const line = formatSimpleConfigLine(data.name, data)
      lines.push(formatExportLine(line, data.isCommented))
    }
  }
  return lines.join('\r\n')
}

function generateItemColorsExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const item of fileConfig.data.itemColors) {
      lines.push(formatExportLine(formatItemColorLine(item), item.isCommented))
    }
    for (const rune of fileConfig.data.runeColors) {
      lines.push(formatExportLine(formatRuneColorLine(rune), rune.isCommented))
    }
    for (const gold of fileConfig.data.goldColors) {
      lines.push(formatExportLine(formatGoldColorLine(gold), gold.isCommented))
    }
    for (const monster of fileConfig.data.monsterColors) {
      lines.push(formatExportLine(formatMonsterColorLine(monster), monster.isCommented))
    }
    for (const item of fileConfig.data.skillMissileDrawModes) {
      lines.push(formatExportLine(formatSkillMissileDrawModeLine(item), item.isCommented))
    }
  }
  return lines.join('\r\n')
}

function generateImportItemsExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const item of fileConfig.data.importItems) {
      lines.push(formatExportLine(formatImportItemLine(item), item.isCommented))
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
      lines.push(formatExportLine(formatStatLimitLine(stat.name, stat), stat.isCommented))
    }

    // Stat Limit Groups
    for (const group of t.statLimitGroups) {
      if (group.isEffective === false) continue
      for (let i = 0; i < group.limits.length; i++) {
        lines.push(formatExportLine(
          formatStatLimitGroupLine(group.name, group.relation, group.limits[i], group.comments?.[i] || ''),
          group.isCommented
        ))
      }
    }

    // Item Descriptors
    for (const desc of t.itemDescriptors) {
      if (desc.isEffective === false) continue
      lines.push(formatExportLine(formatItemDescriptorLine(desc.name, desc), desc.isCommented))
    }

    // Cube Formulas
    for (const formula of t.cubeFormulas) {
      if (formula.isEffective === false) continue
      lines.push(formatExportLine(formatCubeFormulasLine(formula.name, formula), formula.isCommented))
    }

    // Pre Item Tasks
    for (const task of t.preItemTasks) {
      if (task.isEffective === false) continue
      lines.push(formatExportLine(formatPreItemTaskLine(task.name, task), task.isCommented))
    }

    // Do Tasks
    for (const task of t.doTasks) {
      if (task.isEffective === false) continue
      lines.push(formatExportLine(formatDoTaskLine(task.name, task), task.isCommented))
    }

    // Key Bindings
    for (const binding of t.keyBindings) {
      if (binding.isEffective === false) continue
      lines.push(formatExportLine(formatKeyBindingLine(binding.keyCode, binding), binding.isCommented))
    }
  }

  return lines.join('\r\n')
}

function generateMagicBagNamesExport(cfg: Config): string {
  const lines: string[] = []
  for (const fileConfig of cfg.files) {
    for (const item of fileConfig.data.magicBagNames) {
      lines.push(formatExportLine(formatMagicBagNameLine(item), item.isCommented))
    }
  }
  return lines.join('\r\n')
}

export function useConfig() {
  async function loadConfigText(
    displayName: string,
    lines: string[],
    layer: ConfigLayer = 'extern',
    skipRefresh: boolean = false
  ): Promise<void> {
    log(`[loadConfigText] file: ${displayName}, layer: ${layer}, skipRefresh: ${skipRefresh}`)
    if (config.value === null) return
    if (loadedFiles.value.has(displayName)) {
      log(`[loadConfigText] skip: ${displayName} already loaded`)
      return
    }

    try {
      const sourceFile = displayName
      const configData = parseConfig(lines, sourceFile, layer)

      const fileConfig: FileConfig = {
        file: displayName,
        isEditable: isEditableLayer(layer),
        layer,
        profileName: layer === 'profile' ? parseProfileName(lines) : undefined,
        data: configData
      }

      loadedFiles.value.add(displayName)

      // Find and mark the extern as loaded in all files
      for (const fc of config.value.files) {
        const inc = fc.data.includes.find(i => i.file === displayName)
        if (inc) {
          inc.loaded = true
        }
      }

      config.value.files.push(fileConfig)

      if (!skipRefresh) {
        refreshEffectiveStatus(config.value)
      }

      configVersion.value++

      const allIncludes = getAllIncludes(config.value)
      pendingExterns.value = allIncludes.filter(inc =>
        !loadedFiles.value.has(inc.file)
      )
    } catch (e) {
      console.error('Failed to load config text:', e)
      const { t } = useI18n()
      alert(t('error.loadExternFailed', { message: (e as Error).message }))
    }
  }

  async function openFile(file: File): Promise<void> {
    try {
      const lines = await readFile(file)
      // Parse as editable file (sourceFile = null)
      const configData = parseConfig(lines, file.name, 'user')

      // Create new config with this file
      const fileConfig: FileConfig = {
        file: file.name,
        isEditable: true,  // The opened file is always editable
        layer: 'user',
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
      await loadConfigText(file.name, lines, isEditable ? 'user' : 'extern', skipRefresh)
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
      layer: 'user',
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

  function ensureLayerFile(name: string, layer: ConfigLayer): void {
    if (!config.value) return
    if (config.value.files.some(file => file.layer === layer)) return

    const fileConfig: FileConfig = {
      file: name,
      isEditable: isEditableLayer(layer),
      layer,
      data: createEmptyConfigData()
    }
    config.value.files.push(fileConfig)
    loadedFiles.value.add(name)
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
      case 'magicBagNames':
        content = generateMagicBagNamesExport(config.value)
        exportName = 'magic-bag-names.cfg'
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
    loadConfigFiles,
    loadConfigText,
    ensureLayerFile
  }
}
