import { invoke } from '@tauri-apps/api/core'

export interface ConfigDirectory {
  path: string
  name: string
}

export type ValidateResult =
  | { ok: true; error?: null }
  | { ok: false; error: 'no_permission' | 'no_required_file' | string }

export type ChainStatusType = 'loaded' | 'pending' | 'skipped' | 'missing' | 'circular'

export interface TauriChainNode {
  file: string
  path: string
  fullPath: string | null
  status: ChainStatusType
  children: TauriChainNode[]
}

export interface ConfigFileContent {
  name: string
  path: string
  lines: string[]
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function pickConfigDirectory(startDir?: string | null): Promise<ConfigDirectory | null> {
  return invoke<ConfigDirectory | null>('pick_config_directory', {
    startDir: startDir || null
  })
}

export async function validateConfigDirectoryPath(path: string): Promise<ValidateResult> {
  return invoke<ValidateResult>('validate_config_directory', { path })
}

export async function parseConfigChainPath(rootPath: string): Promise<TauriChainNode> {
  return invoke<TauriChainNode>('parse_config_chain', { rootPath })
}

export async function readConfigFile(path: string): Promise<ConfigFileContent> {
  return invoke<ConfigFileContent>('read_config_file', { path })
}

export async function saveEditorOutput(rootPath: string, content: string): Promise<void> {
  return invoke<void>('save_editor_output', { rootPath, content })
}

export async function appendDebugLog(message: string): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string>('append_debug_log', { message })
}
