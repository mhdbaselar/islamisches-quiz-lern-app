<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeading from '@/components/ui/PageHeading.vue'
import type { QuranPageData } from '@/services/quran/provider'
import { LegacyQuranProvider } from '@/services/quran/provider'
import {
  clampQuranPage,
  getNextQuranPage,
  getPreviousQuranPage,
  getVisibleQuranPages,
  type QuranReadingMode,
} from '@/services/quran/reader'

const { t, locale } = useI18n()
const provider = new LegacyQuranProvider()

type QuranTextMode = 'arabic' | 'standard'

const currentPage = ref(1)
const pageInput = ref('1')
const readingMode = ref<QuranReadingMode>('single')
const textMode = ref<QuranTextMode>(locale.value === 'ar' ? 'arabic' : 'standard')
const showTranslation = ref(true)
const isLoading = ref(false)
const error = ref<string | null>(null)
const pages = ref<QuranPageData[]>([])
const isMobile = ref(false)

let mediaQueryList: MediaQueryList | null = null
let abortController: AbortController | null = null

const effectiveMode = computed<QuranReadingMode>(() => (isMobile.value ? 'single' : readingMode.value))
const isArabicReadingMode = computed(() => textMode.value === 'arabic')
const visiblePageNumbers = computed(() => getVisibleQuranPages(currentPage.value, readingMode.value, isMobile.value))
const canGoPrev = computed(() =>
  getPreviousQuranPage(currentPage.value, readingMode.value, isMobile.value) !== currentPage.value)
const canGoNext = computed(() =>
  getNextQuranPage(currentPage.value, readingMode.value, isMobile.value) !== currentPage.value)
const displayPages = computed(() => {
  if (isArabicReadingMode.value && effectiveMode.value === 'spread' && pages.value.length > 1) {
    return [...pages.value].reverse()
  }
  return pages.value
})

const pageIndicator = computed(() => {
  if (effectiveMode.value === 'spread' && visiblePageNumbers.value.length === 2) {
    return t('quran.spreadIndicator', {
      left: visiblePageNumbers.value[0],
      right: visiblePageNumbers.value[1],
    })
  }
  return t('quran.pageIndicator', { page: visiblePageNumbers.value[0] ?? currentPage.value })
})

function syncMobileLayout() {
  isMobile.value = mediaQueryList?.matches ?? false
}

function selectMode(mode: QuranReadingMode) {
  readingMode.value = mode
}

function selectTextMode(mode: QuranTextMode) {
  textMode.value = mode
}

function goPrev() {
  currentPage.value = getPreviousQuranPage(currentPage.value, readingMode.value, isMobile.value)
}

function goNext() {
  currentPage.value = getNextQuranPage(currentPage.value, readingMode.value, isMobile.value)
}

function applyPageInput() {
  const parsed = Number.parseInt(pageInput.value, 10)
  if (Number.isNaN(parsed)) {
    pageInput.value = String(currentPage.value)
    return
  }
  currentPage.value = clampQuranPage(parsed)
}

function formatArabicAyahNumber(verseNumber: number) {
  return new Intl.NumberFormat('ar-u-nu-arab', { useGrouping: false }).format(verseNumber)
}

function formatAyahMarker(verseNumber: number) {
  return `﴿${formatArabicAyahNumber(verseNumber)}﴾`
}

async function loadPages() {
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  isLoading.value = true
  error.value = null

  try {
    const requestedPages = visiblePageNumbers.value
    const loadedPages = await Promise.all(
      requestedPages.map((pageNumber) => provider.getPage({
        pageNumber,
        locale: locale.value,
        showTranslation: showTranslation.value,
        signal: controller.signal,
      })),
    )

    if (controller.signal.aborted) return
    pages.value = loadedPages
  } catch (err) {
    if (controller.signal.aborted) return
    pages.value = []
    error.value = err instanceof Error ? err.message : t('quran.errorUnknown')
  } finally {
    if (abortController === controller) {
      isLoading.value = false
    }
  }
}

watch(currentPage, (nextPage) => {
  pageInput.value = String(nextPage)
}, { immediate: true })

watch(
  [visiblePageNumbers, showTranslation, () => locale.value],
  () => {
    void loadPages()
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  mediaQueryList = window.matchMedia('(max-width: 900px)')
  syncMobileLayout()

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', syncMobileLayout)
  } else {
    mediaQueryList.addListener(syncMobileLayout)
  }
})

onBeforeUnmount(() => {
  abortController?.abort()

  if (!mediaQueryList) return
  if (typeof mediaQueryList.removeEventListener === 'function') {
    mediaQueryList.removeEventListener('change', syncMobileLayout)
  } else {
    mediaQueryList.removeListener(syncMobileLayout)
  }
})
</script>

<template>
  <section class="app-page quran-view">
    <PageHeading :title="t('nav.quran')" :title-to="{ name: 'quran' }" />
    <p class="text-muted-foreground">{{ t('quran.subtitle') }}</p>

    <div class="quran-controls">
      <div class="quran-controls__top">
        <div class="quran-controls__mode">
          <p class="quran-controls__label">{{ t('quran.mode') }}</p>
          <div class="quran-toggle-group">
            <button type="button" class="chip" :class="{ active: effectiveMode === 'single' }" @click="selectMode('single')">
              {{ t('quran.single') }}
            </button>
            <button
              type="button"
              class="chip"
              :class="{ active: effectiveMode === 'spread' }"
              :disabled="isMobile"
              @click="selectMode('spread')"
            >
              {{ t('quran.spread') }}
            </button>
          </div>
          <p v-if="isMobile" class="quran-mobile-hint">{{ t('quran.mobileSpreadHint') }}</p>
        </div>

        <div class="quran-controls__mode">
          <p class="quran-controls__label">{{ t('quran.textMode') }}</p>
          <div class="quran-toggle-group">
            <button
              type="button"
              class="chip"
              :class="{ active: textMode === 'arabic' }"
              @click="selectTextMode('arabic')"
            >
              {{ t('quran.textModeArabic') }}
            </button>
            <button
              type="button"
              class="chip"
              :class="{ active: textMode === 'standard' }"
              @click="selectTextMode('standard')"
            >
              {{ t('quran.textModeStandard') }}
            </button>
          </div>
        </div>

        <label class="quran-controls__toggle">
          <input v-model="showTranslation" type="checkbox" />
          <span>{{ t('quran.translationToggle') }}</span>
        </label>
      </div>

      <div class="quran-page-nav">
        <button type="button" class="btn" :disabled="!canGoPrev || isLoading" @click="goPrev">
          {{ t('quran.prev') }}
        </button>
        <label for="quran-page-input" class="quran-page-nav__label">{{ t('quran.page') }}</label>
        <input
          id="quran-page-input"
          v-model="pageInput"
          class="quran-page-nav__input"
          inputmode="numeric"
          type="text"
          @blur="applyPageInput"
          @keydown.enter.prevent="applyPageInput"
        />
        <span class="quran-page-nav__max">/ 604</span>
        <button type="button" class="btn" :disabled="!canGoNext || isLoading" @click="goNext">
          {{ t('quran.next') }}
        </button>
      </div>

      <p class="quran-page-nav__indicator">{{ pageIndicator }}</p>
    </div>

    <div v-if="isLoading" class="quran-state">
      {{ t('quran.loading') }}
    </div>

    <div v-else-if="error" class="quran-state quran-state--error">
      <p>{{ t('quran.errorPrefix') }}: {{ error }}</p>
      <button type="button" class="btn" @click="loadPages">{{ t('quran.retry') }}</button>
    </div>

    <div
      v-else
      class="quran-reader"
      :class="{ 'quran-reader--spread': effectiveMode === 'spread' && visiblePageNumbers.length > 1 }"
    >
      <article
        v-for="pageData in displayPages"
        :key="pageData.pageNumber"
        class="quran-page"
        translate="no"
      >
        <header class="quran-page__header">
          <span>{{ t('quran.page') }} {{ pageData.pageNumber }}</span>
        </header>

        <div v-if="pageData.verses.length" class="quran-page__verses">
          <template v-if="isArabicReadingMode">
            <p class="quran-page__arabic-flow" dir="rtl" translate="no">
              <template v-for="verse in pageData.verses" :key="`${pageData.pageNumber}-${verse.id}-${verse.verseKey}`">
                <span class="quran-page__arabic-chunk">
                  {{ verse.textUthmani }}
                  <span class="quran-ayah-marker">{{ formatAyahMarker(verse.verseNumber) }}</span>
                </span>
              </template>
            </p>
            <div v-if="showTranslation" class="quran-page__translations">
              <p v-for="verse in pageData.verses" :key="`tr-${pageData.pageNumber}-${verse.id}-${verse.verseKey}`" class="quran-page__translation-line">
                <span class="quran-page__translation-key">{{ verse.verseKey }}</span>
                <span>{{ verse.translation ?? '—' }}</span>
              </p>
            </div>
          </template>

          <template v-else>
            <section v-for="verse in pageData.verses" :key="`${pageData.pageNumber}-${verse.id}-${verse.verseKey}`" class="quran-verse">
              <p class="quran-verse__arabic" dir="rtl" translate="no">{{ verse.textUthmani }}</p>
              <p v-if="showTranslation && verse.translation" class="quran-verse__translation">{{ verse.translation }}</p>
              <p class="quran-verse__meta">{{ verse.verseKey }}</p>
            </section>
          </template>
        </div>

        <p v-else class="quran-page__empty">{{ t('quran.empty') }}</p>
      </article>
    </div>
  </section>
</template>
