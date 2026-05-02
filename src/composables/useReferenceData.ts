import { ref, computed, type Ref, type ComputedRef } from 'vue'
import itemsData from '../../data/items.json'
import statsData from '../../data/isc.json'
import { appendDebugLog, readExternalIscJson } from '../services/tauriApi'

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

// Reference data state - built-in data is loaded first, then EXE-side isc.json can override/append stats.
const items = ref<ReferenceItem[]>(itemsData as ReferenceItem[])
const stats = ref<ReferenceStat[]>(statsData as ReferenceStat[])
const loaded = ref(true)
const loading = ref(false)
let externalStatsLoadStarted = false

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

function normalizeStat(stat: unknown): ReferenceStat | null {
  if (!stat || typeof stat !== 'object') return null
  const item = stat as Record<string, unknown>
  const id = Number(item.id)
  if (!Number.isFinite(id)) return null
  return {
    ...item,
    id
  } as ReferenceStat
}

function mergeStats(baseStats: ReferenceStat[], externalStats: ReferenceStat[]): ReferenceStat[] {
  const merged = [...baseStats]
  const indexById = new Map<number, number>()

  for (let i = 0; i < merged.length; i++) {
    if (merged[i].id != null) {
      indexById.set(Number(merged[i].id), i)
    }
  }

  for (const stat of externalStats) {
    if (stat.id == null) continue
    const id = Number(stat.id)
    const index = indexById.get(id)
    if (index == null) {
      indexById.set(id, merged.length)
      merged.push(stat)
    } else {
      merged[index] = stat
    }
  }

  return merged.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
}

async function loadExternalStats(): Promise<void> {
  try {
    const content = await readExternalIscJson()
    if (!content) return

    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      throw new Error('isc.json root must be an array')
    }

    const externalStats = parsed
      .map(normalizeStat)
      .filter((stat): stat is ReferenceStat => stat !== null)

    stats.value = mergeStats(statsData as ReferenceStat[], externalStats)
    await appendDebugLog(`[reference] loaded isc.json: ${externalStats.length} valid stat entries`)
  } catch (err) {
    await appendDebugLog(`[reference] failed to load isc.json: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function loadReferenceData(): void {
  if (externalStatsLoadStarted) return
  externalStatsLoadStarted = true
  void loadExternalStats()
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
