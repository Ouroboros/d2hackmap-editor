import { ref } from 'vue'

export type DisplayOrder = 'file' | 'effective'

const DISPLAY_ORDER_KEY = 'd2hackmap-displayOrder'

function loadDisplayOrder(): DisplayOrder {
  try {
    const value = localStorage.getItem(DISPLAY_ORDER_KEY)
    return value === 'effective' ? 'effective' : 'file'
  } catch {
    return 'file'
  }
}

const displayOrder = ref<DisplayOrder>(loadDisplayOrder())

export function useDisplayOrder() {
  function setDisplayOrder(order: DisplayOrder): void {
    displayOrder.value = order
    try {
      localStorage.setItem(DISPLAY_ORDER_KEY, order)
    } catch {
      // Ignore storage failures; display order still updates for this session.
    }
  }

  function applyDisplayOrder<T>(items: T[]): T[] {
    return displayOrder.value === 'effective' ? [...items].reverse() : items
  }

  function sortByFileOrder<T>(items: T[], fileOrderedItems: T[]): T[] {
    const order = new Map<T, number>()
    fileOrderedItems.forEach((item, index) => {
      order.set(item, index)
    })

    return [...items].sort((a, b) =>
      (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER)
    )
  }

  function getRealDropTargetIndex(
    sourceDisplayIndex: number,
    targetDisplayIndex: number,
    targetRealIndex: number
  ): number {
    const insertAfterTargetInDisplay = sourceDisplayIndex < targetDisplayIndex
    const insertAfterTargetInFile =
      displayOrder.value === 'file'
        ? insertAfterTargetInDisplay
        : !insertAfterTargetInDisplay

    return insertAfterTargetInFile ? targetRealIndex + 1 : targetRealIndex
  }

  return {
    displayOrder,
    setDisplayOrder,
    applyDisplayOrder,
    sortByFileOrder,
    getRealDropTargetIndex
  }
}
