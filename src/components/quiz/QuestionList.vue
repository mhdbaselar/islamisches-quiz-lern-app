<script setup lang="ts">
import { computed } from 'vue'
import { useQuizState } from '@/quiz/state'

const props = defineProps<{ categoryId?: string, stackId?: string }>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'delete', id: string): void
}>()

const quiz = useQuizState()

const questions = computed(() => props.stackId
  ? quiz.questionsByStack(props.stackId)
  : quiz.questionsByCategory(props.categoryId))

function onEdit(id: string) {
  emit('edit', id)
}
function onDelete(id: string) {
  emit('delete', id)
}
</script>

<template>
  <ol class="quiz-question-list">
    <li v-for="q in questions" :key="q.id" class="quiz-question-item">
      <div class="quiz-question-item__question">{{ quiz.localize(q.text) }}</div>
      <ol class="quiz-question-item__answers">
        <li v-for="(a, idx) in q.answers" :key="idx"
          :class="{ 'quiz-question-item__answer--correct': (q.correctIndexes ? q.correctIndexes.includes(idx) : idx === q.correctIndex) }">
          {{ quiz.localize(a) }}
        </li>
      </ol>
      <div class="footer-split">
        <div class="left">
          <button class="icon-btn" type="button" @click="onEdit(q.id)">✏️</button>
        </div>
        <div class="right">
          <button class="icon-btn" type="button" @click="onDelete(q.id)">🗑️</button>
        </div>
      </div>
    </li>
  </ol>
</template>
