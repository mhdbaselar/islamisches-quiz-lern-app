<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStorage } from '@vueuse/core'
import PageHeading from '@/components/ui/PageHeading.vue'
import type { QuranChapter, QuranPageData } from '@/services/quran/provider'
import { LegacyQuranProvider } from '@/services/quran/provider'
import { buildMushafPageLayout, type QuranMushafLineToken } from '@/services/quran/layout'
import {
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
const MUSHAF_TARGET_FILL_RATIO = 0.95
const MUSHAF_SCALE_MIN = 0.92
const MUSHAF_SCALE_MAX = 1.75

type QuranTextMode = 'arabic' | 'standard'

const currentPage = ref(1)
const pageInput = ref('1')
const readingMode = ref<QuranReadingMode>('single')
const textMode = ref<QuranTextMode>(locale.value === 'ar' ? 'arabic' : 'standard')
const reverseSpreadPages = useStorage<boolean>('app.quran.reverseSpread.v1', true)
const showTranslation = ref(true)
const isLoading = ref(false)
const error = ref<string | null>(null)
const pages = ref<QuranPageData[]>([])
const chapters = ref<QuranChapter[]>([])
const chaptersLoading = ref(false)
const chaptersError = ref<string | null>(null)
const isMobile = ref(false)
const pageFontReady = ref<Record<number, boolean>>({})
const mushafScaleByPage = ref<Record<number, number>>({})

let mediaQueryList: MediaQueryList | null = null
let abortController: AbortController | null = null
let chaptersAbortController: AbortController | null = null
let pendingMushafScaleFrame: number | null = null
let unicodeFontReady = false
let pendingUnicodeFontLoad: Promise<boolean> | null = null
const loadedQcfV2Pages = new Set<number>()
const pendingQcfFontLoads = new Map<number, Promise<boolean>>()

const effectiveMode = computed<QuranReadingMode>(() => (isMobile.value ? 'single' : readingMode.value))
const isArabicReadingMode = computed(() => textMode.value === 'arabic')
const visiblePageNumbers = computed(() => getVisibleQuranPages(currentPage.value, readingMode.value, isMobile.value))
const canGoPrev = computed(() =>
  getPreviousQuranPage(currentPage.value, readingMode.value, isMobile.value) !== currentPage.value)
const canGoNext = computed(() =>
  getNextQuranPage(currentPage.value, readingMode.value, isMobile.value) !== currentPage.value)
const shouldReverseSpreadPages = computed(() => effectiveMode.value === 'spread' && reverseSpreadPages.value)
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

function clampScale(value: number): number {
  return Math.max(MUSHAF_SCALE_MIN, Math.min(MUSHAF_SCALE_MAX, value))
}

function parsePageNumber(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function measureMushafScaleForGrid(gridElement: HTMLElement): number {
  const lineElements = Array.from(gridElement.querySelectorAll<HTMLElement>('.quran-page__mushaf-line'))
  const firstLine = lineElements[0]
  const lineWidth = firstLine?.clientWidth ?? gridElement.clientWidth
  if (!lineWidth) return 1

  const allLineContents = Array.from(
    gridElement.querySelectorAll<HTMLElement>('.quran-page__mushaf-line-content'),
  )
  if (!allLineContents.length) return 1

  // Use word lines as primary sizing signal so repeated basmala/surah lines
  // do not force the whole page to shrink.
  const wordLineContents = allLineContents.filter((lineContent) =>
    lineContent.closest('.quran-page__mushaf-line--words'))
  const measuredLineContents = wordLineContents.length > 0 ? wordLineContents : allLineContents

  let maxContentWidth = 0
  for (const lineContent of measuredLineContents) {
    maxContentWidth = Math.max(maxContentWidth, lineContent.scrollWidth)
  }
  if (!maxContentWidth) return 1

  const targetWidth = lineWidth * MUSHAF_TARGET_FILL_RATIO
  const scaleByWidth = targetWidth / maxContentWidth

  let scaleByHeight = Number.POSITIVE_INFINITY
  for (const lineContent of measuredLineContents) {
    const lineElement = lineContent.closest('.quran-page__mushaf-line')
    if (!(lineElement instanceof HTMLElement)) continue

    const availableHeight = lineElement.clientHeight
    const contentHeight = lineContent.scrollHeight
    if (!availableHeight || !contentHeight) continue

    const targetHeight = availableHeight * 0.985
    if (contentHeight <= targetHeight) continue
    scaleByHeight = Math.min(scaleByHeight, targetHeight / contentHeight)
  }

  const limitingScale = Number.isFinite(scaleByHeight)
    ? Math.min(scaleByWidth, scaleByHeight)
    : scaleByWidth
  return clampScale(limitingScale)
}

function updateMushafScaleFromDom() {
  if (typeof document === 'undefined') return
  if (!isArabicReadingMode.value) {
    mushafScaleByPage.value = {}
    return
  }

  const nextScaleByPage: Record<number, number> = {}
  const grids = document.querySelectorAll<HTMLElement>('.quran-page__mushaf-grid[data-page-number]')
  for (const grid of grids) {
    const pageNumber = parsePageNumber(grid.dataset.pageNumber)
    if (!pageNumber) continue
    nextScaleByPage[pageNumber] = measureMushafScaleForGrid(grid)
  }

  mushafScaleByPage.value = nextScaleByPage
}

function scheduleMushafScaleUpdate() {
  if (typeof window === 'undefined') return
  if (pendingMushafScaleFrame !== null) {
    window.cancelAnimationFrame(pendingMushafScaleFrame)
  }

  pendingMushafScaleFrame = window.requestAnimationFrame(() => {
    pendingMushafScaleFrame = null
    updateMushafScaleFromDom()
  })
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

function getMushafGridStyle(pageNumber: number): Record<string, string> {
  return { '--mushaf-scale': String(mushafScaleByPage.value[pageNumber] ?? 1) }
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
  isLoading.value = true
  error.value = null

  try {
    const requestedPages = visiblePageNumbers.value
    const loadedPages = await Promise.all(
      requestedPages.map((pageNumber) => provider.getPage({
        pageNumber,
        locale: locale.value,
        showTranslation: showTranslation.value,
        includeMushafWords: isArabicReadingMode.value,
        signal: controller.signal,
      })),
    )

    if (controller.signal.aborted) return
    pages.value = loadedPages
    await nextTick()
    scheduleMushafScaleUpdate()

    void ensureMushafFontsForPages(requestedPages).then(async () => {
      if (controller.signal.aborted) return
      await nextTick()
      scheduleMushafScaleUpdate()
    })
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
  [visiblePageNumbers, showTranslation, isArabicReadingMode, () => locale.value],
  () => {
    void loadPages()
  },
  { immediate: true },
)

watch(
  [isArabicReadingMode, displayPages],
  ([isArabic]) => {
    if (!isArabic) {
      mushafScaleByPage.value = {}
      return
    }
    void nextTick().then(() => {
      scheduleMushafScaleUpdate()
    })
    void ensureMushafFontsForPages(displayPages.value.map((page) => page.pageNumber)).then(async () => {
      await nextTick()
      scheduleMushafScaleUpdate()
    })
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
  window.addEventListener('resize', scheduleMushafScaleUpdate)

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
  window.removeEventListener('resize', scheduleMushafScaleUpdate)
  if (pendingMushafScaleFrame !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(pendingMushafScaleFrame)
  }

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

        <label class="quran-controls__toggle">
          <input v-model="reverseSpreadPages" type="checkbox" />
          <span>{{ t('quran.flipSpreadToggle') }}</span>
        </label>
      </div>

      <div class="quran-page-nav">
        <button type="button" class="btn" :disabled="!canGoPrev || isLoading" @click="goPrev">
          {{ t('quran.prev') }}
        </button>

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
        <button type="button" class="btn" :disabled="!canGoNext || isLoading" @click="goNext">
          {{ t('quran.next') }}
        </button>
      </div>

      <p class="quran-page-nav__indicator">{{ pageIndicator }}</p>
      <p v-if="chaptersError" class="quran-mobile-hint">{{ t('quran.surahLoadError') }}: {{ chaptersError }}</p>
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
            <div
              class="quran-page__mushaf-grid"
              :data-page-number="String(pageData.pageNumber)"
              :style="getMushafGridStyle(pageData.pageNumber)"
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
                    <span
                      v-for="(token, tokenIndex) in line.tokens"
                      :key="getMushafTokenKey(token, tokenIndex)"
                      :class="getMushafTokenClass(token)"
                      :style="getMushafTokenStyle(token, pageData.pageNumber)"
                    >
                      {{ token.text }}
                    </span>
                  </span>
                </template>
                <span v-else class="quran-page__mushaf-placeholder" aria-hidden="true">&nbsp;</span>
              </p>
            </div>
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
