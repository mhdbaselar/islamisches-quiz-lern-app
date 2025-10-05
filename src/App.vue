<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Menu, X } from 'lucide-vue-next'
import { Icon } from '@iconify/vue'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const route = useRoute()
const admin = useAdminStore()

const mobileNavOpen = ref(false)

const quizLinks = computed(() => [
  { to: '/quiz/spielen', label: t('quiz.tabs.playLearn') },
  { to: '/quiz/verwalten', label: t('quiz.tabs.manage') },
  { to: '/quiz/statistik', label: t('quiz.tabs.stats') },
])

const navLinks = computed(() => [
  { to: '/', label: t('nav.start') },
  { to: '/quiz', label: t('nav.quiz'), children: quizLinks.value },
  { to: '/gebetszeiten', label: t('nav.prayerTimes') },
  { to: '/quran', label: t('nav.quran') },
  { to: '/einstellungen', label: t('nav.settings') },
  { to: '/about', label: t('nav.about') },
])

function closeMobileNav() {
  mobileNavOpen.value = false
}

function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMobileNav()
}

watch(mobileNavOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', handleKeydown)
    document.documentElement.classList.add('mobile-nav-open')
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.documentElement.classList.remove('mobile-nav-open')
  }
})

watch(() => route.fullPath, () => closeMobileNav())

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.documentElement.classList.remove('mobile-nav-open')
})
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <RouterLink to="/" class="app-brand" @click="closeMobileNav">
        <img alt="Logo" class="app-brand__logo" src="/islam.png" width="40" height="40" />
        <span>{{ t('app.title') }}</span>
      </RouterLink>

      <div class="app-header__actions">
        <button type="button" class="app-header__mobile-toggle" aria-label="Navigation öffnen" @click="toggleMobileNav">
          <Menu class="h-5 w-5" />
        </button>

        <nav class="app-nav" aria-label="Main navigation">
          <ul class="app-nav__list">
            <li v-for="link in navLinks" :key="link.to" class="app-nav__item"
              :class="{ 'app-nav__item--dropdown': link.children }">
              <template v-if="link.children">
                <div class="app-nav__dropdown">
                  <RouterLink class="app-nav__link" :to="link.to">{{ link.label }}</RouterLink>
                  <button class="app-nav__toggle" type="button" aria-haspopup="true" aria-expanded="false"
                    :aria-controls="`${link.to.replace(/\//g, '-')}-submenu`">
                    <Icon icon="prime:angle-down" class="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div :id="`${link.to.replace(/\//g, '-')}-submenu`" class="app-nav__submenu" role="menu">
                    <RouterLink v-for="child in link.children.filter(child =>
                      !(child.to === '/quiz/verwalten' && !admin.isAdmin)
                    )" :key="child.to" class="app-nav__link" :to="child.to" role="menuitem">
                      {{ child.label }}
                    </RouterLink>
                  </div>
                </div>
              </template>
              <template v-else>
                <RouterLink class="app-nav__link" :to="link.to">{{ link.label }}</RouterLink>
              </template>
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <transition name="fade">
      <div v-if="mobileNavOpen" class="app-nav__mobile-overlay" role="dialog" aria-modal="true"
        aria-label="Mobile navigation" @click.self="closeMobileNav">
        <div class="app-nav__mobile-panel">
          <div class="app-nav__mobile-header">
            <RouterLink to="/" class="app-brand" @click="closeMobileNav">
              <img alt="Logo" class="app-brand__logo" src="/islam.png" width="32" height="32" />
              <span>{{ t('app.title') }}</span>
            </RouterLink>
            <button type="button" class="app-nav__mobile-close" aria-label="Navigation schließen"
              @click="closeMobileNav">
              <X class="h-5 w-5" />
            </button>
          </div>
          <nav class="app-nav__mobile-menu" aria-label="Mobile navigation links">
            <ul class="app-nav__mobile-list">
              <li v-for="link in navLinks" :key="`mobile-${link.to}`" class="app-nav__mobile-item">
                <RouterLink class="app-nav__mobile-link" :to="link.to" @click="closeMobileNav">
                  {{ link.label }}
                </RouterLink>
                <div v-if="link.children" class="app-nav__mobile-submenu">
                  <RouterLink v-for="child in link.children" :key="`mobile-child-${child.to}`"
                    class="app-nav__mobile-sublink" :to="child.to" @click="closeMobileNav">
                    {{ child.label }}
                  </RouterLink>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </transition>

    <main class="app-content">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <footer class="app-footer">
      <p>
        {{ t('footer.copyright', { year: new Date().getFullYear() }) }}
        {{ t('footer.madeWith') }}
      </p>
    </footer>
  </div>

</template>
