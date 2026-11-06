<template>
  <div class="conteudo-editor">
    <div v-for="(item, i) in itens" :key="i" class="item cartao">
      <div class="grade">
        <label class="campo">Tipo
          <select v-model="item.tipo" @change="emitir">
            <option value="video">Vídeo (arquivo/link)</option>
            <option value="imagem">Imagem</option>
            <option value="youtube">YouTube</option>
            <option value="aviso">Aviso em texto</option>
          </select>
        </label>
        <label class="campo">Título <input v-model="item.titulo" type="text" placeholder="Opcional" @input="emitir" /></label>
        <label v-if="item.tipo !== 'video'" class="campo">Duração (s) <input v-model.number="item.duracao" type="number" min="5" @input="emitir" /></label>
      </div>
      <label v-if="item.tipo === 'aviso'" class="campo">Texto do aviso
        <textarea v-model="item.texto" rows="2" placeholder="Ex.: Hoje: corte + barba por R$ 50" @input="emitir" />
      </label>
      <MediaInput v-else v-model="item.url" :tipo="item.tipo" @update:model-value="emitir" />
      <button type="button" class="btn perigo pequeno remover" @click="remover(i)">Remover</button>
    </div>
    <button type="button" class="btn pequeno" @click="adicionar"><Icone nome="mais" /> Adicionar item de entretenimento</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Icone from './Icone.vue'
import MediaInput from './MediaInput.vue'

interface Item { tipo: string; url?: string; titulo?: string; duracao?: number; texto?: string }
const props = defineProps<{ modelValue: Item[] | null }>()
const emit = defineEmits<{ 'update:modelValue': [Item[]] }>()

const itens = ref<Item[]>(JSON.parse(JSON.stringify(props.modelValue || [])))
watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(v) !== JSON.stringify(itens.value)) itens.value = JSON.parse(JSON.stringify(v || []))
  },
)
const emitir = () => emit('update:modelValue', JSON.parse(JSON.stringify(itens.value)))
const adicionar = () => { itens.value.push({ tipo: 'video', url: '', duracao: 30 }); emitir() }
const remover = (i: number) => { itens.value.splice(i, 1); emitir() }
</script>

<style scoped>
.conteudo-editor { display: flex; flex-direction: column; gap: 10px; }
.item { padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: none; background: #fbfaf8; }
.grade { display: grid; grid-template-columns: 1.2fr 1.5fr 0.8fr; gap: 10px; }
.remover { align-self: flex-start; }
@media (max-width: 640px) { .grade { grid-template-columns: 1fr; } }
</style>
