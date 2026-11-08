<template>
  <Modal :aberto="aberto" titulo="Enquadrar no formato da tela (16:9)" larga @fechar="cancelar">
    <div class="enquadrar">
      <p class="mudo pequeno topo">
        <strong>{{ nome }}</strong> está em {{ img?.naturalWidth }}×{{ img?.naturalHeight }}
        ({{ descricaoFormato }}). As telas usam <strong>1920×1080</strong>: escolha como a peça deve ficar.
      </p>

      <div class="modos">
        <button type="button" class="modo" :class="{ ativo: modo === 'recortar' }" @click="definirModo('recortar')">
          <strong>Recortar</strong>
          <span>Ocupa a tela toda. Arraste a imagem e use o zoom para escolher a parte que aparece.</span>
        </button>
        <button type="button" class="modo" :class="{ ativo: modo === 'inteira' }" @click="definirModo('inteira')">
          <strong>Encaixar inteira</strong>
          <span>Nada é cortado. As sobras ficam com a própria imagem desfocada.</span>
        </button>
      </div>

      <div
        class="palco-previa"
        :class="{ arrastavel: modo === 'recortar' }"
        @pointerdown="iniciarArraste"
        @pointermove="arrastar"
        @pointerup="soltar"
        @pointercancel="soltar"
        @wheel.prevent="rodar"
      >
        <canvas ref="previa" width="960" height="540" />
        <span class="selo-formato">1920 × 1080</span>
      </div>

      <div v-if="modo === 'recortar'" class="controles">
        <label class="linha">Zoom <input v-model.number="zoom" type="range" min="1" max="3" step="0.01" @input="desenharPrevia" /></label>
        <button type="button" class="btn pequeno" @click="centralizar">Centralizar</button>
      </div>
    </div>
    <template #rodape>
      <button type="button" class="btn" @click="cancelar">Cancelar</button>
      <button type="button" class="btn primario" :disabled="gerando" @click="confirmar">{{ gerando ? 'Gerando…' : 'Usar este enquadramento' }}</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import Modal from './Modal.vue'

/**
 * Padroniza imagens no formato das telas (16:9, 1920×1080), como fazem as redes de DOOH:
 * o enquadramento é decidido no envio, e o player nunca precisa cortar nada.
 * Uso: const arquivo = await enquadrador.value.padronizar(file)  → File 1920×1080, ou null se cancelado.
 */
const W = 1920
const H = 1080
const PROPORCAO = W / H

const aberto = ref(false)
const gerando = ref(false)
const nome = ref('')
const img = ref<HTMLImageElement | null>(null)
const previa = ref<HTMLCanvasElement>()
const modo = ref<'recortar' | 'inteira'>('recortar')
const zoom = ref(1)
const desloc = ref({ x: 0, y: 0 }) // deslocamento do centro, em pixels da saída (1920×1080)
let resolver: ((f: File | null) => void) | null = null

const descricaoFormato = computed(() => {
  const i = img.value
  if (!i) return ''
  const r = i.naturalWidth / i.naturalHeight
  if (r < 0.9) return 'retrato'
  if (r < 1.1) return 'quadrada'
  return r > PROPORCAO ? 'mais larga que 16:9' : 'paisagem fora de 16:9'
})

function carregar(fonte: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(fonte)
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não foi possível ler a imagem')) }
    i.src = url
  })
}

/** Escala que faz a imagem cobrir a área W×H. */
const escalaCobrir = (i: HTMLImageElement, w: number, h: number) => Math.max(w / i.naturalWidth, h / i.naturalHeight)
const escalaConter = (i: HTMLImageElement, w: number, h: number) => Math.min(w / i.naturalWidth, h / i.naturalHeight)

function limitarDeslocamento() {
  const i = img.value
  if (!i) return
  const s = escalaCobrir(i, W, H) * zoom.value
  const folgaX = Math.max(0, (i.naturalWidth * s - W) / 2)
  const folgaY = Math.max(0, (i.naturalHeight * s - H) / 2)
  desloc.value = { x: Math.max(-folgaX, Math.min(folgaX, desloc.value.x)), y: Math.max(-folgaY, Math.min(folgaY, desloc.value.y)) }
}

/** Desenha a peça final em qualquer tamanho proporcional a 1920×1080. */
function desenhar(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const i = img.value!
  const k = w / W
  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  if (modo.value === 'inteira') {
    // fundo: a própria imagem cobrindo tudo, desfocada e escurecida
    const sc = escalaCobrir(i, w, h) * 1.08
    ctx.save()
    ctx.filter = `blur(${Math.round(36 * k)}px) brightness(0.6) saturate(1.2)`
    ctx.drawImage(i, (w - i.naturalWidth * sc) / 2, (h - i.naturalHeight * sc) / 2, i.naturalWidth * sc, i.naturalHeight * sc)
    ctx.restore()
    const s = escalaConter(i, w, h)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 40 * k
    ctx.drawImage(i, (w - i.naturalWidth * s) / 2, (h - i.naturalHeight * s) / 2, i.naturalWidth * s, i.naturalHeight * s)
    ctx.restore()
  } else {
    const s = escalaCobrir(i, w, h) * zoom.value
    const dw = i.naturalWidth * s
    const dh = i.naturalHeight * s
    ctx.drawImage(i, (w - dw) / 2 + desloc.value.x * k, (h - dh) / 2 + desloc.value.y * k, dw, dh)
  }
}

function desenharPrevia() {
  limitarDeslocamento()
  const c = previa.value
  if (!c || !img.value) return
  desenhar(c.getContext('2d')!, c.width, c.height)
}

function definirModo(m: 'recortar' | 'inteira') {
  modo.value = m
  desenharPrevia()
}
function centralizar() {
  desloc.value = { x: 0, y: 0 }
  zoom.value = 1
  desenharPrevia()
}

/* ---------- arrastar e zoom com a roda do mouse */
let arraste: { x: number; y: number; ox: number; oy: number } | null = null
function iniciarArraste(e: PointerEvent) {
  if (modo.value !== 'recortar') return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  arraste = { x: e.clientX, y: e.clientY, ox: desloc.value.x, oy: desloc.value.y }
}
function arrastar(e: PointerEvent) {
  if (!arraste || !previa.value) return
  const fator = W / previa.value.getBoundingClientRect().width
  desloc.value = { x: arraste.ox + (e.clientX - arraste.x) * fator, y: arraste.oy + (e.clientY - arraste.y) * fator }
  desenharPrevia()
}
const soltar = () => { arraste = null }
function rodar(e: WheelEvent) {
  if (modo.value !== 'recortar') return
  zoom.value = Math.max(1, Math.min(3, zoom.value - e.deltaY * 0.0015))
  desenharPrevia()
}

/* ---------- geração do arquivo final */
function gerarArquivo(): Promise<File> {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  desenhar(c.getContext('2d')!, W, H)
  return new Promise((ok, falha) =>
    c.toBlob((b) => (b ? ok(new File([b], `${nome.value.replace(/\.[^.]+$/, '') || 'peca'}-1920x1080.jpg`, { type: 'image/jpeg' })) : falha(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.9),
  )
}

async function confirmar() {
  gerando.value = true
  try {
    const f = await gerarArquivo()
    aberto.value = false
    resolver?.(f)
  } finally {
    gerando.value = false
    resolver = null
  }
}
function cancelar() {
  aberto.value = false
  resolver?.(null)
  resolver = null
}

/** Ignora GIF animado e SVG (não passam por canvas sem perder animação/qualidade). */
const padronizavel = (f: Blob) => /^image\/(png|jpe?g|webp)$/.test(f.type)

/**
 * Devolve a imagem padronizada em 1920×1080.
 * Já em 16:9 → só redimensiona (sem perguntar). Fora do formato → abre o editor.
 */
async function padronizar(arquivo: File): Promise<File | null> {
  if (!padronizavel(arquivo)) return arquivo
  nome.value = arquivo.name
  img.value = await carregar(arquivo)
  const r = img.value.naturalWidth / img.value.naturalHeight
  modo.value = 'recortar'
  zoom.value = 1
  desloc.value = { x: 0, y: 0 }
  if (Math.abs(r - PROPORCAO) < 0.02) return gerarArquivo()
  // retrato e quadrada costumam ficar melhor inteiras; o usuário escolhe
  if (r < 1.1) modo.value = 'inteira'
  aberto.value = true
  await nextTick()
  desenharPrevia()
  return new Promise((ok) => (resolver = ok))
}

/** Reenquadra uma peça já enviada (busca o arquivo pelo endereço). */
async function padronizarUrl(url: string, nomeArquivo = 'peca.jpg'): Promise<File | null> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Não foi possível baixar a peça para enquadrar')
  const b = await r.blob()
  return padronizar(new File([b], nomeArquivo, { type: b.type }))
}

defineExpose({ padronizar, padronizarUrl })
</script>

<style scoped>
.enquadrar { display: flex; flex-direction: column; gap: 12px; }
.topo { margin: 0; }
.modos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.modo { text-align: left; border: 2px solid var(--borda); background: var(--branco); border-radius: 10px; padding: 10px 12px; cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: 2px; }
.modo span { font-size: 0.82rem; color: var(--texto-2); }
.modo.ativo { border-color: var(--laranja); background: var(--laranja-claro); }
.palco-previa { position: relative; background: #111; border-radius: 10px; overflow: hidden; touch-action: none; }
.palco-previa.arrastavel { cursor: grab; }
.palco-previa.arrastavel:active { cursor: grabbing; }
.palco-previa canvas { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; }
.selo-formato { position: absolute; right: 10px; top: 10px; background: rgba(0, 0, 0, 0.6); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; letter-spacing: 0.04em; }
.controles { display: flex; align-items: center; gap: 14px; }
.controles input[type='range'] { width: 220px; }
@media (max-width: 640px) { .modos { grid-template-columns: 1fr; } }
</style>
