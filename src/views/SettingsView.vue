<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute, type LocationQueryRaw } from 'vue-router'
import { useLocaleStore } from '@/stores/locale'
import type { Locale } from '@/i18n'
import { Sun, Moon } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeading from '@/components/ui/PageHeading.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useThemeMode } from '@/stores/theme'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const locale = useLocaleStore()
const { isDark, toggleTheme } = useThemeMode()
const admin = useAdminStore()
const router = useRouter()
const route = useRoute()

const showAdminModal = ref(false)
const adminPin = ref('')
const adminError = ref('')
const pinInput = ref<HTMLInputElement | null>(null)
const showChangePinModal = ref(false)
const showChangePinSuccessModal = ref(false)
const changeCurrentPin = ref('')
const changeNewPin = ref('')
const changeConfirmPin = ref('')
const changePinError = ref('')
const changePinSuccess = ref('')
const changePinCurrentInput = ref<HTMLInputElement | null>(null)

const adminStatusText = computed(() => (admin.isAdmin ? t('settings.adminActive') : t('settings.adminDesc')))

function onChangeLocale(e: Event) {
  const target = e.target as HTMLSelectElement
  const value = target.value as Locale
  locale.setLocale(value)
}

function openAdminModal() {
  adminPin.value = ''
  adminError.value = ''
  showAdminModal.value = true
}

function disableAdmin() {
  admin.logout()
}

function submitAdmin() {
  if (!adminPin.value.trim()) {
    adminError.value = t('settings.adminPinRequired')
    return
  }
  const success = admin.login(adminPin.value)
  if (success) {
    showAdminModal.value = false
    const target = admin.consumePendingRoute()
    if (target) {
      router.push(target)
    }
  } else {
    adminError.value = t('settings.adminInvalidPin')
  }
}

function openChangePinModal() {
  changeCurrentPin.value = ''
  changeNewPin.value = ''
  changeConfirmPin.value = ''
  changePinError.value = ''
  changePinSuccess.value = ''
  showChangePinModal.value = true
}

function submitChangePin() {
  changePinError.value = ''
  const current = changeCurrentPin.value.trim()
  const next = changeNewPin.value.trim()
  const confirm = changeConfirmPin.value.trim()

  if (!current) {
    changePinError.value = t('settings.adminPinRequired')
    return
  }

  if (next.length < 4) {
    changePinError.value = t('settings.adminPinTooShort')
    return
  }

  if (next !== confirm) {
    changePinError.value = t('settings.adminPinMismatch')
    return
  }

  const result = admin.changePin(current, next)
  if (!result.success) {
    if (result.error === 'invalid-current') {
      changePinError.value = t('settings.adminPinInvalidCurrent')
    } else if (result.error === 'invalid-new') {
      changePinError.value = t('settings.adminPinTooShort')
    } else {
      changePinError.value = t('settings.adminPinChangeRequiresAdmin')
    }
    return
  }

  changePinSuccess.value = t('settings.adminPinChangeSuccess')
  showChangePinModal.value = false
  showChangePinSuccessModal.value = true
}

watch(showAdminModal, (open) => {
  if (open) {
    nextTick(() => {
      pinInput.value?.focus()
    })
  } else {
    adminPin.value = ''
    adminError.value = ''
  }
})

watch(showChangePinModal, (open) => {
  if (open) {
    nextTick(() => {
      changePinCurrentInput.value?.focus()
    })
  } else {
    changeCurrentPin.value = ''
    changeNewPin.value = ''
    changeConfirmPin.value = ''
    changePinError.value = ''
  }
})

watch(showChangePinSuccessModal, (open) => {
  if (!open) {
    changePinSuccess.value = ''
  }
})

watch(() => admin.isAdmin, (enabled) => {
  if (!enabled) {
    changePinSuccess.value = ''
    showChangePinSuccessModal.value = false
  }
})

onMounted(() => {
  if (route.query.admin === '1' && !admin.isAdmin) {
    openAdminModal()
  }
  if ('admin' in route.query) {
    const nextQuery: LocationQueryRaw = { ...route.query }
    delete nextQuery.admin
    router.replace({ query: nextQuery })
  }
})
</script>

<template>
  <section class="app-page">
    <PageHeading :title="t('settings.title')" :title-to="{ name: 'settings' }" :description="t('settings.subtitle')" />

    <div class="settings-grid">
      <section class="panel settings-card">
        <div class="settings-card__content">
          <div class="settings-card__text">
            <h2 class="settings-card__title">{{ t('settings.appearance') }}</h2>
            <p class="settings-card__subtitle">{{ t('settings.appearanceDesc') }}</p>
          </div>
          <button type="button" class="btn settings-card__action" @click="toggleTheme" :aria-pressed="isDark">
            <Sun v-if="!isDark" class="settings-card__icon" />
            <Moon v-else class="settings-card__icon" />
            <span>{{ isDark ? t('settings.dark') : t('settings.light') }}</span>
          </button>
        </div>
      </section>

      <section class="panel settings-card">
        <div class="settings-card__content">
          <div class="settings-card__text">
            <h2 class="settings-card__title">{{ t('settings.language') }}</h2>
            <p class="settings-card__subtitle">{{ t('settings.languageDesc') }}</p>
          </div>
          <label class="settings-card__action" for="settings-language-select">
            <span class="sr-only">{{ t('settings.language') }}</span>
            <select id="settings-language-select" class="btn settings-card__select" :value="locale.current"
              @change="onChangeLocale">
              <option value="de">{{ t('languages.de') }}</option>
              <option value="en">{{ t('languages.en') }}</option>
              <option value="ar">{{ t('languages.ar') }}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="panel settings-card">
        <div class="settings-card__content settings-card__content--stacked">
          <div class="settings-card__text">
            <h2 class="settings-card__title">{{ t('settings.adminTitle') }}</h2>
            <p class="settings-card__subtitle">{{ adminStatusText }}</p>
          </div>
          <div class="settings-card__actions">
            <button v-if="admin.isAdmin" type="button" class="btn settings-card__action" @click="disableAdmin">
              {{ t('settings.adminDisable') }}
            </button>
            <button v-if="admin.isAdmin" type="button" class="btn settings-card__action" @click="openChangePinModal">
              {{ t('settings.adminChangePin') }}
            </button>
            <button v-else type="button" class="btn settings-card__action" @click="openAdminModal">
              {{ t('settings.adminEnable') }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <BaseModal v-model="showAdminModal" :title="t('settings.adminModalTitle')">
      <form id="admin-pin-form" class="pin-form__grid" @submit.prevent="submitAdmin">
        <div class="pin-form__field">
          <label class="pin-form__label" for="admin-pin-input">{{ t('settings.adminEnterPin') }}</label>
          <input id="admin-pin-input" ref="pinInput" v-model="adminPin" type="password" class="pin-form__input"
            autocomplete="one-time-code" :placeholder="t('settings.adminPinPlaceholder') " />
        </div>
        <p v-if="adminError" class="pin-form__error">{{ adminError }}</p>
      </form>
      <template #footer>
        <div class="modal-footer-split">
          <div class="left">
            <button class="btn" type="button" @click="showAdminModal = false">{{ t('settings.adminCancel') }}</button>
          </div>
          <div class="right flex gap-2">
            <button class="btn primary" type="submit" form="admin-pin-form">{{ t('settings.adminConfirm') }}</button>
          </div>
        </div>
      </template>
    </BaseModal>

    <BaseModal v-model="showChangePinModal" :title="t('settings.adminChangePin')">
      <form id="change-pin-form" class="pin-form__grid" @submit.prevent="submitChangePin">
        <div class="pin-form__field">
          <label class="pin-form__label" for="admin-current-pin">{{ t('settings.adminCurrentPin') }}</label>
          <input id="admin-current-pin" ref="changePinCurrentInput" v-model="changeCurrentPin" type="password"
            class="pin-form__input" autocomplete="one-time-code" :placeholder="t('settings.adminPinPlaceholder')" />
        </div>
        <div class="pin-form__field">
          <label class="pin-form__label" for="admin-new-pin">{{ t('settings.adminNewPin') }}</label>
          <input id="admin-new-pin" v-model="changeNewPin" type="password" class="pin-form__input"
            autocomplete="new-password" :placeholder="t('settings.adminNewPinPlaceholder')" />
        </div>
        <div class="pin-form__field">
          <label class="pin-form__label" for="admin-confirm-pin">{{ t('settings.adminConfirmNewPin') }}</label>
          <input id="admin-confirm-pin" v-model="changeConfirmPin" type="password" class="pin-form__input"
            autocomplete="new-password" />
        </div>
        <p v-if="changePinError" class="pin-form__error">{{ changePinError }}</p>
      </form>
      <template #footer>
        <div class="modal-footer-split">
          <div class="left">
            <button class="btn" type="button" @click="showChangePinModal = false">{{ t('settings.adminCancel')
              }}</button>
          </div>
          <div class="right flex gap-2">
            <button class="btn primary" type="submit" form="change-pin-form">{{ t('settings.adminConfirm') }}</button>
          </div>
        </div>
      </template>
    </BaseModal>

    <BaseModal v-model="showChangePinSuccessModal" :title="t('settings.adminChangePin')">
      <div class="pin-form__grid">
        <p class="pin-form__success">{{ changePinSuccess || t('settings.adminPinChangeSuccess') }}</p>
      </div>
      <template #footer>
        <div class="modal-footer-split">
          <div class="left"></div>
          <div class="right flex gap-2">
            <button class="btn primary" type="button" @click="showChangePinSuccessModal = false">
              {{ t('settings.adminConfirm') }}
            </button>
          </div>
        </div>
      </template>
    </BaseModal>
  </section>
</template>
