<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuizState } from '@/quiz/state'
import { normalizeCorrectIndexes, answersMatch } from '@/quiz/scoring'

const props = defineProps<{ categoryId?: string, stackId?: string }>()

const quiz = useQuizState()
const { t } = useI18n()

const pool = computed(() => props.stackId
  ? quiz.questionsByStack(props.stackId)
  : quiz.questionsByCategory(props.categoryId))
const index = ref(0)
const selected = ref<number[]>([])

const current = computed(() => pool.value[index.value])

function submit() {
  if (!current.value) return
  const correct = normalizeCorrectIndexes(current.value)
  const isCorrect = answersMatch(selected.value, correct)
  alert(isCorrect ? '✅' : '❌')
  // next
  selected.value = []
  index.value = (index.value + 1) % pool.value.length
}
</script>

<template>
  <div v-if="pool.length" class="quiz-runner">
    <div class="quiz-runner__question">{{ quiz.localize(current!.text) }}</div>
    <div class="quiz-runner__choices">
      <label v-for="(a, i) in current!.answers" :key="i"
        :class="['quiz-choice', { 'quiz-choice--selected': selected.includes(i) }]">
        <input type="checkbox" :value="i" v-model="selected"> {{ quiz.localize(a) }}
      </label>
    </div>
    <div class="quiz-runner__actions">
      <button type="button" class="btn primary" @click="submit" :disabled="!selected.length">
        {{ t('quiz.runner.checkAnswer') }}
      </button>
    </div>
  </div>
  <p v-else class="text-muted-foreground">{{ t('quiz.runner.noQuestions') }}</p>
</template>
