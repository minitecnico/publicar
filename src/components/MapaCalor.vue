<template>
  <div class="mapa-calor">
    <div ref="caixa" class="mapa" />
    <div class="legenda">
      <span>menos</span>
      <i v-for="c in CORES" :key="c" :style="{ background: c }" />
      <span>mais exibições</span>
      <span v-if="erroMapa" class="erro">{{ erroMapa }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { camadaRuas, carregarLeaflet, geoValido, type Geo } from '../mapa'
import { numero } from '../format'

/** Quadrículas de 0,01° (~1 km) com as exibições estimadas em cada uma. */
const props = defineProps<{ pontos: { lat: number; lng: number; exibicoes: number }[]; cerca?: Geo | null }>()

const CORES = ['#fde9b8', '#f9c46b', '#f39a3d', '#e2622b', '#b8321f']
const MEIA = 0.005

const caixa = ref<HTMLDivElement>()
const erroMapa = ref('')
let L: any = null
let mapa: any = null
let camada: any = null
let observador: ResizeObserver | null = null

function desenhar() {
  if (!mapa) return
  camada?.remove()
  camada = L.layerGroup().addTo(mapa)
  const max = Math.max(1, ...props.pontos.map((p) => p.exibicoes))
  const limites: [number, number][] = []
  for (const p of props.pontos) {
    if (p.exibicoes <= 0) continue
    // escala raiz quadrada: realça regiões médias sem apagar as pequenas
    const t = Math.sqrt(p.exibicoes / max)
    const cor = CORES[Math.min(CORES.length - 1, Math.floor(t * CORES.length))]
    const b: [[number, number], [number, number]] = [[p.lat - MEIA, p.lng - MEIA], [p.lat + MEIA, p.lng + MEIA]]
    L.rectangle(b, { stroke: false, fillColor: cor, fillOpacity: 0.35 + t * 0.45 })
      .bindTooltip(`≈ ${numero(p.exibicoes)} exibições nesta região`)
      .addTo(camada)
    limites.push(b[0], b[1])
  }
  if (geoValido(props.cerca) && props.cerca.raio_km) {
    const c = L.circle([props.cerca.lat, props.cerca.lng], { radius: props.cerca.raio_km * 1000, color: '#1e1e1e', weight: 2, dashArray: '6 6', fill: false }).addTo(camada)
    const bb = c.getBounds()
    limites.push([bb.getSouth(), bb.getWest()], [bb.getNorth(), bb.getEast()])
  }
  if (limites.length) mapa.fitBounds(limites, { padding: [16, 16], maxZoom: 14 })
}

onMounted(async () => {
  try {
    L = await carregarLeaflet()
    if (!caixa.value) return
    mapa = L.map(caixa.value, { scrollWheelZoom: false }).setView([-14.2, -51.9], 4)
    camadaRuas(L).addTo(mapa)
    desenhar()
    observador = new ResizeObserver(() => mapa?.invalidateSize())
    observador.observe(caixa.value)
  } catch (e) {
    erroMapa.value = String((e as Error).message || e)
  }
})
onBeforeUnmount(() => {
  observador?.disconnect()
  mapa?.remove()
})
watch(() => [props.pontos, props.cerca], desenhar, { deep: true })
</script>

<style scoped>
.mapa-calor { display: flex; flex-direction: column; gap: 6px; }
.mapa { height: 340px; border-radius: 10px; border: 1px solid var(--borda); overflow: hidden; z-index: 0; }
.legenda { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: var(--texto-2); flex-wrap: wrap; }
.legenda i { width: 22px; height: 10px; border-radius: 2px; display: inline-block; }
.legenda span { margin: 0 4px; }
.erro { color: var(--vermelho); }
@media print { .mapa { height: 300px; break-inside: avoid; } }
</style>
