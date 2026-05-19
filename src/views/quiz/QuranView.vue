<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeading from '@/components/ui/PageHeading.vue'
import type { QuranChapter, QuranPageData, QuranPageRequest } from '@/services/quran/provider'
import { LegacyQuranProvider } from '@/services/quran/provider'
import { buildMushafPageLayout, type QuranMushafLineToken } from '@/services/quran/layout'
import {
  QURAN_MAX_PAGE,
  clampQuranPage,
  getNextQuranPage,
  getPreviousQuranPage,
  getVisibleQuranPages,
  type QuranReadingMode,
} from '@/services/quran/reader'

const { t, locale } = useI18n()
const provider = new LegacyQuranProvider()
const UTHMANIC_HAFS_FONT_FAMILY = 'UthmanicHafs'
const UTHMANIC_HAFS_FONT_URL = 'https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2'
const QCF_V2_FONT_FAMILY_PREFIX = 'QCFV2Page'
const QCF_V2_FONT_URL_PREFIX = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p'

type QuranTextMode = 'arabic' | 'standard'
type PersistedQuranViewSettings = {
  currentPage: number
  readingMode: QuranReadingMode
  textMode: QuranTextMode
  showTranslation: boolean
}
type CachedQuranPageRequestOptions = Pick<QuranPageRequest, 'locale' | 'showTranslation' | 'includeMushafWords'>

const QURAN_VIEW_STORAGE_KEY = 'app.quran.view.settings'
const QURAN_PAGE_CACHE_STORAGE_PREFIX = 'app.quran.page-cache.v1'
const QURAN_WARMED_LOCALES_STORAGE_KEY = 'app.quran.page-cache.v1.warmed-locales'
const ENABLE_BACKGROUND_QURAN_WARMUP = import.meta.env.MODE !== 'test'

function readStoredQuranSettings(): Partial<PersistedQuranViewSettings> | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(QURAN_VIEW_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const restored: Partial<PersistedQuranViewSettings> = {}

    if (typeof parsed.currentPage === 'number' && Number.isFinite(parsed.currentPage)) {
      restored.currentPage = clampQuranPage(Math.trunc(parsed.currentPage))
    }

    if (parsed.readingMode === 'single' || parsed.readingMode === 'spread') {
      restored.readingMode = parsed.readingMode
    }

    if (parsed.textMode === 'arabic' || parsed.textMode === 'standard') {
      restored.textMode = parsed.textMode
    }

    if (typeof parsed.showTranslation === 'boolean') {
      restored.showTranslation = parsed.showTranslation
    }

    return restored
  } catch {
    return null
  }
}

function writeStoredQuranSettings(settings: PersistedQuranViewSettings): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(QURAN_VIEW_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore storage errors */
  }
}

function normalizeLocaleForCache(localeValue: string): string {
  const normalized = localeValue.trim().toLowerCase()
  return normalized || 'default'
}

function normalizeIncludeMushafWords(includeMushafWords: boolean | undefined): boolean {
  return includeMushafWords === true
}

function getQuranPageCacheKey(pageNumber: number, options: CachedQuranPageRequestOptions): string {
  const normalizedPage = clampQuranPage(pageNumber)
  const normalizedLocale = normalizeLocaleForCache(options.locale)
  const includeWordsFlag = normalizeIncludeMushafWords(options.includeMushafWords) ? '1' : '0'
  const showTranslationFlag = options.showTranslation ? '1' : '0'
  return `${QURAN_PAGE_CACHE_STORAGE_PREFIX}:${normalizedLocale}:${normalizedPage}:${includeWordsFlag}:${showTranslationFlag}`
}

function isQuranPageData(value: unknown, expectedPageNumber: number): value is QuranPageData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { pageNumber?: unknown, verses?: unknown }
  return candidate.pageNumber === expectedPageNumber && Array.isArray(candidate.verses)
}

function readCachedQuranPageByOptions(pageNumber: number, options: CachedQuranPageRequestOptions): QuranPageData | null {
  if (typeof window === 'undefined') return null

  try {
    const normalizedPage = clampQuranPage(pageNumber)
    const raw = window.localStorage.getItem(getQuranPageCacheKey(normalizedPage, options))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isQuranPageData(parsed, normalizedPage) ? parsed : null
  } catch {
    return null
  }
}

function readCachedQuranPage(pageNumber: number, options: CachedQuranPageRequestOptions): QuranPageData | null {
  const exactMatch = readCachedQuranPageByOptions(pageNumber, options)
  if (exactMatch) return exactMatch

  if (options.showTranslation && normalizeIncludeMushafWords(options.includeMushafWords)) {
    return null
  }

  return readCachedQuranPageByOptions(pageNumber, {
    locale: options.locale,
    showTranslation: true,
    includeMushafWords: true,
  })
}

function writeCachedQuranPage(pageData: QuranPageData, options: CachedQuranPageRequestOptions): boolean {
  if (typeof window === 'undefined') return false

  try {
    const normalizedPage = clampQuranPage(pageData.pageNumber)
    const payload = JSON.stringify({
      ...pageData,
      pageNumber: normalizedPage,
    })
    window.localStorage.setItem(getQuranPageCacheKey(normalizedPage, options), payload)
    return true
  } catch {
    return false
  }
}

let warmedLocalesCache: Set<string> | null = null

function readWarmedLocales(): Set<string> {
  if (warmedLocalesCache) return warmedLocalesCache
  if (typeof window === 'undefined') {
    warmedLocalesCache = new Set<string>()
    return warmedLocalesCache
  }

  try {
    const raw = window.localStorage.getItem(QURAN_WARMED_LOCALES_STORAGE_KEY)
    if (!raw) {
      warmedLocalesCache = new Set<string>()
      return warmedLocalesCache
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      warmedLocalesCache = new Set<string>()
      return warmedLocalesCache
    }
    warmedLocalesCache = new Set(
      parsed
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => normalizeLocaleForCache(entry)),
    )
    return warmedLocalesCache
  } catch {
    warmedLocalesCache = new Set<string>()
    return warmedLocalesCache
  }
}

function isLocaleWarmed(localeValue: string): boolean {
  const warmedLocales = readWarmedLocales()
  return warmedLocales.has(normalizeLocaleForCache(localeValue))
}

function markLocaleWarmed(localeValue: string): void {
  if (typeof window === 'undefined') return
  const warmedLocales = readWarmedLocales()
  const localeKey = normalizeLocaleForCache(localeValue)
  if (warmedLocales.has(localeKey)) return
  warmedLocales.add(localeKey)

  try {
    window.localStorage.setItem(QURAN_WARMED_LOCALES_STORAGE_KEY, JSON.stringify([...warmedLocales]))
  } catch {
    /* ignore storage errors */
  }
}

const storedQuranSettings = readStoredQuranSettings()
const currentPage = ref(storedQuranSettings?.currentPage ?? 1)
const pageInput = ref(String(currentPage.value))
const readingMode = ref<QuranReadingMode>(storedQuranSettings?.readingMode ?? 'single')
const textMode = ref<QuranTextMode>(storedQuranSettings?.textMode ?? (locale.value === 'ar' ? 'arabic' : 'standard'))
const showTranslation = ref(storedQuranSettings?.showTranslation ?? true)
const isLoading = ref(false)
const error = ref<string | null>(null)
const pages = ref<QuranPageData[]>([])
const chapters = ref<QuranChapter[]>([])
const chaptersLoading = ref(false)
const chaptersError = ref<string | null>(null)
const isMobile = ref(false)
const pageFontReady = ref<Record<number, boolean>>({})

let mediaQueryList: MediaQueryList | null = null
let abortController: AbortController | null = null
let chaptersAbortController: AbortController | null = null
let warmupAbortController: AbortController | null = null
let activeWarmupLocale: string | null = null
let unicodeFontReady = false
let pendingUnicodeFontLoad: Promise<boolean> | null = null
const loadedQcfV2Pages = new Set<number>()
const pendingQcfFontLoads = new Map<number, Promise<boolean>>()
const warmupLocalesWithStorageFailure = new Set<string>()

const effectiveMode = computed<QuranReadingMode>(() => (isMobile.value ? 'single' : readingMode.value))
const isArabicReadingMode = computed(() => textMode.value === 'arabic')
const visiblePageNumbers = computed(() => getVisibleQuranPages(currentPage.value, readingMode.value, isMobile.value))
const canGoPrev = computed(() =>
  getPreviousQuranPage(currentPage.value, readingMode.value, isMobile.value) !== currentPage.value)
const canGoNext = computed(() =>
  getNextQuranPage(currentPage.value, readingMode.value, isMobile.value) !== currentPage.value)
const isSpreadLayout = computed(() => effectiveMode.value === 'spread' && visiblePageNumbers.value.length > 1)
const shouldReverseSpreadPages = computed(() => effectiveMode.value === 'spread' && isArabicReadingMode.value)
const displayPages = computed(() => {
  if (shouldReverseSpreadPages.value && pages.value.length > 1) {
    return [...pages.value].reverse()
  }
  return pages.value
})
const chapterNamesById = computed(() => {
  const map = new Map<number, string>()
  for (const chapter of chapters.value) {
    if (!chapter.nameArabic) continue
    map.set(chapter.id, chapter.nameArabic)
  }
  return map
})
const mushafLayoutsByPage = computed(() => {
  const map = new Map<number, ReturnType<typeof buildMushafPageLayout>>()
  for (const pageData of displayPages.value) {
    map.set(
      pageData.pageNumber,
      buildMushafPageLayout(pageData, {
        getSurahArabicName: (chapterId) => chapterNamesById.value.get(chapterId),
      }),
    )
  }
  return map
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
const showInitialLoadingState = computed(() => isLoading.value && pages.value.length === 0)
const showBlockingErrorState = computed(() => Boolean(error.value) && pages.value.length === 0)

const selectedSurahId = computed<string>({
  get() {
    if (!chapters.value.length) return ''
    const current = chapters.value.find((chapter) =>
      currentPage.value >= chapter.startPage && currentPage.value <= chapter.endPage)
    return current ? String(current.id) : ''
  },
  set(value) {
    const chapterId = Number.parseInt(value, 10)
    if (Number.isNaN(chapterId)) return
    const chapter = chapters.value.find((entry) => entry.id === chapterId)
    if (!chapter) return
    currentPage.value = clampQuranPage(chapter.startPage)
  },
})

function canUseFontFaceApi() {
  return (
    typeof window !== 'undefined'
    && typeof FontFace !== 'undefined'
    && typeof document !== 'undefined'
    && typeof document.fonts !== 'undefined'
  )
}

function getPageQcfV2FontFamily(pageNumber: number) {
  return `${QCF_V2_FONT_FAMILY_PREFIX}-${pageNumber}`
}

async function ensureUnicodeFont(): Promise<boolean> {
  if (unicodeFontReady) return true
  if (!canUseFontFaceApi()) return false
  if (pendingUnicodeFontLoad) return pendingUnicodeFontLoad

  pendingUnicodeFontLoad = (async () => {
    try {
      const fontFace = new FontFace(
        UTHMANIC_HAFS_FONT_FAMILY,
        `url("${UTHMANIC_HAFS_FONT_URL}") format("woff2")`,
        { display: 'swap' },
      )
      const loadedFont = await fontFace.load()
      document.fonts.add(loadedFont)
      unicodeFontReady = true
      return true
    } catch {
      return false
    } finally {
      pendingUnicodeFontLoad = null
    }
  })()

  return pendingUnicodeFontLoad
}

async function ensureQcfV2PageFont(pageNumber: number): Promise<boolean> {
  if (loadedQcfV2Pages.has(pageNumber)) {
    pageFontReady.value = { ...pageFontReady.value, [pageNumber]: true }
    return true
  }
  if (!canUseFontFaceApi()) {
    pageFontReady.value = { ...pageFontReady.value, [pageNumber]: false }
    return false
  }

  const existingLoad = pendingQcfFontLoads.get(pageNumber)
  if (existingLoad) return existingLoad

  const family = getPageQcfV2FontFamily(pageNumber)
  const fontLoad = (async () => {
    try {
      const fontFace = new FontFace(
        family,
        `url("${QCF_V2_FONT_URL_PREFIX}${pageNumber}.woff2") format("woff2")`,
        { display: 'swap' },
      )
      const loadedFont = await fontFace.load()
      document.fonts.add(loadedFont)
      loadedQcfV2Pages.add(pageNumber)
      pageFontReady.value = { ...pageFontReady.value, [pageNumber]: true }
      return true
    } catch {
      pageFontReady.value = { ...pageFontReady.value, [pageNumber]: false }
      return false
    } finally {
      pendingQcfFontLoads.delete(pageNumber)
    }
  })()

  pendingQcfFontLoads.set(pageNumber, fontLoad)
  return fontLoad
}

async function ensureMushafFontsForPages(pageNumbers: number[]) {
  if (!isArabicReadingMode.value) return
  await ensureUnicodeFont()
  await Promise.all(pageNumbers.map((pageNumber) => ensureQcfV2PageFont(pageNumber)))
}

function getMushafLayout(pageNumber: number) {
  return mushafLayoutsByPage.value.get(pageNumber)
}

function getMushafTokenKey(token: QuranMushafLineToken, tokenIndex: number): string {
  if (token.kind === 'word') {
    return `word-${token.verseKey}-${token.position}-${tokenIndex}`
  }
  return `${token.kind}-${token.chapterId}-${tokenIndex}`
}

function getMushafTokenClass(token: QuranMushafLineToken) {
  if (token.kind === 'word') {
    return {
      'quran-page__mushaf-token': true,
      'quran-page__mushaf-token--word': true,
      'quran-page__mushaf-token--end': token.charTypeName === 'end',
    }
  }
  return {
    'quran-page__mushaf-token': true,
    'quran-page__mushaf-token--label': true,
    'quran-page__mushaf-token--surah': token.kind === 'surah',
    'quran-page__mushaf-token--basmala': token.kind === 'basmala',
  }
}

function getMushafTokenStyle(token: QuranMushafLineToken, pageNumber: number) {
  if (token.kind === 'word') {
    if (token.charTypeName === 'end') {
      return {
        fontFamily: `"${UTHMANIC_HAFS_FONT_FAMILY}", "Amiri", "Noto Naskh Arabic", serif`,
      }
    }

    if (pageFontReady.value[pageNumber]) {
      return {
        fontFamily: `"${getPageQcfV2FontFamily(pageNumber)}", "${UTHMANIC_HAFS_FONT_FAMILY}", "Amiri", "Noto Naskh Arabic", serif`,
      }
    }

    return {
      fontFamily: `"${UTHMANIC_HAFS_FONT_FAMILY}", "Amiri", "Noto Naskh Arabic", serif`,
    }
  }

  return {
    fontFamily: `"${UTHMANIC_HAFS_FONT_FAMILY}", "Amiri", "Noto Naskh Arabic", serif`,
  }
}

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

function shouldRenderHeaderNav(pageIndex: number): boolean {
  return isSpreadLayout.value || pageIndex === 0
}

function shouldShowHeaderButton(pageIndex: number, action: 'prev' | 'next'): boolean {
  if (!shouldRenderHeaderNav(pageIndex)) return false
  if (!isSpreadLayout.value) return true

  const leftAction = isArabicReadingMode.value ? 'next' : 'prev'
  if (pageIndex === 0) return action === leftAction
  return action !== leftAction
}

function applyPageInput() {
  const parsed = Number.parseInt(pageInput.value, 10)
  if (Number.isNaN(parsed)) {
    pageInput.value = String(currentPage.value)
    return
  }
  currentPage.value = clampQuranPage(parsed)
}

function formatChapterLabel(chapter: QuranChapter) {
  const latinName = chapter.translatedName || chapter.nameSimple
  if (locale.value === 'ar') {
    return `${chapter.id}. ${chapter.nameArabic}`
  }
  return `${chapter.id}. ${latinName} (${chapter.nameArabic})`
}

function getCurrentPageRequestOptions(): CachedQuranPageRequestOptions {
  return {
    locale: locale.value,
    showTranslation: isArabicReadingMode.value ? true : showTranslation.value,
    includeMushafWords: isArabicReadingMode.value,
  }
}

function getSupersetRequestOptions(localeValue: string): CachedQuranPageRequestOptions {
  return {
    locale: localeValue,
    showTranslation: true,
    includeMushafWords: true,
  }
}

function getAdjacentPrefetchPages(basePages: number[]): number[] {
  const candidates = new Set<number>()
  for (const pageNumber of basePages) {
    for (const offset of [-2, -1, 1, 2]) {
      const candidate = clampQuranPage(pageNumber + offset)
      if (!basePages.includes(candidate)) {
        candidates.add(candidate)
      }
    }
  }
  return [...candidates]
}

async function prefetchAdjacentPages(basePages: number[]) {
  if (!ENABLE_BACKGROUND_QURAN_WARMUP || typeof window === 'undefined') return
  const prefetchOptions = getSupersetRequestOptions(locale.value)
  const prefetchPages = getAdjacentPrefetchPages(basePages)

  for (const pageNumber of prefetchPages) {
    if (readCachedQuranPage(pageNumber, prefetchOptions)) continue

    try {
      const fetchedPage = await provider.getPage({
        pageNumber,
        ...prefetchOptions,
      })
      writeCachedQuranPage(fetchedPage, prefetchOptions)
    } catch {
      return
    }
  }
}

function warmQuranCacheInBackground() {
  if (!ENABLE_BACKGROUND_QURAN_WARMUP || typeof window === 'undefined') return

  const warmupLocaleValue = locale.value
  const localeKey = normalizeLocaleForCache(warmupLocaleValue)
  if (isLocaleWarmed(warmupLocaleValue)) return
  if (warmupLocalesWithStorageFailure.has(localeKey)) return
  if (activeWarmupLocale === localeKey) return

  warmupAbortController?.abort()
  const controller = new AbortController()
  warmupAbortController = controller
  activeWarmupLocale = localeKey

  const warmupOptions = getSupersetRequestOptions(warmupLocaleValue)

  void (async () => {
    try {
      for (let pageNumber = 1; pageNumber <= QURAN_MAX_PAGE; pageNumber += 1) {
        if (controller.signal.aborted) return
        if (readCachedQuranPage(pageNumber, warmupOptions)) continue

        const fetchedPage = await provider.getPage({
          pageNumber,
          ...warmupOptions,
          signal: controller.signal,
        })

        if (controller.signal.aborted) return
        const stored = writeCachedQuranPage(fetchedPage, warmupOptions)
        if (!stored) {
          warmupLocalesWithStorageFailure.add(localeKey)
          return
        }
      }

      if (!controller.signal.aborted) {
        markLocaleWarmed(warmupLocaleValue)
      }
    } catch {
      /* ignore transient warmup errors */
    } finally {
      if (warmupAbortController === controller) {
        warmupAbortController = null
        activeWarmupLocale = null
      }
    }
  })()
}

async function loadChapters() {
  chaptersAbortController?.abort()
  const controller = new AbortController()
  chaptersAbortController = controller
  chaptersLoading.value = true
  chaptersError.value = null

  try {
    const loadedChapters = await provider.getChapters({
      locale: locale.value,
      signal: controller.signal,
    })
    if (controller.signal.aborted) return
    chapters.value = loadedChapters
  } catch (err) {
    if (controller.signal.aborted) return
    chaptersError.value = err instanceof Error ? err.message : t('quran.errorUnknown')
  } finally {
    if (chaptersAbortController === controller) {
      chaptersLoading.value = false
    }
  }
}

async function loadPages() {
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  const hadPagesBeforeRequest = pages.value.length > 0
  error.value = null

  try {
    const requestedPages = visiblePageNumbers.value
    const requestOptions = getCurrentPageRequestOptions()
    const pageByNumber = new Map<number, QuranPageData>()

    for (const pageNumber of requestedPages) {
      const cachedPage = readCachedQuranPage(pageNumber, requestOptions)
      if (cachedPage) {
        pageByNumber.set(pageNumber, cachedPage)
      }
    }

    const missingPages = requestedPages.filter((pageNumber) => !pageByNumber.has(pageNumber))

    if (missingPages.length > 0) {
      isLoading.value = true
      const fetchedPages = await Promise.all(
        missingPages.map((pageNumber) => provider.getPage({
          pageNumber,
          ...requestOptions,
          signal: controller.signal,
        })),
      )

      if (controller.signal.aborted) return

      for (const fetchedPage of fetchedPages) {
        pageByNumber.set(fetchedPage.pageNumber, fetchedPage)
        writeCachedQuranPage(fetchedPage, requestOptions)
      }
    } else {
      isLoading.value = false
    }

    const loadedPages = requestedPages
      .map((pageNumber) => pageByNumber.get(pageNumber))
      .filter((pageData): pageData is QuranPageData => Boolean(pageData))

    if (loadedPages.length !== requestedPages.length) {
      throw new Error('Missing Quran pages after cache/network load')
    }

    if (controller.signal.aborted) return
    pages.value = loadedPages
    void ensureMushafFontsForPages(requestedPages)
    void prefetchAdjacentPages(requestedPages)
    warmQuranCacheInBackground()
  } catch (err) {
    if (controller.signal.aborted) return
    if (!hadPagesBeforeRequest) {
      pages.value = []
    }
    error.value = err instanceof Error ? err.message : t('quran.errorUnknown')
  } finally {
    if (abortController === controller && isLoading.value) {
      isLoading.value = false
    }
  }
}

watch(currentPage, (nextPage) => {
  pageInput.value = String(nextPage)
}, { immediate: true })

watch([currentPage, readingMode, textMode, showTranslation], () => {
  writeStoredQuranSettings({
    currentPage: currentPage.value,
    readingMode: readingMode.value,
    textMode: textMode.value,
    showTranslation: showTranslation.value,
  })
})

watch(
  [visiblePageNumbers, isArabicReadingMode, () => locale.value],
  () => {
    void loadPages()
  },
  { immediate: true },
)

watch(
  showTranslation,
  () => {
    if (isArabicReadingMode.value) return
    void loadPages()
  },
)

watch(
  [isArabicReadingMode, displayPages],
  ([isArabic]) => {
    if (!isArabic) return
    void ensureMushafFontsForPages(displayPages.value.map((page) => page.pageNumber))
  },
  { immediate: true },
)

watch(
  () => locale.value,
  () => {
    void loadChapters()
  },
  { immediate: true },
)

onMounted(() => {
  void ensureUnicodeFont()

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
  chaptersAbortController?.abort()
  warmupAbortController?.abort()

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
        <label for="quran-surah-select" class="quran-page-nav__label">{{ t('quran.surah') }}</label>
        <select
          id="quran-surah-select"
          v-model="selectedSurahId"
          class="quran-page-nav__select"
          :disabled="chaptersLoading || !chapters.length"
        >
          <option value="" disabled>
            {{ chaptersLoading ? t('quran.loadingSurahs') : t('quran.selectSurah') }}
          </option>
          <option v-for="chapter in chapters" :key="chapter.id" :value="String(chapter.id)">
            {{ formatChapterLabel(chapter) }}
          </option>
        </select>

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
      </div>

      <p class="quran-page-nav__indicator">{{ pageIndicator }}</p>
      <p v-if="chaptersError" class="quran-mobile-hint">{{ t('quran.surahLoadError') }}: {{ chaptersError }}</p>
    </div>

    <div v-if="showInitialLoadingState" class="quran-state">
      {{ t('quran.loading') }}
    </div>

    <div v-else-if="showBlockingErrorState" class="quran-state quran-state--error">
      <p>{{ t('quran.errorPrefix') }}: {{ error }}</p>
      <button type="button" class="btn" @click="loadPages">{{ t('quran.retry') }}</button>
    </div>

    <div v-else class="quran-reader-stack">
      <div v-if="error" class="quran-state quran-state--error">
        <p>{{ t('quran.errorPrefix') }}: {{ error }}</p>
        <button type="button" class="btn" @click="loadPages">{{ t('quran.retry') }}</button>
      </div>

      <p v-if="isLoading" class="quran-reader-stack__loading" aria-live="polite">
        {{ t('quran.loading') }}
      </p>

      <div
        class="quran-reader"
        :class="{
          'quran-reader--spread': effectiveMode === 'spread' && visiblePageNumbers.length > 1,
          'quran-reader--single': effectiveMode === 'single' || visiblePageNumbers.length === 1,
        }"
      >
        <article
          v-for="(pageData, pageIndex) in displayPages"
          :key="pageData.pageNumber"
          class="quran-page"
          translate="no"
        >
          <header class="quran-page__header">
            <div
              v-if="shouldRenderHeaderNav(pageIndex)"
              class="quran-page__header-nav"
              :class="{ 'quran-page__header-nav--arabic': isArabicReadingMode }"
            >
              <button
                v-if="shouldShowHeaderButton(pageIndex, 'prev')"
                type="button"
                class="btn quran-page__header-button quran-page__header-button--prev"
                :disabled="!canGoPrev || isLoading"
                @click="goPrev"
              >
                {{ t('quran.prev') }}
              </button>
              <span v-else class="quran-page__header-spacer quran-page__header-spacer--prev" aria-hidden="true" />
              <span v-if="!isArabicReadingMode" class="quran-page__header-page">{{ pageData.pageNumber }}</span>
              <span v-else class="quran-page__header-page quran-page__header-page--spacer" aria-hidden="true">&nbsp;</span>
              <button
                v-if="shouldShowHeaderButton(pageIndex, 'next')"
                type="button"
                class="btn quran-page__header-button quran-page__header-button--next"
                :disabled="!canGoNext || isLoading"
                @click="goNext"
              >
                {{ t('quran.next') }}
              </button>
              <span v-else class="quran-page__header-spacer quran-page__header-spacer--next" aria-hidden="true" />
            </div>
            <span v-if="!isArabicReadingMode" class="quran-page__header-page">{{ pageData.pageNumber }}</span>
            <span v-else class="quran-page__header-page quran-page__header-page--spacer" aria-hidden="true">&nbsp;</span>
          </header>

          <div v-if="pageData.verses.length" class="quran-page__verses">
            <template v-if="isArabicReadingMode">
              <div
                class="quran-page__mushaf-grid"
                dir="rtl"
                translate="no"
              >
                <p
                  v-for="line in getMushafLayout(pageData.pageNumber)?.lines ?? []"
                  :key="`line-${pageData.pageNumber}-${line.lineNumber}`"
                  class="quran-page__mushaf-line"
                  :class="{
                    'quran-page__mushaf-line--label': line.tokens.length > 0 && line.tokens[0].kind !== 'word',
                    'quran-page__mushaf-line--words': line.tokens.length > 0 && line.tokens[0].kind === 'word',
                    'quran-page__mushaf-line--empty': line.tokens.length === 0,
                  }"
                >
                  <template v-if="line.tokens.length">
                    <span class="quran-page__mushaf-line-content">
                      <template v-for="(token, tokenIndex) in line.tokens" :key="getMushafTokenKey(token, tokenIndex)">
                        <span
                          v-if="token.kind === 'word'"
                          :class="getMushafTokenClass(token)"
                          :style="getMushafTokenStyle(token, pageData.pageNumber)"
                          v-html="token.text"
                        />
                        <span
                          v-else
                          :class="getMushafTokenClass(token)"
                          :style="getMushafTokenStyle(token, pageData.pageNumber)"
                        >
                          {{ token.text }}
                        </span>
                      </template>
                    </span>
                  </template>
                  <span v-else class="quran-page__mushaf-placeholder" aria-hidden="true">&nbsp;</span>
                </p>
              </div>
              <p class="quran-page__mushaf-page-number">{{ pageData.pageNumber }}</p>
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
    </div>
  </section>
</template>
