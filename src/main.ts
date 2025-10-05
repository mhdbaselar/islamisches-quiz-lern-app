import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useLocaleStore } from './stores/locale'
import { useQuizState } from './quiz/state'
import i18n from './i18n'
import { useThemeMode } from '@/stores/theme'
import { useAdminStore } from '@/stores/admin'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Initialize theme & locale before mount to avoid FOUC
useThemeMode()
useLocaleStore().init()
useQuizState().init()
useAdminStore().init()

app.mount('#app')
