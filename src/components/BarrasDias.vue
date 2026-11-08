<template>
  <svg :viewBox="`0 0 ${L} ${A}`" class="barras" role="img" :aria-label="titulo">
    <g v-for="(d, i) in dias" :key="d.dia">
      <rect
        :x="x(i) + 6"
        :y="y(d.total)"
        :width="larguraBarra - 12"
        :height="Math.max(base - y(d.total), d.total ? 2 : 0)"
        rx="4"
        :fill="d.dia === hojeStr ? 'var(--laranja)' : '#d9d6cf'"
      >
        <title>{{ dataCurta(d.dia) }}: {{ numero(d.total) }} exibições</title>
      </rect>
      <text v-if="d.total" :x="x(i) + larguraBarra / 2" :y="y(d.total) - 6" text-anchor="middle" class="valor">{{ numero(d.total) }}</text>
      <text :x="x(i) + larguraBarra / 2" :y="A - 6" text-anchor="middle" class="rotulo">{{ dataCurta(d.dia) }}</text>
    </g>
    <line x1="0" :x2="L" :y1="base" :y2="base" stroke="#cfcbc2" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { hoje, numero } from '../format'

const props = defineProps<{ serie: { dia: string; total: number }[]; numDias?: number; titulo?: string; ate?: string }>()
const L = 640
const A = 200
const base = A - 26
const hojeStr = hoje()

// completa os dias sem exibição
const dias = computed(() => {
  const n = props.numDias || 7
  const mapa = Object.fromEntries(props.serie.map((s) => [s.dia, Number(s.total)]))
  return Array.from({ length: n }, (_, i) => {
    // termina em "ate" (campanha já encerrada) ou hoje
    const fim = props.ate ? Date.parse(`${props.ate}T12:00:00-03:00`) : Date.now()
    const dia = new Date(fim - (n - 1 - i) * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    return { dia, total: mapa[dia] || 0 }
  })
})
const max = computed(() => Math.max(1, ...dias.value.map((d) => d.total)))
const larguraBarra = computed(() => L / dias.value.length)
const x = (i: number) => i * larguraBarra.value
const y = (v: number) => base - (v / max.value) * (base - 24)
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
</script>

<style scoped>
.barras { width: 100%; height: auto; display: block; }
.valor { font-size: 12px; font-weight: 600; fill: var(--texto); }
.rotulo { font-size: 11.5px; fill: var(--texto-2); }
</style>
