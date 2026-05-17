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

    const standardButton = wrapper
      .findAll('button')
      .find((button) => button.text() === ar.quran.textModeStandard)
    expect(standardButton).toBeTruthy()
    await standardButton!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.quran-verse').length).toBeGreaterThan(0)
  })
})
