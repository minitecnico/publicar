<template>
  <CrudPage
    ref="crud"
    recurso="campanhas"
    titulo="Campanhas"
    subtitulo="Peças que vão para as telas. Só campanhas “Ativas”, dentro do período e na faixa de dia/horário entram na programação."
    rotulo-novo="Nova campanha"
    :campos="campos"
    :padrao="{ status: 'aguardando', midia_tipo: 'imagem', duracao: 15, prioridade: 1, tipo_tela: 'todas', telas_alvo: [], dias_semana: [], horarios: [] }"
  >
    <template #celula-nome="{ linha }">
      <div class="nome-camp">
        <div class="mini">
          <video v-if="linha.midia_tipo === 'video' && linha.midia_url" :src="linha.midia_url" muted preload="metadata" />
          <img v-else-if="linha.midia_tipo === 'imagem' && linha.midia_url" :src="linha.midia_url" alt="" />
          <span v-else>{{ linha.midia_tipo === 'youtube' ? 'YT' : '—' }}</span>
        </div>
        <strong>{{ linha.nome }}</strong>
      </div>
    </template>
    <template #formulario="{ form }">
      <OcupacaoPrevia :form="form" />
    </template>
    <template #acoes="{ linha }">
      <button v-if="linha.status === 'aguardando' || linha.status === 'rascunho'" class="btn pequeno destaque" @click="mudar(linha, 'ativa')"><Icone nome="check" :tamanho="14" /> Aprovar</button>
      <button v-else-if="linha.status === 'ativa'" class="btn pequeno" @click="mudar(linha, 'pausada')">Pausar</button>
      <button v-else-if="linha.status === 'pausada'" class="btn pequeno" @click="mudar(linha, 'ativa')">Retomar</button>
    </template>
  </CrudPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CrudPage from '../components/CrudPage.vue'
import Icone from '../components/Icone.vue'
import { corStatus, op, type Campo } from '../campos'
import OcupacaoPrevia from '../components/OcupacaoPrevia.vue'
import { data, resumoVeiculacao } from '../format'
import { avisar, erro } from '../toast'

const crud = ref<InstanceType<typeof CrudPage>>()

const campos: Campo[] = [
  { key: 'nome', label: 'Nome da campanha', obrigatorio: true, lista: true },
  { key: 'cliente_id', label: 'Anunciante', tipo: 'relacao', relacao: 'clientes', lista: true },
  { key: 'midia_tipo', label: 'Tipo de mídia', tipo: 'select', opcoes: op(['imagem', 'Imagem'], ['video', 'Vídeo'], ['youtube', 'YouTube']) },
  { key: 'duracao', label: 'Duração na tela (segundos)', tipo: 'numero', dica: 'Para vídeo, informe a duração do vídeo: é ela que conta no inventário.' },
  { key: 'midia_url', label: 'Arquivo da peça', tipo: 'midia' },
  { key: 'texto', label: 'Chamada (texto sobre a peça)', dica: 'Opcional. Ex.: “Pizza grande + refri por R$ 49”', inteira: true },
  { key: 'link_qr', label: 'Link do QR code', dica: 'Site, WhatsApp (wa.me/55…) ou Instagram. Cada leitura é contada no relatório.', inteira: true },
  { key: 'inicio', label: 'Início', tipo: 'data', lista: true },
  { key: 'fim', label: 'Fim', tipo: 'data', lista: true },
  { key: 'tipo_tela', label: 'Onde exibir', tipo: 'select', opcoes: op(['todas', 'Carros e estabelecimentos'], ['carro', 'Só carros de app'], ['estabelecimento', 'Só estabelecimentos']), lista: true },
  { key: 'prioridade', label: 'Inserções por ciclo', tipo: 'numero', dica: 'De 1 a 5. Cada inserção ocupa a duração da peça no ciclo (ex.: 2 × 15s = 30s, planos Destaque).' },
  {
    key: 'dias_semana',
    label: 'Dias da semana',
    tipo: 'checks',
    opcoes: op(['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']),
    dica: 'Nenhum marcado = todos os dias.',
  },
  { key: 'horarios', label: 'Faixas de horário', tipo: 'horarios', lista: true },
  { key: 'telas_alvo', label: 'Telas específicas', tipo: 'telas' },
  {
    key: 'status',
    label: 'Status',
    tipo: 'select',
    lista: true,
    selo: corStatus,
    opcoes: op(['aguardando', 'Aguardando aprovação'], ['ativa', 'Ativa'], ['pausada', 'Pausada'], ['rascunho', 'Rascunho'], ['encerrada', 'Encerrada']),
  },
]
// datas formatadas
campos.find((c) => c.key === 'inicio')!.celula = (v) => data(v)
campos.find((c) => c.key === 'fim')!.celula = (v) => data(v)
campos.find((c) => c.key === 'horarios')!.celula = (_v, l) => resumoVeiculacao(l)

async function mudar(linha: Record<string, any>, status: string) {
  try {
    await crud.value!.atualizar(linha.id, { status })
    avisar(status === 'ativa' ? 'Campanha no ar' : 'Campanha pausada')
  } catch (e) {
    erro(e)
  }
}
</script>

<style scoped>
.nome-camp { display: flex; align-items: center; gap: 10px; }
.mini { width: 56px; height: 36px; border-radius: 6px; background: #1e1e1e; overflow: hidden; display: grid; place-items: center; color: #fff; font-size: 0.7rem; flex-shrink: 0; }
.mini img, .mini video { width: 100%; height: 100%; object-fit: cover; }
</style>
