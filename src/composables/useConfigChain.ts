import { ref, type Ref } from 'vue'
import {
  parseConfigChainPath,
  type ConfigDirectory,
  type TauriChainNode
} from '../services/tauriApi'

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
  fullPath: string | null
  status: ChainStatusType
  children: ChainNode[]
}

// Global state
const chainRoot: Ref<ChainNode | null> = ref(null)
const rootDirHandle: Ref<ConfigDirectory | null> = ref(null)

function normalizeNode(node: TauriChainNode): ChainNode {
  return {
    file: node.file,
    path: node.path,
    fullPath: node.fullPath,
    status: node.status as ChainStatusType,
    children: node.children.map(normalizeNode)
  }
}

export function useConfigChain() {
  // Parse config chain starting from d2hackmap.default.cfg
  async function parseConfigChain(dirHandle: ConfigDirectory): Promise<ChainNode> {
    rootDirHandle.value = dirHandle
    const root = normalizeNode(await parseConfigChainPath(dirHandle.path))
    chainRoot.value = root
    return root
  }

  // Tauri resolves normal relative/absolute imports directly in Rust.
  // Pending nodes are kept for UI compatibility but should be rare.
  async function selectFileForNode(_node: ChainNode): Promise<boolean> {
    return false
  }

  // Skip a pending node
  function skipNode(node: ChainNode): void {
    node.status = ChainStatus.SKIPPED
  }

  // Get all loaded nodes as flat list (for loading into editor)
  // Returns in BFS order: level by level (breadth-first)
  function getLoadedNodes(node: ChainNode | null): ChainNode[] {
    if (!node) return []

    const result: ChainNode[] = []
    const queue: ChainNode[] = [node]
    while (queue.length > 0) {
      const n = queue.shift()!
      if (n.status === ChainStatus.LOADED && n.fullPath) {
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
      if (n.status === ChainStatus.LOADED && n.fullPath) {
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
  function hasPendingNodes(node: ChainNode | null): boolean {
    if (!node) return false
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
