import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ar from '@/locales/ar/common'
import type { QuranChapter, QuranPageData, QuranPageRequest } from '@/services/quran/provider'

const getPageMock = vi.fn<(request: QuranPageRequest) => Promise<QuranPageData>>()
const getChaptersMock = vi.fn<(request?: { locale?: string }) => Promise<QuranChapter[]>>()

vi.mock('@/services/quran/provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/quran/provider')>()
  return {
    ...actual,
    LegacyQuranProvider: class {
      async getPage(request: QuranPageRequest) {
        return getPageMock(request)
      }

      async getChapters(request?: { locale?: string }) {
        return getChaptersMock(request)
      }
    },
  }
})

import QuranView from '@/views/quiz/QuranView.vue'

function buildPage(request: QuranPageRequest): QuranPageData {
  return {
    pageNumber: request.pageNumber,
    verses: [
      {
        id: 8,
        verseKey: '2:1',
        verseNumber: 1,
        pageNumber: request.pageNumber,
        textUthmani: 'الٓمٓ',
        translation: 'Alif Lam Mim',
        words: request.includeMushafWords
          ? [
              {
                position: 1,
                lineNumber: 3,
                pageNumber: request.pageNumber,
                charTypeName: 'word',
                codeV2: 'ﭐ',
                textQpcHafs: 'الٓمٓ',
                textUthmani: 'الٓمٓ',
                verseKey: '2:1',
              },
              {
                position: 2,
                lineNumber: 3,
                pageNumber: request.pageNumber,
                charTypeName: 'end',
                codeV2: '',
                textQpcHafs: '١',
                textUthmani: '١',
                verseKey: '2:1',
              },
            ]
          : [],
      },
      {
        id: 9,
        verseKey: '2:2',
        verseNumber: 2,
        pageNumber: request.pageNumber,
        textUthmani: 'ذَٰلِكَ ٱلْكِتَـٰبُ',
        translation: 'This is the Book',
        words: request.includeMushafWords
          ? [
              {
                position: 1,
                lineNumber: 4,
                pageNumber: request.pageNumber,
                charTypeName: 'word',
                codeV2: 'ﭑ',
                textQpcHafs: 'ذَٰلِكَ',
                textUthmani: 'ذَٰلِكَ',
                verseKey: '2:2',
              },
            ]
          : [],
      },
    ],
  }
}

function getRenderedPageNumbers(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.quran-page__header span').map((header) => {
    const match = header.text().match(/(\d+)$/)
    return match ? Number.parseInt(match[1], 10) : NaN
  }).filter((pageNumber) => Number.isFinite(pageNumber))
}

describe('QuranView mushaf rendering', () => {
  beforeEach(() => {
    getPageMock.mockImplementation(async (request) => buildPage(request))
    getChaptersMock.mockResolvedValue([
      {
        id: 2,
        nameSimple: 'Al-Baqarah',
        nameArabic: 'البقرة',
        translatedName: 'The Cow',
        startPage: 2,
        endPage: 49,
      },
    ])
  })

  it('renders a 15-line mushaf grid in arabic mode and keeps standard mode verse cards', async () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'ar',
      messages: { ar },
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'quran', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(QuranView, {
      global: {
        plugins: [i18n, router],
        stubs: {
          Icon: { template: '<span />' },
        },
      },
    })

    await flushPromises()

    expect(getPageMock).toHaveBeenCalled()
    expect(getPageMock.mock.calls[0]?.[0]?.includeMushafWords).toBe(true)
    expect(wrapper.findAll('.quran-page__mushaf-line')).toHaveLength(15)
    expect(wrapper.find('.quran-page__mushaf-line--label').text()).toContain('سُورَةُ')
    expect(wrapper.findAll('.quran-page__translation-line').length).toBeGreaterThan(0)
    expect(wrapper.find('.quran-page__header-nav').classes()).toContain('quran-page__header-nav--arabic')

    const spreadButton = wrapper
      .findAll('button')
      .find((button) => button.text() === ar.quran.spread)
    expect(spreadButton).toBeTruthy()
    await spreadButton!.trigger('click')
    await flushPromises()

    expect(getRenderedPageNumbers(wrapper)).toEqual([2, 1])
    const arabicSpreadHeaderButtons = wrapper
      .findAll('.quran-page__header-nav')
      .map((header) => header.findAll('button'))
    expect(arabicSpreadHeaderButtons).toHaveLength(2)
    expect(arabicSpreadHeaderButtons[0]).toHaveLength(1)
    expect(arabicSpreadHeaderButtons[1]).toHaveLength(1)
    expect(arabicSpreadHeaderButtons[0][0].text()).toBe(ar.quran.next)
    expect(arabicSpreadHeaderButtons[1][0].text()).toBe(ar.quran.prev)

    const standardButton = wrapper
      .findAll('button')
      .find((button) => button.text() === ar.quran.textModeStandard)
    expect(standardButton).toBeTruthy()
    await standardButton!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.quran-verse').length).toBeGreaterThan(0)
    expect(wrapper.find('.quran-page__header-nav').classes()).not.toContain('quran-page__header-nav--arabic')
    const standardSpreadHeaderButtons = wrapper
      .findAll('.quran-page__header-nav')
      .map((header) => header.findAll('button'))
    expect(standardSpreadHeaderButtons).toHaveLength(2)
    expect(standardSpreadHeaderButtons[0]).toHaveLength(1)
    expect(standardSpreadHeaderButtons[1]).toHaveLength(1)
    expect(standardSpreadHeaderButtons[0][0].text()).toBe(ar.quran.prev)
    expect(standardSpreadHeaderButtons[1][0].text()).toBe(ar.quran.next)
    expect(getRenderedPageNumbers(wrapper)).toEqual([1, 2])
    const lastCall = getPageMock.mock.calls[getPageMock.mock.calls.length - 1]
    expect(lastCall?.[0]?.includeMushafWords).toBe(false)
  })

  it('keeps the current page rendered while loading the next page', async () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'ar',
      messages: { ar },
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'quran', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()

    let callCount = 0
    let resolvePendingPage: (() => void) | null = null
    getPageMock.mockImplementation((request) => {
      callCount += 1
      if (callCount === 1) {
        return Promise.resolve(buildPage(request))
      }
      return new Promise<QuranPageData>((resolve) => {
        resolvePendingPage = () => resolve(buildPage(request))
      })
    })

    const wrapper = mount(QuranView, {
      global: {
        plugins: [i18n, router],
        stubs: {
          Icon: { template: '<span />' },
        },
      },
    })

    await flushPromises()

    const nextButton = wrapper
      .findAll('button')
      .find((button) => button.text() === ar.quran.next)
    expect(nextButton).toBeTruthy()
    await nextButton!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.quran-reader').exists()).toBe(true)
    expect(wrapper.find('.quran-reader-stack__loading').exists()).toBe(true)
    expect(wrapper.find('.quran-page__header-page').text()).toContain('1')
    expect(resolvePendingPage).toBeTypeOf('function')

    resolvePendingPage?.()
    await flushPromises()

    expect(wrapper.find('.quran-reader-stack__loading').exists()).toBe(false)
    expect(wrapper.find('.quran-page__header-page').text()).toContain('2')
  })
})
