import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'app.quiz.admin-mode'
const PIN_STORAGE_KEY = 'app.quiz.admin-pin'
const MIN_PIN_LENGTH = 4

function readStoredFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeStoredFlag(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (enabled) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore storage errors */
  }
}

function readStoredPin(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY)
    return raw && raw.trim().length ? raw.trim() : null
  } catch {
    return null
  }
}

function writeStoredPin(pin: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PIN_STORAGE_KEY, pin)
  } catch {
    /* ignore storage errors */
  }
}

function resolveDefaultPin(): string {
  const fromEnv = import.meta.env.VITE_ADMIN_PIN
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim()
  }
  return '1234'
}

export const useAdminStore = defineStore('admin', () => {
  const isAdmin = ref(false)
  const pendingRoute = ref<string | null>(null)
  const initialized = ref(false)
  const currentPin = ref<string>(readStoredPin() ?? resolveDefaultPin())

  const expectedPin = computed(() => currentPin.value)

  function init() {
    if (initialized.value) return
    isAdmin.value = readStoredFlag()
    const stored = readStoredPin()
    currentPin.value = stored ?? resolveDefaultPin()
    initialized.value = true
  }

  watch(isAdmin, (next) => {
    if (!initialized.value) return
    writeStoredFlag(next)
  })

  watch(currentPin, (next) => {
    if (!initialized.value) return
    writeStoredPin(next)
  })

  function login(pin: string) {
    const sanitized = typeof pin === 'string' ? pin.trim() : ''
    if (!sanitized) return false
    if (sanitized === expectedPin.value) {
      isAdmin.value = true
      return true
    }
    return false
  }

  function logout() {
    isAdmin.value = false
  }

  function changePin(current: string, next: string) {
    if (!initialized.value) init()
    if (!isAdmin.value) return { success: false, error: 'not-admin' as const }

    const sanitizedCurrent = typeof current === 'string' ? current.trim() : ''
    const sanitizedNext = typeof next === 'string' ? next.trim() : ''

    if (!sanitizedCurrent || sanitizedCurrent !== expectedPin.value) {
      return { success: false, error: 'invalid-current' as const }
    }

    if (sanitizedNext.length < MIN_PIN_LENGTH) {
      return { success: false, error: 'invalid-new' as const }
    }

    currentPin.value = sanitizedNext
    writeStoredPin(sanitizedNext)
    return { success: true as const }
  }

  function setPendingRoute(path: string | null) {
    pendingRoute.value = path
  }

  function consumePendingRoute() {
    const path = pendingRoute.value
    pendingRoute.value = null
    return path
  }

  return {
    isAdmin,
    init,
    login,
    logout,
    changePin,
    setPendingRoute,
    consumePendingRoute,
  }
})
