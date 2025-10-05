<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  parent?: string
  parentTo?: RouteLocationRaw
  parentHref?: string
  title: string
  titleTo?: RouteLocationRaw
  titleHref?: string
  description?: string
}>(), {})

const { locale } = useI18n()
const separatorIcon = computed(() => (locale.value === 'ar' ? 'icon-park-outline:left' : 'icon-park-outline:right'))

const hasParentLink = computed(() => Boolean(props.parentTo ?? props.parentHref))
const hasTitleLink = computed(() => Boolean(props.titleTo ?? props.titleHref))

const parentTag = computed(() => {
  if (props.parentTo) return RouterLink
  if (props.parentHref) return 'a'
  return 'span'
})

const parentAttrs = computed(() => {
  if (props.parentTo) return { to: props.parentTo }
  if (props.parentHref) return { href: props.parentHref }
  return {}
})

const titleTag = computed(() => {
  if (props.titleTo) return RouterLink
  if (props.titleHref) return 'a'
  return 'span'
})

const titleAttrs = computed(() => {
  if (props.titleTo) return { to: props.titleTo }
  if (props.titleHref) return { href: props.titleHref }
  return {}
})
</script>

<template>
  <header class="page-heading">
    <div class="page-heading__row">
      <h1 class="page-heading__title">
        <template v-if="props.parent">
          <component :is="parentTag" v-bind="parentAttrs" class="page-heading__parent"
            :class="{ 'page-heading__link': hasParentLink }">
            {{ props.parent }}
          </component>
          <Icon :icon="separatorIcon" class="page-heading__separator" aria-hidden="true" />
        </template>
        <component :is="titleTag" v-bind="titleAttrs" class="page-heading__current"
          :class="{ 'page-heading__link': hasTitleLink }">
          {{ props.title }}
        </component>
      </h1>
      <div v-if="$slots.actions" class="page-heading__actions">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="props.description" class="page-heading__description">{{ props.description }}</p>
  </header>
</template>
