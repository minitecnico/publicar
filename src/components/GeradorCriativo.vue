<template>
  <Modal :aberto="aberto" titulo="Criar arte da peça" larga @fechar="fechar">
    <div class="gerador">
      <div class="previa">
        <canvas ref="tela" width="960" height="540" />
        <ul class="checagem">
          <li v-for="c in checagem" :key="c.txt" :class="c.nivel">
            <span>{{ c.nivel === 'ok' ? '✓' : c.nivel === 'aviso' ? '!' : '✕' }}</span>{{ c.txt }}
          </li>
        </ul>
      </div>

      <div class="campos">
        <div class="modelos">
          <button v-for="m in MODELOS" :key="m.valor" type="button" class="modelo" :class="{ ativo: f.modelo === m.valor }" @click="f.modelo = m.valor">
            <strong>{{ m.nome }}</strong><span>{{ m.desc }}</span>
          </button>
        </div>

        <label class="campo">Título (até 7 palavras) *
          <input v-model="f.titulo" type="text" maxlength="70" placeholder="Ex.: Pizza grande + refri" />
          <span class="dica">{{ palavras }} palavra(s). Menos é mais: o passageiro tem segundos para ler.</span>
        </label>
        <label class="campo">Complemento
          <input v-model="f.subtitulo" type="text" maxlength="90" placeholder="Ex.: Só às sextas, retirada ou entrega" />
        </label>
        <div class="linha2">
          <label class="campo">Preço <input v-model="f.preco" type="text" maxlength="16" placeholder="R$ 49,90" /></label>
          <label class="campo">Preço antigo <input v-model="f.precoDe" type="text" maxlength="16" placeholder="R$ 69,90" /></label>
        </div>
        <label class="campo">Contato na arte
          <input v-model="f.contato" type="text" maxlength="40" placeholder="(75) 99999-0000 · @sualoja" />
        </label>
        <label class="campo">Link do QR (WhatsApp ou site)
          <input v-model="f.link" type="text" placeholder="wa.me/5575999990000 ou sualoja.com.br" />
          <span class="dica">Vira o QR rastreado da tela (fica no canto inferior direito, que a arte deixa livre).</span>
        </label>
        <div class="linha2">
          <div class="campo">
            <span>Logo</span>
            <label class="btn pequeno"><Icone nome="upload" :tamanho="14" /> {{ logo ? 'Trocar logo' : 'Enviar logo' }}<input type="file" accept="image/*" hidden @change="carregarImagem($event, 'logo')" /></label>
          </div>
          <div class="campo">
            <span>Foto do produto</span>
            <label class="btn pequeno"><Icone nome="upload" :tamanho="14" /> {{ foto ? 'Trocar foto' : 'Enviar foto' }}<input type="file" accept="image/*" hidden @change="carregarImagem($event, 'foto')" /></label>
          </div>
        </div>
        <div class="linha2">
          <label class="campo">Cor de fundo <div class="linha"><input v-model="f.fundo" type="color" class="cor" /><input v-model="f.fundo" type="text" /></div></label>
          <label class="campo">Cor de destaque <div class="linha"><input v-model="f.destaque" type="color" class="cor" /><input v-model="f.destaque" type="text" /></div></label>
        </div>
      </div>
    </div>
    <template #rodape>
      <span class="mudo pequeno resumo">{{ erros ? `${erros} item(ns) a corrigir` : 'Pronta para usar' }}</span>
      <button type="button" class="btn" @click="fechar">Cancelar</button>
      <button type="button" class="btn primario" :disabled="!!erros || gerando" @click="gerar">{{ gerando ? 'Gerando…' : 'Usar como peça' }}</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { api } from '../api'
import { erro } from '../toast'
import Icone from './Icone.vue'
import Modal from './Modal.vue'

/**
 * Gerador de criativos para o pequeno anunciante: monta a peça em 1920×1080 a partir de logo, foto,
 * título, preço e contato, com checagem de legibilidade (padrão de mídia exterior: poucas palavras,
 * letra grande, contraste alto). O canto inferior direito fica livre para o QR rastreado do player.
 */
const emit = defineEmits<{ criada: [{ nome: string; midia_url: string; link_qr: string | null }] }>()

const W = 1920
const H = 1080
const FONTE = '"Inter", "Segoe UI", Roboto, Arial, sans-serif'
const MODELOS = [
  { valor: 'oferta', nome: 'Oferta', desc: 'Texto à esquerda, foto à direita' },
  { valor: 'foto', nome: 'Foto em destaque', desc: 'Foto na tela toda, texto por cima' },
  { valor: 'texto', nome: 'Só texto', desc: 'Sem foto: título grande no centro' },
]

const aberto = ref(false)
const gerando = ref(false)
const tela = ref<HTMLCanvasElement>()
const logo = ref<HTMLImageElement | null>(null)
const foto = ref<HTMLImageElement | null>(null)
const f = reactive({ modelo: 'oferta', titulo: '', subtitulo: '', preco: '', precoDe: '', contato: '', link: '', fundo: '#1e1e1e', destaque: '#f2c200' })
/** Tamanhos de letra efetivamente usados no último desenho (para a checagem). */
const medidas = reactive({ titulo: 0, subtitulo: 0, contato: 0, cabe: true })

const palavras = computed(() => f.titulo.trim().split(/\s+/).filter(Boolean).length)

/* ---------------- cores e contraste (WCAG 2) */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0) as [number, number, number]
}
function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** Texto branco ou grafite, o que der mais contraste com o fundo. */
const textoSobre = (fundo: string) => (contraste('#FFFFFF', fundo) >= contraste('#1E1E1E', fundo) ? '#FFFFFF' : '#1E1E1E')
const corTexto = computed(() => (f.modelo === 'foto' ? '#FFFFFF' : textoSobre(f.fundo)))
/** No modelo foto o texto fica sobre um degradê escuro (≈ #141414). */
const fundoDoTexto = computed(() => (f.modelo === 'foto' ? '#141414' : f.fundo))

/* ---------------- checagem de legibilidade */
const checagem = computed(() => {
  const l: { nivel: 'ok' | 'aviso' | 'erro'; txt: string }[] = []
  if (!f.titulo.trim()) l.push({ nivel: 'erro', txt: 'Escreva o título.' })
  else if (palavras.value > 7) l.push({ nivel: 'erro', txt: `Título com ${palavras.value} palavras: use no máximo 7.` })
  else l.push({ nivel: 'ok', txt: `Título com ${palavras.value} palavra(s).` })
  const c = contraste(corTexto.value, fundoDoTexto.value)
  if (c < 4.5) l.push({ nivel: 'erro', txt: `Contraste baixo (${c.toFixed(1)}:1). Escolha um fundo mais claro ou mais escuro (mínimo 4,5:1).` })
  else l.push({ nivel: 'ok', txt: `Contraste ${c.toFixed(1)}:1.` })
  const cd = contraste(textoSobre(f.destaque), f.destaque)
  if (f.preco.trim() && cd < 4.5) l.push({ nivel: 'aviso', txt: 'A cor de destaque deixa o preço pouco legível.' })
  if (f.titulo.trim() && medidas.titulo && medidas.titulo < 72) l.push({ nivel: 'aviso', txt: 'Título longo ficou com letra pequena. Encurte para ler de longe.' })
  if (!medidas.cabe) l.push({ nivel: 'erro', txt: 'O texto não coube. Encurte o título ou o complemento.' })
  if (f.modelo !== 'texto' && !foto.value) l.push({ nivel: f.modelo === 'foto' ? 'erro' : 'aviso', txt: 'Envie uma foto do produto (ou use o modelo "Só texto").' })
  if (foto.value && Math.max(foto.value.naturalWidth, foto.value.naturalHeight) < 900) l.push({ nivel: 'aviso', txt: 'Foto com resolução baixa: pode ficar borrada.' })
  if (!logo.value) l.push({ nivel: 'aviso', txt: 'Sem logo: a marca do anunciante não aparece.' })
  if (!f.contato.trim() && !f.link.trim()) l.push({ nivel: 'aviso', txt: 'Sem contato nem QR: como o cliente vai comprar?' })
  return l
})
const erros = computed(() => checagem.value.filter((c) => c.nivel === 'erro').length)

/* ---------------- desenho */
function quebrar(ctx: CanvasRenderingContext2D, txt: string, larg: number) {
  const linhas: string[] = []
  let atual = ''
  for (const p of txt.split(/\s+/).filter(Boolean)) {
    const t = atual ? `${atual} ${p}` : p
    if (ctx.measureText(t).width <= larg || !atual) atual = t
    else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}
/** Maior letra (de `max` até `min`) em que o texto cabe em `maxLinhas` linhas. */
function caber(ctx: CanvasRenderingContext2D, txt: string, larg: number, maxLinhas: number, max: number, min: number, peso = 800) {
  for (let t = max; t >= min; t -= 4) {
    ctx.font = `${peso} ${t}px ${FONTE}`
    const l = quebrar(ctx, txt, larg)
    if (l.length <= maxLinhas && l.every((x) => ctx.measureText(x).width <= larg)) return { tamanho: t, linhas: l, cabe: true }
  }
  ctx.font = `${peso} ${min}px ${FONTE}`
  return { tamanho: min, linhas: quebrar(ctx, txt, larg).slice(0, maxLinhas), cabe: false }
}
function escrever(ctx: CanvasRenderingContext2D, linhas: string[], x: number, y: number, tamanho: number, alinhar: CanvasTextAlign = 'left') {
  ctx.textAlign = alinhar
  ctx.textBaseline = 'top'
  linhas.forEach((l, i) => ctx.fillText(l, x, y + i * tamanho * 1.08))
  return y + linhas.length * tamanho * 1.08
}
function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}
function conter(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, alinhar: 'esq' | 'centro' = 'esq') {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, alinhar === 'centro' ? x + (w - dw) / 2 : x, y + (h - dh) / 2, dw, dh)
}
function caixa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
/** Selo de preço (com "de R$ X" riscado em cima). Devolve a altura usada. */
function preco(ctx: CanvasRenderingContext2D, x: number, y: number, centro = false) {
  if (!f.preco.trim()) return 0
  let topo = y
  if (f.precoDe.trim()) {
    ctx.font = `600 44px ${FONTE}`
    ctx.fillStyle = corTexto.value
    ctx.globalAlpha = 0.75
    const t = `de ${f.precoDe.trim()}`
    const lw = ctx.measureText(t).width
    const px = centro ? x - lw / 2 : x
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(t, px, topo)
    ctx.fillRect(px, topo + 24, lw, 4)
    ctx.globalAlpha = 1
    topo += 60
  }
  ctx.font = `800 104px ${FONTE}`
  const tw = ctx.measureText(f.preco.trim()).width
  const bw = tw + 80
  const bx = centro ? x - bw / 2 : x
  ctx.fillStyle = f.destaque
  caixa(ctx, bx, topo, bw, 140, 28)
  ctx.fill()
  ctx.fillStyle = textoSobre(f.destaque)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(f.preco.trim(), bx + 40, topo + 74)
  return topo - y + 140
}

function desenhar(ctx: CanvasRenderingContext2D, larguraFinal: number) {
  const k = larguraFinal / W
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.clearRect(0, 0, W, H)
  const cor = corTexto.value
  let cabe = true

  if (f.modelo === 'oferta') {
    ctx.fillStyle = f.fundo
    ctx.fillRect(0, 0, W, H)
    if (foto.value) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(1060, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(900, H); ctx.closePath()
      ctx.clip()
      cobrir(ctx, foto.value, 900, 0, W - 900, H)
      ctx.restore()
      // filete na cor de destaque acompanhando o corte diagonal
      ctx.strokeStyle = f.destaque
      ctx.lineWidth = 14
      ctx.beginPath(); ctx.moveTo(1060, 0); ctx.lineTo(900, H); ctx.stroke()
    }
    if (logo.value) conter(ctx, logo.value, 96, 70, 340, 150)
    ctx.fillStyle = cor
    const t = caber(ctx, f.titulo.trim() || 'Seu título aqui', 760, 3, 128, 64)
    medidas.titulo = t.tamanho
    cabe &&= t.cabe
    let y = escrever(ctx, t.linhas, 96, logo.value ? 270 : 150, t.tamanho)
    if (f.subtitulo.trim()) {
      const s = caber(ctx, f.subtitulo.trim(), 740, 2, 54, 38, 500)
      medidas.subtitulo = s.tamanho
      cabe &&= s.cabe
      ctx.globalAlpha = 0.85
      y = escrever(ctx, s.linhas, 96, y + 22, s.tamanho)
      ctx.globalAlpha = 1
    }
    preco(ctx, 96, y + 44)
    if (f.contato.trim()) {
      ctx.fillStyle = cor
      ctx.font = `700 46px ${FONTE}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(f.contato.trim(), 96, H - 76)
    }
  } else if (f.modelo === 'foto') {
    ctx.fillStyle = '#141414'
    ctx.fillRect(0, 0, W, H)
    if (foto.value) cobrir(ctx, foto.value, 0, 0, W, H)
    const g = ctx.createLinearGradient(0, 0, W * 0.7, 0)
    g.addColorStop(0, 'rgba(10,10,10,0.92)')
    g.addColorStop(0.55, 'rgba(10,10,10,0.7)')
    g.addColorStop(1, 'rgba(10,10,10,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    if (logo.value) {
      ctx.fillStyle = '#FFFFFF'
      caixa(ctx, 80, 64, 380, 170, 26)
      ctx.fill()
      conter(ctx, logo.value, 110, 84, 320, 130, 'centro')
    }
    ctx.fillStyle = cor
    const t = caber(ctx, f.titulo.trim() || 'Seu título aqui', 900, 3, 132, 64)
    medidas.titulo = t.tamanho
    cabe &&= t.cabe
    let y = escrever(ctx, t.linhas, 96, logo.value ? 290 : 160, t.tamanho)
    if (f.subtitulo.trim()) {
      const s = caber(ctx, f.subtitulo.trim(), 880, 2, 54, 38, 500)
      medidas.subtitulo = s.tamanho
      cabe &&= s.cabe
      ctx.globalAlpha = 0.9
      y = escrever(ctx, s.linhas, 96, y + 22, s.tamanho)
      ctx.globalAlpha = 1
    }
    preco(ctx, 96, y + 44)
    if (f.contato.trim()) {
      ctx.fillStyle = cor
      ctx.font = `700 46px ${FONTE}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(f.contato.trim(), 96, H - 76)
    }
  } else {
    ctx.fillStyle = f.fundo
    ctx.fillRect(0, 0, W, H)
    const g = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7)
    g.addColorStop(0, f.destaque + '55')
    g.addColorStop(1, f.destaque + '00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    if (logo.value) conter(ctx, logo.value, W / 2 - 200, 60, 400, 150, 'centro')
    ctx.fillStyle = cor
    const t = caber(ctx, f.titulo.trim() || 'Seu título aqui', 1500, 3, 160, 72)
    medidas.titulo = t.tamanho
    cabe &&= t.cabe
    const alturaTitulo = t.linhas.length * t.tamanho * 1.08
    let y = escrever(ctx, t.linhas, W / 2, Math.max(logo.value ? 250 : 170, 430 - alturaTitulo / 2), t.tamanho, 'center')
    if (f.subtitulo.trim()) {
      const s = caber(ctx, f.subtitulo.trim(), 1300, 2, 60, 40, 500)
      medidas.subtitulo = s.tamanho
      cabe &&= s.cabe
      ctx.globalAlpha = 0.85
      y = escrever(ctx, s.linhas, W / 2, y + 26, s.tamanho, 'center')
      ctx.globalAlpha = 1
    }
    preco(ctx, W / 2, y + 44, true)
    if (f.contato.trim()) {
      ctx.fillStyle = cor
      ctx.font = `700 48px ${FONTE}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(f.contato.trim(), W / 2, H - 76)
    }
  }
  medidas.cabe = cabe
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

function redesenhar() {
  const c = tela.value
  if (c) desenhar(c.getContext('2d')!, c.width)
}
watch([f, logo, foto], () => nextTick(redesenhar), { deep: true })

function carregarImagem(e: Event, qual: 'logo' | 'foto') {
  const input = e.target as HTMLInputElement
  const arq = input.files?.[0]
  input.value = ''
  if (!arq) return
  const img = new Image()
  img.onload = () => (qual === 'logo' ? (logo.value = img) : (foto.value = img))
  img.onerror = () => erro('Não foi possível ler a imagem')
  img.src = URL.createObjectURL(arq)
}

async function gerar() {
  gerando.value = true
  try {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    desenhar(c.getContext('2d')!, W)
    const blob = await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.92))
    const nome = f.titulo.trim().slice(0, 60) || 'Arte'
    const r = await api.upload(new File([blob], `${nome.replace(/[^\w-]+/g, '-').toLowerCase()}-1920x1080.jpg`, { type: 'image/jpeg' }))
    emit('criada', { nome, midia_url: r.url, link_qr: f.link.trim() || null })
    aberto.value = false
  } catch (e) {
    erro(e)
  } finally {
    gerando.value = false
  }
}

function fechar() {
  aberto.value = false
}

/** Abre o editor (opcionalmente já com o link do QR da campanha). */
async function abrir(link?: string | null) {
  if (link && !f.link) f.link = link
  aberto.value = true
  await nextTick()
  // fonte do sistema pode carregar depois do primeiro desenho
  redesenhar()
  setTimeout(redesenhar, 300)
}
defineExpose({ abrir })
</script>

<style scoped>
.gerador { display: grid; grid-template-columns: 1.25fr 1fr; gap: 18px; }
.previa { display: flex; flex-direction: column; gap: 10px; position: sticky; top: 0; align-self: start; }
.previa canvas { width: 100%; height: auto; aspect-ratio: 16 / 9; border-radius: 10px; border: 1px solid var(--borda); background: #111; }
.checagem { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; }
.checagem li { display: flex; gap: 8px; align-items: baseline; }
.checagem li span { width: 18px; height: 18px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 0.7rem; font-weight: 800; flex-shrink: 0; }
.checagem .ok span { background: var(--verde-claro); color: var(--verde); }
.checagem .aviso span { background: var(--laranja-claro); color: var(--laranja-escuro); }
.checagem .erro { color: var(--vermelho); }
.checagem .erro span { background: var(--vermelho-claro); color: var(--vermelho); }
.campos { display: flex; flex-direction: column; gap: 10px; }
.modelos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.modelo { text-align: left; border: 2px solid var(--borda); background: var(--branco); border-radius: 10px; padding: 8px 10px; cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: 2px; }
.modelo span { font-size: 0.72rem; color: var(--texto-2); }
.modelo.ativo { border-color: var(--laranja); background: var(--laranja-claro); }
.linha2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cor { width: 46px; padding: 2px; height: 38px; flex-shrink: 0; }
.resumo { margin-right: auto; }
@media (max-width: 760px) { .gerador { grid-template-columns: 1fr; } .previa { position: static; } }
</style>
