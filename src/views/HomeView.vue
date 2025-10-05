<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="home-view">
    <section class="home-view__hero">
      <img src="/islam.png" alt="Logo" width="72" height="72" />
      <h1 class="text-3xl font-bold">{{ t('pages.home.heading') }}</h1>
      <p class="text-muted-foreground">{{ t('app.title') }}</p>
    </section>

    <section class="app-card-grid app-card-grid--padded home-view__grid">
      <RouterLink class="app-card" to="/quiz">
        <h3 class="font-semibold">{{ t('nav.quiz') }}</h3>
      </RouterLink>

      <RouterLink class="app-card" to="/gebetszeiten">
        <h3 class="font-semibold">{{ t('nav.prayerTimes') }}</h3>
      </RouterLink>

      <RouterLink class="app-card" to="/quran">
        <h3 class="font-semibold">{{ t('nav.quran') }}</h3>
      </RouterLink>
    </section>
  </main>
</template>
