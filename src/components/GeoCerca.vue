<template>
  <div class="geo">
    <div class="linha topo">
      <input v-model="busca" type="text" :placeholder="semRaio ? 'Endereço do estabelecimento' : 'Endereço da loja do anunciante'" @keydown.enter.prevent="procurar" />
      <button type="button" class="btn pequeno" :disabled="!busca.trim() || procurando" @click="procurar">{{ procurando ? 'Buscando…' : 'Buscar' }}</button>
      <template v-if="!semRaio && ponto">
        <label class="linha raio">Raio
          <select v-model.number="raio" @change="emitir">
            <option v-for="r in RAIOS" :key="r" :value="r">{{ r < 1 ? r * 1000 + ' m' : r + ' km' }}</option>
          </select>
        </label>
      </template>
      <button v-if="ponto" type="button" class="btn fantasma pequeno perigo" @click="limpar">{{ semRaio ? 'Remover local' : 'Sem cerca' }}</button>
    </div>
    <ul v-if="resultados.length" class="resultados">
      <li v-for="r in resultados" :key="r.lat + ',' + r.lng"><button type="button" @click="escolher(r.lat, r.lng)">{{ r.nome }}</button></li>
    </ul>
    <div ref="caixa" class="mapa" />
    <p class="dica">
      <template v-if="!ponto">{{ semRaio ? 'Clique no mapa onde fica a tela (ou busque o endereço).' : 'Sem cerca: a campanha roda em qualquer lugar. Clique no mapa ou busque o endereço para criar uma.' }}</template>
      <template v-else-if="semRaio">Local definido. Usado quando a tela não tem GPS.</template>
      <template v-else>A campanha só aparece quando a tela estiver a até <strong>{{ raio < 1 ? raio * 1000 + ' m' : raio + ' km' }}</strong> deste ponto. Clique no mapa para mover.</template>
      <span v-if="erroMapa" class="erro"> {{ erroMapa }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buscarEndereco, camadaRuas, carregarLeaflet, geoValido, type Geo } from '../mapa'
import { erro } from '../toast'

const props = defineProps<{ modelValue: Geo | null | unknown; semRaio?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Geo | null] }>()

const RAIOS = [0.5, 1, 2, 3, 5, 10, 20]
const CENTRO_BR: [number, number] = [-14.2, -51.9]

const caixa = ref<HTMLDivElement>()
const busca = ref('')
const procurando = ref(false)
const resultados = ref<{ nome: string; lat: number; lng: number }[]>([])
const erroMapa = ref('')
const ponto = ref<{ lat: number; lng: number } | null>(geoValido(props.modelValue) ? { lat: Number(props.modelValue.lat), lng: Number(props.modelValue.lng) } : null)
const raio = ref<number>(geoValido(props.modelValue) && Number(props.modelValue.raio_km) > 0 ? Number(props.modelValue.raio_km) : 3)

let L: any = null
let mapa: any = null
let marcador: any = null
let circulo: any = null
let observador: ResizeObserver | null = null

function emitir() {
  emit('update:modelValue', ponto.value ? (props.semRaio ? { ...ponto.value } : { ...ponto.value, raio_km: raio.value }) : null)
  desenhar()
}

function desenhar() {
  if (!mapa) return
  marcador?.remove()
  circulo?.remove()
  marcador = circulo = null
  if (!ponto.value) return
  const ll = [ponto.value.lat, ponto.value.lng]
  marcador = L.circleMarker(ll, { radius: 7, color: '#1e1e1e', weight: 2, fillColor: '#e9a453', fillOpacity: 1 }).addTo(mapa)
  if (!props.semRaio) {
    circulo = L.circle(ll, { radius: raio.value * 1000, color: '#e9a453', weight: 2, fillOpacity: 0.12 }).addTo(mapa)
    mapa.fitBounds(circulo.getBounds(), { padding: [20, 20], maxZoom: 15 })
  }
}

function escolher(lat: number, lng: number) {
  ponto.value = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
  resultados.value = []
  if (mapa && props.semRaio) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 15))
  emitir()
}

function limpar() {
  ponto.value = null
  emitir()
}

async function procurar() {
  procurando.value = true
  try {
    resultados.value = await buscarEndereco(busca.value)
    if (!resultados.value.length) erro('Endereço não encontrado. Tente rua, número e cidade.')
    else if (resultados.value.length === 1) escolher(resultados.value[0].lat, resultados.value[0].lng)
  } catch (e) {
    erro(e)
  } finally {
    procurando.value = false
  }
}

onMounted(async () => {
  try {
    L = await carregarLeaflet()
    if (!caixa.value) return
    mapa = L.map(caixa.value, { scrollWheelZoom: false }).setView(ponto.value ? [ponto.value.lat, ponto.value.lng] : CENTRO_BR, ponto.value ? 14 : 4)
    camadaRuas(L).addTo(mapa)
    mapa.on('click', (e: any) => escolher(e.latlng.lat, e.latlng.lng))
    desenhar()
    // o mapa nasce dentro de um modal: recalcula o tamanho quando a caixa aparece/muda
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

watch(
  () => props.modelValue,
  (v) => {
    const novo = geoValido(v) ? { lat: Number(v.lat), lng: Number(v.lng) } : null
    if (JSON.stringify(novo) !== JSON.stringify(ponto.value)) {
      ponto.value = novo
      if (geoValido(v) && Number(v.raio_km) > 0) raio.value = Number(v.raio_km)
      desenhar()
    }
  },
)
</script>

<style scoped>
.geo { display: flex; flex-direction: column; gap: 8px; font-weight: 400; }
.topo { flex-wrap: wrap; }
.topo input[type='text'] { flex: 1; min-width: 220px; }
.raio select { width: auto; }
.resultados { list-style: none; margin: 0; padding: 0; border: 1px solid var(--borda); border-radius: 8px; max-height: 160px; overflow-y: auto; }
.resultados button { width: 100%; text-align: left; background: none; border: 0; padding: 7px 10px; font: inherit; font-size: 0.85rem; cursor: pointer; }
.resultados li + li button { border-top: 1px solid #efede8; }
.resultados button:hover { background: var(--laranja-claro); }
.mapa { height: 260px; border-radius: 10px; border: 1px solid var(--borda); overflow: hidden; z-index: 0; }
.dica { margin: 0; }
.erro { color: var(--vermelho); }
</style>
