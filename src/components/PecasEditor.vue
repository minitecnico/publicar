<template>
  <div class="pecas">
    <div class="barra">
      <label class="btn primario pequeno" :class="{ desabilitado: enviando }">
        <Icone nome="upload" :tamanho="15" /> {{ enviando ? `Enviando ${enviando}…` : 'Enviar peças' }}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" multiple hidden :disabled="!!enviando" @change="enviarArquivos" />
      </label>
      <div class="yt">
        <input v-model="linkYoutube" type="url" placeholder="ou cole um link do YouTube" @keydown.enter.prevent="adicionarYoutube" />
        <button type="button" class="btn pequeno" :disabled="!idYoutube(linkYoutube)" @click="adicionarYoutube">Adicionar</button>
      </div>
      <span class="espaco" />
      <button v-if="pendentes" type="button" class="btn pequeno destaque" @click="aprovarTodas"><Icone nome="check" :tamanho="14" /> Aprovar {{ pendentes }} peça(s)</button>
    </div>
    <p class="dica">
      Várias peças giram dentro do mesmo espaço de <strong>{{ espacoS }}s</strong>: cada inserção mostra a próxima peça
      {{ rotacao === 'peso' ? 'conforme o peso' : 'em sequência' }}. Padrão das telas: <strong>1920×1080 (16:9)</strong>. Imagens fora do formato abrem o enquadramento antes do envio; vídeo MP4 em 16:9, de até {{ espacoS }}s e 25 MB.
    </p>

    <EnquadrarImagem ref="enquadrador" />
    <div v-if="itens.length" class="lista">
      <div v-for="(p, i) in itens" :key="p._k" class="peca cartao" :class="'st-' + p.status">
        <div class="thumb">
          <img v-if="p.midia_tipo === 'imagem'" :src="p.midia_url" alt="" @load="medir(p, $event)" />
          <video v-else-if="p.midia_tipo === 'video'" :src="p.midia_url" muted preload="metadata" @loadedmetadata="medirVideo(p, $event)" />
          <span v-if="padrao(p)" class="ok-formato" title="No formato padrão das telas">16:9 ✓</span>
          <img v-else-if="idYoutube(p.midia_url)" :src="`https://i.ytimg.com/vi/${idYoutube(p.midia_url)}/mqdefault.jpg`" alt="" />
          <span class="tipo">{{ p.midia_tipo === 'youtube' ? 'YouTube' : p.midia_tipo === 'video' ? `Vídeo · ${p.duracao || '?'}s` : 'Imagem' }}</span>
          <span class="ordem">{{ i + 1 }}</span>
        </div>

        <div class="corpo">
          <div class="linha-topo">
            <input v-model="p.nome" type="text" class="nome" placeholder="Nome da peça (ex.: Oferta de sexta)" @input="emitir" />
            <select v-model="p.status" class="status" @change="emitir">
              <option value="aguardando">Aguardando</option>
              <option value="aprovada">Aprovada</option>
              <option value="reprovada">Reprovada</option>
              <option value="pausada">Pausada</option>
            </select>
          </div>

          <div class="metas">
            <label v-if="p.midia_tipo !== 'imagem'" class="mini-campo">Duração (s)
              <input v-model.number="p.duracao" type="number" min="1" @input="emitir" />
            </label>
            <label v-if="rotacao === 'peso'" class="mini-campo">Peso
              <input v-model.number="p.peso" type="number" min="1" max="10" @input="emitir" />
            </label>
            <span v-if="rotacao === 'peso' && p.status === 'aprovada'" class="selo azul">{{ share(p) }}% das inserções</span>
            <span v-if="p.inicio || p.fim" class="selo">{{ p.inicio ? data(p.inicio) : '…' }} a {{ p.fim ? data(p.fim) : '…' }}</span>
            <span v-if="p.texto" class="selo laranja" :title="p.texto">com chamada</span>
            <span v-if="p.link_qr" class="selo laranja" :title="p.link_qr">QR próprio</span>
          </div>

          <p v-for="a in alertas(p)" :key="a.txt" class="alerta" :class="a.grave ? 'grave' : ''">
            {{ a.txt }}
            <button v-if="a.enquadrar" type="button" class="btn pequeno destaque" :disabled="!!enviando" @click="reenquadrar(p)">Enquadrar em 1920×1080</button>
          </p>

          <details>
            <summary>Chamada, QR, período e arquivo</summary>
            <div class="mais">
              <label class="campo inteira">Chamada (texto sobre a peça)
                <input v-model="p.texto" type="text" placeholder="Ex.: Pizza grande + refri por R$ 49" @input="emitir" />
              </label>
              <label class="campo inteira">Link do QR desta peça
                <input v-model="p.link_qr" type="text" placeholder="Vazio = usa o link da campanha" @input="emitir" />
              </label>
              <label class="campo">Exibir a partir de <input v-model="p.inicio" type="date" @change="emitir" /></label>
              <label class="campo">até <input v-model="p.fim" type="date" @change="emitir" /></label>
              <div class="campo inteira">
                <span>Arquivo</span>
                <div class="linha">
                  <input v-model="p.midia_url" type="text" aria-label="Endereço do arquivo" @change="emitir" />
                  <label class="btn pequeno"><Icone nome="upload" :tamanho="14" /> Trocar
                    <input type="file" accept="image/*,video/mp4,video/webm" hidden @change="trocarArquivo(p, $event)" />
                  </label>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div class="acoes-peca">
          <button type="button" class="btn fantasma pequeno" title="Subir" :disabled="i === 0" @click="mover(i, -1)">▲</button>
          <button type="button" class="btn fantasma pequeno" title="Descer" :disabled="i === itens.length - 1" @click="mover(i, 1)">▼</button>
          <button type="button" class="btn fantasma pequeno perigo" title="Remover peça" @click="remover(i)"><Icone nome="x" :tamanho="14" /></button>
        </div>
      </div>
    </div>
    <div v-else class="vazio-pecas">
      <strong>Nenhuma peça ainda</strong>
      <span>Envie uma ou mais imagens/vídeos. Dá para selecionar vários arquivos de uma vez.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { api } from '../api'
import { data } from '../format'
import { avisar, erro } from '../toast'
import EnquadrarImagem from './EnquadrarImagem.vue'
import Icone from './Icone.vue'

interface Peca {
  id?: number
  nome?: string | null
  midia_tipo: string
  midia_url: string
  duracao?: number | null
  texto?: string | null
  link_qr?: string | null
  peso?: number
  inicio?: string | null
  fim?: string | null
  status: string
  ajuste?: string
  _k?: string
}

const props = defineProps<{ modelValue: Peca[] | null; espaco?: number; rotacao?: string }>()
const emit = defineEmits<{ 'update:modelValue': [Peca[]] }>()

let seq = 0
const chave = () => `k${Date.now()}-${seq++}`
const copiar = (v: Peca[] | null) => (JSON.parse(JSON.stringify(v || [])) as Peca[]).map((p) => ({ ...p, _k: p._k || chave() }))
const itens = ref<Peca[]>(copiar(props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    const limpo = (l: Peca[]) => JSON.stringify(l.map(({ _k, ...r }) => r))
    if (limpo(v || []) !== limpo(itens.value)) itens.value = copiar(v)
  },
)
const enquadrador = ref<InstanceType<typeof EnquadrarImagem>>()
const emitir = () => emit('update:modelValue', itens.value.map((p) => ({ ...p })))

const espacoS = computed(() => Math.max(5, Number(props.espaco) || 15))
const pendentes = computed(() => itens.value.filter((p) => p.status === 'aguardando').length)
const somaPesos = computed(() => itens.value.filter((p) => p.status === 'aprovada').reduce((s, p) => s + Math.max(1, p.peso || 1), 0))
const share = (p: Peca) => (somaPesos.value ? Math.round((Math.max(1, p.peso || 1) / somaPesos.value) * 100) : 0)

/* ------------------------------------------------ especificação técnica (como as redes de DOOH validam) */
const medidas = reactive<Record<string, { w: number; h: number }>>({})
function medir(p: Peca, e: Event) {
  const img = e.target as HTMLImageElement
  medidas[p.midia_url] = { w: img.naturalWidth, h: img.naturalHeight }
}
function medirVideo(p: Peca, e: Event) {
  const v = e.target as HTMLVideoElement
  medidas[p.midia_url] = { w: v.videoWidth, h: v.videoHeight }
  if (!p.duracao && isFinite(v.duration)) {
    p.duracao = Math.ceil(v.duration)
    emitir()
  }
}
const PROPORCAO = 16 / 9
const no169 = (m?: { w: number; h: number }) => !!m && m.w > 0 && Math.abs(m.w / m.h - PROPORCAO) < 0.02
const padrao = (p: Peca) => p.midia_tipo !== 'youtube' && no169(medidas[p.midia_url])

function alertas(p: Peca) {
  const out: { txt: string; grave?: boolean; enquadrar?: boolean }[] = []
  if (p.midia_tipo !== 'imagem' && !p.duracao) out.push({ txt: 'Informe a duração do vídeo.', grave: true })
  if (p.midia_tipo !== 'imagem' && (p.duracao || 0) > espacoS.value)
    out.push({ txt: `Vídeo de ${p.duracao}s não cabe no espaço de ${espacoS.value}s. Edite o vídeo ou aumente a duração do espaço.`, grave: true })
  const m = medidas[p.midia_url]
  if (m && m.w && m.h) {
    if (!no169(m)) {
      if (p.midia_tipo === 'imagem')
        out.push({ txt: `Fora do padrão (${m.w}×${m.h}): na tela aparece inteira, com sobras. Padronize para encaixar perfeito.`, enquadrar: true })
      else out.push({ txt: `Vídeo fora de 16:9 (${m.w}×${m.h}): aparece inteiro, com sobras nas laterais. Exporte em 1920×1080.` })
    }
    if (m.w < 1280) out.push({ txt: `Resolução baixa (${m.w}×${m.h}): pode ficar borrada em TVs. Recomendado: 1920×1080.` })
  }
  return out
}

/* ------------------------------------------------ envio */
const enviando = ref('')
const linkYoutube = ref('')
const idYoutube = (url?: string | null) => (url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] || ''

function duracaoLocal(arq: File): Promise<number | null> {
  return new Promise((ok) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(arq)
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(isFinite(v.duration) ? Math.ceil(v.duration) : null) }
    v.onerror = () => { URL.revokeObjectURL(url); ok(null) }
    v.src = url
  })
}
const nomeArquivo = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80)

async function enviarArquivos(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivos = Array.from(input.files || [])
  input.value = ''
  let ok = 0
  for (const [i, arq] of arquivos.entries()) {
    enviando.value = `${i + 1}/${arquivos.length}`
    try {
      const video = arq.type.startsWith('video')
      const duracao = video ? await duracaoLocal(arq) : null
      // imagem: padroniza em 1920×1080 (abre o enquadramento se estiver fora de 16:9)
      const final = video ? arq : await enquadrador.value!.padronizar(arq)
      if (!final) continue
      const r = await api.upload(final)
      itens.value.push({ _k: chave(), nome: nomeArquivo(arq.name), midia_tipo: video ? 'video' : 'imagem', midia_url: r.url, duracao, peso: 1, status: 'aguardando' })
      emitir()
      ok++
    } catch (err) {
      erro(err)
    }
  }
  enviando.value = ''
  if (ok) avisar(ok === 1 ? 'Peça adicionada' : `${ok} peças adicionadas`)
}

async function trocarArquivo(p: Peca, e: Event) {
  const input = e.target as HTMLInputElement
  const arq = input.files?.[0]
  input.value = ''
  if (!arq) return
  try {
    const video = arq.type.startsWith('video')
    const duracao = video ? await duracaoLocal(arq) : null
    const final = video ? arq : await enquadrador.value!.padronizar(arq)
    if (!final) return
    const r = await api.upload(final)
    Object.assign(p, { midia_url: r.url, midia_tipo: video ? 'video' : 'imagem', duracao, status: 'aguardando' })
    emitir()
    avisar('Arquivo trocado: a peça volta para aprovação')
  } catch (err) {
    erro(err)
  }
}

/** Peça antiga fora do padrão: baixa, enquadra e substitui pelo arquivo 1920×1080. */
async function reenquadrar(p: Peca) {
  try {
    const final = await enquadrador.value!.padronizarUrl(p.midia_url, `${p.nome || 'peca'}.jpg`)
    if (!final) return
    enviando.value = '1/1'
    const r = await api.upload(final)
    p.midia_url = r.url
    emitir()
    avisar('Peça padronizada em 1920×1080. Salve a campanha para aplicar.')
  } catch (err) {
    erro(err)
  } finally {
    enviando.value = ''
  }
}

function adicionarYoutube() {
  const id = idYoutube(linkYoutube.value)
  if (!id) return
  itens.value.push({ _k: chave(), nome: 'Vídeo do YouTube', midia_tipo: 'youtube', midia_url: `https://www.youtube.com/watch?v=${id}`, duracao: null, peso: 1, status: 'aguardando' })
  linkYoutube.value = ''
  emitir()
}

function mover(i: number, d: number) {
  const [p] = itens.value.splice(i, 1)
  itens.value.splice(i + d, 0, p)
  emitir()
}
function remover(i: number) {
  if (!confirm('Remover esta peça da campanha?')) return
  itens.value.splice(i, 1)
  emitir()
}
function aprovarTodas() {
  for (const p of itens.value) if (p.status === 'aguardando') p.status = 'aprovada'
  emitir()
}
</script>

<style scoped>
.pecas { display: flex; flex-direction: column; gap: 10px; font-weight: 400; }
.barra { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.barra .espaco { flex: 1; }
.yt { display: flex; gap: 6px; flex: 1; min-width: 240px; max-width: 420px; }
.desabilitado { opacity: 0.6; pointer-events: none; }
.dica { margin: 0; }
.lista { display: flex; flex-direction: column; gap: 8px; }
.peca { display: grid; grid-template-columns: 168px 1fr auto; gap: 12px; padding: 10px; box-shadow: none; align-items: start; }
.peca.st-reprovada { opacity: 0.6; }
.peca.st-aguardando { border-color: #f3d3a6; background: #fffaf2; }
.thumb { position: relative; width: 168px; aspect-ratio: 16 / 9; background: #111; border-radius: 6px; overflow: hidden; }
.thumb img, .thumb video { width: 100%; height: 100%; object-fit: contain; }
.thumb .ok-formato { position: absolute; right: 6px; top: 6px; background: var(--verde); color: #fff; font-size: 0.66rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; }
.alerta .btn { margin-left: 6px; vertical-align: middle; }
.thumb .tipo { position: absolute; left: 6px; bottom: 6px; background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 0.7rem; padding: 2px 7px; border-radius: 999px; }
.thumb .ordem { position: absolute; left: 6px; top: 6px; background: var(--laranja); color: var(--grafite); font-weight: 800; font-size: 0.72rem; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; }
.corpo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.linha-topo { display: flex; gap: 8px; }
.nome { flex: 1; font-weight: 600; }
.status { width: auto; }
.metas { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.mini-campo { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--texto-2); }
.mini-campo input { width: 70px; padding: 4px 6px; }
.mini-campo select { width: auto; padding: 4px 6px; }
.alerta { margin: 0; font-size: 0.8rem; color: var(--laranja-escuro); }
.alerta.grave { color: var(--vermelho); font-weight: 600; }
details summary { cursor: pointer; font-size: 0.82rem; color: var(--texto-2); }
.mais { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 8px; }
.mais .inteira { grid-column: 1 / -1; }
.acoes-peca { display: flex; flex-direction: column; gap: 2px; }
.vazio-pecas { border: 2px dashed var(--borda); border-radius: 10px; padding: 22px; text-align: center; display: flex; flex-direction: column; gap: 4px; color: var(--texto-2); }
@media (max-width: 640px) {
  .peca { grid-template-columns: 1fr; }
  .thumb { width: 100%; }
  .acoes-peca { flex-direction: row; }
  .mais { grid-template-columns: 1fr; }
}
</style>
