<script setup lang="ts">
import { computed } from 'vue'
import { useQuizState } from '@/quiz/state'

const quiz = useQuizState()

const categories = computed(() => quiz.categories)

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'select', categoryId: string): void
  (e: 'update:modelValue', value?: string): void
}>()

function onSelect(id: string) {
  emit('update:modelValue', id)
  emit('select', id)
}
</script>

<template>
  <div class="quiz-category-list">
    <button v-for="c in categories" :key="c.id" class="chip category-item"
      :class="{ active: props.modelValue === c.id }" type="button" @click="onSelect(c.id)">
      {{ quiz.localize(c.name) }}
    </button>
  </div>
</template>
