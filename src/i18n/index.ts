import { en } from './en'
import { ru } from './ru'
import type { AppStrings } from './en'

export type Lang = 'ru' | 'en'

const CIS = ['ru', 'kk', 'be', 'uk', 'uz', 'ky', 'tg', 'az', 'hy', 'ka', 'mn']

export function detectLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const code = locale.split('-')[0].toLowerCase()
    return CIS.includes(code) ? 'ru' : 'en'
  } catch {
    return 'en'
  }
}

// Mutable object — Object.assign replaces top-level keys; remount propagates changes
export const s: AppStrings = { ...en }
export let lang: Lang = detectLang()

export function applyLang(l: Lang) {
  lang = l
  Object.assign(s, l === 'ru' ? ru : en)
}

applyLang(lang)
