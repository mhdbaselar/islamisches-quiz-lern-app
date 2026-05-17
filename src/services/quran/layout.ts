import type { QuranPageData, QuranWord } from '@/services/quran/provider'

export const MUSHAF_LINE_COUNT = 15
export const DEFAULT_BASMALA_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'

export type QuranMushafLineToken = QuranMushafWordToken | QuranMushafLabelToken

export interface QuranMushafWordToken {
  kind: 'word'
  text: string
  codeV2: string
  charTypeName: string
  verseKey: string
  position: number
}

export interface QuranMushafLabelToken {
  kind: 'surah' | 'basmala'
  text: string
  chapterId: number
}

export interface QuranMushafLine {
  lineNumber: number
  tokens: QuranMushafLineToken[]
}

export interface QuranMushafPageLayout {
  pageNumber: number
  lines: QuranMushafLine[]
}

export interface BuildMushafPageLayoutOptions {
  getSurahArabicName?: (chapterId: number) => string | undefined
  basmalaText?: string
}

type ChapterStart = {
  chapterId: number
  startLine: number
}

function parseChapterId(verseKey: string): number {
  const [chapterPart] = verseKey.split(':')
  const chapterId = Number.parseInt(chapterPart ?? '', 10)
  return Number.isFinite(chapterId) ? chapterId : 0
}

function isLineNumberInRange(lineNumber: number): boolean {
  return Number.isInteger(lineNumber) && lineNumber >= 1 && lineNumber <= MUSHAF_LINE_COUNT
}

function resolveWordText(word: QuranWord): string {
  return word.codeV2 || word.textQpcHafs || word.textUthmani
}

function getFirstWordOfVerse(words: QuranWord[], pageNumber: number): QuranWord | null {
  const candidates = words
    .filter((word) => word.pageNumber === pageNumber && isLineNumberInRange(word.lineNumber))
    .sort((a, b) => a.position - b.position)
  return candidates[0] ?? null
}

function createEmptyMushafLines(): QuranMushafLine[] {
  return Array.from(
    { length: MUSHAF_LINE_COUNT },
    (_, index): QuranMushafLine => ({
      lineNumber: index + 1,
      tokens: [],
    }),
  )
}

function formatSurahTitle(chapterId: number, getSurahArabicName?: (chapterId: number) => string | undefined): string {
  const name = getSurahArabicName?.(chapterId)?.trim()
  if (name) return `سُورَةُ ${name}`
  return `سُورَةُ ${chapterId}`
}

export function buildMushafPageLayout(
  pageData: QuranPageData,
  options: BuildMushafPageLayoutOptions = {},
): QuranMushafPageLayout {
  const lines = createEmptyMushafLines()
  const chapterStarts: ChapterStart[] = []

  for (const verse of pageData.verses) {
    const words = verse.words
      .filter((word) => word.pageNumber === pageData.pageNumber && isLineNumberInRange(word.lineNumber))
      .sort((a, b) => a.position - b.position)

    for (const word of words) {
      const targetLine = lines[word.lineNumber - 1]
      targetLine.tokens.push({
        kind: 'word',
        text: resolveWordText(word),
        codeV2: word.codeV2,
        charTypeName: word.charTypeName,
        verseKey: word.verseKey,
        position: word.position,
      })
    }

    if (verse.verseNumber !== 1) continue
    const chapterId = parseChapterId(verse.verseKey)
    if (chapterId <= 0) continue
    const firstWord = getFirstWordOfVerse(verse.words, pageData.pageNumber)
    if (!firstWord) continue
    chapterStarts.push({
      chapterId,
      startLine: firstWord.lineNumber,
    })
  }

  const basmalaText = options.basmalaText?.trim() || DEFAULT_BASMALA_TEXT
  chapterStarts
    .sort((a, b) => a.startLine - b.startLine)
    .forEach(({ chapterId, startLine }) => {
      let surahLine = chapterId === 1 ? startLine - 1 : startLine - 2
      if (!isLineNumberInRange(surahLine)) {
        const fallbackSurahLine = startLine - 1
        if (isLineNumberInRange(fallbackSurahLine)) {
          surahLine = fallbackSurahLine
        }
      }

      if (isLineNumberInRange(surahLine)) {
        const line = lines[surahLine - 1]
        if (line.tokens.length === 0) {
          line.tokens.push({
            kind: 'surah',
            text: formatSurahTitle(chapterId, options.getSurahArabicName),
            chapterId,
          })
        }
      }

      if (chapterId === 1 || chapterId === 9) return

      const basmalaLine = startLine - 1
      if (!isLineNumberInRange(basmalaLine)) return
      const line = lines[basmalaLine - 1]
      if (line.tokens.length > 0) return
      line.tokens.push({
        kind: 'basmala',
        text: basmalaText,
        chapterId,
      })
    })

  return {
    pageNumber: pageData.pageNumber,
    lines,
  }
}
