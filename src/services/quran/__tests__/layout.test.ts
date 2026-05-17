import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BASMALA_TEXT,
  MUSHAF_LINE_COUNT,
  buildMushafPageLayout,
} from '@/services/quran/layout'
import type { QuranPageData, QuranVerse, QuranWord } from '@/services/quran/provider'

function createWord(input: Partial<QuranWord> & Pick<QuranWord, 'position' | 'lineNumber' | 'pageNumber'>): QuranWord {
  return {
    position: input.position,
    lineNumber: input.lineNumber,
    pageNumber: input.pageNumber,
    charTypeName: input.charTypeName ?? 'word',
    codeV2: input.codeV2 ?? '',
    textQpcHafs: input.textQpcHafs ?? '',
    textUthmani: input.textUthmani ?? '',
    verseKey: input.verseKey ?? '',
  }
}

function createVerse(input: {
  id: number
  verseKey: string
  verseNumber: number
  pageNumber: number
  words: QuranWord[]
}): QuranVerse {
  return {
    id: input.id,
    verseKey: input.verseKey,
    verseNumber: input.verseNumber,
    pageNumber: input.pageNumber,
    textUthmani: '',
    translation: null,
    words: input.words,
  }
}

function createPage(pageNumber: number, verses: QuranVerse[]): QuranPageData {
  return {
    pageNumber,
    verses,
  }
}

describe('quran mushaf layout', () => {
  it('always builds exactly 15 lines', () => {
    const page = createPage(3, [
      createVerse({
        id: 13,
        verseKey: '2:6',
        verseNumber: 6,
        pageNumber: 3,
        words: [
          createWord({ position: 1, lineNumber: 1, pageNumber: 3, codeV2: 'ﱁ', verseKey: '2:6' }),
          createWord({ position: 2, lineNumber: 1, pageNumber: 3, codeV2: 'ﱂ', verseKey: '2:6' }),
        ],
      }),
    ])

    const layout = buildMushafPageLayout(page)
    expect(layout.lines).toHaveLength(MUSHAF_LINE_COUNT)
    expect(layout.lines[0].lineNumber).toBe(1)
    expect(layout.lines[14].lineNumber).toBe(15)
  })

  it('places surah line and basmala line before surah 2 on page 2', () => {
    const page = createPage(2, [
      createVerse({
        id: 8,
        verseKey: '2:1',
        verseNumber: 1,
        pageNumber: 2,
        words: [
          createWord({ position: 1, lineNumber: 3, pageNumber: 2, codeV2: 'ﭐ', verseKey: '2:1' }),
          createWord({
            position: 2,
            lineNumber: 3,
            pageNumber: 2,
            charTypeName: 'end',
            textQpcHafs: '١',
            verseKey: '2:1',
          }),
        ],
      }),
    ])

    const layout = buildMushafPageLayout(page, {
      getSurahArabicName: (chapterId) => (chapterId === 2 ? 'البقرة' : undefined),
    })

    expect(layout.lines[0].tokens[0]).toMatchObject({
      kind: 'surah',
      text: 'سُورَةُ البقرة',
      chapterId: 2,
    })
    expect(layout.lines[1].tokens[0]).toMatchObject({
      kind: 'basmala',
      text: DEFAULT_BASMALA_TEXT,
      chapterId: 2,
    })
    expect(layout.lines[2].tokens).toHaveLength(2)
    expect(layout.lines[2].tokens[0]).toMatchObject({ kind: 'word', codeV2: 'ﭐ' })
  })

  it('keeps surah 9 without basmala line', () => {
    const page = createPage(187, [
      createVerse({
        id: 1137,
        verseKey: '9:1',
        verseNumber: 1,
        pageNumber: 187,
        words: [createWord({ position: 1, lineNumber: 2, pageNumber: 187, codeV2: 'ﱚ', verseKey: '9:1' })],
      }),
    ])

    const layout = buildMushafPageLayout(page, {
      getSurahArabicName: (chapterId) => (chapterId === 9 ? 'التوبة' : undefined),
    })

    expect(layout.lines[0].tokens[0]).toMatchObject({
      kind: 'surah',
      text: 'سُورَةُ التوبة',
      chapterId: 9,
    })
    expect(layout.lines[1].tokens.some((token) => token.kind === 'basmala')).toBe(false)
  })

  it('handles a mid-page surah transition with reserved surah/basmala lines', () => {
    const page = createPage(106, [
      createVerse({
        id: 860,
        verseKey: '4:176',
        verseNumber: 176,
        pageNumber: 106,
        words: [createWord({ position: 1, lineNumber: 1, pageNumber: 106, codeV2: 'ﯓ', verseKey: '4:176' })],
      }),
      createVerse({
        id: 861,
        verseKey: '5:1',
        verseNumber: 1,
        pageNumber: 106,
        words: [createWord({ position: 1, lineNumber: 8, pageNumber: 106, codeV2: 'ﰱ', verseKey: '5:1' })],
      }),
      createVerse({
        id: 862,
        verseKey: '5:2',
        verseNumber: 2,
        pageNumber: 106,
        words: [createWord({ position: 1, lineNumber: 10, pageNumber: 106, codeV2: 'ﰲ', verseKey: '5:2' })],
      }),
    ])

    const layout = buildMushafPageLayout(page, {
      getSurahArabicName: (chapterId) => (chapterId === 5 ? 'المائدة' : undefined),
    })

    expect(layout.lines[5].tokens[0]).toMatchObject({
      kind: 'surah',
      text: 'سُورَةُ المائدة',
      chapterId: 5,
    })
    expect(layout.lines[6].tokens[0]).toMatchObject({
      kind: 'basmala',
      text: DEFAULT_BASMALA_TEXT,
      chapterId: 5,
    })
    expect(layout.lines[7].tokens[0]).toMatchObject({ kind: 'word', codeV2: 'ﰱ' })
  })

  it('supports multiple surah starts on page 604', () => {
    const page = createPage(604, [
      createVerse({
        id: 6222,
        verseKey: '112:1',
        verseNumber: 1,
        pageNumber: 604,
        words: [createWord({ position: 1, lineNumber: 3, pageNumber: 604, codeV2: 'ﱠ', verseKey: '112:1' })],
      }),
      createVerse({
        id: 6226,
        verseKey: '113:1',
        verseNumber: 1,
        pageNumber: 604,
        words: [createWord({ position: 1, lineNumber: 7, pageNumber: 604, codeV2: 'ﱡ', verseKey: '113:1' })],
      }),
      createVerse({
        id: 6231,
        verseKey: '114:1',
        verseNumber: 1,
        pageNumber: 604,
        words: [createWord({ position: 1, lineNumber: 12, pageNumber: 604, codeV2: 'ﱢ', verseKey: '114:1' })],
      }),
    ])

    const layout = buildMushafPageLayout(page, {
      getSurahArabicName: (chapterId) => {
        if (chapterId === 112) return 'الإخلاص'
        if (chapterId === 113) return 'الفلق'
        if (chapterId === 114) return 'الناس'
        return undefined
      },
    })

    expect(layout.lines[0].tokens[0]).toMatchObject({ kind: 'surah', chapterId: 112 })
    expect(layout.lines[1].tokens[0]).toMatchObject({ kind: 'basmala', chapterId: 112 })
    expect(layout.lines[4].tokens[0]).toMatchObject({ kind: 'surah', chapterId: 113 })
    expect(layout.lines[5].tokens[0]).toMatchObject({ kind: 'basmala', chapterId: 113 })
    expect(layout.lines[9].tokens[0]).toMatchObject({ kind: 'surah', chapterId: 114 })
    expect(layout.lines[10].tokens[0]).toMatchObject({ kind: 'basmala', chapterId: 114 })
  })
})
