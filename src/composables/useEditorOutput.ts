import { ref, type Ref } from 'vue'
import { generateConfig } from '../generator'
import {
  readConfigFile,
  saveProfileLayers,
  validateConfigDirectoryPath,
  type ConfigDirectory
} from '../services/tauriApi'
import { createEmptyConfigData, type BaseConfigItem, type Config, type ConfigData, type FileConfig } from '../types'
import {
  ENTRY_FILENAME,
  ENTRY_IMPORT_LINES,
  ACTIVE_PROFILE_FILENAME,
  USER_DEFINED_FILENAME
} from '../profile/profileConstants'
import { withProfileHeader } from '../profile/profileHeader'
import { useI18n } from '../i18n'

// Constants
export const EDITOR_OUTPUT_FILENAME = ENTRY_FILENAME
export const ACTIVE_PROFILE_OUTPUT_FILENAME = ACTIVE_PROFILE_FILENAME
export const USER_DEFINED_OUTPUT_FILENAME = USER_DEFINED_FILENAME
export const REQUIRED_FILE = 'd2hackmap.default.cfg'

// Validation result type
export type ValidateResult =
  | { ok: true }
  | { ok: false, error: 'no_permission' | 'no_required_file' | string }

// State
const dirHandle: Ref<ConfigDirectory | null> = ref(null)

export function generateEntryContent(): string {
  return ENTRY_IMPORT_LINES.map(line => `    ${line}`).join('\r\n') + '\r\n'
}

function joinConfigLines(lines: string[]): string {
  return lines.join('\r\n')
}

function normalizeConfigText(text: string): string {
  return text.split(/\r?\n/).map(line => line.trimEnd()).join('\n').trim()
}

function joinConfigPath(rootPath: string, fileName: string): string {
  const separator = rootPath.includes('\\') ? '\\' : '/'
  return `${rootPath.replace(/[\\/]+$/, '')}${separator}${fileName}`
}

function cloneProfileItem<T extends BaseConfigItem>(item: T): T {
  return {
    ...item,
    sourceFile: ACTIVE_PROFILE_FILENAME,
    layer: 'profile',
    saveTarget: 'profile'
  }
}

function mergeProfileAndUserData(profileData: ConfigData, userData: ConfigData): ConfigData {
  const merged = createEmptyConfigData()

  merged.toggles = [...profileData.toggles.map(cloneProfileItem), ...userData.toggles.map(cloneProfileItem)]
  merged.itemColors = [...profileData.itemColors.map(cloneProfileItem), ...userData.itemColors.map(cloneProfileItem)]
  merged.runeColors = [...profileData.runeColors.map(cloneProfileItem), ...userData.runeColors.map(cloneProfileItem)]
  merged.goldColors = [...profileData.goldColors.map(cloneProfileItem), ...userData.goldColors.map(cloneProfileItem)]
  merged.skillMissileDrawModes = [
    ...profileData.skillMissileDrawModes.map(cloneProfileItem),
    ...userData.skillMissileDrawModes.map(cloneProfileItem)
  ]
  merged.importItems = [...profileData.importItems.map(cloneProfileItem), ...userData.importItems.map(cloneProfileItem)]
  merged.includes = [...profileData.includes, ...userData.includes]

  merged.transmute.statLimits = [
    ...profileData.transmute.statLimits.map(cloneProfileItem),
    ...userData.transmute.statLimits.map(cloneProfileItem)
  ]
  merged.transmute.statLimitGroups = [
    ...profileData.transmute.statLimitGroups.map(cloneProfileItem),
    ...userData.transmute.statLimitGroups.map(cloneProfileItem)
  ]
  merged.transmute.itemDescriptors = [
    ...profileData.transmute.itemDescriptors.map(cloneProfileItem),
    ...userData.transmute.itemDescriptors.map(cloneProfileItem)
  ]
  merged.transmute.cubeFormulas = [
    ...profileData.transmute.cubeFormulas.map(cloneProfileItem),
    ...userData.transmute.cubeFormulas.map(cloneProfileItem)
  ]
  merged.transmute.preItemTasks = [
    ...profileData.transmute.preItemTasks.map(cloneProfileItem),
    ...userData.transmute.preItemTasks.map(cloneProfileItem)
  ]
  merged.transmute.doTasks = [
    ...profileData.transmute.doTasks.map(cloneProfileItem),
    ...userData.transmute.doTasks.map(cloneProfileItem)
  ]
  merged.transmute.keyBindings = [
    ...profileData.transmute.keyBindings.map(cloneProfileItem),
    ...userData.transmute.keyBindings.map(cloneProfileItem)
  ]

  return merged
}

export function useEditorOutput() {
  const { t } = useI18n()

  // Validate directory: check required file and read permission.
  async function validateConfigDirectory(handle: ConfigDirectory): Promise<ValidateResult> {
    const result = await validateConfigDirectoryPath(handle.path)
    if (result.ok) {
      return { ok: true }
    }

    return {
      ok: false,
      error: result.error === 'no_required_file' ? 'no_required_file' : 'no_permission'
    }
  }

  // Set the directory handle
  function setDirHandle(handle: ConfigDirectory | null): void {
    dirHandle.value = handle
  }

  function requireDirectory(): ConfigDirectory {
    if (!dirHandle.value) {
      throw new Error('No directory handle')
    }
    return dirHandle.value
  }

  function getProfileFile(config: Config): FileConfig {
    const profileFile = config.files.find(file => file.layer === 'profile')
    if (!profileFile) throw new Error('No active profile file found')
    return profileFile
  }

  function getUserFile(config: Config): FileConfig {
    const userFile = config.files.find(file => file.layer === 'user')
    if (!userFile) throw new Error('No user-defined file found')
    return userFile
  }

  function generateProfileContent(config: Config, profileNameOverride?: string): string {
    const profileFile = getProfileFile(config)
    const profileName = profileFile.profileName || t('profile.unnamed')
    return withProfileHeader(generateConfig(profileFile.data), profileNameOverride || profileName)
  }

  function generateUserContent(config: Config): string {
    return generateConfig(getUserFile(config).data)
  }

  async function readExistingLayerContent(rootPath: string, fileName: string, fallback: string): Promise<string> {
    try {
      const file = await readConfigFile(joinConfigPath(rootPath, fileName))
      return joinConfigLines(file.lines)
    } catch {
      return fallback
    }
  }

  async function writeLayers(rootPath: string, profileContent: string, userContent: string): Promise<void> {
    await saveProfileLayers(
      rootPath,
      generateEntryContent(),
      profileContent,
      userContent
    )
  }

  async function saveUserConfig(config: Config): Promise<void> {
    const rootPath = requireDirectory().path
    const profileContent = await readExistingLayerContent(
      rootPath,
      ACTIVE_PROFILE_FILENAME,
      generateProfileContent(config)
    )
    await writeLayers(rootPath, profileContent, generateUserContent(config))
  }

  async function saveCurrentProfileConfig(config: Config, profileNameOverride?: string): Promise<void> {
    const rootPath = requireDirectory().path
    const userContent = await readExistingLayerContent(
      rootPath,
      USER_DEFINED_FILENAME,
      generateUserContent(config)
    )
    await writeLayers(rootPath, generateProfileContent(config, profileNameOverride), userContent)

    if (profileNameOverride) {
      getProfileFile(config).profileName = profileNameOverride
    }
  }

  async function saveMergedProfileAs(config: Config, profileName: string): Promise<void> {
    const rootPath = requireDirectory().path
    const profileFile = getProfileFile(config)
    const userFile = getUserFile(config)
    const mergedData = mergeProfileAndUserData(profileFile.data, userFile.data)

    await writeLayers(rootPath, withProfileHeader(generateConfig(mergedData), profileName), '')
    profileFile.profileName = profileName
  }

  async function resetActiveProfileConfig(config: Config, profileName: string): Promise<void> {
    const rootPath = requireDirectory().path
    const userContent = await readExistingLayerContent(
      rootPath,
      USER_DEFINED_FILENAME,
      generateUserContent(config)
    )
    await writeLayers(rootPath, withProfileHeader('', profileName), userContent)
  }

  async function hasUnsavedProfileLayers(config: Config): Promise<boolean> {
    const rootPath = requireDirectory().path
    const profileContent = generateProfileContent(config)
    const userContent = generateUserContent(config)
    const diskProfileContent = await readExistingLayerContent(rootPath, ACTIVE_PROFILE_FILENAME, '')
    const diskUserContent = await readExistingLayerContent(rootPath, USER_DEFINED_FILENAME, '')

    return (
      normalizeConfigText(profileContent) !== normalizeConfigText(diskProfileContent) ||
      normalizeConfigText(userContent) !== normalizeConfigText(diskUserContent)
    )
  }

  return {
    dirHandle,
    validateConfigDirectory,
    setDirHandle,
    saveUserConfig,
    saveCurrentProfileConfig,
    saveMergedProfileAs,
    resetActiveProfileConfig,
    hasUnsavedProfileLayers,
    EDITOR_OUTPUT_FILENAME,
    REQUIRED_FILE
  }
}
