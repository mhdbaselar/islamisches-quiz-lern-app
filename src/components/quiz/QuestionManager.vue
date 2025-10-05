<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuizState } from '@/quiz/state'
import QuestionList from './QuestionList.vue'
import QuestionEditor from './QuestionEditor.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const { t } = useI18n()
const quiz = useQuizState()

const selectedCategory = ref<string>('')
const selectedStack = ref<string>('')

const categories = computed(() => quiz.categories.map(c => ({ id: c.id, label: quiz.localize(c.name) })))
// Für Editor im Modal brauchen wir alle Stacks; die Dropdowns filtern ohnehin nach categoryId
const stacks = computed(() => quiz.stacks.map(s => ({ id: s.id, label: quiz.localize(s.name), categoryId: s.categoryId })))

const draft = ref({
  categoryId: '',
  stackId: '',
  text: { de: '', en: '', ar: '' },
  answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }],
  correctIndexes: [] as number[],
  correctIndex: undefined as number | undefined,
})

const editing = ref<{ id: string | null, value: typeof draft.value }>({ id: null, value: { categoryId: '', stackId: '', text: { de: '', en: '', ar: '' }, answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }], correctIndexes: [], correctIndex: undefined } })
const editOpen = ref(false)
const addOpen = ref(false)
const isEditValid = ref(false)
const isAddValid = ref(false)
const addSubmitted = ref(false)
const editSubmitted = ref(false)

function remove(id: string) {
  if (confirm(t('quiz.manager.confirmDeleteQuestion'))) quiz.deleteQuestion(id)
}
function onSave() {
  if (!draft.value.stackId) return
  draft.value.categoryId = quiz.stacks.find(s => s.id === draft.value.stackId)?.categoryId ?? ''
  quiz.addQuestion({ ...draft.value })
  draft.value = {
    categoryId: selectedCategory.value,
    stackId: selectedStack.value,
    text: { de: '', en: '', ar: '' },
    answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }],
    correctIndexes: [],
    correctIndex: undefined,
  }
}

function openAdd() {
  draft.value = {
    categoryId: selectedCategory.value,
    stackId: selectedStack.value,
    text: { de: '', en: '', ar: '' },
    answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }],
    correctIndexes: [],
    correctIndex: undefined,
  }
  addOpen.value = true
}
function saveAdd() {
  addSubmitted.value = true
  if (isAddValid.value) {
    onSave()
    addOpen.value = false
    addSubmitted.value = false
  }
}

function startEdit(id: string) {
  const q = quiz.questions.find(q => q.id === id)
  if (!q) return
  // Auswahl passend setzen, damit Stacks/Editor korrekt gefüllt sind
  selectedCategory.value = q.categoryId
  selectedStack.value = q.stackId
  editing.value = { id, value: JSON.parse(JSON.stringify({ categoryId: q.categoryId, stackId: q.stackId, text: q.text, answers: q.answers, correctIndexes: q.correctIndexes ?? [], correctIndex: q.correctIndex })) }
  nextTick(() => { editOpen.value = true })
}
function cancelEdit() {
  editing.value = { id: null, value: { categoryId: '', stackId: '', text: { de: '', en: '', ar: '' }, answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }], correctIndexes: [], correctIndex: undefined } }
  editOpen.value = false
}
function saveEdit() {
  if (!editing.value.id) return
  editSubmitted.value = true
  if (isEditValid.value) {
    const v = editing.value.value
    // categoryId aus stack ableiten
    v.categoryId = quiz.stacks.find(s => s.id === v.stackId)?.categoryId ?? v.categoryId
    quiz.updateQuestion(editing.value.id, { ...v })
    cancelEdit()
    editSubmitted.value = false
  }
}
</script>

<template>
  <div class="quiz-manager">
    <div class="quiz-manager__row">
      <label>{{ t('quiz.editor.category') }}</label>
      <select v-model="selectedCategory" @change="selectedStack = ''">
        <option value="">{{ t('quiz.all') }}</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
    </div>
    <div class="quiz-manager__row">
      <label>{{ t('quiz.editor.stack') }}</label>
      <select v-model="selectedStack">
        <option value="">{{ t('quiz.all') }}</option>
        <option v-for="s in stacks" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
    </div>

    <QuestionList :category-id="selectedCategory || undefined" :stack-id="selectedStack || undefined" @delete="remove"
      @edit="startEdit" />

    <BaseModal v-model="editOpen" :title="t('quiz.manager.editQuestion')">
      <QuestionEditor v-model="editing.value" :categories="categories" :stacks="stacks" @valid="isEditValid = $event"
        :show-errors="editSubmitted" />
      <template #footer>
        <div class="modal-footer-split">
          <div class="left">
            <button class="btn" type="button" @click="cancelEdit">{{ t('quiz.editor.cancel') }}</button>
          </div>
          <div class="right">
            <button class="btn primary" type="button" @click="saveEdit">{{ t('quiz.editor.save') }}</button>
          </div>
        </div>
      </template>
    </BaseModal>

    <BaseModal v-model="addOpen" :title="t('quiz.manage.addNew')">
      <QuestionEditor v-model="draft" :categories="categories" :stacks="stacks" @valid="isAddValid = $event"
        :show-errors="addSubmitted" />
      <template #footer>
        <div class="modal-footer-split">
          <div class="left">
            <button class="btn" type="button" @click="addOpen = false">{{ t('quiz.editor.cancel') }}</button>
          </div>
          <div class="right">
            <button class="btn primary" type="button" @click="saveAdd">{{ t('quiz.editor.save') }}</button>
          </div>
        </div>
      </template>
    </BaseModal>
    <div class="quiz-manager__actions justify-end">
      <button class="btn primary" type="button" @click="openAdd">{{ t('quiz.manage.addNew') }}</button>
    </div>
  </div>
</template>
