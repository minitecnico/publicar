<template>
  <div class="toasts">
    <TransitionGroup name="t">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.tipo">{{ t.texto }}</div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { toasts } from '../toast'
</script>

<style scoped>
.toasts { position: fixed; right: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 1000; }
.toast { background: var(--grafite); color: #fff; padding: 11px 16px; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.18); max-width: 360px; font-size: .9rem; border-left: 4px solid var(--laranja); }
.toast.erro { border-left-color: #e5534b; }
.t-enter-active, .t-leave-active { transition: all .2s; }
.t-enter-from, .t-leave-to { opacity: 0; transform: translateY(8px); }
</style>
