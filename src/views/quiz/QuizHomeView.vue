<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import PageHeading from '@/components/ui/PageHeading.vue'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const admin = useAdminStore()
</script>

<template>
  <section class="app-page">
    <PageHeading :title="t('quiz.title')" :title-to="{ name: 'quiz-home' }" />
    <div class="app-card-grid app-card-grid--padded">
      <RouterLink class="app-card" :to="{ name: 'quiz-practice' }">{{ t('quiz.tabs.playLearn') }}</RouterLink>
      <RouterLink v-if="admin.isAdmin" class="app-card" to="/quiz/verwalten">{{ t('quiz.tabs.manage') }}</RouterLink>
      <RouterLink class="app-card" to="/quiz/statistik">{{ t('quiz.stats.title') }}</RouterLink>
    </div>
  </section>
</template>
