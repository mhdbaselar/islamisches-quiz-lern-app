import { computed } from 'vue'
import { createGlobalState, useColorMode } from '@vueuse/core'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme'

export const useThemeMode = createGlobalState(() => {
  const mode = useColorMode<ThemeMode>({
    attribute: 'class',
    selector: 'html',
    storageKey: STORAGE_KEY,
    initialValue: 'light',
  })

  const current = computed(() => mode.value)
  const isDark = computed(() => mode.value === 'dark')

  function setTheme(next: ThemeMode) {
    mode.value = next
  }

  function toggleTheme() {
    mode.value = isDark.value ? 'light' : 'dark'
  }

  return {
    mode,
    current,
    isDark,
    setTheme,
    toggleTheme,
    toggle: toggleTheme,
  }
})
