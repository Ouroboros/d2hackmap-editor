/**
 * File-based item movement utility
 */

import type { BaseConfigItem, Config, FileConfig } from '../types'
import { log } from './log'

// Array-type keys of ConfigData (excluding 'transmute' which is an object)
type ConfigDataArrayKey = 'toggles' | 'itemColors' | 'runeColors' | 'goldColors' | 'importItems' | 'includes'

/**
 * Move an item within its own file
 * @param config The config object
 * @param draggedItem The item being dragged
 * @param targetIndex Target index in the merged display list
 * @param arrayName The array name in ConfigData (e.g., 'itemColors')
 * @returns true if moved, false otherwise
 */
export function moveItemInFile<T extends BaseConfigItem>(
  config: Config,
  draggedItem: T,
  targetIndex: number,
  arrayName: ConfigDataArrayKey
): boolean {
  log(`[moveItemInFile] START: arrayName=${arrayName}, targetIndex=${targetIndex}`)

  // 1. Find the file containing this item
  let sourceFile: FileConfig | null = null
  let fileArray: T[] | null = null

  for (const fileConfig of config.files) {
    const array = fileConfig.data[arrayName] as unknown as T[]
    if (array.includes(draggedItem)) {
      sourceFile = fileConfig
      fileArray = array
      break
    }
  }

  if (!sourceFile || !fileArray) {
    log(`[moveItemInFile] FAIL: sourceFile or fileArray not found`)
    return false
  }

  log(`[moveItemInFile] sourceFile=${sourceFile.file}, fileArray.length=${fileArray.length}`)

  // 2. Build the merged list to understand display positions
  const allItems: T[] = []
  for (const fileConfig of config.files) {
    const array = fileConfig.data[arrayName] as unknown as T[]
    allItems.push(...array)
  }

  log(`[moveItemInFile] allItems.length=${allItems.length}`)

  // 3. Calculate target position within the source file
  // Count how many items from this file appear before targetIndex
  let fileTargetIndex = 0
  for (let i = 0; i < targetIndex && i < allItems.length; i++) {
    if (fileArray.includes(allItems[i])) {
      fileTargetIndex++
    }
  }

  // 4. Get current position in file array
  const fromIndex = fileArray.indexOf(draggedItem)
  if (fromIndex === -1) {
    log(`[moveItemInFile] FAIL: draggedItem not found in fileArray`)
    return false
  }

  log(`[moveItemInFile] fromIndex=${fromIndex}, fileTargetIndex=${fileTargetIndex}`)

  // Adjust target if dragging downward within file
  if (fromIndex < fileTargetIndex) {
    fileTargetIndex--
    log(`[moveItemInFile] adjusted fileTargetIndex=${fileTargetIndex}`)
  }

  // No move needed
  if (fromIndex === fileTargetIndex) {
    log(`[moveItemInFile] NO MOVE: fromIndex === fileTargetIndex`)
    return false
  }

  // 5. Perform the move within file array
  fileArray.splice(fromIndex, 1)
  fileArray.splice(fileTargetIndex, 0, draggedItem)

  log(`[moveItemInFile] SUCCESS: moved from ${fromIndex} to ${fileTargetIndex}`)
  return true
}

// Transmute array keys
type TransmuteArrayKey = 'statLimits' | 'statLimitGroups' | 'itemDescriptors' | 'cubeFormulas' | 'preItemTasks' | 'doTasks' | 'keyBindings'

/**
 * Move a transmute item within its own file
 */
export function moveTransmuteItemInFile<T extends BaseConfigItem>(
  config: Config,
  draggedItem: T,
  targetIndex: number,
  arrayName: TransmuteArrayKey
): boolean {
  log(`[moveTransmuteItemInFile] START: arrayName=${arrayName}, targetIndex=${targetIndex}`)

  // 1. Find the file containing this item
  let sourceFile: FileConfig | null = null
  let fileArray: T[] | null = null

  for (const fileConfig of config.files) {
    const array = fileConfig.data.transmute[arrayName] as unknown as T[]
    if (array.includes(draggedItem)) {
      sourceFile = fileConfig
      fileArray = array
      break
    }
  }

  if (!sourceFile || !fileArray) {
    log(`[moveTransmuteItemInFile] FAIL: sourceFile or fileArray not found`)
    return false
  }

  log(`[moveTransmuteItemInFile] sourceFile=${sourceFile.file}, fileArray.length=${fileArray.length}`)

  // 2. Build the merged list
  const allItems: T[] = []
  for (const fileConfig of config.files) {
    const array = fileConfig.data.transmute[arrayName] as unknown as T[]
    allItems.push(...array)
  }

  log(`[moveTransmuteItemInFile] allItems.length=${allItems.length}`)

  // 3. Calculate target position within the source file
  let fileTargetIndex = 0
  for (let i = 0; i < targetIndex && i < allItems.length; i++) {
    if (fileArray.includes(allItems[i])) {
      fileTargetIndex++
    }
  }

  // 4. Get current position in file array
  const fromIndex = fileArray.indexOf(draggedItem)
  if (fromIndex === -1) {
    log(`[moveTransmuteItemInFile] FAIL: draggedItem not found in fileArray`)
    return false
  }

  log(`[moveTransmuteItemInFile] fromIndex=${fromIndex}, fileTargetIndex=${fileTargetIndex}`)

  // Adjust target if dragging downward within file
  if (fromIndex < fileTargetIndex) {
    fileTargetIndex--
    log(`[moveTransmuteItemInFile] adjusted fileTargetIndex=${fileTargetIndex}`)
  }

  // No move needed
  if (fromIndex === fileTargetIndex) {
    log(`[moveTransmuteItemInFile] NO MOVE: fromIndex === fileTargetIndex`)
    return false
  }

  // 5. Perform the move within file array
  fileArray.splice(fromIndex, 1)
  fileArray.splice(fileTargetIndex, 0, draggedItem)

  log(`[moveTransmuteItemInFile] SUCCESS: moved from ${fromIndex} to ${fileTargetIndex}`)
  return true
}
