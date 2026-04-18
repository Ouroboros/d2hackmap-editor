import { ref, type Ref } from 'vue'

// Node status constants
export const ChainStatus = {
  LOADED: 'loaded',
  PENDING: 'pending',
  SKIPPED: 'skipped',
  MISSING: 'missing',
  CIRCULAR: 'circular'
} as const

export type ChainStatusType = typeof ChainStatus[keyof typeof ChainStatus]

// Chain node type
export interface ChainNode {
  file: string
  path: string
  handle: FileSystemFileHandle | null
  status: ChainStatusType
  children: ChainNode[]
}

// Global state
const chainRoot: Ref<ChainNode | null> = ref(null)
const rootDirHandle: Ref<FileSystemDirectoryHandle | null> = ref(null)

// Parse only Import Config lines from file content
function parseImportConfigs(text: string): string[] {
  const imports: string[] = []
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed === '') continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.substring(0, colonIndex).trim()
    if (key === 'Import Config') {
      let valuePart = trimmed.substring(colonIndex + 1).trim()
      // Remove comments
      const commentIdx = valuePart.indexOf('//')
      if (commentIdx !== -1) {
        valuePart = valuePart.substring(0, commentIdx).trim()
      }
      // Remove quotes
      if ((valuePart.startsWith('"') && valuePart.endsWith('"')) ||
          (valuePart.startsWith("'") && valuePart.endsWith("'"))) {
        valuePart = valuePart.slice(1, -1)
      }
      if (valuePart) {
        imports.push(valuePart)
      }
    }
  }

  return imports
}

// Check if path is accessible (same dir or subdir)
function isAccessiblePath(importPath: string): boolean {
  // Absolute path (Windows)
  if (/^[a-zA-Z]:/.test(importPath)) return false
  // Parent directory reference
  if (importPath.startsWith('..')) return false
  // Unix absolute path
  if (importPath.startsWith('/')) return false
  return true
}

// Resolve path relative to current file's directory
function resolvePath(basePath: string, importPath: string): string {
  if (basePath === '') return importPath
  // Split base path into parts
  const parts = basePath.split('/')
  parts.pop() // Remove filename, keep directory
  // Add import path parts
  const importParts = importPath.split(/[/\\]/)
  for (const part of importParts) {
    if (part === '..') {
      parts.pop()
    } else if (part !== '.') {
      parts.push(part)
    }
  }
  return parts.join('/')
}

// Get file handle from directory handle by path
async function getFileFromPath(dirHandle: FileSystemDirectoryHandle, filePath: string): Promise<FileSystemFileHandle | null> {
  const parts = filePath.split('/')
  let currentHandle: FileSystemDirectoryHandle = dirHandle

  // Navigate to subdirectories
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i])
    } catch (e) {
      return null
    }
  }

  // Get the file
  try {
    const fileName = parts[parts.length - 1]
    const fileHandle = await currentHandle.getFileHandle(fileName)
    return fileHandle
  } catch (e) {
    return null
  }
}

// Read file content with encoding detection
async function readFileContent(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile()
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  let encoding = 'gbk'
  let bomLength = 0

  // UTF-16 LE BOM
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    encoding = 'utf-16le'
    bomLength = 2
  }
  // UTF-16 BE BOM
  else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    encoding = 'utf-16be'
    bomLength = 2
  }
  // UTF-8 BOM
  else if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    encoding = 'utf-8'
    bomLength = 3
  }

  const dataBuffer = bomLength > 0 ? buffer.slice(bomLength) : buffer
  const decoder = new TextDecoder(encoding)
  return decoder.decode(dataBuffer)
}

// Recursively parse config chain
async function parseChainNode(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
  loadedPaths: Set<string>,
  basePath: string = ''
): Promise<ChainNode> {
  const fullPath = basePath ? `${basePath}/${filePath}` : filePath
  const normalizedPath = fullPath.replace(/\\/g, '/')

  // Check circular reference
  if (loadedPaths.has(normalizedPath)) {
    return {
      file: filePath,
      path: normalizedPath,
      handle: null,
      status: ChainStatus.CIRCULAR,
      children: []
    }
  }

  // Check if path is accessible
  if (isAccessiblePath(filePath) === false) {
    return {
      file: filePath,
      path: normalizedPath,
      handle: null,
      status: ChainStatus.PENDING,
      children: []
    }
  }

  // Try to get file
  const fileHandle = await getFileFromPath(dirHandle, normalizedPath)
  if (fileHandle === null) {
    return {
      file: filePath,
      path: normalizedPath,
      handle: null,
      status: ChainStatus.MISSING,
      children: []
    }
  }

  // Mark as loaded
  loadedPaths.add(normalizedPath)

  // Parse imports
  const content = await readFileContent(fileHandle)
  const imports = parseImportConfigs(content)

  // Parse children recursively
  const children: ChainNode[] = []
  const currentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/') + 1)

  for (const importPath of imports) {
    const childNode = await parseChainNode(dirHandle, importPath, loadedPaths, currentDir)
    children.push(childNode)
  }

  return {
    file: filePath,
    path: normalizedPath,
    handle: fileHandle,
    status: ChainStatus.LOADED,
    children
  }
}

export function useConfigChain() {
  // Parse config chain starting from d2hackmap.default.cfg
  async function parseConfigChain(dirHandle: FileSystemDirectoryHandle): Promise<ChainNode> {
    rootDirHandle.value = dirHandle
    const loadedPaths = new Set<string>()

    // Start from d2hackmap.default.cfg
    const root = await parseChainNode(dirHandle, 'd2hackmap.default.cfg', loadedPaths)
    chainRoot.value = root

    return root
  }

  // Manually select file for a pending node
  async function selectFileForNode(node: ChainNode): Promise<boolean> {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'CFG Files',
          accept: { 'application/x-cfg': ['.cfg'] }
        }]
      })

      if (fileHandle === null) return false

      // Update node
      node.handle = fileHandle
      node.status = ChainStatus.LOADED

      // Parse its imports
      const content = await readFileContent(fileHandle)
      const imports = parseImportConfigs(content)

      // We can't reliably access files relative to this manually selected file,
      // so all children start as pending
      const children: ChainNode[] = []
      for (const importPath of imports) {
        children.push({
          file: importPath,
          path: importPath,
          handle: null,
          status: ChainStatus.PENDING,
          children: []
        })
      }
      node.children = children

      return true
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Failed to select file:', e)
      }
      return false
    }
  }

  // Skip a pending node
  function skipNode(node: ChainNode): void {
    node.status = ChainStatus.SKIPPED
  }

  // Get all loaded nodes as flat list (for loading into editor)
  // Returns in BFS order: level by level (breadth-first)
  function getLoadedNodes(node: ChainNode): ChainNode[] {
    const result: ChainNode[] = []
    const queue: ChainNode[] = [node]
    while (queue.length > 0) {
      const n = queue.shift()!
      if (n.status === ChainStatus.LOADED && n.handle) {
        result.push(n)
      }
      for (const child of n.children) {
        queue.push(child)
      }
    }
    return result
  }

  // Get subtree starting from a node (main config and its imports)
  function getSubtree(node: ChainNode): ChainNode[] {
    const result: ChainNode[] = []
    function collect(n: ChainNode): void {
      if (n.status === ChainStatus.LOADED && n.handle) {
        result.push(n)
      }
      for (const child of n.children) {
        collect(child)
      }
    }
    collect(node)
    return result
  }

  // Check if there are any pending nodes
  function hasPendingNodes(node: ChainNode): boolean {
    if (node.status === ChainStatus.PENDING) return true
    for (const child of node.children) {
      if (hasPendingNodes(child)) return true
    }
    return false
  }

  return {
    chainRoot,
    rootDirHandle,
    parseConfigChain,
    selectFileForNode,
    skipNode,
    getLoadedNodes,
    getSubtree,
    hasPendingNodes,
    ChainStatus
  }
}
