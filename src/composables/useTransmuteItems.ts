import { useConfig } from './useConfig'
import { getEditableFile } from './useItemActions'
import type { BaseConfigItem } from '../types'

export type TransmuteArrayKey =
  | 'statLimits'
  | 'statLimitGroups'
  | 'itemDescriptors'
  | 'cubeFormulas'
  | 'preItemTasks'
  | 'doTasks'
  | 'keyBindings'

export function useTransmuteItems() {
  const { config } = useConfig()

  function getAllTransmuteItems<T extends BaseConfigItem>(arrayName: TransmuteArrayKey): T[] {
    if (!config.value) return []
    const result: T[] = []
    for (const fileConfig of config.value.files) {
      const array = fileConfig.data.transmute[arrayName] as unknown as T[]
      result.push(...array)
    }
    return result
  }

  function addTransmuteItemToEditable<T extends BaseConfigItem>(arrayName: TransmuteArrayKey, item: T): boolean {
    if (!config.value) return false
    const editableFile = getEditableFile(config.value)
    if (!editableFile) return false
    const array = editableFile.data.transmute[arrayName] as unknown as T[]
    array.push(item)
    return true
  }

  function deleteTransmuteItemFromFile<T extends BaseConfigItem>(item: T, arrayName: TransmuteArrayKey): boolean {
    if (!config.value) return false

    for (const fileConfig of config.value.files) {
      const array = fileConfig.data.transmute[arrayName] as unknown as T[]
      const index = array.indexOf(item)
      if (index === -1) continue

      if (!fileConfig.isEditable) return false

      if (item.isNew) {
        array.splice(index, 1)
      } else {
        item.isDeleted = true
        item.isCommented = false
      }
      return true
    }
    return false
  }

  function filterBySearch<T extends BaseConfigItem>(items: T[], searchQuery: string, ...fields: (keyof T)[]): T[] {
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter(item =>
      fields.some(field => String(item[field] ?? '').toLowerCase().includes(q))
    )
  }

  return {
    getAllTransmuteItems,
    addTransmuteItemToEditable,
    deleteTransmuteItemFromFile,
    filterBySearch
  }
}
