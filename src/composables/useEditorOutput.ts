import { ref, type Ref } from 'vue'
import { generateConfig, INDENT } from '../generator'
import { log } from '../utils/log'
import type { Config } from '../types'

// Constants
export const EDITOR_OUTPUT_FILENAME = 'd2hackmap.gen.cfg'
export const REQUIRED_FILE = 'd2hackmap.default.cfg'

// Validation result type
export type ValidateResult =
  | { ok: true }
  | { ok: false, error: 'no_permission' | 'no_required_file' }

// State
const dirHandle: Ref<FileSystemDirectoryHandle | null> = ref(null)

export function useEditorOutput() {
  // Check if we have read permission for the directory
  async function checkDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    log(`[Permission] Checking directory: ${handle.name}`)

    try {
      // Try to query permission first
      const permission = await handle.queryPermission({ mode: 'read' })
      log(`[Permission] queryPermission: ${permission}`)
      if (permission === 'granted') return true

      // If not granted, request permission
      const requested = await handle.requestPermission({ mode: 'read' })
      log(`[Permission] requestPermission: ${requested}`)
      return requested === 'granted'
    } catch (e) {
      log(`[Permission] API not supported: ${e}`)
      // Some browsers don't support queryPermission/requestPermission
      // Try to actually read the directory to check permission
      try {
        const files: string[] = []
        for await (const entry of handle.values()) {
          files.push(entry.name)
          if (files.length >= 5) break // Just list first few
        }
        log(`[Permission] List files OK: ${files.join(', ')}`)
        return true
      } catch (listError) {
        log(`[Permission] List files FAILED: ${listError}`)
        return false
      }
    }
  }

  // Validate directory: check permission and required file
  async function validateConfigDirectory(handle: FileSystemDirectoryHandle): Promise<ValidateResult> {
    log(`[Validate] Directory: ${handle.name}`)

    // First check permission
    const hasPermission = await checkDirectoryPermission(handle)
    log(`[Validate] Permission: ${hasPermission}`)
    if (!hasPermission) {
      return { ok: false, error: 'no_permission' }
    }

    // Then check required file exists AND can be read
    // Some browsers allow getFileHandle but not actual file reading
    try {
      log(`[Validate] getFileHandle: ${REQUIRED_FILE}`)
      const fileHandle = await handle.getFileHandle(REQUIRED_FILE)
      log(`[Validate] getFile()`)
      // Actually try to read the file to verify read permission
      const file = await fileHandle.getFile()
      log(`[Validate] File size: ${file.size}`)
      // Read a small portion to confirm read access
      const slice = await file.slice(0, 1).arrayBuffer()
      log(`[Validate] Read OK: ${slice.byteLength} bytes`)
      return { ok: true }
    } catch (e) {
      log(`[Validate] FAILED: ${e}`)
      // Distinguish between file not found vs no read permission
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        return { ok: false, error: 'no_required_file' }
      }
      // Other errors (SecurityError, etc.) indicate permission issues
      return { ok: false, error: 'no_permission' }
    }
  }

  // Get editor output file handle (returns null if not exists)
  async function getEditorOutputHandle(handle: FileSystemDirectoryHandle): Promise<FileSystemFileHandle | null> {
    try {
      return await handle.getFileHandle(EDITOR_OUTPUT_FILENAME)
    } catch (e) {
      return null
    }
  }

  // Set the directory handle
  function setDirHandle(handle: FileSystemDirectoryHandle): void {
    dirHandle.value = handle
  }

  // Save config to editor output file
  async function saveToEditorFile(config: Config): Promise<FileSystemFileHandle> {
    if (!dirHandle.value) {
      throw new Error('No directory handle')
    }

    // Find the editable file's data
    const editableFile = config.files.find(f => f.isEditable)
    if (!editableFile) {
      throw new Error('No editable file found')
    }

    // Generate config content
    const content = generateConfig(editableFile.data)

    // Create or get editor output file handle
    const editorHandle = await dirHandle.value.getFileHandle(EDITOR_OUTPUT_FILENAME, { create: true })

    // Write content as UTF-16 LE with BOM
    const writable = await editorHandle.createWritable()
    const bom = new Uint8Array([0xFF, 0xFE])
    const textBytes = new Uint8Array(content.length * 2)
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i)
      textBytes[i * 2] = code & 0xFF
      textBytes[i * 2 + 1] = (code >> 8) & 0xFF
    }
    await writable.write(bom)
    await writable.write(textBytes)
    await writable.close()

    // Ensure import line in d2hackmap.cfg
    await ensureEditorImport()

    return editorHandle
  }

  // Read file content and detect encoding
  async function readFileContent(handle: FileSystemFileHandle): Promise<{ lines: string[], encoding: string, bomLength: number }> {
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let encoding = 'gbk'
    let bomLength = 0
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      encoding = 'utf-16le'
      bomLength = 2
    } else if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      encoding = 'utf-8'
      bomLength = 3
    }
    const dataBuffer = bomLength > 0 ? buffer.slice(bomLength) : buffer
    const decoder = new TextDecoder(encoding)
    const text = decoder.decode(dataBuffer)
    return { lines: text.split(/\r?\n/), encoding, bomLength }
  }

  // Write file content with encoding
  async function writeFileContent(handle: FileSystemFileHandle, lines: string[], encoding: string, bomLength: number): Promise<void> {
    const newContent = lines.join('\r\n')
    const writable = await handle.createWritable()
    if (encoding === 'utf-16le') {
      const bom = new Uint8Array([0xFF, 0xFE])
      const textBytes = new Uint8Array(newContent.length * 2)
      for (let i = 0; i < newContent.length; i++) {
        const code = newContent.charCodeAt(i)
        textBytes[i * 2] = code & 0xFF
        textBytes[i * 2 + 1] = (code >> 8) & 0xFF
      }
      await writable.write(bom)
      await writable.write(textBytes)
    } else {
      const encoder = new TextEncoder()
      if (encoding === 'utf-8' && bomLength > 0) {
        await writable.write(new Uint8Array([0xEF, 0xBB, 0xBF]))
      }
      await writable.write(encoder.encode(newContent))
    }
    await writable.close()
  }

  // Get Import Config values from lines
  function getImportConfigs(lines: string[]): string[] {
    const imports: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('//')) continue
      if (!trimmed.startsWith('Import Config:')) continue
      let value = trimmed.substring('Import Config:'.length).trim()
      // Remove comments
      const commentIdx = value.indexOf('//')
      if (commentIdx !== -1) value = value.substring(0, commentIdx).trim()
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (value) imports.push(value)
    }
    return imports
  }

  // Check if lines contain Import for gen.cfg
  function hasGenImport(lines: string[]): boolean {
    return lines.some(line => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//')) return false
      return trimmed.startsWith('Import Config:') && trimmed.includes(EDITOR_OUTPUT_FILENAME)
    })
  }

  // Insert Import gen.cfg into lines
  function insertGenImport(lines: string[]): void {
    const importLine = `${INDENT}Import Config: "${EDITOR_OUTPUT_FILENAME}"`
    const lastImportIndex = lines.findLastIndex(line => {
      const trimmed = line.trim()
      return !trimmed.startsWith('//') && trimmed.startsWith('Import Config:')
    })
    if (lastImportIndex === -1) {
      // No Import Config exists, insert at first line
      lines.unshift(importLine)
    } else {
      // Insert after the last Import Config
      lines.splice(lastImportIndex + 1, 0, importLine)
    }
  }

  // Ensure gen.cfg is in Import chain
  // Logic:
  // 1. Read default.cfg, get first Import Config (A.cfg)
  // 2. If default.cfg directly imports gen.cfg → done
  // 3. Otherwise check A.cfg:
  //    - If A.cfg has Import gen.cfg → done
  //    - If not, insert Import gen.cfg into A.cfg
  async function ensureEditorImport(): Promise<void> {
    if (!dirHandle.value) return

    try {
      // Read default.cfg
      const defaultHandle = await dirHandle.value.getFileHandle(REQUIRED_FILE)
      const defaultContent = await readFileContent(defaultHandle)

      // Check if default.cfg directly imports gen.cfg
      if (hasGenImport(defaultContent.lines)) return

      // Get first Import Config from default.cfg
      const imports = getImportConfigs(defaultContent.lines)
      if (imports.length === 0) {
        // No imports in default.cfg, insert gen.cfg import
        insertGenImport(defaultContent.lines)
        await writeFileContent(defaultHandle, defaultContent.lines, defaultContent.encoding, defaultContent.bomLength)
        return
      }

      // Check first imported file (A.cfg)
      const firstImport = imports[0]
      try {
        const firstHandle = await dirHandle.value.getFileHandle(firstImport)
        const firstContent = await readFileContent(firstHandle)

        // Check if A.cfg has Import gen.cfg
        if (hasGenImport(firstContent.lines)) return

        // Insert Import gen.cfg into A.cfg
        insertGenImport(firstContent.lines)
        await writeFileContent(firstHandle, firstContent.lines, firstContent.encoding, firstContent.bomLength)
      } catch (e) {
        // First import file doesn't exist, insert into default.cfg instead
        insertGenImport(defaultContent.lines)
        await writeFileContent(defaultHandle, defaultContent.lines, defaultContent.encoding, defaultContent.bomLength)
      }
    } catch (e) {
      console.warn('Could not ensure editor import:', e)
    }
  }

  return {
    dirHandle,
    validateConfigDirectory,
    getEditorOutputHandle,
    setDirHandle,
    saveToEditorFile,
    ensureEditorImport,
    EDITOR_OUTPUT_FILENAME,
    REQUIRED_FILE
  }
}
