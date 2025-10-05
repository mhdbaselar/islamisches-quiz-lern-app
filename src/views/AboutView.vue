<script setup lang="ts">
import PageHeading from '@/components/ui/PageHeading.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="app-page">
    <PageHeading :title="t('pages.about.heading')" :title-to="{ name: 'about' }" />
  </section>
</template>
