export type QuranReadingMode = 'single' | 'spread'

export const QURAN_MIN_PAGE = 1
export const QURAN_MAX_PAGE = 604

export function clampQuranPage(page: number): number {
  if (!Number.isFinite(page)) return QURAN_MIN_PAGE
  const normalized = Math.trunc(page)
  return Math.min(QURAN_MAX_PAGE, Math.max(QURAN_MIN_PAGE, normalized))
}

export function getSpreadStartPage(page: number): number {
  const clamped = clampQuranPage(page)
  if (clamped === QURAN_MAX_PAGE) {
    return QURAN_MAX_PAGE - 1
  }
  return clamped % 2 === 0 ? clamped - 1 : clamped
}

export function getVisibleQuranPages(currentPage: number, readingMode: QuranReadingMode, isMobile: boolean): number[] {
  const clamped = clampQuranPage(currentPage)
  if (readingMode === 'single' || isMobile) {
    return [clamped]
  }

  const leftPage = getSpreadStartPage(clamped)
  const rightPage = Math.min(leftPage + 1, QURAN_MAX_PAGE)
  return [leftPage, rightPage]
}

export function getNextQuranPage(currentPage: number, readingMode: QuranReadingMode, isMobile: boolean): number {
  const clamped = clampQuranPage(currentPage)
  if (readingMode === 'spread' && !isMobile) {
    const leftPage = getSpreadStartPage(clamped)
    return Math.min(leftPage + 2, QURAN_MAX_PAGE)
  }
  return Math.min(clamped + 1, QURAN_MAX_PAGE)
}

export function getPreviousQuranPage(currentPage: number, readingMode: QuranReadingMode, isMobile: boolean): number {
  const clamped = clampQuranPage(currentPage)
  if (readingMode === 'spread' && !isMobile) {
    const leftPage = getSpreadStartPage(clamped)
    return Math.max(leftPage - 2, QURAN_MIN_PAGE)
  }
  return Math.max(clamped - 1, QURAN_MIN_PAGE)
}
