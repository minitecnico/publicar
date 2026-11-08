<template>
  <div class="portal">
    <p v-if="!p" class="mudo centro">{{ falha || 'Carregando…' }}</p>
    <template v-else>
      <header class="topo">
        <img src="/logo.png" alt="" class="logo" />
        <div>
          <span class="rotulo">Área do anunciante · {{ p.empresa }}</span>
          <h1>Olá, {{ p.cliente }}</h1>
          <p class="mudo">Acompanhe suas campanhas, envie artes novas e pague suas faturas.</p>
        </div>
        <a v-if="whats" class="btn nao-imprimir" :href="whats" target="_blank" rel="noopener"><Icone nome="whatsapp" :tamanho="16" /> Falar com a gente</a>
      </header>

      <section v-if="abertas.length" class="bloco">
        <h2>Faturas em aberto</h2>
        <div class="faturas">
          <article v-for="f in abertas" :key="f.id" class="fatura cartao" :class="{ vencida: f.vencimento < hojeStr }">
            <div class="fat-info">
              <strong>{{ moeda(f.valor) }}</strong>
              <span>{{ f.descricao || 'Mensalidade' }}</span>
              <span :class="f.vencimento < hojeStr ? 'atraso' : 'mudo'">{{ f.vencimento < hojeStr ? 'Venceu em' : 'Vence em' }} {{ data(f.vencimento) }}</span>
            </div>
            <template v-if="f.pix">
              <img v-if="qrs[f.id]" :src="qrs[f.id]" alt="QR code Pix" class="qr-pix" />
              <div class="fat-acoes">
                <button class="btn primario" @click="copiarPix(f.pix)">Copiar Pix copia e cola</button>
                <a v-if="whats" class="btn pequeno" :href="comprovante(f)" target="_blank" rel="noopener">Enviar comprovante</a>
              </div>
            </template>
            <p v-else class="mudo pequeno">Fale com a empresa para receber os dados de pagamento.</p>
          </article>
        </div>
      </section>

      <section class="bloco">
        <h2>Suas campanhas</h2>
        <p v-if="!p.campanhas.length" class="mudo">Nenhuma campanha ainda.</p>
        <article v-for="cp in p.campanhas" :key="cp.id" class="campanha cartao">
          <div class="cp-topo">
            <div>
              <h3>{{ cp.nome }}</h3>
              <span class="selo" :class="cp.status === 'ativa' ? 'verde' : cp.status === 'aguardando' ? 'laranja' : ''">{{ ROTULO[cp.status] || cp.status }}</span>
              <span class="mudo pequeno"> {{ cp.inicio ? data(cp.inicio) : '' }}{{ cp.fim ? ` a ${data(cp.fim)}` : '' }}</span>
            </div>
            <a class="btn pequeno" :href="`/relatorio/${cp.token_publico}`" target="_blank" rel="noopener">Relatório completo</a>
          </div>
          <div class="cp-numeros">
            <div><strong>{{ numero(cp.exibicoes) }}</strong><span>exibições (30 dias)</span></div>
            <div><strong>{{ numero(cp.impactos) }}</strong><span>impactos (30 dias)</span></div>
            <div><strong>{{ numero(cp.qr) }}</strong><span>leituras do QR</span></div>
          </div>
          <div class="pecas">
            <div v-for="pc in cp.pecas" :key="pc.id" class="peca" :title="pc.nome">
              <div class="mini"><img v-if="pc.midia_tipo === 'imagem'" :src="pc.midia_url" alt="" /><span v-else>{{ pc.midia_tipo === 'video' ? 'Vídeo' : 'YT' }}</span></div>
              <span class="selo" :class="pc.status === 'aprovada' ? 'verde' : pc.status === 'aguardando' ? 'laranja' : pc.status === 'reprovada' ? 'vermelho' : ''">{{ ROTULO_PECA[pc.status] || pc.status }}</span>
            </div>
            <label class="peca nova" :class="{ desab: enviando === cp.id }">
              <span>{{ enviando === cp.id ? 'Enviando…' : '+ Enviar arte nova' }}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4" hidden :disabled="enviando === cp.id" @change="enviarArte(cp, $event)" />
            </label>
          </div>
          <p class="mudo pequeno dica-arte">Formato 1920×1080 (paisagem). Arte nova passa por aprovação antes de ir ao ar. Vídeo de até {{ cp.duracao }}s.</p>
        </article>
      </section>

      <section v-if="pagas.length" class="bloco">
        <h2>Faturas pagas</h2>
        <table class="tabela cartao">
          <tbody><tr v-for="f in pagas" :key="f.id"><td>{{ f.descricao || 'Mensalidade' }}</td><td>{{ f.pago_em ? data(f.pago_em) : '' }}</td><td class="num">{{ moeda(f.valor) }}</td></tr></tbody>
        </table>
      </section>
      <EnquadrarImagem ref="enquadrador" />
    </template>
    <div v-if="aviso" class="toast-portal">{{ aviso }}</div>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import EnquadrarImagem from '../components/EnquadrarImagem.vue'
import Icone from '../components/Icone.vue'
import { data, hoje, moeda, numero } from '../format'

const ROTULO: Record<string, string> = { ativa: 'No ar', aguardando: 'Em aprovação', pausada: 'Pausada', encerrada: 'Encerrada' }
const ROTULO_PECA: Record<string, string> = { aprovada: 'No ar', aguardando: 'Em análise', reprovada: 'Reprovada', pausada: 'Pausada' }

const route = useRoute()
const token = String(route.params.token)
const p = ref<any>(null)
const falha = ref('')
const aviso = ref('')
const enviando = ref<number | null>(null)
const qrs = reactive<Record<number, string>>({})
const enquadrador = ref<InstanceType<typeof EnquadrarImagem>>()
const hojeStr = hoje()

const abertas = computed(() => (p.value?.faturas || []).filter((f: any) => f.status === 'aberta'))
const pagas = computed(() => (p.value?.faturas || []).filter((f: any) => f.status === 'paga'))
const fone = computed(() => {
  const d = String(p.value?.whatsapp || '').replace(/\D/g, '')
  return d ? (d.length <= 11 ? `55${d}` : d) : ''
})
const whats = computed(() => (fone.value ? `https://wa.me/${fone.value}?text=${encodeURIComponent(`Olá! Sou ${p.value.cliente}.`)}` : ''))
const comprovante = (f: any) => `https://wa.me/${fone.value}?text=${encodeURIComponent(`Olá! Sou ${p.value.cliente} e paguei a fatura de ${moeda(f.valor)} (vencimento ${data(f.vencimento)}). Segue o comprovante.`)}`

function avisar(t: string) {
  aviso.value = t
  setTimeout(() => (aviso.value = ''), 3500)
}

async function carregar() {
  try {
    const r = await fetch(`/api/publico/portal/${encodeURIComponent(token)}`, { cache: 'no-store' })
    const corpo = await r.json()
    if (!r.ok) { falha.value = corpo.erro || 'Portal indisponível'; return }
    p.value = corpo
    document.title = `${corpo.cliente} · ${corpo.empresa}`
    for (const f of corpo.faturas) if (f.pix && !qrs[f.id]) qrs[f.id] = await QRCode.toDataURL(f.pix, { margin: 1, width: 220 })
  } catch {
    falha.value = 'Sem conexão. Tente de novo.'
  }
}

async function copiarPix(codigo: string) {
  try {
    await navigator.clipboard.writeText(codigo)
    avisar('Pix copiado: cole no app do seu banco')
  } catch {
    prompt('Copie o código Pix:', codigo)
  }
}

function duracaoVideo(arq: File): Promise<number | null> {
  return new Promise((ok) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(arq)
    v.preload = 'metadata'
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(isFinite(v.duration) ? Math.ceil(v.duration) : null) }
    v.onerror = () => { URL.revokeObjectURL(url); ok(null) }
    v.src = url
  })
}

async function enviarArte(cp: any, e: Event) {
  const input = e.target as HTMLInputElement
  const arq = input.files?.[0]
  input.value = ''
  if (!arq) return
  try {
    const video = arq.type.startsWith('video')
    const final = video ? arq : await enquadrador.value!.padronizar(arq) // imagem sai em 1920×1080
    if (!final) return
    enviando.value = cp.id
    const fd = new FormData()
    fd.append('arquivo', final)
    fd.append('nome', arq.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80))
    if (video) fd.append('duracao', String((await duracaoVideo(arq)) || ''))
    const r = await fetch(`/api/publico/portal/${encodeURIComponent(token)}/campanha/${cp.id}/peca`, { method: 'POST', body: fd })
    const corpo = await r.json().catch(() => ({}))
    if (!r.ok) { avisar(corpo.erro || 'Não foi possível enviar'); return }
    avisar('Arte enviada! Ela vai ao ar depois da aprovação.')
    await carregar()
  } catch {
    avisar('Falha no envio. Tente de novo.')
  } finally {
    enviando.value = null
  }
}

onMounted(carregar)
</script>

<style scoped>
.portal { max-width: 980px; margin: 0 auto; padding: 24px 16px 48px; }
.centro { text-align: center; margin-top: 20vh; }
.topo { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.topo > div { flex: 1; min-width: 220px; }
.logo { width: 72px; height: 72px; object-fit: contain; background: #fff; border-radius: 14px; border: 1px solid var(--borda); padding: 6px; }
.rotulo { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--texto-2); font-weight: 700; }
.topo h1 { margin: 2px 0 4px; font-size: 1.6rem; }
.topo p { margin: 0; }
.bloco { margin-top: 24px; }
.bloco h2 { font-size: 1.1rem; margin: 0 0 10px; }
.faturas { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.fatura { padding: 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.fatura.vencida { border-color: #f1c5c0; }
.fat-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 150px; }
.fat-info strong { font-size: 1.5rem; }
.atraso { color: var(--vermelho); font-weight: 600; }
.qr-pix { width: 130px; height: 130px; border: 1px solid var(--borda); border-radius: 8px; }
.fat-acoes { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.campanha { padding: 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; }
.cp-topo { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
.cp-topo h3 { margin: 0 0 4px; }
.cp-numeros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.cp-numeros div { background: #fbfaf8; border: 1px solid var(--borda); border-radius: 10px; padding: 10px; display: flex; flex-direction: column; }
.cp-numeros strong { font-size: 1.3rem; }
.cp-numeros span { font-size: 0.75rem; color: var(--texto-2); }
.pecas { display: flex; flex-wrap: wrap; gap: 10px; }
.peca { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.mini { width: 128px; aspect-ratio: 16 / 9; border-radius: 8px; background: #1e1e1e; overflow: hidden; display: grid; place-items: center; color: #fff; font-size: 0.75rem; }
.mini img { width: 100%; height: 100%; object-fit: cover; }
.peca.nova { width: 128px; aspect-ratio: 16 / 9; border: 2px dashed var(--borda); border-radius: 8px; display: grid; place-items: center; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--texto-2); text-align: center; padding: 6px; }
.peca.nova:hover { border-color: var(--laranja); color: var(--laranja-escuro); }
.peca.nova.desab { opacity: 0.6; pointer-events: none; }
.dica-arte { margin: 0; }
.toast-portal { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--grafite); color: #fff; padding: 12px 18px; border-radius: 999px; font-weight: 600; z-index: 600; }
@media (max-width: 600px) { .cp-numeros { grid-template-columns: 1fr 1fr 1fr; } }
</style>
