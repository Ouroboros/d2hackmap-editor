import { ref, watchEffect } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'cfg-editor-theme'
const theme = ref<Theme>((localStorage.getItem(STORAGE_KEY) as Theme) || 'system')

function applyTheme(value: Theme): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')

  if (value === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    root.classList.add(value)
  }
}

// Watch for changes
watchEffect(() => {
  applyTheme(theme.value)
  localStorage.setItem(STORAGE_KEY, theme.value)
})

// Listen for OS preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') {
    applyTheme('system')
  }
})

export function useTheme() {
  function setTheme(value: Theme): void {
    theme.value = value
  }

  return { theme, setTheme }
}
