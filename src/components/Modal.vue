<template>
  <Teleport to="body">
    <div v-if="aberto" class="fundo" @mousedown.self="$emit('fechar')">
      <div class="janela cartao" :class="{ larga }" role="dialog" aria-modal="true">
        <header>
          <h2>{{ titulo }}</h2>
          <button class="btn fantasma pequeno" aria-label="Fechar" @click="$emit('fechar')"><Icone nome="x" /></button>
        </header>
        <div class="corpo"><slot /></div>
        <footer v-if="$slots.rodape"><slot name="rodape" /></footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import Icone from './Icone.vue'

defineProps<{ aberto: boolean; titulo: string; larga?: boolean }>()
const emit = defineEmits<{ fechar: [] }>()
const esc = (e: KeyboardEvent) => e.key === 'Escape' && emit('fechar')
onMounted(() => window.addEventListener('keydown', esc))
onBeforeUnmount(() => window.removeEventListener('keydown', esc))
</script>

<style scoped>
.fundo { position: fixed; inset: 0; background: rgba(20, 20, 20, 0.45); display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px; z-index: 500; overflow-y: auto; }
.janela { width: 100%; max-width: 640px; }
.janela.larga { max-width: 860px; }
header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--borda); }
.corpo { padding: 20px; }
footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--borda); background: #fbfaf8; border-radius: 0 0 var(--raio) var(--raio); }
</style>
