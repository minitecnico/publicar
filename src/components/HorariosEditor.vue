<template>
  <div class="horarios">
    <div class="atalhos">
      <span class="mudo pequeno">Atalhos:</span>
      <button v-for="p in PRESETS" :key="p.nome" type="button" class="btn pequeno" :class="{ ativo: temJanela(p) }" @click="alternarPreset(p)">
        {{ p.nome }} <span class="mudo">{{ p.ini }}–{{ p.fim }}</span>
      </button>
    </div>
    <div v-for="(j, i) in janelas" :key="i" class="janela">
      <input v-model="j.ini" type="time" step="900" required @change="emitir" />
      <span>até</span>
      <input v-model="j.fim" type="time" step="900" required @change="emitir" />
      <span v-if="j.fim && j.ini && j.fim <= j.ini" class="selo azul">cruza a meia-noite</span>
      <button type="button" class="btn fantasma pequeno" title="Remover faixa" @click="remover(i)"><Icone nome="x" :tamanho="14" /></button>
    </div>
    <div class="linha">
      <button type="button" class="btn pequeno" @click="adicionar"><Icone nome="mais" :tamanho="14" /> Faixa personalizada</button>
      <span class="mudo pequeno">{{ janelas.length ? '' : 'Sem faixas: roda o dia todo.' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Icone from './Icone.vue'

interface Janela { ini: string; fim: string }
const props = defineProps<{ modelValue: Janela[] | null }>()
const emit = defineEmits<{ 'update:modelValue': [Janela[]] }>()

const PRESETS = [
  { nome: 'Manhã', ini: '06:00', fim: '11:00' },
  { nome: 'Almoço', ini: '11:00', fim: '14:00' },
  { nome: 'Tarde', ini: '14:00', fim: '18:00' },
  { nome: 'Noite', ini: '18:00', fim: '23:00' },
  { nome: 'Madrugada', ini: '23:00', fim: '06:00' },
]

const copia = (v: Janela[] | null) => JSON.parse(JSON.stringify(v || [])) as Janela[]
const janelas = ref<Janela[]>(copia(props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    if (JSON.stringify(v || []) !== JSON.stringify(janelas.value)) janelas.value = copia(v)
  },
)
const emitir = () => emit('update:modelValue', copia(janelas.value))
const temJanela = (p: Janela) => janelas.value.some((j) => j.ini === p.ini && j.fim === p.fim)
function alternarPreset(p: Janela) {
  const i = janelas.value.findIndex((j) => j.ini === p.ini && j.fim === p.fim)
  if (i >= 0) janelas.value.splice(i, 1)
  else janelas.value.push({ ini: p.ini, fim: p.fim })
  janelas.value.sort((a, b) => a.ini.localeCompare(b.ini))
  emitir()
}
const adicionar = () => { janelas.value.push({ ini: '08:00', fim: '12:00' }); emitir() }
const remover = (i: number) => { janelas.value.splice(i, 1); emitir() }
</script>

<style scoped>
.horarios { display: flex; flex-direction: column; gap: 8px; font-weight: 400; }
.atalhos { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.atalhos .btn.ativo { background: var(--laranja-claro); border-color: var(--laranja); color: var(--laranja-escuro); }
.janela { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.janela input { width: auto; }
</style>
