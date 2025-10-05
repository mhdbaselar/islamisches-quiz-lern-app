<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuizState, type LocalizedText, type StackMode } from '@/quiz/state'
import BaseModal from '@/components/ui/BaseModal.vue'
import PageHeading from '@/components/ui/PageHeading.vue'
import QuestionEditor from '@/components/quiz/QuestionEditor.vue'
import Draggable from 'vuedraggable'
import { Icon } from '@iconify/vue'
import { StorageSerializers, useStorage } from '@vueuse/core'

const { t, locale } = useI18n()
const quiz = useQuizState()
const isRtl = computed(() => locale.value === 'ar')

// Expand/Collapse States
const OPEN_CAT_KEY = 'quiz.manage.openCat'
const OPEN_STACK_KEY = 'quiz.manage.openStack'
const openCat = useStorage<Record<string, boolean>>(OPEN_CAT_KEY, {}, undefined, {
  serializer: StorageSerializers.object,
})
const openStack = useStorage<Record<string, boolean>>(OPEN_STACK_KEY, {}, undefined, {
  serializer: StorageSerializers.object,
})

const toggleCat = (id: string) => {
  openCat.value = { ...openCat.value, [id]: !openCat.value[id] }
}

const toggleStack = (id: string) => {
  openStack.value = { ...openStack.value, [id]: !openStack.value[id] }
}

// Entferne verwaiste Einträge, wenn Daten sich ändern
watch(() => quiz.categories.map(c => c.id), (ids) => {
  const allowed = new Set(ids)
  openCat.value = Object.fromEntries(Object.entries(openCat.value).filter(([id]) => allowed.has(id)))
}, { immediate: true })

watch(() => quiz.stacks.map(s => s.id), (ids) => {
  const allowed = new Set(ids)
  openStack.value = Object.fromEntries(Object.entries(openStack.value).filter(([id]) => allowed.has(id)))
}, { immediate: true })

// Options für QuestionEditor
const categoriesOptions = computed(() => quiz.categories.map(c => ({ id: c.id, label: quiz.localize(c.name) })))
const stacksOptions = computed(() => quiz.stacks.map(s => ({ id: s.id, label: quiz.localize(s.name), categoryId: s.categoryId })))

const currentLocaleKey = computed(() => locale.value as keyof LocalizedText)

type StackModeState = Record<StackMode, boolean>
const STACK_MODE_OPTIONS: StackMode[] = ['play', 'learn']

function createModeState(modes?: StackMode[]): StackModeState {
  const state: StackModeState = { play: false, learn: false }
  if (Array.isArray(modes) && modes.length) {
    for (const mode of modes) {
      if (STACK_MODE_OPTIONS.includes(mode)) state[mode] = true
    }
  } else {
    for (const option of STACK_MODE_OPTIONS) {
      state[option] = true
    }
  }
  return state
}

function selectedModes(state: StackModeState): StackMode[] {
  return STACK_MODE_OPTIONS.filter(mode => state[mode])
}

// Hilfsfunktionen für gefilterte Listen (vermeidet Dopplungen im Template)
function stacksByCat(categoryId: string) { return quiz.stacks.filter(s => s.categoryId === categoryId) }
function questionsBySt(stackId: string) { return quiz.questions.filter(q => q.stackId === stackId) }

// Category Modal
type CatModal = { mode: 'add' | 'edit', id?: string, value: LocalizedText }
const catModal = ref<CatModal>({ mode: 'add', value: { de: '', en: '', ar: '' } })
const catOpen = ref(false)
const catSubmitted = ref(false)
const currentCategoryName = computed(() => (catModal.value.value[currentLocaleKey.value] ?? '').trim())

function openAddCategory() {
  catModal.value = { mode: 'add', value: { de: '', en: '', ar: '' } }
  catSubmitted.value = false
  catOpen.value = true
}
function openEditCategory(id: string, name: LocalizedText) {
  catModal.value = { mode: 'edit', id, value: JSON.parse(JSON.stringify(name)) }
  catSubmitted.value = false
  catOpen.value = true
}
function saveCategory() {
  catSubmitted.value = true
  const val = currentCategoryName.value
  if (!val) return
  const payload = JSON.parse(JSON.stringify(catModal.value.value)) as LocalizedText
  if (catModal.value.mode === 'add') {
    quiz.addCategory(payload)
  } else if (catModal.value.id) {
    quiz.updateCategory(catModal.value.id, { name: payload })
  }
  catOpen.value = false
  catSubmitted.value = false
}
function deleteCategory(id: string) {
  if (confirm(t('quiz.manager.confirmDeleteCategory'))) quiz.deleteCategory(id)
}

// Stack Modal
type StackModal = { mode: 'add' | 'edit', id?: string, value: LocalizedText, categoryId: string, modes: StackModeState }
const stackModal = ref<StackModal>({ mode: 'add', value: { de: '', en: '', ar: '' }, categoryId: '', modes: createModeState() })
const stackOpen = ref(false)
const stackSubmitted = ref(false)
const currentStackName = computed(() => (stackModal.value.value[currentLocaleKey.value] ?? '').trim())
const hasStackModeSelection = computed(() => selectedModes(stackModal.value.modes).length > 0)

function openAddStack(categoryId: string) {
  const defaultCategory = categoryId || quiz.categories[0]?.id || ''
  stackModal.value = { mode: 'add', value: { de: '', en: '', ar: '' }, categoryId: defaultCategory, modes: createModeState() }
  stackSubmitted.value = false
  stackOpen.value = true
}
function openEditStack(stId: string) {
  const st = quiz.stacks.find(s => s.id === stId)
  if (!st) return
  stackModal.value = {
    mode: 'edit',
    id: stId,
    value: JSON.parse(JSON.stringify(st.name)),
    categoryId: st.categoryId,
    modes: createModeState(st.modes),
  }
  stackSubmitted.value = false
  stackOpen.value = true
}
function saveStack() {
  stackSubmitted.value = true
  const name = currentStackName.value
  const selected = selectedModes(stackModal.value.modes)
  if (!name || !selected.length || !stackModal.value.categoryId) return
  const payloadName = JSON.parse(JSON.stringify(stackModal.value.value)) as LocalizedText
  if (stackModal.value.mode === 'add') {
    quiz.addStack({ categoryId: stackModal.value.categoryId, name: payloadName, modes: selected })
  } else if (stackModal.value.id) {
    quiz.updateStack(stackModal.value.id, { categoryId: stackModal.value.categoryId, name: payloadName, modes: selected })
  }
  stackOpen.value = false
  stackSubmitted.value = false
}
function deleteStack(id: string) {
  if (confirm(t('quiz.manager.confirmDeleteStack'))) quiz.deleteStack(id)
}

// Question Modal
type EditorQuestion = {
  id?: string
  categoryId: string
  stackId: string
  text: LocalizedText
  answers: LocalizedText[]
  correctIndex?: number
  correctIndexes?: number[]
}
const qModalOpen = ref(false)
const qSubmitted = ref(false)
const qValid = ref(false)
const qDraft = ref<EditorQuestion>({ categoryId: '', stackId: '', text: { de: '', en: '', ar: '' }, answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }], correctIndexes: [], correctIndex: undefined })
let qEditingId: string | null = null

function openAddQuestion(categoryId: string, stackId: string) {
  qEditingId = null
  qDraft.value = { categoryId, stackId, text: { de: '', en: '', ar: '' }, answers: [{ de: '', en: '', ar: '' }, { de: '', en: '', ar: '' }], correctIndexes: [], correctIndex: undefined }
  qSubmitted.value = false
  qModalOpen.value = true
}
function openEditQuestion(id: string) {
  const q = quiz.questions.find(qq => qq.id === id)
  if (!q) return
  qEditingId = id
  qDraft.value = JSON.parse(JSON.stringify({ categoryId: q.categoryId, stackId: q.stackId, text: q.text, answers: q.answers, correctIndexes: q.correctIndexes ?? [], correctIndex: q.correctIndex }))
  qSubmitted.value = false
  qModalOpen.value = true
}
function saveQuestion() {
  qSubmitted.value = true
  if (!qValid.value) return
  if (qEditingId) {
    quiz.updateQuestion(qEditingId, { ...qDraft.value })
  } else {
    quiz.addQuestion({ ...qDraft.value })
  }
  qModalOpen.value = false
}
function deleteQuestion(id: string) {
  if (confirm(t('quiz.manager.confirmDeleteQuestion'))) quiz.deleteQuestion(id)
}

// Drag & Drop Reorder Handler
function onStacksReordered(categoryId: string, newList: Array<{ id: string }>) {
  const orderedIds = newList.map(it => it.id)
  quiz.reorderStacks(categoryId, orderedIds)
}
function onQuestionsReordered(stackId: string, newList: Array<{ id: string }>) {
  const orderedIds = newList.map(it => it.id)
  quiz.reorderQuestions(stackId, orderedIds)
}
</script>

<template>
  <section class="app-page">
    <PageHeading :parent="t('quiz.title')" :parent-to="{ name: 'quiz-home' }" :title="t('quiz.tabs.manage')"
      :title-to="{ name: 'quiz-manage' }" :description="t('quiz.manage.heading')" />
    <div class="quiz-manage">
      <!-- Kategorien Ebene -->
      <div v-for="c in quiz.categories" :key="c.id" class="quiz-manage__node quiz-manage__node--cat">
        <div class="quiz-manage__line">
          <button class="quiz-manage__chevron" type="button" @click="toggleCat(c.id)">
            <Icon :icon="openCat[c.id] ? 'prime:angle-down' : (isRtl ? 'prime:angle-left' : 'prime:angle-right')" />
          </button>
          <div class="quiz-manage__title">{{ quiz.localize(c.name) }}</div>
          <div class="quiz-manage__actions">
            <button class="icon-btn" type="button" @click="openEditCategory(c.id, c.name)">
              <Icon icon="uil:edit" />
            </button>
            <button class="icon-btn" type="button" @click="deleteCategory(c.id)">
              <Icon icon="ri:delete-bin-line" />
            </button>
          </div>
        </div>
        <div v-if="openCat[c.id]" class="quiz-manage__children">
          <!-- Stacks Ebene (draggable) -->
          <Draggable :modelValue="stacksByCat(c.id)" item-key="id" handle=".quiz-manage__drag-handle"
            :ghost-class="'quiz-manage__drag-ghost'" :chosen-class="'quiz-manage__drag-active'"
            @update:modelValue="(newList: any[]) => onStacksReordered(c.id, newList)">
            <template #item="{ element: s }">
              <div :key="s.id" class="quiz-manage__node quiz-manage__node--stack">
                <div class="quiz-manage__line">
                  <button class="quiz-manage__chevron" type="button" @click="toggleStack(s.id)">
                    <Icon
                      :icon="openStack[s.id] ? 'prime:angle-down' : (isRtl ? 'prime:angle-left' : 'prime:angle-right')" />
                  </button>
                  <div class="quiz-manage__title">
                    <span>{{ quiz.localize(s.name) }}</span>
                    <span class="quiz-manage__mode-badges">
                      <span
                        v-for="mode in s.modes"
                        :key="`${s.id}-${mode}`"
                        :class="['quiz-manage__mode-badge', { 'quiz-manage__mode-badge-learn': mode === 'learn' }]"
                      >
                        {{ mode === 'play' ? t('quiz.tabs.play') : t('quiz.tabs.learn') }}
                      </span>
                    </span>
                  </div>
                  <div class="quiz-manage__actions">
                    <button class="icon-btn" type="button" @click="openEditStack(s.id)">
                      <Icon icon="uil:edit" />
                    </button>
                    <button class="icon-btn" type="button" @click="deleteStack(s.id)">
                      <Icon icon="ri:delete-bin-line" />
                    </button>
                    <button class="icon-btn quiz-manage__drag-handle" type="button" title="Drag" aria-label="Drag">
                      <Icon icon="carbon:drag-vertical" />
                    </button>
                  </div>
                </div>
                <div v-if="openStack[s.id]" class="quiz-manage__children">
                  <!-- Fragen Ebene (draggable) -->
                  <Draggable :modelValue="questionsBySt(s.id)" item-key="id" handle=".quiz-manage__drag-handle"
                    :ghost-class="'quiz-manage__drag-ghost'" :chosen-class="'quiz-manage__drag-active'"
                    @update:modelValue="(newList: any[]) => onQuestionsReordered(s.id, newList)">
                    <template #item="{ element: q }">
                      <div :key="q.id" class="quiz-manage__node quiz-manage__node--question">
                        <div class="quiz-manage__line quiz-manage__line--question">
                          <div class="quiz-manage__title">{{ quiz.localize(q.text) }}</div>
                          <div class="quiz-manage__actions">
                            <button class="icon-btn" type="button" @click="openEditQuestion(q.id)">
                              <Icon icon="uil:edit" />
                            </button>
                            <button class="icon-btn" type="button" @click="deleteQuestion(q.id)">
                              <Icon icon="ri:delete-bin-line" />
                            </button>
                            <button class="icon-btn quiz-manage__drag-handle" type="button" title="Drag"
                              aria-label="Drag">
                              <Icon icon="carbon:drag-vertical" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </template>
                  </Draggable>
                  <!-- Neue Frage hinzufügen -->
                  <div class="quiz-manage__add-row">
                    <button class="btn" type="button" @click="openAddQuestion(c.id, s.id)">+ {{ t('quiz.manage.addNew')
                      }}</button>
                  </div>
                </div>
              </div>
            </template>
          </Draggable>
          <!-- Neuen Stack hinzufügen -->
          <div class="quiz-manage__add-row">
            <button class="btn" type="button" @click="openAddStack(c.id)">+ {{ t('quiz.manager.addStack') }}</button>
          </div>
        </div>
      </div>
      <!-- Neue Kategorie hinzufügen -->
      <div class="quiz-manage__add-row quiz-manage__add-row--root">
        <button class="btn primary" type="button" @click="openAddCategory()">+ {{ t('quiz.manager.addCategory')
        }}</button>
      </div>

      <!-- Category Modal -->
      <BaseModal v-model="catOpen"
        :title="catModal.mode === 'add' ? t('quiz.manager.addCategory') : t('quiz.manager.editCategory')">
        <div class="quiz-manage__form-row">
          <span class="quiz-manager__label-spacer" aria-hidden="true">&nbsp;</span>
          <div class="quiz-manage__form-field">
            <input :placeholder="t('quiz.manager.addCategory')"
              v-model="catModal.value[locale as keyof typeof catModal.value]" />
            <p v-if="catSubmitted && !currentCategoryName" class="quiz-manage__hint quiz-manage__hint--error">
              {{ t('quiz.manager.errors.nameRequired') }}
            </p>
          </div>
        </div>
        <template #footer>
          <div class="modal-footer-split">
            <div class="left"><button class="btn" type="button" @click="catOpen = false">{{ t('quiz.editor.cancel')
                }}</button></div>
            <div class="right"><button class="btn primary" type="button" @click="saveCategory">{{ t('quiz.editor.save')
            }}</button></div>
          </div>
        </template>
      </BaseModal>

      <!-- Stack Modal -->
      <BaseModal v-model="stackOpen"
        :title="stackModal.mode === 'add' ? t('quiz.manager.addStack') : t('quiz.manager.editStack')">
        <div class="quiz-manage__form-row"><label>{{ t('quiz.editor.category') }}</label>
          <select v-model="stackModal.categoryId">
            <option v-for="c in quiz.categories" :key="c.id" :value="c.id">{{ quiz.localize(c.name) }}</option>
          </select>
        </div>
        <div class="quiz-manage__form-row"><label>{{ t('quiz.editor.name') }}</label>
          <div class="quiz-manage__form-field">
            <input v-model="stackModal.value[locale as keyof typeof stackModal.value]" />
            <p v-if="stackSubmitted && !currentStackName" class="quiz-manage__hint quiz-manage__hint--error">
              {{ t('quiz.manager.errors.nameRequired') }}
            </p>
          </div>
        </div>
        <div class="quiz-manage__form-row"><label>{{ t('quiz.manager.modes.label') }}</label>
          <div class="quiz-manage__mode-options">
            <label class="quiz-manage__mode-option">
              <input type="checkbox" v-model="stackModal.modes.play" />
              <span>{{ t('quiz.manager.modes.play') }}</span>
            </label>
            <label class="quiz-manage__mode-option">
              <input type="checkbox" v-model="stackModal.modes.learn" />
              <span>{{ t('quiz.manager.modes.learn') }}</span>
            </label>
          </div>
        </div>
        <div class="quiz-manage__form-row">
          <span class="quiz-manager__label-spacer" aria-hidden="true">&nbsp;</span>
          <p v-if="stackSubmitted && !hasStackModeSelection" class="quiz-manage__hint quiz-manage__hint--error">
            {{ t('quiz.manager.errors.modeRequired') }}
          </p>
        </div>
        <template #footer>
          <div class="modal-footer-split">
            <div class="left"><button class="btn" type="button" @click="stackOpen = false">{{ t('quiz.editor.cancel')
                }}</button></div>
            <div class="right"><button class="btn primary" type="button" @click="saveStack">{{ t('quiz.editor.save')
            }}</button></div>
          </div>
        </template>
      </BaseModal>

      <!-- Question Modal -->
      <BaseModal v-model="qModalOpen" :title="qEditingId ? t('quiz.manager.editQuestion') : t('quiz.manage.addNew')">
        <QuestionEditor v-model="qDraft" :categories="categoriesOptions" :stacks="stacksOptions"
          @valid="qValid = $event" :show-errors="qSubmitted" />
        <template #footer>
          <div class="modal-footer-split">
            <div class="left"><button class="btn" type="button" @click="qModalOpen = false">{{ t('quiz.editor.cancel')
                }}</button></div>
            <div class="right"><button class="btn primary" type="button" @click="saveQuestion">{{ t('quiz.editor.save')
                }}</button></div>
          </div>
        </template>
      </BaseModal>
    </div>
  </section>
</template>
