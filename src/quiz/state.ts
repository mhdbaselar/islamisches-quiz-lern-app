import { defineStore } from 'pinia'
import { i18n, type Locale } from '@/i18n'
import { useAdminStore } from '@/stores/admin'

// Ein lokalisierter Text hält pro Sprache einen String.
export type LocalizedText = Record<Locale, string>

export interface Category {
  id: string
  name: LocalizedText
}

export type StackMode = 'play' | 'learn'

export interface Stack {
  id: string
  categoryId: string
  name: LocalizedText
  modes: StackMode[]
}

export interface Question {
  id: string
  categoryId: string
  stackId: string
  text: LocalizedText
  answers: LocalizedText[]
  // Single correct (legacy)
  correctIndex?: number
  // Multiple correct answers (new)
  correctIndexes?: number[]
}

// Ein gespeichertes Spielergebnis (Run)
export interface RunRecord {
  id: string
  timestamp: number
  categoryId: string
  stackId: string
  total: number
  correct: number
  // optional: zur späteren Auswertung
  answers?: Array<{ questionId: string, selected: number[] }>
}

// Liefert die lokalisierte Darstellung mit Fallback.
export function ltxt(text: LocalizedText, fallback: Locale = 'en') {
  const loc = i18n.global.locale.value as Locale
  return text[loc] ?? text[fallback] ?? Object.values(text)[0] ?? ''
}

const ALL_STACK_MODES: StackMode[] = ['play', 'learn']

function normalizeStackModes(modes?: StackMode[] | null): StackMode[] {
  if (!Array.isArray(modes) || !modes.length) return [...ALL_STACK_MODES]
  const unique = new Set<StackMode>()
  for (const mode of modes) {
    if (ALL_STACK_MODES.includes(mode)) unique.add(mode)
  }
  return unique.size ? Array.from(unique) : [...ALL_STACK_MODES]
}

let nextId = 1000
function genId(prefix: string) {
  return `${prefix}_${nextId++}`
}

// Persistence
const STORAGE_KEY = 'app.quiz.v2'
const SCHEMA_VERSION = 3
type PersistedQuiz = {
  version: number
  nextId?: number
  categories: Category[]
  stacks: Stack[]
  questions: Question[]
  results?: RunRecord[]
}

type LegacyPersistedQuizV2 = {
  version: 2
  nextId?: number
  categories?: Category[]
  stacks?: Array<Omit<Stack, 'modes'> & { modes?: StackMode[] }>
  questions?: Question[]
  results?: RunRecord[]
}

function computeNextIdFromState(categories: Category[], stacks: Stack[], questions: Question[]): number {
  const ids = [
    ...categories.map(c => c.id),
    ...stacks.map(s => s.id),
    ...questions.map(q => q.id),
  ]
  let max = 1000
  for (const id of ids) {
    const m = id.match(/_(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!Number.isNaN(n) && n >= max) max = n + 1
    }
  }
  return max
}

function saveToStorage(data: PersistedQuiz): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore quota errors */ }
}

function upgradePersistedQuiz(data: unknown): PersistedQuiz | null {
  const legacy = data as LegacyPersistedQuizV2 | null
  if (!legacy || typeof legacy !== 'object') return null
  if (legacy.version !== 2) return null
  return {
    version: SCHEMA_VERSION,
    nextId: typeof legacy.nextId === 'number' ? legacy.nextId : undefined,
    categories: Array.isArray(legacy.categories) ? legacy.categories : [],
    stacks: Array.isArray(legacy.stacks)
      ? legacy.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st?.modes) }))
      : [],
    questions: Array.isArray(legacy.questions) ? legacy.questions : [],
    results: Array.isArray(legacy.results) ? legacy.results : [],
  }
}

function loadFromStorage(): PersistedQuiz | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedQuiz
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version === SCHEMA_VERSION) {
      return {
        ...parsed,
        stacks: parsed.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) })),
      }
    }
    const upgraded = upgradePersistedQuiz(parsed)
    if (upgraded) {
      saveToStorage(upgraded)
      return upgraded
    }
    return null
  } catch {
    return null
  }
}

let subscribed = false

export const useQuizState = defineStore('quiz', {
  state: () => ({
    categories: [
      {
        id: 'cat_intro',
        name: { de: 'Einsteigerfragen', en: 'Beginner Questions', ar: 'أسئلة للمبتدئين' },
      },
      {
        id: 'cat_daily',
        name: { de: 'Alltag & Etikette', en: 'Daily Life & Etiquette', ar: 'الحياة اليومية والآداب' },
      },
      {
        id: 'cat_aqida',
        name: { de: 'Glaubensgrundlagen', en: 'Beliefs (Aqidah)', ar: 'العقيدة' },
      },
      {
        id: 'cat_history',
        name: { de: 'Geschichte', en: 'History', ar: 'التاريخ' },
      },
      {
        id: 'cat_practice',
        name: { de: 'Praxis', en: 'Practice', ar: 'العبادات' },
      },
    ] as Category[],
    stacks: [
      {
        id: 'stack_pillars',
        categoryId: 'cat_aqida',
        name: { de: 'Säulen des Islam', en: 'Pillars of Islam', ar: 'أركان الإسلام' },
        modes: [...ALL_STACK_MODES],
      },
      {
        id: 'stack_prayer',
        categoryId: 'cat_practice',
        name: { de: 'Gebet', en: 'Prayer', ar: 'الصلاة' },
        modes: [...ALL_STACK_MODES],
      },
      {
        id: 'stack_intro_basics',
        categoryId: 'cat_intro',
        name: { de: 'Grundlagen', en: 'Basics', ar: 'أساسيات' },
        modes: [...ALL_STACK_MODES],
      },
      {
        id: 'stack_intro_facts',
        categoryId: 'cat_intro',
        name: { de: 'Schnelle Fakten', en: 'Quick Facts', ar: 'حقائق سريعة' },
        modes: [...ALL_STACK_MODES],
      },
      {
        id: 'stack_daily_ethics',
        categoryId: 'cat_daily',
        name: { de: 'Alltags-Etikette', en: 'Daily Etiquette', ar: 'آداب يومية' },
        modes: [...ALL_STACK_MODES],
      },
    ] as Stack[],
    questions: [
      {
        id: 'q1',
        categoryId: 'cat_aqida',
        stackId: 'stack_pillars',
        text: {
          de: 'Wie viele Säulen des Islams gibt es?',
          en: 'How many pillars of Islam are there?',
          ar: 'كم عدد أركان الإسلام؟',
        },
        answers: [
          { de: 'Drei', en: 'Three', ar: 'ثلاثة' },
          { de: 'Fünf', en: 'Five', ar: 'خمسة' },
          { de: 'Sieben', en: 'Seven', ar: 'سبعة' },
          { de: 'Zehn', en: 'Ten', ar: 'عشرة' },
        ],
        correctIndex: 1,
        correctIndexes: [1],
      },
      {
        id: 'q2',
        categoryId: 'cat_practice',
        stackId: 'stack_prayer',
        text: {
          de: 'Wie oft beten Muslime am Tag?',
          en: 'How many times do Muslims pray daily?',
          ar: 'كم مرة يصلي المسلمون يوميًا؟',
        },
        answers: [
          { de: 'Dreimal', en: 'Three times', ar: 'ثلاث مرات' },
          { de: 'Viermal', en: 'Four times', ar: 'أربع مرات' },
          { de: 'Fünfmal', en: 'Five times', ar: 'خمس مرات' },
          { de: 'Sechsmal', en: 'Six times', ar: 'ست مرات' },
        ],
        correctIndex: 2,
        correctIndexes: [2],
      },
      {
        id: 'q_intro_1',
        categoryId: 'cat_intro',
        stackId: 'stack_intro_basics',
        text: {
          de: "Was bedeutet das Wort 'Islam'?",
          en: "What does the word 'Islam' mean?",
          ar: 'ماذا يعني لفظ الإسلام؟',
        },
        answers: [
          { de: 'Friede und Hingabe', en: 'Peace and submission', ar: 'السلام والخضوع' },
          { de: 'Wissen', en: 'Knowledge', ar: 'المعرفة' },
          { de: 'Gemeinschaft', en: 'Community', ar: 'الجماعة' },
          { de: 'Reise', en: 'Journey', ar: 'رحلة' },
        ],
        correctIndex: 0,
        correctIndexes: [0],
      },
      {
        id: 'q_intro_2',
        categoryId: 'cat_intro',
        stackId: 'stack_intro_basics',
        text: {
          de: 'Wie heißt der letzte Prophet im Islam?',
          en: 'Who is the final Prophet in Islam?',
          ar: 'من هو آخر نبي في الإسلام؟',
        },
        answers: [
          { de: 'Prophet Adam', en: 'Prophet Adam', ar: 'النبي آدم' },
          { de: 'Prophet Ibrahim', en: 'Prophet Abraham', ar: 'النبي إبراهيم' },
          { de: 'Prophet Isa', en: 'Prophet Jesus', ar: 'النبي عيسى' },
          { de: 'Prophet Muhammad ﷺ', en: 'Prophet Muhammad ﷺ', ar: 'النبي محمد ﷺ' },
        ],
        correctIndex: 3,
        correctIndexes: [3],
      },
      {
        id: 'q_intro_3',
        categoryId: 'cat_intro',
        stackId: 'stack_intro_basics',
        text: {
          de: 'Wie heißt das heilige Buch der Muslime?',
          en: 'What is the holy book of Muslims?',
          ar: 'ما هو الكتاب المقدس للمسلمين؟',
        },
        answers: [
          { de: 'Torah', en: 'Torah', ar: 'التوراة' },
          { de: 'Bibel', en: 'Bible', ar: 'الإنجيل' },
          { de: 'Quran', en: 'Quran', ar: 'القرآن' },
          { de: 'Psalmen', en: 'Psalms', ar: 'الزبور' },
        ],
        correctIndex: 2,
        correctIndexes: [2],
      },
      {
        id: 'q_intro_4',
        categoryId: 'cat_intro',
        stackId: 'stack_intro_facts',
        text: {
          de: 'Wie lautet der Name Gottes im Islam?',
          en: 'What is the name of God in Islam?',
          ar: 'ما اسم الله في الإسلام؟',
        },
        answers: [
          { de: 'Allah', en: 'Allah', ar: 'الله' },
          { de: 'Yahweh', en: 'Yahweh', ar: 'يهوه' },
          { de: 'Brahma', en: 'Brahma', ar: 'براهما' },
          { de: 'Vishnu', en: 'Vishnu', ar: 'فيشنو' },
        ],
        correctIndex: 0,
        correctIndexes: [0],
      },
      {
        id: 'q_intro_5',
        categoryId: 'cat_intro',
        stackId: 'stack_intro_facts',
        text: {
          de: 'Welche Stadt ist die Geburtsstadt des Propheten Muhammad ﷺ?',
          en: 'Which city is the birthplace of Prophet Muhammad ﷺ?',
          ar: 'ما المدينة التي ولد فيها النبي محمد ﷺ؟',
        },
        answers: [
          { de: 'Medina', en: 'Medina', ar: 'المدينة' },
          { de: 'Mekka', en: 'Mecca', ar: 'مكة' },
          { de: 'Jerusalem', en: 'Jerusalem', ar: 'القدس' },
          { de: 'Kairo', en: 'Cairo', ar: 'القاهرة' },
        ],
        correctIndex: 1,
        correctIndexes: [1],
      },
      {
        id: 'q_intro_6',
        categoryId: 'cat_intro',
        stackId: 'stack_intro_facts',
        text: {
          de: 'Wie heißt der islamische Fastenmonat?',
          en: 'What is the Islamic month of fasting called?',
          ar: 'ما اسم شهر الصيام في الإسلام؟',
        },
        answers: [
          { de: 'Rajab', en: 'Rajab', ar: 'رجب' },
          { de: 'Ramadan', en: 'Ramadan', ar: 'رمضان' },
          { de: 'Muharram', en: 'Muharram', ar: 'محرم' },
          { de: 'Safar', en: 'Safar', ar: 'صفر' },
        ],
        correctIndex: 1,
        correctIndexes: [1],
      },
      {
        id: 'q_daily_1',
        categoryId: 'cat_daily',
        stackId: 'stack_daily_ethics',
        text: {
          de: 'Welche Grußformel wird unter Muslimen häufig verwendet?',
          en: 'Which greeting is commonly used among Muslims?',
          ar: 'ما التحية الشائعة بين المسلمين؟',
        },
        answers: [
          { de: 'Hallo', en: 'Hello', ar: 'مرحبًا' },
          { de: 'Salam alaikum', en: 'Salam alaikum', ar: 'السلام عليكم' },
          { de: 'Shalom', en: 'Shalom', ar: 'شالوم' },
          { de: 'Namaste', en: 'Namaste', ar: 'ناماستي' },
        ],
        correctIndex: 1,
        correctIndexes: [1],
      },
      {
        id: 'q_daily_2',
        categoryId: 'cat_daily',
        stackId: 'stack_daily_ethics',
        text: {
          de: 'Was antwortet man auf den Gruß “Salam alaikum”?',
          en: 'What is the response to the greeting “Salam alaikum”?',
          ar: 'ما الرد على تحية "السلام عليكم"؟',
        },
        answers: [
          { de: 'Guten Morgen', en: 'Good morning', ar: 'صباح الخير' },
          { de: 'Wa alaikum salam', en: 'Wa alaikum salam', ar: 'وعليكم السلام' },
          { de: 'Bis später', en: 'See you later', ar: 'أراك لاحقًا' },
          { de: 'Mashallah', en: 'Mashallah', ar: 'ما شاء الله' },
        ],
        correctIndex: 1,
        correctIndexes: [1],
      },
    ] as Question[],
    results: [] as RunRecord[],
  }),
  getters: {
    localizedCategoryName: (state) => (id: string) => {
      const cat = state.categories.find((c) => c.id === id)
      return cat ? ltxt(cat.name) : ''
    },
    localizedStackName: (state) => (id: string) => {
      const st = state.stacks.find((s) => s.id === id)
      return st ? ltxt(st.name) : ''
    },
    stacksByCategory: (state) => (categoryId?: string) => {
      return categoryId ? state.stacks.filter(s => s.categoryId === categoryId) : state.stacks
    },
    questionsByStack: (state) => (stackId?: string) => {
      return stackId ? state.questions.filter(q => q.stackId === stackId) : state.questions
    },
    questionsByCategory: (state) => (categoryId?: string) => {
      if (!categoryId) return state.questions
      const stackIds = state.stacks.filter(s => s.categoryId === categoryId).map(s => s.id)
      return state.questions.filter(q => stackIds.includes(q.stackId))
    },
    // Aggregierte Statistik nach Kategorie
    statsByCategory: (state) => {
      return () => {
        const map = new Map<string, { name: string, total: number, correct: number, runs: number }>()
        for (const r of state.results) {
          const cat = state.categories.find(c => c.id === r.categoryId)
          const name = cat ? ltxt(cat.name) : r.categoryId
          const prev = map.get(r.categoryId) ?? { name, total: 0, correct: 0, runs: 0 }
          prev.total += r.total
          prev.correct += r.correct
          prev.runs += 1
          map.set(r.categoryId, prev)
        }
        return Array.from(map.entries()).map(([id, v]) => ({ id, ...v, avg: v.total ? (v.correct / v.total) : 0 }))
      }
    },
    // Aggregierte Statistik nach Stapel (inkl. Kategorie-Name)
    statsByStack: (state) => {
      return () => {
        const map = new Map<string, { name: string, catName: string, total: number, correct: number, runs: number, categoryId: string }>()
        for (const r of state.results) {
          const st = state.stacks.find(s => s.id === r.stackId)
          const name = st ? ltxt(st.name) : r.stackId
          const cat = state.categories.find(c => c.id === r.categoryId)
          const catName = cat ? ltxt(cat.name) : r.categoryId
          const prev = map.get(r.stackId) ?? { name, catName, total: 0, correct: 0, runs: 0, categoryId: r.categoryId }
          prev.total += r.total
          prev.correct += r.correct
          prev.runs += 1
          map.set(r.stackId, prev)
        }
        return Array.from(map.entries()).map(([id, v]) => ({ id, ...v, avg: v.total ? (v.correct / v.total) : 0 }))
      }
    },
  },
  actions: {
    localize(text: LocalizedText) {
      return ltxt(text)
    },
    init() {
      // Load persisted state if available
      const persisted = loadFromStorage()
      if (persisted) {
        this.categories = persisted.categories ?? this.categories
        this.stacks = (persisted.stacks ?? this.stacks).map((st) => ({ ...st, modes: normalizeStackModes(st.modes) }))
        this.questions = persisted.questions ?? this.questions
        this.results = persisted.results ?? []
        // Set nextId from persisted or compute from state
        nextId = (persisted.nextId && persisted.nextId > 0)
          ? persisted.nextId
          : computeNextIdFromState(this.categories, this.stacks, this.questions)
      } else {
        // Persist initial seed once
        saveToStorage({
          version: SCHEMA_VERSION,
          nextId,
          categories: this.categories,
          stacks: this.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) })),
          questions: this.questions,
          results: this.results,
        })
      }

      // Subscribe once to persist on any change
      if (!subscribed) {
        this.$subscribe((_mutation, state) => {
          saveToStorage({
            version: SCHEMA_VERSION,
            nextId,
            categories: state.categories,
            stacks: state.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) })),
            questions: state.questions,
            results: state.results,
          })
        })
        subscribed = true
      }
    },
    exportBackup(): string {
      const payload: PersistedQuiz = {
        version: SCHEMA_VERSION,
        nextId,
        categories: this.categories,
        stacks: this.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) })),
        questions: this.questions,
        results: this.results,
      }
      return JSON.stringify(payload, null, 2)
    },
    importBackup(json: string): boolean {
      try {
        const data = JSON.parse(json) as PersistedQuiz
        if (!data || data.version !== SCHEMA_VERSION) return false
        if (!Array.isArray(data.categories) || !Array.isArray(data.stacks) || !Array.isArray(data.questions)) return false
        this.categories = data.categories
        this.stacks = data.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) }))
        this.questions = data.questions
        this.results = Array.isArray(data.results) ? data.results : []
        nextId = (data.nextId && data.nextId > 0) ? data.nextId : computeNextIdFromState(this.categories, this.stacks, this.questions)
        saveToStorage({
          version: SCHEMA_VERSION,
          nextId,
          categories: this.categories,
          stacks: this.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) })),
          questions: this.questions,
          results: this.results,
        })
        return true
      } catch {
        return false
      }
    },
    resetToDefaults() {
      // Clear storage and reload app defaults
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      this.$reset()
      nextId = computeNextIdFromState(this.categories, this.stacks, this.questions)
      saveToStorage({
        version: SCHEMA_VERSION,
        nextId,
        categories: this.categories,
        stacks: this.stacks.map((st) => ({ ...st, modes: normalizeStackModes(st.modes) })),
        questions: this.questions,
        results: this.results,
      })
    },
    addCategory(name: LocalizedText) {
      const id = genId('cat')
      const cat: Category = { id, name }
      this.categories.push(cat)
      return cat
    },
    updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>) {
      const idx = this.categories.findIndex(c => c.id === id)
      if (idx >= 0) this.categories[idx] = { ...this.categories[idx], ...patch }
    },
    deleteCategory(id: string) {
      // delete stacks in category and their questions
      const stackIds = this.stacks.filter(s => s.categoryId === id).map(s => s.id)
      this.stacks = this.stacks.filter(s => s.categoryId !== id)
      this.questions = this.questions.filter(q => q.categoryId !== id && !stackIds.includes(q.stackId))
      this.categories = this.categories.filter(c => c.id !== id)
      // zugehörige Ergebnisse entfernen
      this.results = this.results.filter(r => r.categoryId !== id && !stackIds.includes(r.stackId))
    },
    addStack(payload: Omit<Stack, 'id'>) {
      const st: Stack = {
        id: genId('stack'),
        ...payload,
        modes: normalizeStackModes(payload.modes),
      }
      this.stacks.push(st)
      return st
    },
    updateStack(id: string, patch: Partial<Omit<Stack, 'id'>>) {
      const idx = this.stacks.findIndex(s => s.id === id)
      if (idx >= 0) {
        const prev = this.stacks[idx]
        const next = { ...prev, ...patch }
        if (patch.modes) {
          next.modes = normalizeStackModes(patch.modes)
        }
        this.stacks[idx] = next
        // Wenn sich die Kategorie geändert hat, passe alle Fragen im Stapel an
        if (patch.categoryId && patch.categoryId !== prev.categoryId) {
          this.questions = this.questions.map(q => q.stackId === id ? { ...q, categoryId: next.categoryId } : q)
        }
      }
    },
    deleteStack(id: string) {
      this.stacks = this.stacks.filter(s => s.id !== id)
      this.questions = this.questions.filter(q => q.stackId !== id)
      // zugehörige Ergebnisse entfernen
      this.results = this.results.filter(r => r.stackId !== id)
    },
    reorderStacks(categoryId: string, orderedIds: string[]) {
      // Ersetze nur die Elemente dieser Kategorie an ihren bisherigen Indizes
      const positions: number[] = []
      const items: Stack[] = []
      this.stacks.forEach((s, idx) => {
        if (s.categoryId === categoryId) {
          positions.push(idx)
        }
      })
      for (const id of orderedIds) {
        const st = this.stacks.find(s => s.id === id && s.categoryId === categoryId)
        if (st) items.push(st)
      }
      if (positions.length === items.length) {
        positions.forEach((pos, i) => { this.stacks[pos] = items[i] })
      }
    },
    addQuestion(payload: Omit<Question, 'id' | 'categoryId'> & { categoryId?: string }) {
      const stack = this.stacks.find(s => s.id === payload.stackId)
      const categoryId = payload.categoryId ?? stack?.categoryId ?? ''
      const q: Question = { id: genId('q'), ...payload, categoryId }
      this.questions.push(q)
      return q
    },
    updateQuestion(id: string, patch: Partial<Omit<Question, 'id'>>) {
      const idx = this.questions.findIndex(q => q.id === id)
      if (idx >= 0) {
        const next = { ...this.questions[idx], ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'stackId')) {
          const st = this.stacks.find(s => s.id === (patch.stackId ?? next.stackId))
          if (st && !patch.categoryId) {
            next.categoryId = st.categoryId
          }
        }
        this.questions[idx] = next
      }
    },
    deleteQuestion(id: string) {
      this.questions = this.questions.filter(q => q.id !== id)
    },
    reorderQuestions(stackId: string, orderedIds: string[]) {
      const positions: number[] = []
      const items: Question[] = []
      this.questions.forEach((q, idx) => {
        if (q.stackId === stackId) positions.push(idx)
      })
      for (const id of orderedIds) {
        const q = this.questions.find(qq => qq.id === id && qq.stackId === stackId)
        if (q) items.push(q)
      }
      if (positions.length === items.length) {
        positions.forEach((pos, i) => { this.questions[pos] = items[i] })
      }
    },
    // Ergebnis eines Spiels speichern
    recordRun(payload: Omit<RunRecord, 'id' | 'timestamp'>) {
      const id = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const rec: RunRecord = { id, timestamp: Date.now(), ...payload }
      this.results.push(rec)
      return rec
    },
    clearResults(): boolean {
      const admin = useAdminStore()
      if (!admin.isAdmin) {
        return false
      }
      this.results = []
      return true
    },
  },
})

export type { Question as QuizQuestion }
