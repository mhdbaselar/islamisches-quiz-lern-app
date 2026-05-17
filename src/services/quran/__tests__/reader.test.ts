import { describe, expect, it } from 'vitest'
import {
  clampQuranPage,
  getNextQuranPage,
  getPreviousQuranPage,
  getVisibleQuranPages,
} from '@/services/quran/reader'

describe('quran reader helpers', () => {
  it('clamps pages to 1..604', () => {
    expect(clampQuranPage(-10)).toBe(1)
    expect(clampQuranPage(999)).toBe(604)
    expect(clampQuranPage(12.9)).toBe(12)
  })

  it('builds odd/even pairs in spread mode', () => {
    expect(getVisibleQuranPages(2, 'spread', false)).toEqual([1, 2])
    expect(getVisibleQuranPages(57, 'spread', false)).toEqual([57, 58])
    expect(getVisibleQuranPages(604, 'spread', false)).toEqual([603, 604])
  })

  it('uses single page on mobile even when spread is selected', () => {
    expect(getVisibleQuranPages(33, 'spread', true)).toEqual([33])
  })

  it('navigates within boundaries in single mode', () => {
    expect(getPreviousQuranPage(1, 'single', false)).toBe(1)
    expect(getNextQuranPage(1, 'single', false)).toBe(2)
    expect(getNextQuranPage(604, 'single', false)).toBe(604)
  })

  it('navigates by spread in desktop mode', () => {
    expect(getNextQuranPage(1, 'spread', false)).toBe(3)
    expect(getNextQuranPage(2, 'spread', false)).toBe(3)
    expect(getPreviousQuranPage(4, 'spread', false)).toBe(1)
    expect(getPreviousQuranPage(604, 'spread', false)).toBe(601)
    expect(getNextQuranPage(603, 'spread', false)).toBe(604)
  })
})
