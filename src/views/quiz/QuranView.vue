<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PageHeading from '@/components/ui/PageHeading.vue'

const { t } = useI18n()
</script>

<template>
  <section class="app-page">
    <PageHeading :title="t('nav.quran')" :title-to="{ name: 'quran' }" />
    <p class="text-muted-foreground">Hier kannst du später Suren lesen und ggf. Audio einbetten.</p>
  </section>
</template>
