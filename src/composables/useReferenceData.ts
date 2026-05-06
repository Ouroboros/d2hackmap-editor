import { ref, computed, type Ref, type ComputedRef } from 'vue'
import itemsData from '../../data/items.json'
import statsData from '../../data/isc.json'
import skillsData from '../../data/skills.json'
import { appendDebugLog, readExternalIscJson, readExternalSkillsJson } from '../services/tauriApi'

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

// Reference skill type
export interface ReferenceSkill {
  id: number | null
  name?: string
  classCode?: string
  [key: string]: unknown
}

// Reference data state - built-in data is loaded first, then EXE-side JSON can override/append by ID.
const items = ref<ReferenceItem[]>(itemsData as ReferenceItem[])
const stats = ref<ReferenceStat[]>(statsData as ReferenceStat[])
const skills = ref<ReferenceSkill[]>(skillsData as ReferenceSkill[])
const loaded = ref(true)
const loading = ref(false)
let externalReferenceLoadStarted = false

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

const skillsMap: ComputedRef<Map<number, ReferenceSkill>> = computed(() => {
  const map = new Map<number, ReferenceSkill>()
  for (const skill of skills.value) {
    if (skill.id != null) {
      map.set(skill.id, skill)
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

function normalizeSkill(skill: unknown): ReferenceSkill | null {
  if (!skill || typeof skill !== 'object') return null
  const item = skill as Record<string, unknown>
  const id = Number(item.id)
  if (!Number.isFinite(id)) return null
  return {
    ...item,
    id
  } as ReferenceSkill
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

function mergeSkills(baseSkills: ReferenceSkill[], externalSkills: ReferenceSkill[]): ReferenceSkill[] {
  const merged = [...baseSkills]
  const indexById = new Map<number, number>()

  for (let i = 0; i < merged.length; i++) {
    if (merged[i].id != null) {
      indexById.set(Number(merged[i].id), i)
    }
  }

  for (const skill of externalSkills) {
    if (skill.id == null) continue
    const id = Number(skill.id)
    const index = indexById.get(id)
    if (index == null) {
      indexById.set(id, merged.length)
      merged.push(skill)
    } else {
      merged[index] = skill
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
  if (externalReferenceLoadStarted) return
  externalReferenceLoadStarted = true
  void loadExternalStats()
  void loadExternalSkills()
}

async function loadExternalSkills(): Promise<void> {
  try {
    const content = await readExternalSkillsJson()
    if (!content) return

    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      throw new Error('skills.json root must be an array')
    }

    const externalSkills = parsed
      .map(normalizeSkill)
      .filter((skill): skill is ReferenceSkill => skill !== null)

    skills.value = mergeSkills(skillsData as ReferenceSkill[], externalSkills)
    await appendDebugLog(`[reference] loaded skills.json: ${externalSkills.length} valid skill entries`)
  } catch (err) {
    await appendDebugLog(`[reference] failed to load skills.json: ${err instanceof Error ? err.message : String(err)}`)
  }
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

  // Search skills by query
  function searchSkills(query: string, limit: number = 20): ReferenceSkill[] {
    if (!query || !skills.value.length) return skills.value.slice(0, limit)

    const q = query.toLowerCase()
    return skills.value
      .filter(skill =>
        skill.id?.toString().includes(q) ||
        skill.name?.toLowerCase().includes(q) ||
        skill.classCode?.toLowerCase().includes(q)
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

  // Get skill by ID
  function getSkillById(id: string | number | null | undefined): ReferenceSkill | undefined {
    return skills.value.find(skill => skill.id?.toString() === id?.toString())
  }

  return {
    items,
    itemsMap,
    stats,
    skills,
    skillsMap,
    loaded,
    loading,
    loadReferenceData,
    searchItems,
    searchStats,
    searchSkills,
    getItemById,
    getStatById,
    getSkillById
  }
}
