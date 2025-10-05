import { defineStore } from 'pinia'
import { i18n, updateHtmlLangAndDir, type Locale } from '@/i18n'

const STORAGE_KEY = 'app.locale'

export const useLocaleStore = defineStore('locale', {
    state: () => ({
        current: (localStorage.getItem(STORAGE_KEY) as Locale | null) || 'de',
    }),
    actions: {
        setLocale(locale: Locale) {
            this.current = locale
            i18n.global.locale.value = locale
            updateHtmlLangAndDir(locale)
            localStorage.setItem(STORAGE_KEY, locale)
        },
        init() {
            this.setLocale(this.current)
        },
    },
})
