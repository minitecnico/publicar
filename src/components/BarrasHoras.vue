<template>
  <svg :viewBox="`0 0 ${L} ${A}`" class="barras" role="img" aria-label="Exibições por hora do dia">
    <g v-for="h in serie" :key="h.hora">
      <rect :x="x(h.hora) + 2" :y="y(h.total)" :width="larg - 4" :height="Math.max(base - y(h.total), h.total ? 2 : 0)" rx="3" :fill="h.hora === pico ? 'var(--laranja)' : '#d9d6cf'">
        <title>{{ String(h.hora).padStart(2, '0') }}h: {{ numero(h.total) }} exibições</title>
      </rect>
      <text v-if="h.hora % 3 === 0" :x="x(h.hora) + larg / 2" :y="A - 6" text-anchor="middle" class="rotulo">{{ String(h.hora).padStart(2, '0') }}h</text>
    </g>
    <line x1="0" :x2="L" :y1="base" :y2="base" stroke="#cfcbc2" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { numero } from '../format'

const props = defineProps<{ serie: { hora: number; total: number }[] }>()
const L = 720
const A = 170
const base = A - 24
const larg = L / 24
const max = computed(() => Math.max(1, ...props.serie.map((h) => Number(h.total))))
const pico = computed(() => props.serie.reduce((m, h) => (h.total > (props.serie[m]?.total ?? -1) ? h.hora : m), 0))
const x = (h: number) => h * larg
const y = (v: number) => base - (v / max.value) * (base - 12)
</script>

<style scoped>
.barras { width: 100%; height: auto; display: block; }
.rotulo { font-size: 11px; fill: var(--texto-2); }
</style>
