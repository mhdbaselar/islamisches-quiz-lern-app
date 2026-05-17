import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TRANSLATION_ID,
  LegacyQuranProvider,
  getTranslationIdForLocale,
} from '@/services/quran/provider'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('quran provider', () => {
  it('maps locale to translation id with fallback', () => {
    expect(getTranslationIdForLocale('de')).toBe(27)
    expect(getTranslationIdForLocale('en')).toBe(85)
    expect(getTranslationIdForLocale('ar')).toBe(85)
    expect(getTranslationIdForLocale('fr')).toBe(DEFAULT_TRANSLATION_ID)
  })

  it('loads page data from legacy endpoint with translation parameter', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input
      void _init
      return jsonResponse({
        verses: [
          {
            id: 1,
            verse_key: '1:1',
            verse_number: 1,
            page_number: 1,
            text_uthmani: 'بِسْمِ',
            translations: [{ text: '<b>Im Namen</b>' }],
          },
          {
            id: 2,
            verse_key: '1:2',
            verse_number: 2,
            page_number: 1,
            text_uthmani: 'ٱلْحَمْدُ',
            translations: [],
          },
        ],
      })
    })

    const provider = new LegacyQuranProvider({
      fetchImpl: fetchMock as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    })

    const result = await provider.getPage({
      pageNumber: 1,
      locale: 'de',
      showTranslation: true,
    })

    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(requestUrl).toContain('/verses/by_page/1?')
    expect(requestUrl).toContain('fields=text_uthmani')
    expect(requestUrl).toContain('per_page=50')
    expect(requestUrl).toContain('translations=27')

    expect(result.pageNumber).toBe(1)
    expect(result.verses).toHaveLength(2)
    expect(result.verses[0]).toMatchObject({
      id: 1,
      verseKey: '1:1',
      verseNumber: 1,
      textUthmani: 'بِسْمِ',
      translation: 'Im Namen',
    })
    expect(result.verses[1].translation).toBeNull()
  })

  it('omits translation parameter when translation is disabled', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input
      void _init
      return jsonResponse({ verses: [] })
    })
    const provider = new LegacyQuranProvider({
      fetchImpl: fetchMock as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    })

    await provider.getPage({
      pageNumber: 12,
      locale: 'en',
      showTranslation: false,
    })

    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(requestUrl).not.toContain('translations=')
  })

  it('throws useful errors for failed and invalid responses', async () => {
    const failedFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input
      void _init
      return jsonResponse({}, 500)
    })
    const invalidFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input
      void _init
      return jsonResponse({ wrong: true })
    })

    const providerWithFailedResponse = new LegacyQuranProvider({
      fetchImpl: failedFetch as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    })
    const providerWithInvalidResponse = new LegacyQuranProvider({
      fetchImpl: invalidFetch as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    })

    await expect(providerWithFailedResponse.getPage({
      pageNumber: 8,
      locale: 'en',
      showTranslation: true,
    })).rejects.toThrow('Failed to load Quran page 8')

    await expect(providerWithInvalidResponse.getPage({
      pageNumber: 8,
      locale: 'en',
      showTranslation: true,
    })).rejects.toThrow('Unexpected Quran response')
  })

  it('loads chapters for surah navigation', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      void _input
      void _init
      return jsonResponse({
        chapters: [
          {
            id: 1,
            name_simple: 'Al-Fatihah',
            name_arabic: 'الفاتحة',
            pages: [1, 1],
            translated_name: { name: 'The Opening' },
          },
          {
            id: 2,
            name_simple: 'Al-Baqarah',
            name_arabic: 'البقرة',
            pages: [2, 49],
            translated_name: { name: 'The Cow' },
          },
        ],
      })
    })

    const provider = new LegacyQuranProvider({
      fetchImpl: fetchMock as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
    })

    const chapters = await provider.getChapters({ locale: 'de' })
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '')

    expect(requestUrl).toContain('/chapters?language=de')
    expect(chapters).toHaveLength(2)
    expect(chapters[0]).toMatchObject({
      id: 1,
      nameSimple: 'Al-Fatihah',
      nameArabic: 'الفاتحة',
      translatedName: 'The Opening',
      startPage: 1,
      endPage: 1,
    })
    expect(chapters[1]).toMatchObject({
      id: 2,
      startPage: 2,
      endPage: 49,
    })
  })
})
