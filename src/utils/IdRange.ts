/**
 * IdRange - Generic ID range type
 *
 * Supported formats:
 * - Single value: "1"
 * - List: "1,2,3"
 * - Range: "1-3"
 * - Open range: "1+" (means >= 1)
 * - Mixed: "1,2-5,10+"
 */

interface SinglePart {
  type: 'single'
  value: number
}

interface RangePart {
  type: 'range'
  start: number
  end: number
}

interface GtePart {
  type: 'gte'
  value: number
}

type RangeParts = SinglePart | RangePart | GtePart

export class IdRange {
  raw: string
  parts: RangeParts[]

  constructor(str: string) {
    this.raw = str || ''
    this.parts = this._parse(str)
  }

  /** Parse range string into parts list */
  private _parse(str: string): RangeParts[] {
    if (!str || str.trim() === '') return []

    const parts: RangeParts[] = []
    const segments = str.split(',').map(s => s.trim()).filter(s => s)

    for (const segment of segments) {
      if (segment.endsWith('+')) {
        // Open range: "3+"
        const start = parseInt(segment.slice(0, -1))
        if (!isNaN(start) && start >= 0) {
          parts.push({ type: 'gte', value: start })
        }
      } else if (segment.includes('-')) {
        // Range: "1-3"
        const [startStr, endStr] = segment.split('-')
        const start = parseInt(startStr)
        const end = parseInt(endStr)
        if (!isNaN(start) && !isNaN(end) && start >= 0 && end >= start) {
          parts.push({ type: 'range', start, end })
        }
      } else {
        // Single value: "1"
        const val = parseInt(segment)
        if (!isNaN(val) && val >= 0) {
          parts.push({ type: 'single', value: val })
        }
      }
    }

    return parts
  }

  /** Check if an ID matches this range */
  match(id: number | string): boolean {
    if (typeof id !== 'number') id = parseInt(id as string)
    if (isNaN(id)) return false

    for (const part of this.parts) {
      switch (part.type) {
        case 'single':
          if (id === part.value) return true
          break
        case 'range':
          if (id >= part.start && id <= part.end) return true
          break
        case 'gte':
          if (id >= part.value) return true
          break
      }
    }
    return false
  }

  /** Check if contains open range (like "1+") */
  hasOpenRange(): boolean {
    return this.parts.some(p => p.type === 'gte')
  }

  /** Get all enumerable IDs (excludes open range) */
  enumerate(): number[] {
    const ids: number[] = []
    for (const part of this.parts) {
      switch (part.type) {
        case 'single':
          ids.push(part.value)
          break
        case 'range':
          for (let i = part.start; i <= part.end; i++) {
            ids.push(i)
          }
          break
        // skip 'gte', cannot enumerate
      }
    }
    return ids
  }

  /**
   * Check if enumerable IDs contain invalid ones
   * @param validIds - Valid ID set
   * @returns Whether has invalid ID
   */
  hasInvalid(validIds: Map<number, unknown> | Set<number>): boolean {
    if (!validIds || validIds.size === 0) return false

    for (const part of this.parts) {
      switch (part.type) {
        case 'single':
          if (!validIds.has(part.value)) return true
          break
        case 'range':
          for (let i = part.start; i <= part.end; i++) {
            if (!validIds.has(i)) return true
          }
          break
        // skip 'gte', cannot validate
      }
    }
    return false
  }

  /**
   * Get invalid ID list
   * @param validIds - Valid ID set
   * @returns Invalid ID list
   */
  getInvalid(validIds: Map<number, unknown> | Set<number>): number[] {
    if (!validIds || validIds.size === 0) return []

    const invalid: number[] = []
    for (const part of this.parts) {
      switch (part.type) {
        case 'single':
          if (!validIds.has(part.value)) invalid.push(part.value)
          break
        case 'range':
          for (let i = part.start; i <= part.end; i++) {
            if (!validIds.has(i)) invalid.push(i)
          }
          break
      }
    }
    return invalid
  }

  /** Is empty */
  isEmpty(): boolean {
    return this.parts.length === 0
  }

  /** Return raw string */
  toString(): string {
    return this.raw
  }
}
