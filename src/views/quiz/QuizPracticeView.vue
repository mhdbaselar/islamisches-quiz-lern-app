<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '@/components/ui/BaseModal.vue'
import PageHeading from '@/components/ui/PageHeading.vue'
import StackModeSelector from '@/components/quiz/StackModeSelector.vue'
import QuizChoiceList from '@/components/quiz/QuizChoiceList.vue'
import { computeResult, answersMatch, normalizeCorrectIndexes } from '@/quiz/scoring'
import { useQuizFlow } from '@/quiz/flow'

type Mode = 'play' | 'learn'
type GivenAnswer = { questionId: string, selected: number[] }

type StackSelection = { stackId: string, mode: Mode }

const SESSION_KEY = 'app.quiz.session.v1'
const SESSION_VERSION = 1

type SessionPayload = {
  version: number
  running: boolean
  mode: Mode | null
  stackId: string
  idx: number
  selected: number[]
  answers: GivenAnswer[]
  checked: boolean
  isCorrect: boolean
  showResult: boolean
  triedAdvance: boolean
  questionIds: string[]
}

const { t } = useI18n()

const {
  quiz,
  groups,
  running,
  currentStackId,
  pool,
  idx,
  selected,
  triedAdvance,
  current,
  startStack,
  cancelRun,
  resetQuestionState,
} = useQuizFlow()

const activeMode = ref<Mode | null>(null)
const answers = ref<GivenAnswer[]>([])
const showResult = ref(false)
const checked = ref(false)
const isCorrect = ref(false)

const result = computed(() => computeResult(pool.value, answers.value))
const formatQuestionCount = (count: number) => `${count} ${count === 1 ? t('quiz.play.questionSingular') : t('quiz.play.questionPlural')}`
const correctAnswers = computed(() => (current.value ? normalizeCorrectIndexes(current.value) : []))
const correctAnswerTexts = computed(() => {
  if (!current.value) return [] as string[]
  return correctAnswers.value.map((answerIndex) => quiz.localize(current.value!.answers[answerIndex]))
})

const isRestoring = ref(true)

function clearSession() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore storage errors
  }
}

function saveSession() {
  if (isRestoring.value || typeof window === 'undefined') return
  if (!running.value || !activeMode.value) {
    clearSession()
    return
  }

  const payload: SessionPayload = {
    version: SESSION_VERSION,
    running: running.value,
    mode: activeMode.value,
    stackId: currentStackId.value,
    idx: idx.value,
    selected: [...selected.value],
    answers: answers.value
      .filter((entry): entry is GivenAnswer => !!entry && Array.isArray(entry.selected))
      .map((entry) => ({ questionId: entry.questionId, selected: [...entry.selected] })),
    checked: checked.value,
    isCorrect: isCorrect.value,
    showResult: showResult.value,
    triedAdvance: triedAdvance.value,
    questionIds: pool.value.map((q) => q.id),
  }

  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

function loadSession() {
  if (typeof window === 'undefined') {
    isRestoring.value = false
    return
  }

  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) {
    isRestoring.value = false
    return
  }

  try {
    const parsed = JSON.parse(raw) as SessionPayload | null
    if (!parsed || parsed.version !== SESSION_VERSION || !parsed.running || !parsed.mode || !parsed.stackId) {
      clearSession()
      isRestoring.value = false
      return
    }

    const stack = quiz.stacks.find((s) => s.id === parsed.stackId)
    if (!stack) {
      clearSession()
      isRestoring.value = false
      return
    }

    if (!stack.modes.includes(parsed.mode)) {
      clearSession()
      isRestoring.value = false
      return
    }

    const stackQuestions = quiz.questionsByStack(parsed.stackId)
    if (!stackQuestions.length) {
      clearSession()
      isRestoring.value = false
      return
    }

    if (Array.isArray(parsed.questionIds) && parsed.questionIds.length) {
      const sameLength = parsed.questionIds.length === stackQuestions.length
      const sameOrder = sameLength && parsed.questionIds.every((id, index) => id === stackQuestions[index]?.id)
      if (!sameOrder) {
        clearSession()
        isRestoring.value = false
        return
      }
    }

  currentStackId.value = parsed.stackId
    pool.value = stackQuestions
    running.value = true
    activeMode.value = parsed.mode

    const maxIdx = Math.max(stackQuestions.length - 1, 0)
    const nextIdx = Math.min(Math.max(parsed.idx ?? 0, 0), maxIdx)
    idx.value = nextIdx

    const currentQuestion = pool.value[idx.value] ?? null
    let sanitizedSelected: number[] = []
    if (Array.isArray(parsed.selected) && currentQuestion) {
      sanitizedSelected = parsed.selected.filter((choice) => Number.isInteger(choice) && choice >= 0 && choice < currentQuestion.answers.length)
    }
    selected.value = sanitizedSelected

    const questionMap = new Map(pool.value.map((entry) => [entry.id, entry]))
    if (Array.isArray(parsed.answers)) {
      const sanitizedAnswers = parsed.answers
        .map((entry) => {
          const question = questionMap.get(entry.questionId)
          if (!question) return null
          const picks = Array.isArray(entry.selected)
            ? entry.selected.filter((choice) => Number.isInteger(choice) && choice >= 0 && choice < question.answers.length)
            : []
          return { questionId: question.id, selected: picks }
        })
        .filter((entry): entry is GivenAnswer => entry !== null)
      answers.value = sanitizedAnswers
    } else {
      answers.value = []
    }

    checked.value = !!parsed.checked
    isCorrect.value = !!parsed.isCorrect
    showResult.value = !!parsed.showResult
    triedAdvance.value = !!parsed.triedAdvance
  } catch {
    clearSession()
  }

  isRestoring.value = false
}

watch(
  () => ({
    running: running.value,
    mode: activeMode.value,
    stackId: currentStackId.value,
    idx: idx.value,
    selected: [...selected.value],
    answers: answers.value.map((entry) => ({ questionId: entry.questionId, selected: [...entry.selected] })),
    checked: checked.value,
    isCorrect: isCorrect.value,
    showResult: showResult.value,
    triedAdvance: triedAdvance.value,
    questionIds: pool.value.map((q) => q.id),
  }),
  () => saveSession(),
  { deep: false },
)

onMounted(() => {
  loadSession()
})

onBeforeUnmount(() => {
  saveSession()
})

function resetModeState() {
  answers.value = []
  showResult.value = false
  checked.value = false
  isCorrect.value = false
  resetQuestionState()
}

function handleStart({ stackId, mode }: StackSelection) {
  const stack = quiz.stacks.find((s) => s.id === stackId)
  if (!stack || !stack.modes.includes(mode)) {
    return
  }
  resetModeState()
  clearSession()
  activeMode.value = mode
  startStack(stackId)
}

function handleCancel() {
  cancelRun()
  resetModeState()
  activeMode.value = null
  clearSession()
}

function advancePlayMode() {
  if (activeMode.value !== 'play' || !current.value) {
    return
  }

  if (!selected.value.length) {
    triedAdvance.value = true
    return
  }

  triedAdvance.value = false
  answers.value[idx.value] = { questionId: current.value.id, selected: [...selected.value] }

  if (idx.value < pool.value.length - 1) {
    idx.value++
    resetQuestionState()
    return
  }

  const res = result.value
  const stackId = currentStackId.value
  const stack = quiz.stacks.find((s) => s.id === stackId)
  const categoryId = stack?.categoryId || ''

  try {
    quiz.recordRun({
      categoryId,
      stackId,
      total: res.total,
      correct: res.correct,
      answers: answers.value.map((a) => ({ questionId: a.questionId, selected: [...a.selected] })),
    })
  } catch {
    // ignore store errors, still show result
  }

  showResult.value = true
}

function checkLearnAnswer() {
  if (activeMode.value !== 'learn') {
    return
  }

  if (!current.value || !selected.value.length) {
    triedAdvance.value = true
    return
  }

  const normalized = normalizeCorrectIndexes(current.value)
  isCorrect.value = answersMatch(selected.value, normalized)
  checked.value = true
  triedAdvance.value = false
}

function nextLearnStep() {
  if (activeMode.value !== 'learn') {
    return
  }

  if (!checked.value) {
    checkLearnAnswer()
    return
  }

  if (idx.value < pool.value.length - 1) {
    idx.value++
    resetQuestionState()
    checked.value = false
    isCorrect.value = false
  } else {
    handleCancel()
  }
}
</script>

<template>
  <section class="app-page">
    <PageHeading :parent="t('quiz.title')" :parent-to="{ name: 'quiz-home' }" :title="t('quiz.tabs.playLearn')"
      :title-to="{ name: 'quiz-practice' }" />

    <div class="quiz-mode">
      <template v-if="!running">
        <StackModeSelector :groups="groups" :format-count="formatQuestionCount"
          :empty-hint="t('quiz.runner.noQuestions')" :play-label="t('quiz.tabs.play')"
          :learn-label="t('quiz.tabs.learn')" @select="handleStart" />
      </template>

      <template v-else>
        <div v-if="activeMode === 'play'" class="quiz-runner">
          <div class="quiz-runner__head">
            <div class="left">
              <span class="quiz-runner__badge quiz-runner__badge--play">{{ t('quiz.tabs.play') }}</span>
            </div>
            <div class="center">{{ idx + 1 }} / {{ pool.length }}</div>
            <div class="right"></div>
          </div>
          <div class="quiz-runner__question">{{ quiz.localize(current!.text) }}</div>
          <QuizChoiceList v-model="selected" mode="play" :answers="current!.answers" />
          <p v-if="triedAdvance && !selected.length" class="quiz-runner__hint">{{ t('quiz.runner.selectAtLeastOne') }}
          </p>
          <div class="quiz-runner__foot">
            <div class="left">
              <button class="btn" type="button" @click="handleCancel">{{ t('quiz.editor.cancel') }}</button>
            </div>
            <div class="right">
              <button class="btn primary" type="button" @click="advancePlayMode">{{ idx < pool.length - 1 ?
                t('quiz.runner.next') : t('quiz.runner.finish') }}</button>
            </div>
          </div>

          <BaseModal v-model="showResult" :title="t('quiz.runner.result')" :closable="false">
            <div class="result-summary">
              <p class="mb-2">{{ t('quiz.runner.correctOfTotal', { correct: result.correct, total: result.total }) }}
              </p>
            </div>
            <div class="result-list">
              <div v-for="(q, i) in pool" :key="q.id" class="result-item">
                <div class="result-head">
                  <div class="q-text">{{ quiz.localize(q.text) }}</div>
                  <div class="badge" :class="result.details[i]?.ok ? 'ok' : 'bad'">
                    {{ result.details[i]?.ok ? t('quiz.runner.correctShort') : t('quiz.runner.wrongShort') }}
                  </div>
                </div>
                <div class="cols">
                  <div class="col">
                    <div class="label">{{ t('quiz.runner.yourAnswer') }}</div>
                    <ul class="ans-list">
                      <li v-if="!result.details[i]?.given?.length" class="muted">{{ t('quiz.runner.noAnswer') }}</li>
                      <li v-for="idx in result.details[i]?.given ?? []" :key="`given-${idx}`">
                        {{ quiz.localize(q.answers[idx]) }}
                      </li>
                    </ul>
                  </div>
                  <div class="col">
                    <div class="label">{{ t('quiz.runner.correctAnswer') }}</div>
                    <ul class="ans-list">
                      <li v-for="idx in result.details[i]?.correct ?? []" :key="`corr-${idx}`">
                        {{ quiz.localize(q.answers[idx]) }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <template #footer>
              <div class="modal-footer-split">
                <div class="left"></div>
                <div class="right">
                  <button class="btn" type="button" @click="handleCancel">OK</button>
                </div>
              </div>
            </template>
          </BaseModal>
        </div>

        <div v-else-if="activeMode === 'learn'" class="quiz-runner">
          <div class="quiz-runner__head">
            <div class="left">
              <span class="quiz-runner__badge quiz-runner__badge--learn">{{ t('quiz.tabs.learn') }}</span>
            </div>
            <div class="center">{{ idx + 1 }} / {{ pool.length }}</div>
            <div class="right"></div>
          </div>

          <div class="quiz-runner__body">
            <div class="quiz-runner__question">{{ quiz.localize(current!.text) }}</div>
            <QuizChoiceList v-model="selected" mode="learn" :answers="current!.answers" :checked="checked"
              :correct-answers="correctAnswers" />
            <p v-if="triedAdvance && !selected.length" class="quiz-runner__hint">
              {{ t('quiz.runner.selectAtLeastOne') }}
            </p>
            <div v-if="checked" class="quiz-runner__feedback"
              :class="isCorrect ? 'quiz-runner__feedback--correct' : 'quiz-runner__feedback--wrong'">
              <p v-if="isCorrect">
                {{ t('quiz.runner.correctShort') }}!
              </p>
              <p v-else>
                {{ t('quiz.runner.wrongShort') }}. {{ t('quiz.runner.correctAnswer') }}:
                <span class="quiz-runner__correct-list">
                  {{ correctAnswerTexts.join(', ') }}
                </span>
              </p>
            </div>
          </div>

          <div class="quiz-runner__foot">
            <div class="left">
              <button class="btn" type="button" @click="handleCancel">{{ t('quiz.editor.cancel') }}</button>
            </div>
            <div class="center"></div>
            <div class="right">
              <button v-if="!checked" class="btn primary" type="button" @click="checkLearnAnswer">
                {{ t('quiz.runner.checkAnswer') }}
              </button>
              <button v-else class="btn primary" type="button" @click="nextLearnStep">
                {{ idx < pool.length - 1 ? t('quiz.runner.next') : t('quiz.runner.finish') }} </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
