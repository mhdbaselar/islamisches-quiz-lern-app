<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuizState, type LocalizedText } from '@/quiz/state'
import BaseModal from '@/components/ui/BaseModal.vue'

const { t } = useI18n()
const quiz = useQuizState()

const draft = ref<LocalizedText>({ de: '', en: '', ar: '' })
const editing = ref<{ id: string | null, value: LocalizedText }>({ id: null, value: { de: '', en: '', ar: '' } })
const currentLocale = ref<string>(useI18n().locale.value)
const editOpen = ref(false)
const addOpen = ref(false)

function add() {
  const key = currentLocale.value as keyof LocalizedText
  if (!draft.value[key]) return
  quiz.addCategory({ ...draft.value })
  draft.value = { de: '', en: '', ar: '' }
}
function remove(id: string) {
  if (confirm(t('quiz.manager.confirmDeleteCategory'))) quiz.deleteCategory(id)
}

function startEdit(id: string, current: LocalizedText) {
  editing.value = { id, value: JSON.parse(JSON.stringify(current)) }
  editOpen.value = true
}
function cancelEdit() {
  editing.value = { id: null, value: { de: '', en: '', ar: '' } }
  editOpen.value = false
}
function saveEdit() {
  if (!editing.value.id) return
  // Nur die aktuelle Sprache aktualisieren, andere unverändert lassen
  const key = currentLocale.value as keyof LocalizedText
  const updated = { ...quiz.categories.find(c => c.id === editing.value.id)?.name } as LocalizedText
  updated[key] = editing.value.value[key]
  quiz.updateCategory(editing.value.id, { name: updated })
  cancelEdit()
}

function openAdd() {
  draft.value = { de: '', en: '', ar: '' }
  addOpen.value = true
}
function saveAdd() {
  add()
  addOpen.value = false
}
</script>

<template>
  <div class="quiz-manager">
    <ul class="quiz-manager__list">
      <li v-for="c in quiz.categories" :key="c.id" class="quiz-manager__item">
        <div>{{ quiz.localize(c.name) }}</div>
        <div class="quiz-manager__actions">
          <button class="icon-btn" type="button" @click="startEdit(c.id, c.name)">✏️</button>
          <button class="icon-btn" type="button" @click="remove(c.id)">🗑️</button>
        </div>
      </li>
    </ul>
    <div class="quiz-manager__actions justify-end">
      <button class="btn primary" type="button" @click="openAdd">{{ t('quiz.manager.addCategory') }}</button>
    </div>
    <BaseModal v-model="addOpen" :title="t('quiz.manager.addCategory')">
      <div class="quiz-manager__edit-block">
        <div class="quiz-manager__row">
          <span class="quiz-manager__label-spacer" aria-hidden="true">&nbsp;</span>
          <input :placeholder="t('quiz.manager.addCategory')" v-model="draft[currentLocale as keyof typeof draft]" />
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

    <BaseModal v-model="editOpen" :title="t('quiz.manager.editCategory')">
      <div class="quiz-manager__edit-block">
        <div class="quiz-manager__row"><label>{{ t('quiz.editor.name') }}</label><input
            v-model="editing.value[currentLocale as keyof typeof editing.value]" /></div>
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
  </div>
</template>
