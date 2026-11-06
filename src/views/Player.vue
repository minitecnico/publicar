<template>
  <!-- Sem código: pede o código da tela uma única vez -->
  <div v-if="!codigo" class="pedir-codigo">
    <form class="caixa" @submit.prevent="definirCodigo">
      <img src="/logo.png" alt="Publicar" />
      <h1>Configurar esta tela</h1>
      <p>Digite o código de 6 letras que aparece em <strong>Telas</strong> no painel.</p>
      <input v-model="codigoDigitado" maxlength="6" placeholder="EX: K7P2QD" autocapitalize="characters" autofocus />
      <button>Começar</button>
    </form>
  </div>

  <div v-else class="player" :style="estiloTema" @click="tocarTela">
    <!-- Erro sem cache -->
    <div v-if="!dados && falha" class="ocioso">
      <img src="/logo.png" alt="Publicar" class="logo-ocioso" />
      <p>{{ falha }}</p>
      <p class="pequeno">Código: {{ codigo }} · tentando de novo a cada minuto</p>
      <button class="trocar" @click.stop="trocarCodigo">Trocar código</button>
    </div>

    <template v-else-if="dados">
      <div class="area" :class="{ lateral: layoutLateral }">
        <!-- Palco principal -->
        <div class="palco">
          <Transition name="fade" mode="out-in">
            <div v-if="atual" :key="atual.chave" class="item">
              <img v-if="atual.tipo === 'imagem'" :src="fonte(atual.url)" alt="" class="midia" />
              <video
                v-else-if="atual.tipo === 'video'"
                :src="fonte(atual.url)"
                class="midia"
                autoplay
                playsinline
                :muted="mudo"
                @ended="avancar"
                @error="avancarDepois(2)"
              />
              <iframe
                v-else-if="atual.tipo === 'youtube'"
                :src="embedYoutube(atual.url)"
                class="midia"
                allow="autoplay; encrypted-media"
                frameborder="0"
              />
              <div v-else-if="atual.tipo === 'aviso'" class="aviso">
                <span class="aviso-titulo">{{ atual.titulo || 'Aviso' }}</span>
                <p>{{ atual.texto }}</p>
              </div>

              <div v-if="atual.texto && atual.tipo !== 'aviso'" class="chamada">{{ atual.texto }}</div>
              <div v-if="atual.campanhaId && qrs[atual.campanhaId]" class="qr"><img :src="qrs[atual.campanhaId]" alt="QR code" /><span>Aponte a câmera</span></div>
            </div>
            <div v-else key="vazio" class="ocioso">
              <img src="/logo.png" alt="Publicar" class="logo-ocioso" />
              <p>{{ dados.tela.nome }} pronta.</p>
              <p class="pequeno">Aguardando campanhas ativas · código {{ dados.tela.codigo }}</p>
            </div>
          </Transition>
        </div>

        <!-- Coluna de anúncios (layout lateral) -->
        <aside v-if="layoutLateral" class="coluna">
          <Transition name="fade" mode="out-in">
            <div v-if="lateralAtual" :key="lateralAtual.chave" class="item">
              <img v-if="lateralAtual.tipo === 'imagem'" :src="fonte(lateralAtual.url)" alt="" class="midia" />
              <video v-else-if="lateralAtual.tipo === 'video'" :src="fonte(lateralAtual.url)" class="midia" autoplay muted playsinline loop />
              <div v-if="lateralAtual.texto" class="chamada pequena">{{ lateralAtual.texto }}</div>
              <div v-if="lateralAtual.campanhaId && qrs[lateralAtual.campanhaId]" class="qr pequeno-qr"><img :src="qrs[lateralAtual.campanhaId]" alt="QR code" /></div>
            </div>
          </Transition>
        </aside>
      </div>

      <!-- Rodapé: logo, recados e relógio -->
      <footer class="rodape">
        <div class="logo-pilula"><img :src="dados.tela.logo_url || '/logo.png'" alt="" /></div>
        <div class="ticker">
          <div v-if="recados" class="ticker-faixa" :style="{ animationDuration: duracaoTicker }">
            <span>{{ recados }}</span><span aria-hidden="true">{{ recados }}</span>
          </div>
        </div>
        <div class="relogio">{{ relogio }}</div>
      </footer>

      <div v-if="semRede" class="sem-rede" title="Sem conexão: tocando a última programação salva" />
    </template>

    <!-- Toque inicial: tela cheia, som e tela sempre acesa -->
    <Transition name="fade">
      <div v-if="mostrarInicio" class="inicio" @click.stop="iniciar">
        <img src="/logo.png" alt="Publicar" />
        <p>Toque na tela para iniciar</p>
      </div>
    </Transition>
    <Transition name="fade">
      <div v-if="aviso" class="aviso-flutuante">{{ aviso }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/* ------------------------------------------------------------ tipos */
interface Campanha { id: number; nome: string; midia_tipo: string; midia_url: string; duracao: number; texto: string | null; prioridade: number; qr_url: string | null }
interface Conteudo { tipo: string; url?: string; duracao?: number; titulo?: string; texto?: string }
interface Dados {
  tela: { id: number; nome: string; codigo: string; tipo: string; layout: string; cor_primaria: string; cor_fundo: string; logo_url: string | null; ticker: string | null; conteudo: Conteudo[] }
  campanhas: Campanha[]
}
interface Item { chave: string; tipo: string; url?: string; duracao: number; texto?: string | null; titulo?: string; qr?: string; campanhaId?: number }

const VERSAO = '0.1.0'
const route = useRoute()
const router = useRouter()

/* ------------------------------------------------------------ código da tela */
const codigo = ref<string>(String(route.params.codigo || localStorage.getItem('publicar.tela') || '').toUpperCase())
const codigoDigitado = ref('')
function definirCodigo() {
  const c = codigoDigitado.value.trim().toUpperCase()
  if (c.length < 4) return
  localStorage.setItem('publicar.tela', c)
  router.replace(`/tela/${c}`)
  codigo.value = c
  carregar()
}
function trocarCodigo() {
  localStorage.removeItem('publicar.tela')
  codigo.value = ''
  router.replace('/tela')
}
if (codigo.value) localStorage.setItem('publicar.tela', codigo.value)

/* ------------------------------------------------------------ dados e cache */
const chaveCache = () => `publicar.player.${codigo.value}`
const dados = ref<Dados | null>(null)
const falha = ref('')
const semRede = ref(false)
const qrs = reactive<Record<number, string>>({})

try {
  const salvo = localStorage.getItem(chaveCache())
  if (salvo) dados.value = JSON.parse(salvo)
} catch { /* ignora cache corrompido */ }

async function carregar() {
  if (!codigo.value) return
  try {
    const res = await fetch(`/api/player/${codigo.value}`, { cache: 'no-store' })
    const corpo = await res.json()
    if (!res.ok) {
      falha.value = corpo.erro || 'Não foi possível carregar a tela'
      if (res.status === 404 || res.status === 403) dados.value = null
      return
    }
    falha.value = ''
    semRede.value = false
    dados.value = corpo
    localStorage.setItem(chaveCache(), JSON.stringify(corpo))
  } catch {
    semRede.value = true
    if (!dados.value) falha.value = 'Sem conexão com a internet'
  }
}

/* ------------------------------------------------------------ mídia offline (Cache API) */
const locais = reactive<Record<string, string>>({})
const CACHE_MIDIA = 'publicar-midia-v1'
let preparando = false

async function prepararMidias() {
  if (preparando || !('caches' in window) || !dados.value) return
  preparando = true
  try {
    const urls = new Set<string>()
    for (const c of dados.value.campanhas) if (c.midia_url && c.midia_tipo !== 'youtube') urls.add(c.midia_url)
    for (const c of dados.value.tela.conteudo || []) if (c.url && (c.tipo === 'video' || c.tipo === 'imagem')) urls.add(c.url)
    if (dados.value.tela.logo_url) urls.add(dados.value.tela.logo_url)
    const cache = await caches.open(CACHE_MIDIA)
    for (const url of urls) {
      if (locais[url]) continue
      try {
        let res = await cache.match(url)
        if (!res) {
          const rede = await fetch(url)
          if (!rede.ok) continue
          await cache.put(url, rede.clone())
          res = rede
        }
        locais[url] = URL.createObjectURL(await res.blob())
      } catch { /* sem CORS ou sem rede: usa o endereço direto */ }
    }
    // limpa do cache arquivos que saíram da programação
    for (const req of await cache.keys()) {
      const caminho = new URL(req.url).pathname
      if (![...urls].some((u) => u === req.url || u === caminho)) await cache.delete(req)
    }
  } finally {
    preparando = false
  }
}
const fonte = (url?: string) => (url ? locais[url] || url : '')

watch(
  () => dados.value?.campanhas,
  async (camps) => {
    for (const c of camps || []) {
      if (c.qr_url && !qrs[c.id]) qrs[c.id] = await QRCode.toDataURL(c.qr_url, { margin: 1, width: 240, color: { dark: '#1E1E1E' } })
    }
    prepararMidias()
  },
  { immediate: true },
)

/* ------------------------------------------------------------ programação */
const anuncios = computed<Item[]>(() => {
  const lista: Item[] = []
  for (const c of dados.value?.campanhas || []) {
    for (let r = 0; r < Math.max(1, Math.min(c.prioridade || 1, 5)); r++) {
      lista.push({ chave: `c${c.id}-${r}`, tipo: c.midia_tipo, url: c.midia_url, duracao: c.duracao || 15, texto: c.texto, qr: qrs[c.id], campanhaId: c.id })
    }
  }
  // espalha as repetições para não tocar a mesma peça em sequência
  return lista.sort((a, b) => Number(a.chave.split('-')[1]) - Number(b.chave.split('-')[1]))
})
const entretenimento = computed<Item[]>(() =>
  (dados.value?.tela.conteudo || [])
    .filter((c) => c.url || c.texto)
    .map((c, i) => ({ chave: `e${i}`, tipo: c.tipo, url: c.url, duracao: c.duracao || 30, texto: null, titulo: c.titulo, ...(c.tipo === 'aviso' ? { texto: c.texto } : {}) })),
)
const layoutLateral = computed(() => dados.value?.tela.layout === 'lateral' && entretenimento.value.length > 0 && anuncios.value.length > 0)

const atual = ref<Item | null>(null)
const lateralAtual = ref<Item | null>(null)
let iAnuncio = 0
let iEnt = 0
let anunciosDesdeEnt = 0
let iLateral = 0
let timer: number | undefined
let timerLateral: number | undefined
let rodada = 0

function proximoItem(): Item | null {
  const ads = anuncios.value
  const ent = entretenimento.value
  if (layoutLateral.value) return ent.length ? { ...ent[iEnt++ % ent.length], chave: `e${rodada}` } : null
  if (!ads.length && !ent.length) return null
  if (ent.length && (!ads.length || anunciosDesdeEnt >= 2)) {
    anunciosDesdeEnt = 0
    return { ...ent[iEnt++ % ent.length], chave: `e${rodada}` }
  }
  anunciosDesdeEnt++
  return { ...ads[iAnuncio++ % ads.length], chave: `a${rodada}` }
}

function avancar() {
  clearTimeout(timer)
  rodada++
  const item = proximoItem()
  atual.value = item
  if (!item) {
    timer = window.setTimeout(avancar, 10000)
    return
  }
  if (item.campanhaId) registrarExibicao(item.campanhaId)
  // vídeo avança no "ended"; a trava de segurança evita ficar parado se o vídeo travar
  const segundos = item.tipo === 'video' ? 300 : Math.max(5, item.duracao)
  timer = window.setTimeout(avancar, segundos * 1000)
}
const avancarDepois = (s: number) => { clearTimeout(timer); timer = window.setTimeout(avancar, s * 1000) }

function avancarLateral() {
  clearTimeout(timerLateral)
  const ads = anuncios.value
  if (!layoutLateral.value || !ads.length) { lateralAtual.value = null; return }
  const item = { ...ads[iLateral++ % ads.length], chave: `l${iLateral}` }
  lateralAtual.value = item
  if (item.campanhaId) registrarExibicao(item.campanhaId)
  timerLateral = window.setTimeout(avancarLateral, Math.max(8, item.duracao) * 1000)
}

watch(layoutLateral, () => { avancar(); avancarLateral() })
watch(
  () => dados.value?.tela.id,
  () => { if (!atual.value) avancar() },
)

/* ------------------------------------------------------------ prova de exibição */
const chaveExib = () => `publicar.exib.${codigo.value}`
const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

function registrarExibicao(campanhaId: number) {
  const fila = JSON.parse(localStorage.getItem(chaveExib()) || '{}')
  const k = `${campanhaId}|${hojeBR()}`
  fila[k] = (fila[k] || 0) + 1
  localStorage.setItem(chaveExib(), JSON.stringify(fila))
}

async function enviarExibicoes() {
  const fila: Record<string, number> = JSON.parse(localStorage.getItem(chaveExib()) || '{}')
  const itens = Object.entries(fila).map(([k, total]) => {
    const [cid, dia] = k.split('|')
    return { campanha_id: Number(cid), dia, total }
  })
  if (!itens.length) return
  try {
    const res = await fetch(`/api/player/${codigo.value}/exibicoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }), keepalive: true })
    if (res.ok) {
      // desconta só o que foi enviado (pode ter entrado exibição nova durante o envio)
      const agora: Record<string, number> = JSON.parse(localStorage.getItem(chaveExib()) || '{}')
      for (const i of itens) {
        const k = `${i.campanha_id}|${i.dia}`
        agora[k] = (agora[k] || 0) - i.total
        if (agora[k] <= 0) delete agora[k]
      }
      localStorage.setItem(chaveExib(), JSON.stringify(agora))
    }
  } catch { /* tenta no próximo ciclo */ }
}

async function ping() {
  try {
    await fetch(`/api/player/${codigo.value}/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versao: VERSAO, tela: `${screen.width}x${screen.height}`, campanhas: dados.value?.campanhas.length ?? 0 }),
    })
    semRede.value = false
  } catch {
    semRede.value = true
  }
}

/* ------------------------------------------------------------ interação, tema, relógio */
const mudo = ref(true)
const mostrarInicio = ref(!sessionStorage.getItem('publicar.iniciado'))
const aviso = ref('')
let wakeLock: { release: () => Promise<void> } | null = null

async function iniciar() {
  mostrarInicio.value = false
  mudo.value = false
  sessionStorage.setItem('publicar.iniciado', '1')
  try { await document.documentElement.requestFullscreen?.() } catch { /* sem permissão */ }
  try { wakeLock = await (navigator as any).wakeLock?.request('screen') } catch { /* não suportado */ }
}

function tocarTela() {
  if (mostrarInicio.value) return
  mudo.value = !mudo.value
  aviso.value = mudo.value ? 'Som desligado' : 'Som ligado'
  setTimeout(() => (aviso.value = ''), 1500)
}

const estiloTema = computed(() => ({
  '--cor': dados.value?.tela.cor_primaria || '#E9A453',
  '--fundo-tela': dados.value?.tela.cor_fundo || '#1E1E1E',
}))

const recados = computed(() =>
  (dados.value?.tela.ticker || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('   •   ') + ((dados.value?.tela.ticker || '').trim() ? '   •   ' : ''),
)
const duracaoTicker = computed(() => `${Math.max(15, recados.value.length * 0.28)}s`)

const relogio = ref('')
const atualizarRelogio = () => (relogio.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }))

function embedYoutube(url?: string) {
  const id = (url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1]
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1` : ''
}

/* ------------------------------------------------------------ ciclo de vida */
const intervalos: number[] = []
const aoOcultar = () => document.visibilityState === 'hidden' && enviarExibicoes()

onMounted(async () => {
  document.title = 'Publicar · Tela'
  atualizarRelogio()
  if (!codigo.value) return
  await carregar()
  avancar()
  avancarLateral()
  ping()
  // passados 10 s sem toque (instalação em quiosque), some o aviso e segue tocando sem som
  setTimeout(() => (mostrarInicio.value = false), 10000)
  intervalos.push(
    window.setInterval(atualizarRelogio, 15000),
    // intervalos pensados para caber ~180 telas no limite grátis de 100 mil requisições/dia
    window.setInterval(carregar, 10 * 60 * 1000),
    window.setInterval(enviarExibicoes, 15 * 60 * 1000),
    window.setInterval(ping, 5 * 60 * 1000),
  )
  document.addEventListener('visibilitychange', aoOcultar)
  window.addEventListener('online', carregar)
})

onBeforeUnmount(() => {
  intervalos.forEach(clearInterval)
  clearTimeout(timer)
  clearTimeout(timerLateral)
  document.removeEventListener('visibilitychange', aoOcultar)
  window.removeEventListener('online', carregar)
  enviarExibicoes()
  wakeLock?.release().catch(() => {})
})
</script>

<style scoped>
.player { position: fixed; inset: 0; background: var(--fundo-tela); color: #fff; display: flex; flex-direction: column; overflow: hidden; user-select: none; cursor: none; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
.area { flex: 1; display: flex; min-height: 0; }
.palco { flex: 1; position: relative; min-width: 0; }
.area.lateral .palco { flex: 3; }
.coluna { flex: 1.15; position: relative; border-left: 4px solid var(--cor); background: #000; }
.item { position: absolute; inset: 0; display: grid; place-items: center; }
.midia { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; border: 0; background: #000; }
.chamada { position: absolute; left: 3vw; bottom: 3vh; max-width: 62%; background: var(--cor); color: #1e1e1e; font-weight: 800; font-size: clamp(18px, 3.2vw, 48px); line-height: 1.15; padding: 0.45em 0.7em; border-radius: 0.35em; box-shadow: 0 8px 30px rgba(0,0,0,.35); }
.chamada.pequena { font-size: clamp(12px, 1.4vw, 22px); left: 6%; right: 6%; max-width: none; bottom: 2vh; }
.qr { position: absolute; right: 3vw; bottom: 3vh; background: #fff; padding: 10px 10px 6px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 8px 30px rgba(0,0,0,.35); }
.qr img { width: clamp(90px, 13vw, 190px); height: auto; display: block; }
.qr span { color: #1e1e1e; font-size: clamp(10px, 1.1vw, 15px); font-weight: 700; }
.pequeno-qr { right: 6%; top: 3vh; bottom: auto; padding: 6px; }
.pequeno-qr img { width: clamp(60px, 7vw, 110px); }
.aviso { width: 78%; text-align: center; }
.aviso-titulo { display: inline-block; background: var(--cor); color: #1e1e1e; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; padding: .3em .9em; border-radius: 999px; font-size: clamp(14px, 1.8vw, 26px); }
.aviso p { font-size: clamp(26px, 5vw, 80px); font-weight: 800; line-height: 1.1; margin: .4em 0 0; }

.rodape { position: relative; z-index: 2; height: clamp(44px, 8vh, 72px); background: var(--cor); color: #1e1e1e; display: flex; align-items: center; gap: 14px; padding: 0 14px; flex-shrink: 0; }
.logo-pilula { background: #fff; border-radius: 8px; height: 76%; padding: 3px 10px; display: flex; align-items: center; flex-shrink: 0; }
.logo-pilula img { height: 100%; width: auto; }
.ticker { flex: 1; overflow: hidden; white-space: nowrap; font-weight: 700; font-size: clamp(14px, 2.4vh, 26px); mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
.ticker-faixa { display: inline-flex; animation: rolar linear infinite; }
.ticker-faixa span { white-space: pre; }
@keyframes rolar { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.relogio { font-weight: 800; font-size: clamp(18px, 3.4vh, 36px); font-variant-numeric: tabular-nums; flex-shrink: 0; }

.ocioso { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: #f6f5f2; color: #1e1e1e; gap: 6px; padding: 20px; }
.logo-ocioso { width: min(42vw, 420px); margin-bottom: 12px; }
.ocioso p { margin: 0; font-size: clamp(16px, 2.4vw, 28px); font-weight: 650; }
.ocioso .pequeno { font-size: clamp(12px, 1.4vw, 17px); font-weight: 400; color: #5f5f5a; }
.trocar { margin-top: 14px; border: 1px solid #ccc; background: #fff; padding: 8px 14px; border-radius: 8px; font: inherit; cursor: pointer; }
.sem-rede { position: absolute; top: 10px; right: 10px; width: 12px; height: 12px; border-radius: 50%; background: #e5534b; box-shadow: 0 0 0 3px rgba(0,0,0,.3); }
.inicio { position: absolute; inset: 0; background: rgba(246, 245, 242, 0.96); color: #1e1e1e; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; cursor: pointer; z-index: 10; }
.inicio img { width: min(40vw, 380px); }
.inicio p { font-size: clamp(18px, 2.6vw, 30px); font-weight: 700; margin: 0; animation: pulsar 1.6s ease-in-out infinite; }
@keyframes pulsar { 50% { opacity: .45; } }
.aviso-flutuante { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,.75); padding: 10px 18px; border-radius: 999px; font-weight: 700; z-index: 11; }
.fade-enter-active, .fade-leave-active { transition: opacity .45s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.pedir-codigo { min-height: 100vh; display: grid; place-items: center; background: #f6f5f2; padding: 20px; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; }
.pedir-codigo .caixa { background: #fff; border: 1px solid #e4e2dc; border-radius: 14px; padding: 32px; width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; text-align: center; }
.pedir-codigo img { width: 180px; align-self: center; }
.pedir-codigo h1 { margin: 0; font-size: 1.3rem; }
.pedir-codigo p { margin: 0; color: #5f5f5a; }
.pedir-codigo input { font-size: 1.6rem; text-align: center; letter-spacing: .3em; text-transform: uppercase; padding: 12px; border: 2px solid #e4e2dc; border-radius: 10px; font-weight: 800; }
.pedir-codigo input:focus { outline: none; border-color: #e9a453; }
.pedir-codigo button { background: #1e1e1e; color: #fff; border: none; padding: 13px; border-radius: 10px; font: inherit; font-weight: 700; font-size: 1.05rem; cursor: pointer; }
</style>
