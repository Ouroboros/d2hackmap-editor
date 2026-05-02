export interface FitTextColumnWidthOptions {
  min?: number
  max?: number
  padding?: number
  font?: string
  sampleSelector?: string
}

const DEFAULT_MIN_WIDTH = 80
const DEFAULT_MAX_WIDTH = 360
const DEFAULT_PADDING = 34
const DEFAULT_FONT = '400 14px Microsoft YaHei, 微软雅黑, sans-serif'

export function estimateTextWidth(text: string, options: FitTextColumnWidthOptions = {}): number {
  const context = getMeasureContext()
  if (!context) {
    return 0
  }

  context.font = getMeasureFont(options)
  return context.measureText(text).width
}

export function fitTextColumnWidth(
  values: Array<string | number | null | undefined>,
  header: string,
  options: FitTextColumnWidthOptions = {}
): string {
  const min = options.min ?? DEFAULT_MIN_WIDTH
  const max = options.max ?? DEFAULT_MAX_WIDTH
  const padding = options.padding ?? DEFAULT_PADDING

  let widest = estimateTextWidth(header, options)
  for (const value of values) {
    widest = Math.max(widest, estimateTextWidth(String(value ?? ''), options))
  }

  return `${Math.min(max, Math.max(min, Math.ceil(widest) + padding))}px`
}

export function fitTextColumnWidthNumber(
  values: Array<string | number | null | undefined>,
  header: string,
  options: FitTextColumnWidthOptions = {}
): number {
  return Number.parseInt(fitTextColumnWidth(values, header, options), 10)
}

let measureContext: CanvasRenderingContext2D | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext
  if (typeof document === 'undefined') return null

  measureContext = document.createElement('canvas').getContext('2d')
  return measureContext
}

function getMeasureFont(options: FitTextColumnWidthOptions): string {
  if (options.font) return options.font
  if (typeof window === 'undefined' || typeof document === 'undefined') return DEFAULT_FONT

  const sample = options.sampleSelector
    ? document.querySelector(options.sampleSelector) as HTMLElement | null
    : null
  const style = window.getComputedStyle(sample ?? document.body)
  return `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}
