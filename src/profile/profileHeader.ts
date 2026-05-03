import { PROFILE_HEADER_PREFIX } from './profileConstants'

export function parseProfileName(lines: string[]): string {
  const firstLine = lines[0]?.trim() ?? ''
  if (!firstLine.startsWith(PROFILE_HEADER_PREFIX)) return ''
  return firstLine.slice(PROFILE_HEADER_PREFIX.length).trim()
}

export function withProfileHeader(content: string, profileName: string): string {
  const normalizedName = profileName.trim()
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim().startsWith(PROFILE_HEADER_PREFIX)) {
    lines.shift()
  }
  const header = `${PROFILE_HEADER_PREFIX} ${normalizedName || '未命名 Profile'}`
  return [header, '', ...lines].join('\r\n').replace(/\r\n+$/g, '\r\n')
}
