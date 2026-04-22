export interface FitTextColumnWidthOptions {
  min?: number
  max?: number
  padding?: number
  asciiWidth?: number
  wideWidth?: number
}

const DEFAULT_MIN_WIDTH = 80
const DEFAULT_MAX_WIDTH = 360
const DEFAULT_PADDING = 34
const DEFAULT_ASCII_WIDTH = 8
const DEFAULT_WIDE_WIDTH = 14

export function estimateTextWidth(text: string, options: FitTextColumnWidthOptions = {}): number {
  const asciiWidth = options.asciiWidth ?? DEFAULT_ASCII_WIDTH
  const wideWidth = options.wideWidth ?? DEFAULT_WIDE_WIDTH
  let width = 0

  for (const char of text) {
    width += char.charCodeAt(0) > 255 ? wideWidth : asciiWidth
  }

  return width
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

  return `${Math.min(max, Math.max(min, widest + padding))}px`
}

export function fitTextColumnWidthNumber(
  values: Array<string | number | null | undefined>,
  header: string,
  options: FitTextColumnWidthOptions = {}
): number {
  return Number.parseInt(fitTextColumnWidth(values, header, options), 10)
}
