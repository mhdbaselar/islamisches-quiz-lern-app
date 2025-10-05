<script setup lang="ts">
import { computed } from 'vue'
import type { StackGroup } from '@/quiz/flow'

const props = withDefaults(defineProps<{
  groups: StackGroup[]
  emptyHint?: string
  formatCount?: (count: number) => string
  playLabel: string
  learnLabel: string
}>(), {
  emptyHint: '',
  formatCount: (count: number) => `${count}`,
})

const emit = defineEmits<{
  (e: 'select', payload: { stackId: string, mode: 'play' | 'learn' }): void
}>()

const formatCount = (count: number) => props.formatCount(count)
const renderGroups = computed(() =>
  props.groups
    .map((group) => ({
      ...group,
      stacks: group.stacks.filter((stack) => Array.isArray(stack.modes) && stack.modes.length > 0),
    }))
    .filter((group) => group.stacks.length),
)

function handleSelect(stack: StackGroup['stacks'][number], mode: 'play' | 'learn') {
  if (!stack.modes.includes(mode)) return
  emit('select', { stackId: stack.id, mode })
}
</script>

<template>
  <div class="stack-selector">
    <p v-if="!renderGroups.length" class="stack-selector__empty">
      {{ props.emptyHint }}
    </p>
    <template v-else>
      <div v-for="group in renderGroups" :key="group.id" class="stack-selector__group">
        <h3 class="stack-selector__title">{{ group.name }}</h3>
        <div class="stack-grid">
          <div v-for="stack in group.stacks" :key="stack.id" class="quiz-mode__stack-card">
            <div class="quiz-mode__stack-card-head">
              <span class="quiz-mode__stack-name">{{ stack.name }}</span>
              <span class="quiz-mode__stack-meta">{{ formatCount(stack.questionCount) }}</span>
            </div>
            <div class="quiz-mode__stack-actions">
              <button
                v-if="stack.modes.includes('play')"
                type="button"
                class="btn primary quiz-mode__stack-action"
                @click="handleSelect(stack, 'play')"
              >
                {{ props.playLabel }}
              </button>
              <button
                v-if="stack.modes.includes('learn')"
                type="button"
                class="btn quiz-mode__stack-action"
                @click="handleSelect(stack, 'learn')"
              >
                {{ props.learnLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
