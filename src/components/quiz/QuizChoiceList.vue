<script setup lang="ts">
import { computed } from 'vue'
import clsx from 'clsx'
import { Icon } from '@iconify/vue'
import type { LocalizedText } from '@/quiz/state'
import { useQuizState } from '@/quiz/state'

type Mode = 'play' | 'learn'

const props = withDefaults(defineProps<{
  answers: LocalizedText[]
  mode: Mode
  checked?: boolean
  correctAnswers?: number[]
  disabled?: boolean
}>(), {
  checked: false,
  correctAnswers: () => [],
  disabled: false,
})

const model = defineModel<number[]>({ default: [] })
const quiz = useQuizState()

const isLearnMode = computed(() => props.mode === 'learn')
const isDisabled = computed(() => props.disabled || (isLearnMode.value && props.checked))

function isSelected(index: number) {
  return model.value.includes(index)
}

function isCorrect(index: number) {
  return props.correctAnswers.includes(index)
}

function isWrongSelection(index: number) {
  return props.checked && isSelected(index) && !isCorrect(index)
}
</script>

<template>
  <div class="quiz-runner__choices">
    <label v-for="(answer, index) in answers" :key="index" class="quiz-choice" :class="clsx({
      'quiz-choice--selected': !props.checked && isSelected(index),
      'quiz-choice--correct': props.checked && isCorrect(index),
      'quiz-choice--wrong': isWrongSelection(index),
    })">
      <input type="checkbox" :value="index" v-model="model" :disabled="isDisabled">
      {{ quiz.localize(answer) }}
      <Icon v-if="isLearnMode && props.checked && isCorrect(index)" class="quiz-choice__icon quiz-choice__icon--correct"
        icon="heroicons:check-16-solid" aria-hidden="true" />
      <Icon v-if="isLearnMode && isWrongSelection(index)" class="quiz-choice__icon quiz-choice__icon--wrong"
        icon="entypo:cross" aria-hidden="true" />
    </label>
  </div>
</template>
