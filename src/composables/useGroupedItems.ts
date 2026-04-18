/**
 * Vue composable for grouped item display and operations
 * Provides convenience functions for editors working with file-based config
 */
import type {
  Config,
  ConfigData,
  FileConfig,
  BaseConfigItem
} from '../types'

export interface ItemGroup<T> {
  key: string
  items: T[]
}

/**
 * Group items by key
 * - Group order: first-seen key comes first
 * - Within group: later-loaded items come first (for display with first-wins)
 */
export function groupByKey<T>(
  items: T[],
  getKey: (item: T) => string
): ItemGroup<T>[] {
  const map = new Map<string, T[]>()
  const order: string[] = []

  for (const item of items) {
    const key = getKey(item)
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    // Later items go to front for first-wins display
    map.get(key)!.unshift(item)
  }

  return order.map(key => ({ key, items: map.get(key)! }))
}

/**
 * Get first valid (not commented/deleted) item from a group
 */
export function getEffective<T extends BaseConfigItem>(
  group: ItemGroup<T>
): T | null {
  return group.items.find(item => !item.isCommented && !item.isDeleted) ?? null
}

/**
 * Get effective items from a list, ordered by original position
 * - Iterates backwards to find effective items (later items override earlier)
 * - Returns items in original position order
 */
export function getEffectiveItems<T extends BaseConfigItem>(
  items: T[],
  getKey: (item: T) => string
): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.isCommented || item.isDeleted) continue

    const key = getKey(item)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  }

  return result.reverse()
}

// Array-type keys of ConfigData (excluding 'transmute' which is an object)
type ConfigDataArrayKey = 'toggles' | 'itemColors' | 'runeColors' | 'goldColors' | 'importItems' | 'includes'

/**
 * Get all items from all files for a given array name
 * Items are in load order (first loaded first)
 */
export function getAllItems<T extends BaseConfigItem>(
  config: Config | null,
  arrayName: ConfigDataArrayKey
): T[] {
  if (!config) return []
  const result: T[] = []
  for (const fileConfig of config.files) {
    const array = fileConfig.data[arrayName] as unknown as T[]
    result.push(...array)
  }
  return result
}

/**
 * Get the editable file from config
 */
export function getEditableFile(config: Config | null): FileConfig | undefined {
  if (!config) return undefined
  return config.files.find(f => f.isEditable)
}

/**
 * Check if an item is from an extern (non-editable) file
 * Uses the sourceFile field on the item
 */
export function isItemExtern(item: BaseConfigItem): boolean {
  return item.sourceFile !== null
}

/**
 * Get the source file name for an item
 */
export function getItemSourceFile(item: BaseConfigItem): string | null {
  return item.sourceFile
}

/**
 * Get CSS classes for item row
 */
export function getItemRowClasses(item: BaseConfigItem): Record<string, boolean> {
  return {
    'row-extern': isItemExtern(item),
    'row-commented': item.isCommented,
    'row-deleted': !!item.isDeleted
  }
}

/**
 * Add new item to the editable file's array
 */
export function addItemToEditable<T extends BaseConfigItem>(
  config: Config | null,
  arrayName: ConfigDataArrayKey,
  item: T
): boolean {
  if (!config) return false
  const editableFile = getEditableFile(config)
  if (!editableFile) return false
  const array = editableFile.data[arrayName] as unknown as T[]
  array.push(item)
  return true
}

/**
 * Delete item from its file's array
 */
export function deleteItemFromFile<T extends BaseConfigItem>(
  config: Config | null,
  item: T,
  arrayName: ConfigDataArrayKey
): boolean {
  if (!config) return false

  for (const fileConfig of config.files) {
    const array = fileConfig.data[arrayName] as unknown as T[]
    const index = array.indexOf(item)
    if (index === -1) continue

    // Can only delete from editable files
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

/**
 * Build a map of key -> index for commented/deleted main items
 * Used to find jump targets from extern items
 */
export function buildCommentedMainMap<T extends BaseConfigItem>(
  items: T[],
  getKey: (item: T) => string
): Map<string, number> {
  const map = new Map<string, number>()
  items.forEach((item, index) => {
    if (item.sourceFile === null && (item.isCommented || item.isDeleted)) {
      const key = getKey(item)
      if (!map.has(key)) {
        map.set(key, index)
      }
    }
  })
  return map
}

/**
 * Get jump target index for an extern item
 * Returns the index of the commented/deleted main item with the same key
 * Returns undefined if no jump target (item is main, or no commented main exists)
 */
export function getJumpTargetIndex<T extends BaseConfigItem>(
  item: T,
  commentedMainMap: Map<string, number>,
  getKey: (item: T) => string
): number | undefined {
  // Main items don't need jump
  if (item.sourceFile === null) return undefined
  // Non-effective extern items don't need jump
  if (item.isCommented || item.isDeleted) return undefined
  // Look up in map
  return commentedMainMap.get(getKey(item))
}

/**
 * Scroll to a row by index and highlight it briefly
 */
export function scrollToIndex(index: number, containerSelector?: string): void {
  const selector = containerSelector
    ? `${containerSelector} [data-index="${index}"]`
    : `[data-index="${index}"]`
  const row = document.querySelector(selector)
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    row.classList.add('highlight-jump')
    setTimeout(() => row.classList.remove('highlight-jump'), 3000)
  }
}
