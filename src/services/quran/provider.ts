import { clampQuranPage } from '@/services/quran/reader'

export interface QuranVerse {
  id: number
  verseKey: string
  verseNumber: number
  pageNumber: number
  textUthmani: string
  translation: string | null
}

export interface QuranPageData {
  pageNumber: number
  verses: QuranVerse[]
}

export interface QuranPageRequest {
  pageNumber: number
  locale: string
  showTranslation: boolean
  signal?: AbortSignal
}

export interface QuranProvider {
  getPage(request: QuranPageRequest): Promise<QuranPageData>
}

export const LEGACY_QURAN_API_BASE_URL = 'https://api.quran.com/api/v4'
export const DEFAULT_TRANSLATION_ID = 85
const TRANSLATION_ID_BY_LOCALE: Record<string, number> = {
  de: 27,
  en: 85,
  ar: 85,
}

type LegacyApiTranslation = {
  text?: unknown
}

type LegacyApiVerse = {
  id?: unknown
  verse_key?: unknown
  verse_number?: unknown
  page_number?: unknown
  text_uthmani?: unknown
  translations?: LegacyApiTranslation[]
}

type LegacyApiResponse = {
  verses?: LegacyApiVerse[]
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function getDefaultFetchImpl(): FetchLike {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch is not available in this runtime')
  }
  return globalThis.fetch.bind(globalThis) as FetchLike
}

export function getTranslationIdForLocale(locale: string): number {
  const normalized = locale.trim().toLowerCase()
  return TRANSLATION_ID_BY_LOCALE[normalized] ?? DEFAULT_TRANSLATION_ID
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class LegacyQuranProvider implements QuranProvider {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(options?: { baseUrl?: string, fetchImpl?: FetchLike }) {
    this.baseUrl = (options?.baseUrl ?? LEGACY_QURAN_API_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = options?.fetchImpl ?? getDefaultFetchImpl()
  }

  async getPage(request: QuranPageRequest): Promise<QuranPageData> {
    const pageNumber = clampQuranPage(request.pageNumber)
    const params = new URLSearchParams({
      fields: 'text_uthmani',
      per_page: '50',
    })

    if (request.showTranslation) {
      params.set('translations', String(getTranslationIdForLocale(request.locale)))
    }

    const response = await this.fetchImpl(
      `${this.baseUrl}/verses/by_page/${pageNumber}?${params.toString()}`,
      { signal: request.signal },
    )

    if (!response.ok) {
      throw new Error(`Failed to load Quran page ${pageNumber} (status ${response.status})`)
    }

    const payload = await response.json() as LegacyApiResponse
    if (!payload || !Array.isArray(payload.verses)) {
      throw new Error(`Unexpected Quran response for page ${pageNumber}`)
    }

    const verses = payload.verses
      .map((verse): QuranVerse | null => {
        const textUthmani = parseString(verse.text_uthmani).trim()
        if (!textUthmani) return null

        const translationText = parseString(verse.translations?.[0]?.text).trim()
        return {
          id: parseNumber(verse.id, 0),
          verseKey: parseString(verse.verse_key),
          verseNumber: parseNumber(verse.verse_number, 0),
          pageNumber: parseNumber(verse.page_number, pageNumber),
          textUthmani,
          translation: translationText ? stripHtmlTags(translationText) : null,
        }
      })
      .filter((verse): verse is QuranVerse => verse !== null)

    return {
      pageNumber,
      verses,
    }
  }
}

export class ProxyQuranProvider implements QuranProvider {
  async getPage(): Promise<QuranPageData> {
    throw new Error('ProxyQuranProvider is not configured yet. Add a backend proxy for Quran.Foundation OAuth2.')
  }
}
