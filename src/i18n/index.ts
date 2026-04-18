import zhCN from './zh-CN'

type LocaleMessages = Record<string, string>

const locales: Record<string, LocaleMessages> = {
  'zh-CN': zhCN
}

let currentLocale: LocaleMessages = zhCN

export interface I18n {
  t: (key: string, params?: Record<string, string | number>) => string
  setLocale: (lang: string) => void
}

export function useI18n(): I18n {
  function t(key: string, params: Record<string, string | number> = {}): string {
    let text = currentLocale[key] || key
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v))
    })
    return text
  }

  function setLocale(lang: string): void {
    currentLocale = locales[lang] || zhCN
  }

  return { t, setLocale }
}
