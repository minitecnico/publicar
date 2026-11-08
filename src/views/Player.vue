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
            <div v-if="atual" :key="atual.chave" class="item" :style="{ '--dur': `${atual.duracao}s` }">
              <!-- fundo: a própria peça desfocada preenche a tela (sem faixas pretas em peça fora do formato) -->
              <div class="fundo-peca" :style="fundoPeca(atual)" />

              <img v-if="atual.tipo === 'imagem'" :src="fonte(atual.url)" alt="" class="midia zoom" :class="{ inteira: atual.inteira }" />
              <video
                v-else-if="atual.tipo === 'video'"
                :src="fonte(atual.url)"
                class="midia"
                :class="{ inteira: atual.inteira }"
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

              <span v-if="atual.campanhaId" class="selo-pub">Publicidade</span>

              <!-- faixa inferior: chamada + QR alinhados -->
              <div v-if="(atual.texto && atual.tipo !== 'aviso') || atual.qr" class="faixa-info">
                <div v-if="atual.texto && atual.tipo !== 'aviso'" class="chamada">{{ atual.texto }}</div>
                <span v-else class="espaco" />
                <div v-if="atual.qr" class="qr">
                  <img :src="atual.qr" alt="QR code" />
                  <span>Aponte a<br />câmera</span>
                </div>
              </div>

              <div v-if="mostraProgresso(atual)" class="progresso"><i /></div>
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
            <div v-if="lateralAtual" :key="lateralAtual.chave" class="item" :style="{ '--dur': `${Math.max(8, lateralAtual.duracao)}s` }">
              <div class="fundo-peca" :style="fundoPeca(lateralAtual)" />
              <img v-if="lateralAtual.tipo === 'imagem'" :src="fonte(lateralAtual.url)" alt="" class="midia zoom" />
              <video v-else-if="lateralAtual.tipo === 'video'" :src="fonte(lateralAtual.url)" class="midia" autoplay muted playsinline loop />
              <span class="selo-pub">Publicidade</span>
              <div v-if="lateralAtual.texto || lateralAtual.qr" class="faixa-info compacta">
                <div v-if="lateralAtual.texto" class="chamada">{{ lateralAtual.texto }}</div>
                <div v-if="lateralAtual.qr" class="qr"><img :src="lateralAtual.qr" alt="QR code" /></div>
              </div>
              <div class="progresso"><i /></div>
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
        <div class="relogio">
          <strong>{{ relogio }}</strong>
          <span>{{ dataHoje }}</span>
        </div>
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
interface Janela { ini: string; fim: string }
interface Peca { id: number; tipo: string; url: string; duracao: number | null; texto: string | null; peso: number; qr_url: string | null; ajuste?: string }
/** duracao = espaço comprado; as peças giram dentro dele */
interface Campanha { id: number; nome: string; duracao: number; prioridade: number; rotacao?: string; pecas?: Peca[]; dias_semana?: number[]; horarios?: Janela[] }
interface Conteudo { tipo: string; url?: string; duracao?: number; titulo?: string; texto?: string }
interface Dados {
  tela: { id: number; nome: string; codigo: string; tipo: string; layout: string; cor_primaria: string; cor_fundo: string; logo_url: string | null; ticker: string | null; conteudo: Conteudo[] }
  campanhas: Campanha[]
  /** ciclo de anúncios em segundos: a sobra é preenchida com entretenimento */
  ciclo?: number
  /** minutos entre buscas da programação (cada busca também é o sinal de vida) */
  programacao_min?: number
  /** minutos entre envios da prova de exibição (o servidor ajusta ao tamanho da rede) */
  envio_min?: number
}
interface Item { chave: string; tipo: string; url?: string; duracao: number; texto?: string | null; titulo?: string; qr?: string; campanhaId?: number; pecaId?: number; inteira?: boolean }

const VERSAO = '0.4.0'
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
const qrs = reactive<Record<string, string>>({}) // por endereço do QR

try {
  const salvo = localStorage.getItem(chaveCache())
  if (salvo) dados.value = JSON.parse(salvo)
} catch { /* ignora cache corrompido */ }

async function carregar() {
  if (!codigo.value) return
  try {
    // a busca da programação também é o sinal de vida da tela
    const q = new URLSearchParams({ v: VERSAO, r: `${screen.width}x${screen.height}` })
    const res = await fetch(`/api/player/${codigo.value}?${q}`, { cache: 'no-store' })
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
    for (const c of dados.value.campanhas) for (const p of c.pecas || []) if (p.url && p.tipo !== 'youtube') urls.add(p.url)
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
      for (const p of c.pecas || []) {
        if (p.qr_url && !qrs[p.qr_url]) qrs[p.qr_url] = await QRCode.toDataURL(p.qr_url, { margin: 1, width: 240, color: { dark: '#1E1E1E' } })
      }
    }
    prepararMidias()
  },
  { immediate: true },
)

/* ------------------------------------------------------------ dia e horário (fuso de Brasília) */
const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const fmtAgora = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
function momentoSP() {
  const p = Object.fromEntries(fmtAgora.formatToParts(new Date()).map((x) => [x.type, x.value]))
  return { dia: DIAS_EN.indexOf(p.weekday), minuto: (Number(p.hour) % 24) * 60 + Number(p.minute) }
}
const agora = ref(momentoSP())
const paraMin = (h: string) => {
  const [hh, mm] = String(h || '').split(':').map(Number)
  return hh * 60 + (mm || 0)
}
/** A campanha está na sua faixa de dia/horário agora? */
function noAr(c: Campanha) {
  const { dia, minuto } = agora.value
  if (c.dias_semana?.length && !c.dias_semana.map(Number).includes(dia)) return false
  if (!c.horarios?.length) return true
  return c.horarios.some((j) => {
    const i = paraMin(j.ini)
    const f = paraMin(j.fim)
    if (isNaN(i) || isNaN(f)) return false
    if (f > i) return minuto >= i && minuto < f
    if (f === i) return true
    return minuto >= i || minuto < f // cruza a meia-noite
  })
}

/* ------------------------------------------------------------ programação */
const anuncios = computed<Item[]>(() => {
  const lista: Item[] = []
  for (const c of (dados.value?.campanhas || []).filter((c) => noAr(c) && c.pecas?.length)) {
    // cada inserção é um espaço da campanha; a peça é escolhida na hora de tocar (rodízio)
    for (let r = 0; r < Math.max(1, Math.min(c.prioridade || 1, 5)); r++) {
      lista.push({ chave: `c${c.id}-${r}`, tipo: 'espaco', duracao: Math.max(5, c.duracao || 15), campanhaId: c.id })
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

/* Rodízio das peças: round-robin ponderado suave (distribui de forma uniforme e previsível;
   pesos iguais = sequencial). Estado por campanha, mantido entre ciclos. */
const rodizio = new Map<number, Map<number, number>>()
function proximaPeca(c: Campanha): Peca {
  const pecas = c.pecas!
  const est = rodizio.get(c.id) || new Map<number, number>()
  rodizio.set(c.id, est)
  let total = 0
  let melhor = pecas[0]
  for (const p of pecas) {
    const w = Math.max(1, p.peso || 1)
    total += w
    est.set(p.id, (est.get(p.id) || 0) + w)
    if (est.get(p.id)! > est.get(melhor.id)!) melhor = p
  }
  est.set(melhor.id, est.get(melhor.id)! - total)
  return melhor
}
/** Transforma o espaço da campanha na peça que vai tocar agora. */
function montarAnuncio(espaco: Item, chave: string): Item | null {
  const c = dados.value?.campanhas.find((x) => x.id === espaco.campanhaId)
  if (!c?.pecas?.length) return null
  const p = proximaPeca(c)
  return {
    chave,
    tipo: p.tipo,
    url: p.url,
    // imagem fica o espaço inteiro; vídeo/YouTube a própria duração (validada para caber no espaço)
    duracao: p.tipo === 'imagem' ? espaco.duracao : Math.max(5, p.duracao || espaco.duracao),
    texto: p.texto,
    qr: p.qr_url ? qrs[p.qr_url] : undefined,
    campanhaId: c.id,
    pecaId: p.id,
    inteira: p.ajuste === 'inteira',
  }
}

const atual = ref<Item | null>(null)
const lateralAtual = ref<Item | null>(null)
let iAnuncio = 0
let iEnt = 0
let saldoEnt = 0 // segundos de entretenimento a que o ciclo ainda tem direito
let iLateral = 0
let timer: number | undefined
let timerLateral: number | undefined
let rodada = 0

function proximoItem(): Item | null {
  const ads = anuncios.value
  const ent = entretenimento.value
  if (layoutLateral.value) return ent.length ? { ...ent[iEnt++ % ent.length], chave: `e${rodada}` } : null
  if (!ads.length && !ent.length) return null
  if (!ads.length) return { ...ent[iEnt++ % ent.length], chave: `e${rodada}` }
  // Ciclo de anúncios: os anúncios ocupam o tempo vendido; a sobra do ciclo vira entretenimento,
  // distribuída entre os anúncios. Ciclo lotado = só anúncios (frequência garantida ao anunciante).
  if (ent.length && saldoEnt >= 5) {
    const e = ent[iEnt++ % ent.length]
    const usar = e.tipo === 'video' ? e.duracao : Math.min(e.duracao, Math.max(5, Math.round(saldoEnt)))
    saldoEnt -= usar
    return { ...e, duracao: usar, chave: `e${rodada}` }
  }
  const ciclo = dados.value?.ciclo || 120
  const tempoAds = ads.reduce((s, a) => s + Math.max(5, a.duracao), 0)
  saldoEnt = Math.max(0, saldoEnt) + Math.max(0, ciclo - tempoAds) / ads.length
  return montarAnuncio(ads[iAnuncio++ % ads.length], `a${rodada}`)
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
  if (item.campanhaId) registrarExibicao(item.campanhaId, item.pecaId)
  // vídeo avança no "ended"; a trava de segurança evita ficar parado se o vídeo travar
  // (anúncio: duração da peça + folga; entretenimento: até 5 min)
  const segundos = item.tipo === 'video' ? (item.campanhaId ? item.duracao + 3 : 300) : Math.max(5, item.duracao)
  timer = window.setTimeout(avancar, segundos * 1000)
}
const avancarDepois = (s: number) => { clearTimeout(timer); timer = window.setTimeout(avancar, s * 1000) }

function avancarLateral() {
  clearTimeout(timerLateral)
  const ads = anuncios.value
  if (!layoutLateral.value || !ads.length) { lateralAtual.value = null; return }
  const item = montarAnuncio(ads[iLateral++ % ads.length], `l${iLateral}`)
  lateralAtual.value = item
  if (!item) { timerLateral = window.setTimeout(avancarLateral, 5000); return }
  if (item.campanhaId) registrarExibicao(item.campanhaId, item.pecaId)
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

// fila local: "campanha|dia" → { total, pecas: { peca_id: n } } (versões antigas guardavam só o número)
interface Contagem { total: number; pecas: Record<string, number> }
function lerFila(): Record<string, Contagem> {
  let bruto: Record<string, number | Contagem> = {}
  try { bruto = JSON.parse(localStorage.getItem(chaveExib()) || '{}') } catch { /* fila corrompida: recomeça */ }
  const out: Record<string, Contagem> = {}
  for (const [k, v] of Object.entries(bruto)) out[k] = typeof v === 'number' ? { total: v, pecas: {} } : { total: Number(v.total) || 0, pecas: v.pecas || {} }
  return out
}

function registrarExibicao(campanhaId: number, pecaId?: number) {
  const fila = lerFila()
  const k = `${campanhaId}|${hojeBR()}`
  const c = (fila[k] ||= { total: 0, pecas: {} })
  c.total++
  if (pecaId) c.pecas[pecaId] = (c.pecas[pecaId] || 0) + 1
  localStorage.setItem(chaveExib(), JSON.stringify(fila))
}

async function enviarExibicoes() {
  const fila = lerFila()
  const itens = Object.entries(fila).map(([k, c]) => {
    const [cid, dia] = k.split('|')
    return { campanha_id: Number(cid), dia, total: c.total, pecas: c.pecas }
  })
  if (!itens.length) return
  try {
    const res = await fetch(`/api/player/${codigo.value}/exibicoes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }), keepalive: true })
    if (res.ok) {
      // desconta só o que foi enviado (pode ter entrado exibição nova durante o envio)
      const agora = lerFila()
      for (const i of itens) {
        const k = `${i.campanha_id}|${i.dia}`
        const c = agora[k]
        if (!c) continue
        c.total -= i.total
        for (const [pid, n] of Object.entries(i.pecas)) {
          c.pecas[pid] = (c.pecas[pid] || 0) - n
          if (c.pecas[pid] <= 0) delete c.pecas[pid]
        }
        if (c.total <= 0) delete agora[k]
      }
      localStorage.setItem(chaveExib(), JSON.stringify(agora))
    }
  } catch { /* tenta no próximo ciclo */ }
}

/* Agendamento com intervalo vindo do servidor e um pouco de aleatoriedade,
   para as telas não baterem todas no mesmo minuto. */
const timersCiclo: Record<string, number> = {}
let desmontado = false
function agendar(nome: string, fn: () => unknown, minutos: () => number) {
  const proximo = () => {
    if (desmontado) return
    const ms = minutos() * 60 * 1000 * (0.9 + Math.random() * 0.2)
    timersCiclo[nome] = window.setTimeout(async () => {
      try { await fn() } finally { proximo() }
    }, ms)
  }
  proximo()
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
const dataHoje = ref('')
function atualizarRelogio() {
  relogio.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  dataHoje.value = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    .replace('.', '')
  const m = momentoSP()
  if (m.minuto !== agora.value.minuto || m.dia !== agora.value.dia) agora.value = m // reavalia as faixas de horário
}

/** Fundo da peça: imagem/miniatura desfocada; vídeo usa um degradê com as cores da tela. */
function fundoPeca(item: Item) {
  if (item.tipo === 'imagem' && item.url) return { backgroundImage: `url("${fonte(item.url)}")` }
  const yt = item.tipo === 'youtube' ? (item.url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] : null
  if (yt) return { backgroundImage: `url("https://i.ytimg.com/vi/${yt}/hqdefault.jpg")` }
  return { backgroundImage: 'radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--cor) 35%, transparent), transparent 60%), radial-gradient(circle at 80% 90%, color-mix(in srgb, var(--cor) 20%, transparent), transparent 55%)', filter: 'none', transform: 'none' }
}
/** Barra de progresso só onde a duração é conhecida (anúncios e imagens/avisos). */
const mostraProgresso = (item: Item) => !!item.campanhaId || item.tipo === 'imagem' || item.tipo === 'aviso'

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
  // passados 10 s sem toque (instalação em quiosque), some o aviso e segue tocando sem som
  setTimeout(() => (mostrarInicio.value = false), 10000)
  intervalos.push(window.setInterval(atualizarRelogio, 15000))
  // intervalos definidos pelo servidor para a rede inteira caber no plano grátis (requisições e gravações no D1)
  agendar('programacao', carregar, () => dados.value?.programacao_min || 15)
  agendar('exibicoes', enviarExibicoes, () => dados.value?.envio_min || 60)
  document.addEventListener('visibilitychange', aoOcultar)
  window.addEventListener('online', carregar)
})

onBeforeUnmount(() => {
  intervalos.forEach(clearInterval)
  desmontado = true
  Object.values(timersCiclo).forEach(clearTimeout)
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
.area { flex: 1; display: flex; min-height: 0; gap: 0; }
.palco { flex: 1; position: relative; min-width: 0; overflow: hidden; background: #000; }
.area.lateral { gap: clamp(6px, 0.8vw, 12px); padding: clamp(6px, 0.8vw, 12px); background: var(--fundo-tela); }
.area.lateral .palco { flex: 3; border-radius: 14px; }
.coluna { flex: 1.15; position: relative; overflow: hidden; background: #000; border-radius: 14px; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--cor) 70%, transparent); }

/* ---------- peça */
.item { position: absolute; inset: 0; display: grid; place-items: center; overflow: hidden; }
.fundo-peca { position: absolute; inset: -40px; background-size: cover; background-position: center; filter: blur(38px) saturate(1.35) brightness(0.55); transform: scale(1.1); }
.midia { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; border: 0; z-index: 1; }
/* "Ajustar inteira": peça toda visível, sobra preenchida pelo fundo desfocado */
.midia.inteira { object-fit: contain; filter: drop-shadow(0 12px 40px rgba(0, 0, 0, 0.45)); }
/* coluna lateral é estreita: a peça aparece inteira para não cortar o anúncio */
.coluna .midia { object-fit: contain; filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.45)); }
.zoom { animation: zoom var(--dur, 15s) ease-out both; }
@keyframes zoom { from { transform: scale(1); } to { transform: scale(1.045); } }

.selo-pub { position: absolute; top: clamp(10px, 2vh, 22px); left: clamp(10px, 1.6vw, 26px); z-index: 3; font-size: clamp(9px, 0.95vw, 13px); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.85); background: rgba(0, 0, 0, 0.38); backdrop-filter: blur(6px); padding: 0.35em 0.9em; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.18); }

/* ---------- faixa inferior: chamada + QR */
.faixa-info { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; gap: 2vw; padding: 8vh clamp(14px, 2.4vw, 40px) clamp(14px, 3vh, 34px); background: linear-gradient(to top, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.35) 55%, transparent); }
.faixa-info .espaco { flex: 1; }
.chamada { position: relative; max-width: 64%; color: #fff; font-weight: 800; font-size: clamp(20px, 3.4vw, 54px); line-height: 1.08; letter-spacing: -0.01em; padding-left: 0.5em; text-shadow: 0 2px 18px rgba(0, 0, 0, 0.55); animation: subir 0.7s 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.chamada::before { content: ''; position: absolute; left: 0; top: 0.08em; bottom: 0.08em; width: 0.16em; border-radius: 999px; background: var(--cor); }
.qr { flex-shrink: 0; display: flex; align-items: center; gap: 12px; background: #fff; color: #1e1e1e; padding: 10px 14px 10px 10px; border-radius: 16px; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45); border-bottom: 4px solid var(--cor); animation: subir 0.7s 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.qr img { width: clamp(84px, 10.5vw, 168px); height: auto; display: block; border-radius: 6px; }
.qr span { font-size: clamp(11px, 1.15vw, 17px); font-weight: 800; line-height: 1.15; text-transform: uppercase; letter-spacing: 0.04em; }
@keyframes subir { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }

.faixa-info.compacta { flex-direction: column; align-items: stretch; gap: 10px; padding: 6vh 12px 14px; }
.faixa-info.compacta .chamada { max-width: none; font-size: clamp(13px, 1.5vw, 24px); }
.faixa-info.compacta .qr { align-self: flex-end; padding: 6px; border-radius: 10px; }
.faixa-info.compacta .qr img { width: clamp(56px, 6vw, 100px); }

.progresso { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; z-index: 4; background: rgba(255, 255, 255, 0.12); }
.progresso i { display: block; height: 100%; width: 100%; background: var(--cor); transform-origin: left; animation: progresso var(--dur, 15s) linear both; }
@keyframes progresso { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* ---------- aviso em texto */
.aviso { position: relative; z-index: 1; width: 78%; text-align: center; }
.aviso-titulo { display: inline-block; background: var(--cor); color: #1e1e1e; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; padding: .3em .9em; border-radius: 999px; font-size: clamp(14px, 1.8vw, 26px); }
.aviso p { font-size: clamp(26px, 5vw, 80px); font-weight: 800; line-height: 1.1; margin: .4em 0 0; text-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }

/* ---------- rodapé */
.rodape { position: relative; z-index: 2; height: clamp(48px, 8.5vh, 78px); background: #121212; color: #fff; display: flex; align-items: center; gap: clamp(10px, 1.4vw, 20px); padding: 0 clamp(10px, 1.4vw, 20px); flex-shrink: 0; border-top: 3px solid var(--cor); }
.logo-pilula { background: #fff; border-radius: 10px; height: 72%; padding: 4px 12px; display: flex; align-items: center; flex-shrink: 0; }
.logo-pilula img { height: 100%; width: auto; }
.ticker { flex: 1; overflow: hidden; white-space: nowrap; font-weight: 600; font-size: clamp(14px, 2.5vh, 26px); color: rgba(255, 255, 255, 0.92); mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent); }
.ticker-faixa { display: inline-flex; animation: rolar linear infinite; }
.ticker-faixa span { white-space: pre; }
@keyframes rolar { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.relogio { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; background: var(--cor); color: #1e1e1e; border-radius: 10px; height: 76%; padding: 0 clamp(10px, 1.2vw, 18px); }
.relogio strong { font-weight: 800; font-size: clamp(18px, 3.3vh, 34px); font-variant-numeric: tabular-nums; }
.relogio span { font-size: clamp(9px, 1.35vh, 13px); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; opacity: 0.8; }

.ocioso { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #fff; gap: 8px; padding: 20px; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--cor) 22%, var(--fundo-tela)), var(--fundo-tela) 65%); }
.logo-ocioso { width: min(34vw, 340px); margin-bottom: 18px; background: #fff; padding: clamp(12px, 2vw, 26px); border-radius: 22px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45); }
.ocioso p { margin: 0; font-size: clamp(16px, 2.4vw, 28px); font-weight: 700; }
.ocioso .pequeno { font-size: clamp(12px, 1.4vw, 17px); font-weight: 500; color: rgba(255, 255, 255, 0.65); }
.trocar { margin-top: 14px; border: 1px solid rgba(255,255,255,.3); background: transparent; color: #fff; padding: 8px 14px; border-radius: 8px; font: inherit; cursor: pointer; }
.sem-rede { position: absolute; top: 10px; right: 10px; width: 12px; height: 12px; border-radius: 50%; background: #e5534b; box-shadow: 0 0 0 3px rgba(0,0,0,.3); }
.inicio { position: absolute; inset: 0; background: rgba(12, 12, 12, 0.82); backdrop-filter: blur(10px); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; cursor: pointer; z-index: 10; }
.inicio img { width: min(34vw, 320px); background: #fff; padding: clamp(12px, 2vw, 24px); border-radius: 22px; }
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
