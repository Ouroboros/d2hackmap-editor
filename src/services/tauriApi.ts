import { invoke } from '@tauri-apps/api/core'
import { parseProfileName } from '../profile/profileHeader'

export interface ConfigDirectory {
  path: string
  name: string
}

export type ValidateResult =
  | { ok: true; error?: null }
  | { ok: false; error: 'no_permission' | 'no_required_file' | string }

export type ChainStatusType = 'loaded' | 'pending' | 'skipped' | 'missing' | 'circular'

export interface ResolvedConfigPath {
  file: string
  path: string
  fullPath: string | null
  status: ChainStatusType
}

export interface ConfigFileContent {
  name: string
  path: string
  lines: string[]
}

export interface ProfileScaffoldResult {
  entryPath: string
  activeProfilePath: string
  userDefinedPath: string
  previousEntryContent: string | null
}

interface ProfileFile {
  file: string
  path: string
}

export interface ProfileInfo {
  name: string
  file: string
  path: string
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

export async function readConfigFile(path: string): Promise<ConfigFileContent> {
  return invoke<ConfigFileContent>('read_config_file', { path })
}

export async function resolveConfigPath(
  rootPath: string,
  baseFilePath: string,
  importPath: string
): Promise<ResolvedConfigPath> {
  return invoke<ResolvedConfigPath>('resolve_config_path', {
    rootPath,
    baseFilePath,
    importPath
  })
}

export async function ensureProfileScaffold(
  rootPath: string,
  entryContent: string,
  initialProfileContent: string,
  initialUserContent: string
): Promise<ProfileScaffoldResult> {
  return invoke<ProfileScaffoldResult>('ensure_profile_scaffold', {
    rootPath,
    entryContent,
    initialProfileContent,
    initialUserContent
  })
}

export async function saveProfileLayers(
  rootPath: string,
  entryContent: string,
  profileContent: string,
  userContent: string
): Promise<void> {
  return invoke<void>('save_profile_layers', {
    rootPath,
    entryContent,
    profileContent,
    userContent
  })
}

export async function listEditorProfiles(): Promise<ProfileInfo[]> {
  const files = await invoke<ProfileFile[]>('list_editor_profiles')
  const profiles = await Promise.all(
    files.map(async profileFile => {
      const content = await readConfigFile(profileFile.path)
      const fallbackName = profileFile.file.replace(/\.cfg$/i, '')
      const name = parseProfileName(content.lines) || fallbackName
      return {
        name,
        file: profileFile.file,
        path: profileFile.path
      }
    })
  )

  return profiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

export async function switchEditorProfile(rootPath: string, profileFile: string): Promise<void> {
  return invoke<void>('switch_editor_profile', { rootPath, profileFile })
}

export async function deleteEditorProfile(profileFile: string): Promise<void> {
  return invoke<void>('delete_editor_profile', { profileFile })
}

export async function saveActiveProfileToLibrary(
  rootPath: string,
  profileName: string
): Promise<ProfileInfo> {
  const file = profileNameToFileName(profileName)
  const saved = await invoke<ProfileFile>('save_active_profile_to_library', {
    rootPath,
    profileFile: file
  })

  return {
    name: profileName.trim() || saved.file.replace(/\.cfg$/i, ''),
    file: saved.file,
    path: saved.path
  }
}

function profileNameToFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
  return `${cleaned || 'unnamed-profile'}.cfg`
}

export async function appendDebugLog(message: string): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string>('append_debug_log', { message })
}

export async function readExternalIscJson(): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string | null>('read_external_isc_json')
}
