import { ref, computed, type Ref, type ComputedRef } from 'vue'
import itemsData from '../../data/items.json'
import statsData from '../../data/stats.json'

// Reference item type
export interface ReferenceItem {
  id: number | null
  name?: string
  code?: string
  [key: string]: unknown
}

// Reference stat type
export interface ReferenceStat {
  id: number | null
  name?: string
  code?: string
  [key: string]: unknown
}

// Reference data state - directly loaded from imported JSON
const items = ref<ReferenceItem[]>(itemsData as ReferenceItem[])
const stats = ref<ReferenceStat[]>(statsData as ReferenceStat[])
const loaded = ref(true)
const loading = ref(false)

// Create a Map for fast ID lookup
const itemsMap: ComputedRef<Map<number, ReferenceItem>> = computed(() => {
  const map = new Map<number, ReferenceItem>()
  for (const item of items.value) {
    if (item.id != null) {
      map.set(item.id, item)
    }
  }
  return map
})

// Load reference data (now synchronous since data is imported)
function loadReferenceData(): void {
  // Data already loaded via import
}

export function useReferenceData() {
  // Search items by query
  function searchItems(query: string, limit: number = 20): ReferenceItem[] {
    if (!query || !items.value.length) return items.value.slice(0, limit)

    const q = query.toLowerCase()
    return items.value
      .filter(item =>
        item.id?.toString().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q)
      )
      .slice(0, limit)
  }

  // Search stats by query
  function searchStats(query: string, limit: number = 20): ReferenceStat[] {
    if (!query || !stats.value.length) return stats.value.slice(0, limit)

    const q = query.toLowerCase()
    return stats.value
      .filter(stat =>
        stat.id?.toString().includes(q) ||
        stat.name?.toLowerCase().includes(q) ||
        stat.code?.toLowerCase().includes(q)
      )
      .slice(0, limit)
  }

  // Get item by ID
  function getItemById(id: string | number | null | undefined): ReferenceItem | undefined {
    return items.value.find(item => item.id?.toString() === id?.toString())
  }

  // Get stat by ID
  function getStatById(id: string | number | null | undefined): ReferenceStat | undefined {
    return stats.value.find(stat => stat.id?.toString() === id?.toString())
  }

  return {
    items,
    itemsMap,
    stats,
    loaded,
    loading,
    loadReferenceData,
    searchItems,
    searchStats,
    getItemById,
    getStatById
  }
}
