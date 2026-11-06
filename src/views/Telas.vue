<template>
  <CrudPage
    ref="crud"
    recurso="telas"
    titulo="Telas"
    subtitulo="Tablets nos carros e TVs nos estabelecimentos. Abra o endereço do player na tela e ela começa a tocar."
    rotulo-novo="Nova tela"
    :campos="campos"
    :padrao="{ tipo: 'carro', layout: 'cheia', status: 'ativa', cor_primaria: '#E9A453', cor_fundo: '#1E1E1E', conteudo: [] }"
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
import { computed, ref } from 'vue'
import CrudPage from '../components/CrudPage.vue'
import Icone from '../components/Icone.vue'
import Modal from '../components/Modal.vue'
import { corStatus, op, type Campo } from '../campos'
import { online, tempoDesde } from '../format'
import { avisar } from '../toast'

const crud = ref<InstanceType<typeof CrudPage>>()
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
  { key: 'conteudo', label: 'Entretenimento da tela', tipo: 'conteudo' },
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
</style>
