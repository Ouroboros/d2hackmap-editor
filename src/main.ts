import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import zhCN from './i18n/zh-CN'

// Simple pre-Vue i18n lookup
function t(key: string): string {
  return zhCN[key] || key
}

// Browser compatibility check
function checkBrowserCompatibility(): boolean {
  const errors: string[] = []

  if (typeof TextDecoder === 'undefined') {
    errors.push('TextDecoder API')
  } else {
    try {
      new TextDecoder('gbk')
    } catch (e) {
      errors.push('GBK encoding')
    }
  }

  if (typeof FileReader === 'undefined') {
    errors.push('FileReader API')
  }

  if (typeof Blob === 'undefined') {
    errors.push('Blob API')
  }

  if (errors.length > 0) {
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif; background: #1e1e1e; color: #e0e0e0; min-height: 100vh;">
        <h1 style="color: #ff6b6b;">${t('browser.notSupported')}</h1>
        <p>${t('browser.useModern')}</p>
        <ul style="list-style: none; padding: 0;">
          <li>Chrome 61+ (2017)</li>
          <li>Firefox 55+ (2017)</li>
          <li>Edge 79+ (2020)</li>
          <li>Safari 14.1+ (2021)</li>
        </ul>
        <p style="color: #888; margin-top: 20px;">
          ${t('browser.missingFeatures')} ${errors.join(', ')}
        </p>
      </div>
    `
    return false
  }
  return true
}

if (checkBrowserCompatibility()) {
  createApp(App).mount('#app')
}
