import type { Question } from './state'

export function normalizeCorrectIndexes(question: Question): number[] {
  if (Array.isArray(question.correctIndexes) && question.correctIndexes.length) {
    return question.correctIndexes
  }
  if (typeof question.correctIndex === 'number') {
    return [question.correctIndex]
  }
  return []
}

export function sortNumeric(values: number[], asc = true): number[] {
  return [...values].sort((a, b) => (asc ? a - b : b - a))
}

export function answersMatch(selected: number[], correct: number[]): boolean {
  const normalizedSelected = sortNumeric(selected)
  const normalizedCorrect = sortNumeric(correct)
  return normalizedSelected.length === normalizedCorrect.length && normalizedSelected.every((value, index) => value === normalizedCorrect[index])
}

export type GivenAnswer = { questionId: string, selected: number[] }

export function computeResult(pool: Question[], answers: GivenAnswer[]) {
  let correct = 0
  const total = pool.length
  const details = pool.map((question, index) => {
    const given = answers[index]?.selected ?? []
    const normalizedCorrect = normalizeCorrectIndexes(question)
    const ok = answersMatch(given, normalizedCorrect)
    if (ok) correct += 1
    return { questionId: question.id, given, correct: normalizedCorrect, ok }
  })
  return { correct, total, details }
}
