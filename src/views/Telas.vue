<template>
  <CrudPage
    ref="crud"
    recurso="telas"
    titulo="Telas"
    subtitulo="Tablets nos carros e TVs nos estabelecimentos. Abra o endereço do player na tela e ela começa a tocar."
    rotulo-novo="Nova tela"
    :campos="campos"
    :padrao="{ tipo: 'carro', layout: 'cheia', status: 'ativa', cor_primaria: '#E9A453', cor_fundo: '#1E1E1E', conteudo: [], widgets: ['clima', 'cotacao', 'noticias', 'esportes', 'curiosidades'] }"
  >
    <template #ferramentas>
      <span class="selo verde"><span class="ponto" /> {{ onlineCount }} online</span>
    </template>
    <template #celula-codigo="{ linha }">
      <code class="codigo">{{ linha.codigo }}</code>
    </template>
    <template #celula-ultimo_ping="{ linha }">
      <span class="selo" :class="online(linha.ultimo_ping) ? 'verde' : 'vermelho'" :title="tempoDesde(linha.ultimo_ping)">
        <span class="ponto" /> {{ online(linha.ultimo_ping) ? 'Online' : 'Offline' }}
      </span>
      <div class="mudo pequeno">{{ tempoDesde(linha.ultimo_ping) }}</div>
      <div v-if="saude(linha)" class="saude">
        <span v-if="saude(linha)!.bateria != null" :class="{ fraca: saude(linha)!.bateria! < 20 && !saude(linha)!.carregando }" title="Bateria">
          🔋 {{ saude(linha)!.bateria }}%{{ saude(linha)!.carregando ? ' ⚡' : '' }}
        </span>
        <span v-if="saude(linha)!.rede" title="Rede">{{ String(saude(linha)!.rede).toUpperCase() }}</span>
        <span v-if="saude(linha)!.versao" title="Versão do player">v{{ saude(linha)!.versao }}</span>
      </div>
    </template>
    <template #celula-audiencia="{ linha }">
      <strong>{{ numero(Math.round(audienciaTela(linha, padroes).pessoas)) }}</strong>
      <span class="mudo pequeno"> pessoas/dia</span>
    </template>
    <template #formulario="{ form }">
      <div class="previa-aud">
        <strong>Audiência estimada desta tela</strong>
        <span>
          ≈ <b>{{ numero(Math.round(audienciaTela(form, padroes).pessoas)) }}</b> pessoas por dia ·
          <b>{{ audienciaTela(form, padroes).publico.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }}</b> diante da tela a cada momento ·
          <b>{{ audienciaTela(form, padroes).impactosPorExibicao.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }}</b> impactos por exibição
        </span>
        <span class="mudo pequeno">Campos de audiência vazios usam os padrões de Configurações. Quanto mais real o número informado, mais confiável o relatório para o anunciante.</span>
      </div>
    </template>
    <template #acoes="{ linha }">
      <button class="btn pequeno" title="Instalar na tela" @click="abrirInstalacao(linha)"><Icone nome="qr" :tamanho="14" /> Instalar</button>
      <a class="btn pequeno fantasma" :href="`/tela/${linha.codigo}`" target="_blank" rel="noopener">Ver</a>
    </template>
  </CrudPage>

  <Modal :aberto="!!instalando" :titulo="`Instalar: ${instalando?.nome}`" @fechar="instalando = null">
    <div v-if="instalando" class="instalar">
      <img :src="qr" alt="QR code do endereço do player" class="qr" />
      <div>
        <p><strong>No tablet ou TV:</strong></p>
        <ol>
          <li>Aponte a câmera para o QR code ou abra o endereço abaixo no navegador (Chrome).</li>
          <li>No menu do navegador, toque em <em>Adicionar à tela inicial</em> para abrir em tela cheia.</li>
          <li>Toque uma vez na tela para liberar o som e o modo tela cheia.</li>
        </ol>
        <p class="endereco"><code>{{ urlPlayer }}</code></p>
        <button class="btn pequeno" @click="copiar"><Icone nome="link" :tamanho="14" /> Copiar endereço</button>
        <p class="mudo pequeno">Código da tela: <strong>{{ instalando.codigo }}</strong> — também dá para abrir <code>{{ origem }}/tela</code> e digitar o código.</p>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, onMounted, ref } from 'vue'
import CrudPage from '../components/CrudPage.vue'
import Icone from '../components/Icone.vue'
import Modal from '../components/Modal.vue'
import { corStatus, op, type Campo } from '../campos'
import { audienciaTela, comPadrao } from '../audiencia'
import { api } from '../api'
import { numero, online, tempoDesde } from '../format'
import { avisar } from '../toast'

const crud = ref<InstanceType<typeof CrudPage>>()
const padroes = ref(comPadrao(null))
/** Saúde do aparelho enviada no último sinal de vida. */
function saude(l: Record<string, any>): { bateria?: number | null; carregando?: boolean | null; rede?: string | null; versao?: string | null } | null {
  try {
    const i = typeof l.ultima_info === 'string' ? JSON.parse(l.ultima_info) : l.ultima_info
    return i && typeof i === 'object' ? i : null
  } catch {
    return null
  }
}
onMounted(async () => {
  try { padroes.value = comPadrao((await api.get('/config')).config?.audiencia) } catch { /* usa os padrões */ }
})

const instalando = ref<Record<string, any> | null>(null)
const qr = ref('')
const origem = location.origin
const urlPlayer = computed(() => `${origem}/tela/${instalando.value?.codigo}`)
const onlineCount = computed(() => (crud.value?.linhas || []).filter((l: any) => online(l.ultimo_ping)).length)

const campos: Campo[] = [
  { key: 'nome', label: 'Nome da tela', obrigatorio: true, lista: true, dica: 'Ex.: Carro 07 — Onix prata, ou Barbearia do Zé — TV da espera' },
  { key: 'codigo', label: 'Código', lista: true, mostrarSe: () => false },
  { key: 'tipo', label: 'Tipo', tipo: 'select', lista: true, opcoes: op(['carro', 'Carro de aplicativo'], ['estabelecimento', 'Estabelecimento']) },
  { key: 'motorista_id', label: 'Motorista', tipo: 'relacao', relacao: 'motoristas', mostrarSe: (f) => f.tipo === 'carro' },
  { key: 'cliente_id', label: 'Estabelecimento', tipo: 'relacao', relacao: 'clientes', filtroRelacao: (c) => c.tipo !== 'anunciante', mostrarSe: (f) => f.tipo === 'estabelecimento' },
  { key: 'bairro', label: 'Bairro / região', lista: true },
  { key: 'audiencia', label: 'Audiência', lista: true, mostrarSe: () => false },

  // audiência (vazio = padrão da empresa)
  { key: 'corridas_dia', label: 'Corridas por dia', tipo: 'numero', mostrarSe: (f) => f.tipo === 'carro', placeholder: () => `padrão: ${padroes.value.carro.corridas}`, dica: 'Média informada pelo motorista (veja no app de corridas).' },
  { key: 'passageiros_corrida', label: 'Passageiros por corrida', tipo: 'numero', mostrarSe: (f) => f.tipo === 'carro', placeholder: () => `padrão: ${padroes.value.carro.passageiros}` },
  { key: 'fluxo_dia', label: 'Pessoas por dia no local', tipo: 'numero', mostrarSe: (f) => f.tipo === 'estabelecimento', placeholder: () => `padrão: ${padroes.value.estabelecimento.fluxo}`, dica: 'Clientes atendidos por dia (pergunte ao estabelecimento).' },
  {
    key: 'permanencia_min',
    label: 'Minutos diante da tela',
    tipo: 'numero',
    placeholder: (f) => `padrão: ${f.tipo === 'carro' ? padroes.value.carro.permanencia : padroes.value.estabelecimento.permanencia}`,
    dica: 'Carro: duração média da corrida. Estabelecimento: tempo médio de espera.',
  },
  { key: 'horas_operacao', label: 'Horas ligada por dia', tipo: 'numero', placeholder: (f) => `padrão: ${f.tipo === 'carro' ? padroes.value.carro.horas : padroes.value.estabelecimento.horas}` },

  {
    key: 'layout',
    label: 'Layout',
    tipo: 'select',
    opcoes: op(['cheia', 'Tela cheia — anúncios e conteúdo em sequência'], ['lateral', 'Lateral — entretenimento grande + anúncios ao lado']),
  },
  { key: 'cor_primaria', label: 'Cor de destaque', tipo: 'cor' },
  { key: 'cor_fundo', label: 'Cor de fundo', tipo: 'cor' },
  { key: 'logo_url', label: 'Logo exibido no rodapé', tipo: 'midia', dica: 'Opcional. Se vazio, usa o logo da Publicar.' },
  { key: 'ticker', label: 'Faixa de recados (rodapé)', tipo: 'textarea', dica: 'Um recado por linha. Ex.: Wi-Fi: senha 1234 · Hoje: corte + barba R$ 50' },
  {
    key: 'widgets',
    label: 'Conteúdo automático',
    tipo: 'checks',
    opcoes: op(['clima', 'Clima'], ['cotacao', 'Dólar e euro'], ['noticias', 'Notícias da cidade'], ['esportes', 'Esportes'], ['curiosidades', 'Você sabia?']),
    dica: 'Quadros leves gerados sozinhos (poucos KB, funcionam offline). Cidade e patrocinadores em Configurações.',
  },
  { key: 'conteudo', label: 'Conteúdo próprio (promoções, vídeos, avisos)', tipo: 'conteudo' },
  { key: 'ultimo_ping', label: 'Conexão', lista: true, mostrarSe: () => false },
  { key: 'status', label: 'Status', tipo: 'select', lista: true, selo: corStatus, opcoes: op(['ativa', 'Ativa'], ['inativa', 'Inativa']) },
]

async function abrirInstalacao(linha: Record<string, any>) {
  instalando.value = linha
  qr.value = await QRCode.toDataURL(`${origem}/tela/${linha.codigo}`, { margin: 1, width: 220, color: { dark: '#1E1E1E' } })
}

async function copiar() {
  await navigator.clipboard.writeText(urlPlayer.value)
  avisar('Endereço copiado')
}
</script>

<style scoped>
.codigo { font-family: ui-monospace, Menlo, monospace; font-weight: 700; letter-spacing: 0.08em; background: var(--laranja-claro); color: var(--laranja-escuro); padding: 3px 8px; border-radius: 6px; }
.instalar { display: grid; grid-template-columns: 220px 1fr; gap: 20px; align-items: start; }
.qr { width: 220px; height: 220px; border: 1px solid var(--borda); border-radius: 8px; }
.instalar ol { padding-left: 18px; margin: 6px 0 12px; color: var(--texto-2); }
.endereco code { display: block; background: #f4f3ef; padding: 8px 10px; border-radius: 6px; word-break: break-all; margin-bottom: 8px; }
@media (max-width: 640px) { .instalar { grid-template-columns: 1fr; } }
.saude { display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.75rem; color: var(--texto-2); margin-top: 2px; }
.saude .fraca { color: var(--vermelho); font-weight: 700; }
.previa-aud { display: flex; flex-direction: column; gap: 3px; border: 1px solid #c9dcf0; background: var(--azul-claro); border-radius: 8px; padding: 12px 14px; }
.previa-aud strong { color: var(--azul); }
</style>
