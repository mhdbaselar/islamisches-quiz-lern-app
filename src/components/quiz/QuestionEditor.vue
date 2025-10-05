<script setup lang="ts">
import { reactive, watch, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { type LocalizedText } from '@/quiz/state'

type EditorQuestion = {
  id?: string
  categoryId: string
  stackId: string
  text: LocalizedText
  answers: LocalizedText[]
  correctIndex?: number
  correctIndexes?: number[]
}

const props = defineProps<{
  modelValue: EditorQuestion
  categories: { id: string, label: string }[]
  stacks: { id: string, label: string, categoryId: string }[]
  showErrors?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: EditorQuestion): void
  (e: 'save'): void
  (e: 'cancel'): void
  (e: 'valid', value: boolean): void
}>()

const { t, locale } = useI18n()

const form = reactive<EditorQuestion>(JSON.parse(JSON.stringify(props.modelValue)) as EditorQuestion)

watch(() => props.modelValue, (v) => Object.assign(form, v), { deep: true })

function update() {
  emit('update:modelValue', JSON.parse(JSON.stringify(form)))
}

function addAnswer() { form.answers.push({ de: '', en: '', ar: '' }); update() }
function removeAnswer(idx: number) {
  if (form.answers.length <= 2) return
  form.answers.splice(idx, 1)
  if (Array.isArray(form.correctIndexes)) {
    const adjusted = form.correctIndexes
      .filter(i => i !== idx)
      .map(i => (i > idx ? i - 1 : i))
    form.correctIndexes = Array.from(new Set(adjusted)).sort((a, b) => a - b)
  } else if (form.correctIndex != null) {
    if (form.correctIndex === idx) form.correctIndex = undefined
    else if (form.correctIndex > idx) form.correctIndex = form.correctIndex - 1
  }
  update()
}

const currentLocale = computed(() => locale.value as keyof LocalizedText)
const isNonEmpty = (s?: string) => !!s && s.trim().length > 0
const isValid = computed(() => {
  const loc = currentLocale.value
  const textOk = isNonEmpty(form.text[loc])
  const answersOk = Array.isArray(form.answers) && form.answers.length >= 2 && form.answers.every((a: LocalizedText) => isNonEmpty(a[loc]))
  const correct = Array.isArray(form.correctIndexes) ? form.correctIndexes : (form.correctIndex != null ? [form.correctIndex] : [])
  const hasCorrect = Array.isArray(correct) && correct.length > 0
  return isNonEmpty(form.categoryId) && isNonEmpty(form.stackId) && textOk && answersOk && hasCorrect
})

const errors = computed(() => {
  const loc = currentLocale.value
  const errs: Record<string, string | undefined> = {}
  if (!isNonEmpty(form.categoryId)) errs.category = t('quiz.editor.errors.categoryRequired')
  if (!isNonEmpty(form.stackId)) errs.stack = t('quiz.editor.errors.stackRequired')
  if (!isNonEmpty(form.text[loc])) errs.text = t('quiz.editor.errors.textRequired')
  if (!Array.isArray(form.answers) || form.answers.length < 2) errs.minAnswers = t('quiz.editor.errors.minAnswers')
  else {
    // erste leere Antwort melden
    const idx = form.answers.findIndex((a: LocalizedText) => !isNonEmpty(a[loc]))
    if (idx !== -1) errs[`answer_${idx}`] = t('quiz.editor.errors.answerRequired')
  }
  const correct = Array.isArray(form.correctIndexes) ? form.correctIndexes : (form.correctIndex != null ? [form.correctIndex] : [])
  if (!Array.isArray(correct) || correct.length === 0) errs.correct = t('quiz.editor.errors.correctRequired')
  return errs
})

watchEffect(() => {
  emit('valid', isValid.value)
})
</script>

<template>
  <div class="quiz-editor">
    <div class="quiz-editor__row">
      <label>{{ t('quiz.editor.category') }}</label>
      <select v-model="form.categoryId" @change="update"
        :class="{ 'quiz-editor__invalid': showErrors && errors.category }">
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
      <p v-if="showErrors && errors.category" class="quiz-editor__error">{{ errors.category }}</p>
    </div>

    <div class="quiz-editor__row">
      <label>{{ t('quiz.editor.stack') }}</label>
      <select v-model="form.stackId" @change="update" :class="{ 'quiz-editor__invalid': showErrors && errors.stack }">
        <option v-for="s in stacks.filter(s => s.categoryId === form.categoryId)" :key="s.id" :value="s.id">{{ s.label
        }}
        </option>
      </select>
      <p v-if="showErrors && errors.stack" class="quiz-editor__error">{{ errors.stack }}</p>
    </div>

    <fieldset class="quiz-editor__fieldset">
      <legend>{{ t('quiz.editor.questionText') }}</legend>
      <div class="quiz-editor__question">
        <textarea class="quiz-editor__text" rows="3" :placeholder="t('quiz.editor.text')"
          v-model="form.text[locale as keyof typeof form.text]" @input="update"
          :class="{ 'quiz-editor__invalid': showErrors && errors.text }"></textarea>
      </div>
      <p v-if="showErrors && errors.text" class="quiz-editor__error">{{ errors.text }}</p>
    </fieldset>

    <fieldset class="quiz-editor__fieldset">
      <legend>{{ t('quiz.editor.answers') }}</legend>
      <div class="quiz-editor__row">
        <label>{{ t('quiz.editor.correct') }}</label>
        <div class="quiz-editor__correct-grid" :class="{ 'quiz-editor__invalid': showErrors && errors.correct }">
          <label v-for="(a, i) in form.answers" :key="`c-${i}`" class="quiz-editor__correct-choice">
            <input type="checkbox"
              :checked="Array.isArray(form.correctIndexes) ? form.correctIndexes.includes(i) : (form.correctIndex === i)"
              @change="($event) => {
                const checked = ($event.target as HTMLInputElement).checked
                const set = new Set<number>(Array.isArray(form.correctIndexes) ? form.correctIndexes : (form.correctIndex != null ? [form.correctIndex] : []))
                if (checked) set.add(i); else set.delete(i)
                form.correctIndexes = Array.from(set).sort((a, b) => a - b)
                form.correctIndex = undefined
                update()
              }" /> {{ i + 1 }}
          </label>
        </div>
        <p v-if="showErrors && errors.correct" class="quiz-editor__error">{{ errors.correct }}</p>
      </div>

      <div v-for="(a, idx) in form.answers" :key="idx" class="quiz-editor__answer-item">
        <div class="quiz-editor__answer-row">
          <span class="quiz-editor__answer-number">{{ idx + 1 }}.</span>
          <textarea class="quiz-editor__text" rows="2" :placeholder="t('quiz.editor.addAnswer')"
            v-model="a[locale as keyof typeof a]" @input="update"
            :class="{ 'quiz-editor__invalid': showErrors && errors[`answer_${idx}`] }"></textarea>
          <button class="icon-btn" type="button" @click="removeAnswer(idx)"
            :disabled="form.answers.length <= 2">🗑️</button>
        </div>
        <p v-if="showErrors && errors[`answer_${idx}`]" class="quiz-editor__error">{{ errors[`answer_${idx}`] }}</p>
      </div>
      <div class="quiz-editor__answer-item quiz-editor__add">
        <div class="quiz-editor__answer-row">
          <span class="quiz-editor__answer-number" aria-hidden="true"></span>
          <button class="btn" type="button" @click="addAnswer">+ {{ t('quiz.editor.addAnswer') }}</button>
          <span aria-hidden="true"></span>
        </div>
      </div>
    </fieldset>
  </div>
</template>
