<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PageHeading from '@/components/ui/PageHeading.vue'

const { t } = useI18n()
</script>

<template>
  <section class="app-page">
    <PageHeading :title="t('nav.prayerTimes')" :title-to="{ name: 'gebetszeiten' }" />
    <p class="text-muted-foreground">Hier werden später die heutigen Gebetszeiten angezeigt, inklusive nächster
      Gebetszeit.</p>
  </section>
</template>
