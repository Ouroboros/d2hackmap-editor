/**
 * Composable for common item actions (comment, delete, restore)
 * Used by all config item editors
 */

import { log } from '../utils/log'
// Re-export grouping utilities for editors
export {
  groupByKey,
  getEffective,
  getEffectiveItems,
  isItemExtern,
  getItemSourceFile,
  getItemRowClasses,
  getAllItems,
  getEditableFile,
  addItemToEditable,
  deleteItemFromFile,
  buildCommentedMainMap,
  getJumpTargetIndex,
  scrollToIndex
} from './useGroupedItems'
import {
  getAllItems as _getAllItems,
  isItemExtern,
  getItemRowClasses
} from './useGroupedItems'
import type {
  BaseConfigItem,
  Config,
  ConfigData,
  ToggleItem,
  ItemColorItem,
  RuneColorItem,
  GoldColorItem,
  ImportItemItem,
  StatLimitItem,
  StatLimitGroupItem,
  ItemDescriptorItem,
  CubeFormulaItem,
  PreItemTaskItem,
  DoTaskItem,
  KeyBindingItem
} from '../types'

/**
 * Mark an item as deleted (direct item reference)
 */
export function markDeleted(item: BaseConfigItem | null | undefined): void {
  if (!item) return
  item.isDeleted = true
  item.isCommented = false
}

/**
 * Mark an item as commented (direct item reference)
 */
export function markCommented(item: BaseConfigItem | null | undefined): void {
  if (!item) return
  item.isCommented = true
  item.isDeleted = false
}

/**
 * Mark an item as restored (direct item reference)
 */
export function markRestored(item: BaseConfigItem | null | undefined): void {
  if (!item) return
  item.isCommented = false
  item.isDeleted = false
}

/**
 * Check if item is disabled (commented or deleted)
 */
export function isItemDisabled(item: BaseConfigItem): boolean {
  return item.isCommented || !!item.isDeleted
}

/**
 * Check if item is effective (not commented/deleted)
 */
export function isItemEffective(item: BaseConfigItem): boolean {
  return !item.isCommented && !item.isDeleted
}

// ========== Key Functions ==========

export function getToggleKey(item: ToggleItem): string {
  return item.name
}

export function getItemColorKey(item: ItemColorItem): string {
  return `${item.itemId}|${item.quality}|${item.ethereal}|${item.sockets}`
}

export function getRuneColorKey(item: RuneColorItem): string {
  return item.range
}

export function getGoldColorKey(item: GoldColorItem): string {
  return item.range
}

export function getImportItemKey(item: ImportItemItem): string {
  return `${item.itemId}|${item.quality}|${item.ethereal}|${item.sockets}`
}

export function getStatLimitKey(item: StatLimitItem): string {
  return item.name || ''
}

export function getStatLimitGroupKey(item: StatLimitGroupItem): string {
  return item.name
}

export function getItemDescriptorKey(item: ItemDescriptorItem): string {
  return item.name
}

export function getCubeFormulaKey(item: CubeFormulaItem): string {
  return item.name
}

export function getPreItemTaskKey(item: PreItemTaskItem): string {
  return item.name
}

export function getDoTaskKey(item: DoTaskItem): string {
  return item.name
}

export function getKeyBindingKey(item: KeyBindingItem): string {
  return item.keyCode
}

// ========== Effective Status Calculation ==========

/**
 * Update effective status for items
 * Later loaded items (later in array) override earlier ones
 * Traverse from end to find effective items
 */
function updateEffectiveStatus<T extends BaseConfigItem>(
  items: T[],
  getKey: (item: T) => string,
  debugLabel?: string
): void {
  const seen = new Set<string>()

  // Traverse from end - first valid item for each key is effective
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.isCommented || item.isDeleted) {
      item.isEffective = false
      continue
    }

    const key = getKey(item)
    const wasEffective = item.isEffective
    if (seen.has(key)) {
      item.isEffective = false
    } else {
      seen.add(key)
      item.isEffective = true
    }

    if (debugLabel && wasEffective !== item.isEffective) {
      log(`[${debugLabel}] Item ${i} effective: ${wasEffective} -> ${item.isEffective}, key=${key}`)
    }
  }
}

// Transmute array keys
type TransmuteArrayKey = 'statLimits' | 'statLimitGroups' | 'itemDescriptors' | 'cubeFormulas' | 'preItemTasks' | 'doTasks' | 'keyBindings'

/**
 * Get all transmute items from all files
 */
function getAllTransmuteItems<T extends BaseConfigItem>(
  config: Config,
  arrayName: TransmuteArrayKey
): T[] {
  const result: T[] = []
  for (const fileConfig of config.files) {
    const array = fileConfig.data.transmute[arrayName] as unknown as T[]
    result.push(...array)
  }
  return result
}

/**
 * Refresh isEffective status for all config items
 * Call this after loading, operations, or reordering
 */
export function refreshEffectiveStatus(config: Config, debug = false): void {
  const label = debug ? 'refresh' : undefined

  // Collect all items and update effective status
  const allToggles = _getAllItems<ToggleItem>(config, 'toggles')
  const allItemColors = _getAllItems<ItemColorItem>(config, 'itemColors')
  const allRuneColors = _getAllItems<RuneColorItem>(config, 'runeColors')
  const allGoldColors = _getAllItems<GoldColorItem>(config, 'goldColors')
  const allImportItems = _getAllItems<ImportItemItem>(config, 'importItems')

  updateEffectiveStatus(allToggles, getToggleKey, label)
  updateEffectiveStatus(allItemColors, getItemColorKey, label)
  updateEffectiveStatus(allRuneColors, getRuneColorKey, label)
  updateEffectiveStatus(allGoldColors, getGoldColorKey, label)
  updateEffectiveStatus(allImportItems, getImportItemKey, label)

  // Transmute items
  const allStatLimits = getAllTransmuteItems<StatLimitItem>(config, 'statLimits')
  const allStatLimitGroups = getAllTransmuteItems<StatLimitGroupItem>(config, 'statLimitGroups')
  const allItemDescriptors = getAllTransmuteItems<ItemDescriptorItem>(config, 'itemDescriptors')
  const allCubeFormulas = getAllTransmuteItems<CubeFormulaItem>(config, 'cubeFormulas')
  const allPreItemTasks = getAllTransmuteItems<PreItemTaskItem>(config, 'preItemTasks')
  const allDoTasks = getAllTransmuteItems<DoTaskItem>(config, 'doTasks')
  const allKeyBindings = getAllTransmuteItems<KeyBindingItem>(config, 'keyBindings')

  updateEffectiveStatus(allStatLimits, getStatLimitKey, label)
  updateEffectiveStatus(allStatLimitGroups, getStatLimitGroupKey, label)
  updateEffectiveStatus(allItemDescriptors, getItemDescriptorKey, label)
  updateEffectiveStatus(allCubeFormulas, getCubeFormulaKey, label)
  updateEffectiveStatus(allPreItemTasks, getPreItemTaskKey, label)
  updateEffectiveStatus(allDoTasks, getDoTaskKey, label)
  updateEffectiveStatus(allKeyBindings, getKeyBindingKey, label)
}

/**
 * Composable hook for item actions
 */
export function useItemActions() {
  return {
    // Direct item operations
    markDeleted,
    markCommented,
    markRestored,
    // Status checks
    isItemDisabled,
    isItemEffective,
    isItemExtern,
    getItemRowClasses,
    // Effective status refresh
    refreshEffectiveStatus
  }
}
