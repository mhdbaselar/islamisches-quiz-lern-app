<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuizState, type LocalizedText, type StackMode } from '@/quiz/state'
import BaseModal from '@/components/ui/BaseModal.vue'

const { t } = useI18n()
const quiz = useQuizState()

const selectedCategory = ref<string>('')
const draft = ref<{ categoryId: string, name: LocalizedText }>({ categoryId: '', name: { de: '', en: '', ar: '' } })
const editing = ref<{ id: string | null, categoryId: string, name: LocalizedText }>({ id: null, categoryId: '', name: { de: '', en: '', ar: '' } })
const ALL_MODES: StackMode[] = ['play', 'learn']
const currentLocale = ref<string>(useI18n().locale.value)
const editOpen = ref(false)
const addOpen = ref(false)

const categories = computed(() => quiz.categories.map(c => ({ id: c.id, label: quiz.localize(c.name) })))
const stacks = computed(() => selectedCategory.value ? quiz.stacksByCategory(selectedCategory.value) : quiz.stacks)

function add() {
  if (!draft.value.categoryId) return
  const key = currentLocale.value as keyof LocalizedText
  if (!draft.value.name[key]) return
  quiz.addStack({ categoryId: draft.value.categoryId, name: { ...draft.value.name }, modes: [...ALL_MODES] })
  draft.value = { categoryId: selectedCategory.value, name: { de: '', en: '', ar: '' } }
}
function remove(id: string) {
  if (confirm(t('quiz.manager.confirmDeleteStack'))) quiz.deleteStack(id)
}

function startEdit(stackId: string) {
  const st = quiz.stacks.find(s => s.id === stackId)
  if (!st) return
  editing.value = { id: st.id, categoryId: st.categoryId, name: JSON.parse(JSON.stringify(st.name)) }
  editOpen.value = true
}
function cancelEdit() {
  editing.value = { id: null, categoryId: '', name: { de: '', en: '', ar: '' } }
  editOpen.value = false
}
function saveEdit() {
  if (!editing.value.id) return
  const key = currentLocale.value as keyof LocalizedText
  const existing = quiz.stacks.find(s => s.id === editing.value.id)
  const updated = existing ? { ...existing.name } as LocalizedText : { de: '', en: '', ar: '' }
  updated[key] = editing.value.name[key]
  quiz.updateStack(editing.value.id, { categoryId: editing.value.categoryId, name: updated, modes: existing?.modes ?? [...ALL_MODES] })
  cancelEdit()
}

function openAdd() {
  draft.value = { categoryId: selectedCategory.value, name: { de: '', en: '', ar: '' } }
  addOpen.value = true
}
function saveAdd() {
  add()
  addOpen.value = false
}
</script>

<template>
  <div class="quiz-manager">
    <div class="quiz-manager__row">
      <label>{{ t('quiz.editor.category') }}</label>
      <select v-model="selectedCategory">
        <option value="">{{ t('quiz.all') }}</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
    </div>

    <ul class="quiz-manager__list">
      <li v-for="s in stacks" :key="s.id" class="quiz-manager__item">
        <div>{{ quiz.localize(s.name) }}</div>
        <div class="quiz-manager__actions">
          <button class="icon-btn" type="button" @click="startEdit(s.id)">✏️</button>
          <button class="icon-btn" type="button" @click="remove(s.id)">🗑️</button>
        </div>
      </li>
    </ul>
    <div class="quiz-manager__actions justify-end">
      <button class="btn primary" type="button" @click="openAdd">{{ t('quiz.manager.addStack') }}</button>
    </div>
    <BaseModal v-model="addOpen" :title="t('quiz.manager.addStack')">
      <div class="quiz-manager__edit-block">
        <div class="quiz-manager__row">
          <label>{{ t('quiz.editor.category') }}</label>
          <select v-model="draft.categoryId">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
          </select>
        </div>
        <div class="quiz-manager__row">
          <span class="quiz-manager__label-spacer" aria-hidden="true">&nbsp;</span>
          <input :placeholder="t('quiz.manager.addStack')"
            v-model="draft.name[currentLocale as keyof typeof draft.name]" />
        </div>
      </div>
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
  </div>
  <BaseModal v-model="editOpen" :title="t('quiz.manager.editStack')">
    <div class="quiz-manager__edit-block">
      <div class="quiz-manager__row">
        <label>{{ t('quiz.editor.category') }}</label>
        <select v-model="editing.categoryId">
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
      </div>
      <div class="quiz-manager__row"><label>{{ t('quiz.editor.name') }}</label><input
          v-model="editing.name[currentLocale as keyof typeof editing.name]" /></div>
    </div>
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
</template>
