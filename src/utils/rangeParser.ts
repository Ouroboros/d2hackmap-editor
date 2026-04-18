/**
 * Range Parser & Builder
 *
 * Supported formats:
 * - Single value: 1, 3, 4
 * - List: 1,2,3,4
 * - Range: 1-3, 4-6
 * - Lower bound+: 1+ (means 1~max)
 * - Mixed: 1,2-3,4,5-6,7+
 */

/**
 * Parse range string, return selected number set
 * @param str - Range string
 * @param max - Max value (for + syntax)
 * @returns Selected number set
 */
export function parseRange(str: string, max: number = 255): Set<number> {
  const selected = new Set<number>()
  if (!str || str.trim() === '') return selected

  const parts = str.split(',').map(s => s.trim()).filter(s => s)

  for (const part of parts) {
    if (part.endsWith('+')) {
      // Range from value to max: "3+"
      const start = parseInt(part.slice(0, -1))
      if (!isNaN(start) && start >= 0) {
        for (let i = start; i <= max; i++) {
          selected.add(i)
        }
      }
    } else if (part.includes('-')) {
      // Range: "1-3"
      const [startStr, endStr] = part.split('-')
      const start = parseInt(startStr)
      const end = parseInt(endStr)
      if (!isNaN(start) && !isNaN(end) && start >= 0 && end >= start) {
        for (let i = start; i <= Math.min(end, max); i++) {
          selected.add(i)
        }
      }
    } else {
      // Single value: "1"
      const val = parseInt(part)
      if (!isNaN(val) && val >= 0 && val <= max) {
        selected.add(val)
      }
    }
  }

  return selected
}

/**
 * Build optimized range string from selected set
 * @param selected - Selected number set
 * @param max - Max value (for + syntax)
 * @returns Optimized range string
 */
export function buildRange(selected: Set<number> | number[], max: number = 255): string {
  const set = selected instanceof Set ? selected : new Set(selected)

  if (set.size === 0) return ''

  const sorted = Array.from(set).sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0

  while (i < sorted.length) {
    const start = sorted[i]
    let end = start

    // Find consecutive range
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) {
      i++
      end = sorted[i]
    }

    if (end === max && end > start) {
      // Range goes to max: use + syntax
      parts.push(`${start}+`)
    } else if (end > start + 1) {
      // Range of 3+: use range syntax
      parts.push(`${start}-${end}`)
    } else if (end > start) {
      // Range of 2: just list them
      parts.push(`${start},${end}`)
    } else {
      // Single value
      parts.push(`${start}`)
    }

    i++
  }

  return parts.join(',')
}

/**
 * Check if value is in range string
 */
export function isInRange(str: string, value: number, max: number = 255): boolean {
  return parseRange(str, max).has(value)
}

/**
 * Toggle value selection state
 * @returns New range string
 */
export function toggleInRange(str: string, value: number, max: number = 255): string {
  const selected = parseRange(str, max)
  if (selected.has(value)) {
    selected.delete(value)
  } else {
    selected.add(value)
  }
  return buildRange(selected, max)
}
