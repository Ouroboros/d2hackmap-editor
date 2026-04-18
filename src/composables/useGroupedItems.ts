/**
 * Vue composable for grouped item display and operations
 * Provides convenience functions for editors working with file-based config
 */
import { nextTick } from 'vue'
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
const FAST_SCROLL_DURATION_MS = 140
const HIGHLIGHT_DURATION_MS = 1100
const highlightTimers = new WeakMap<Element, number>()

function animateScrollTop(container: HTMLElement, targetTop: number): void {
  const startTop = container.scrollTop
  const delta = targetTop - startTop
  if (Math.abs(delta) < 2) {
    container.scrollTop = targetTop
    return
  }

  const startTime = performance.now()
  const step = (now: number): void => {
    const progress = Math.min(1, (now - startTime) / FAST_SCROLL_DURATION_MS)
    const eased = 1 - Math.pow(1 - progress, 3)
    container.scrollTop = startTop + delta * eased
    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

function scrollRowIntoContainer(row: Element, container: HTMLElement): void {
  const rowRect = row.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const rowTop = container.scrollTop + rowRect.top - containerRect.top
  const targetTop = rowTop - (container.clientHeight - rowRect.height) / 2
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  animateScrollTop(container, Math.min(maxTop, Math.max(0, targetTop)))
}

function restartRowHighlight(row: Element): void {
  const activeTimer = highlightTimers.get(row)
  if (activeTimer !== undefined) {
    window.clearTimeout(activeTimer)
  }

  row.classList.remove('highlight-jump')
  if (row instanceof HTMLElement) {
    void row.offsetWidth
  } else {
    row.getBoundingClientRect()
  }
  row.classList.add('highlight-jump')

  const timer = window.setTimeout(() => {
    row.classList.remove('highlight-jump')
    highlightTimers.delete(row)
  }, HIGHLIGHT_DURATION_MS)
  highlightTimers.set(row, timer)
}

export function scrollToIndex(index: number, containerSelector?: string): boolean {
  const selector = containerSelector
    ? `${containerSelector} [data-index="${index}"]`
    : `[data-index="${index}"]`
  const row = document.querySelector(selector)
  if (!row) {
    return false
  }

  const container = containerSelector
    ? document.querySelector<HTMLElement>(containerSelector)
    : null

  if (container && container.scrollHeight > container.clientHeight) {
    scrollRowIntoContainer(row, container)
  } else {
    row.scrollIntoView({ behavior: 'auto', block: 'center' })
  }
  restartRowHighlight(row)
  return true
}

/**
 * Scroll to an item object after Vue has rendered the updated list.
 */
export function scrollToItemInList<T>(
  getItems: () => readonly T[],
  item: T,
  containerSelector?: string,
  isTarget?: (candidate: T, item: T) => boolean
): void {
  const findIndex = (): number => {
    const index = getItems().indexOf(item)
    if (index >= 0 || !isTarget) {
      return index
    }

    return getItems().findIndex(candidate => isTarget(candidate, item))
  }

  const runAfterFrame = (callback: () => void): void => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(callback)
    } else {
      setTimeout(callback, 0)
    }
  }

  const tryScroll = (remaining: number): void => {
    nextTick(() => {
      runAfterFrame(() => {
        const index = findIndex()
        if (index >= 0 && scrollToIndex(index, containerSelector)) return
        if (remaining > 0) {
          setTimeout(() => tryScroll(remaining - 1), 50)
        }
      })
    })
  }

  tryScroll(10)
}

/**
 * Scroll to the matching main-config item. Uses object identity first and key
 * matching as a fallback after copied items cause list recomputation.
 */
export function scrollToMainItemInList<T extends BaseConfigItem>(
  getItems: () => readonly T[],
  item: T,
  getKey: (item: T) => string,
  containerSelector?: string
): void {
  scrollToItemInList(
    getItems,
    item,
    containerSelector,
    (candidate, target) => candidate.sourceFile === null && getKey(candidate) === getKey(target)
  )
}
