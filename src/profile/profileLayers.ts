import type { BaseConfigItem, ConfigLayer, FileConfig, SaveTarget } from '../types'
import {
  ACTIVE_PROFILE_FILENAME,
  ENTRY_FILENAME,
  USER_DEFINED_FILENAME
} from './profileConstants'

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

export function classifyConfigFile(path: string): ConfigLayer {
  const name = baseName(path).toLowerCase()
  if (name === ENTRY_FILENAME.toLowerCase()) return 'entry'
  if (name === ACTIVE_PROFILE_FILENAME.toLowerCase()) return 'profile'
  if (name === USER_DEFINED_FILENAME.toLowerCase()) return 'user'
  return 'extern'
}

export function isEditableLayer(layer: ConfigLayer): boolean {
  return layer === 'profile' || layer === 'user'
}

export function saveTargetForLayer(layer: ConfigLayer): SaveTarget {
  return isEditableLayer(layer) ? layer : null
}

export function isEditableItem(item: BaseConfigItem): boolean {
  return isEditableLayer(item.layer)
}

export function isExternItem(item: BaseConfigItem): boolean {
  return item.layer === 'extern'
}

export function getFileByLayer(files: FileConfig[], layer: ConfigLayer): FileConfig | undefined {
  return files.find(file => file.layer === layer)
}
