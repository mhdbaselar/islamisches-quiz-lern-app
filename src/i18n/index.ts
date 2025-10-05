import { createI18n } from 'vue-i18n'

// Dynamic import of locale modules ensures modular growth
import de from '@/locales/de/common'
import en from '@/locales/en/common'
import ar from '@/locales/ar/common'

export type Locale = 'de' | 'en' | 'ar'

export const rtlLocales: Locale[] = ['ar']

export function updateHtmlLangAndDir(locale: Locale) {
    const html = document.documentElement
    const isRtl = rtlLocales.includes(locale)
    html.setAttribute('lang', locale)
    html.setAttribute('dir', isRtl ? 'rtl' : 'ltr')
}

export const messages = {
    de,
    en,
    ar,
}

const defaultLocale: Locale = 'de'

export const i18n = createI18n({
    legacy: false,
    locale: defaultLocale,
    fallbackLocale: 'en',
    messages,
})

// initialize html attributes
if (typeof document !== 'undefined') {
    updateHtmlLangAndDir(defaultLocale)
}

export default i18n
