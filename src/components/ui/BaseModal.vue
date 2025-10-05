<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  width?: string | number
  closable?: boolean
}>(), {
  closable: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const overlay = ref<HTMLElement | null>(null)

const dialogStyle = computed(() => {
  if (typeof props.width === 'string' && props.width.trim().length > 0) {
    return {
      width: props.width,
      maxWidth: '92vw',
      maxHeight: '90vh',
    }
  }

  if (typeof props.width === 'number') {
    return {
      width: `min(${props.width}px, 92vw)`,
      maxWidth: '92vw',
      maxHeight: '90vh',
    }
  }

  return {
    width: 'min(720px, 92vw)',
    maxWidth: '92vw',
    maxHeight: '90vh',
  }
})

function close() { emit('update:modelValue', false) }

function onKey(e: KeyboardEvent) {
  if (!props.closable) return
  if (e.key === 'Escape') close()
}

function onOverlayClick(e: MouseEvent) {
  if (!props.closable) return
  if (e.target === overlay.value) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  // Ensure body overflow is reset when component unmounts
  document.body.style.overflow = ''
})

watch(() => props.modelValue, (open) => {
  try {
    document.body.style.overflow = open ? 'hidden' : ''
  } catch (error) {
    console.warn('Failed to set body overflow:', error)
  }
}, { immediate: true })
</script>

<template>
  <teleport to="body">
    <div v-if="modelValue" ref="overlay" class="ui-modal__overlay" @click="onOverlayClick">
      <div class="ui-modal__dialog" role="dialog" aria-modal="true" :aria-label="title" :style="dialogStyle">
        <header v-if="title" class="ui-modal__header">
          <h3>{{ title }}</h3>
          <button v-if="props.closable" class="icon-btn" type="button" aria-label="Close" @click="close">✖️</button>
        </header>
        <div class="ui-modal__content">
          <slot />
        </div>
        <footer class="ui-modal__footer">
          <slot name="footer">
            <div class="modal-footer-split">
              <div class="left" v-if="props.closable">
                <button class="btn" type="button" @click="close">Close</button>
              </div>
              <div class="right">
                <!-- Place save or custom actions here -->
              </div>
            </div>
          </slot>
        </footer>
      </div>
    </div>
  </teleport>

</template>
