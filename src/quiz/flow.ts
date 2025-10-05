import { computed, ref } from 'vue'
import { useQuizState, type Question, type StackMode } from './state'

export type StackGroup = {
  id: string
  name: string
  stacks: { id: string, name: string, questionCount: number, modes: StackMode[] }[]
}

export function useQuizFlow() {
  const quiz = useQuizState()

  const groups = computed<StackGroup[]>(() =>
    quiz.categories.map((category) => ({
      id: category.id,
      name: quiz.localize(category.name),
      stacks: quiz.stacks
        .filter((stack) => stack.categoryId === category.id)
        .map((stack) => ({
          id: stack.id,
          name: quiz.localize(stack.name),
          questionCount: quiz.questionsByStack(stack.id).length,
          modes: stack.modes,
        })),
    })),
  )

  const running = ref(false)
  const currentStackId = ref<string>('')
  const pool = ref<Question[]>([])
  const idx = ref(0)
  const selected = ref<number[]>([])
  const triedAdvance = ref(false)

  const current = computed<Question | null>(() => pool.value[idx.value] ?? null)

  function resetQuestionState() {
    selected.value = []
    triedAdvance.value = false
  }

  function startStack(stackId: string) {
    currentStackId.value = stackId
    pool.value = quiz.questionsByStack(stackId)
    idx.value = 0
    resetQuestionState()
    running.value = true
  }

  function cancelRun() {
    running.value = false
    currentStackId.value = ''
    pool.value = []
    idx.value = 0
    resetQuestionState()
  }

  return {
    quiz,
    groups,
    hasGroups: computed(() => groups.value.some((group) => group.stacks.length > 0)),
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
  }
}
