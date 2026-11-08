<template>
  <CrudPage
    ref="crud"
    recurso="campanhas"
    titulo="Campanhas"
    subtitulo="A campanha é o contrato: período, telas, horários e o espaço comprado. As peças (criativos) giram dentro desse espaço."
    rotulo-novo="Nova campanha"
    :campos="campos"
    :padrao="{ status: 'aguardando', duracao: 15, prioridade: 1, rotacao: 'sequencial', tipo_tela: 'todas', telas_alvo: [], dias_semana: [], horarios: [], pecas: [] }"
  >
    <template #celula-nome="{ linha }">
      <div class="nome-camp">
        <div class="mini">
          <template v-if="capa(linha)">
            <video v-if="capa(linha)!.midia_tipo === 'video'" :src="capa(linha)!.midia_url" muted preload="metadata" />
            <img v-else-if="capa(linha)!.midia_tipo === 'imagem'" :src="capa(linha)!.midia_url" alt="" />
            <span v-else>YT</span>
          </template>
          <span v-else>—</span>
          <span v-if="(linha.pecas || []).length > 1" class="qtd">+{{ linha.pecas.length - 1 }}</span>
        </div>
        <div>
          <strong>{{ linha.nome }}</strong>
          <div class="sub">
            <span class="mudo pequeno">{{ textoPecas(linha) }}</span>
            <span v-if="pendentes(linha)" class="selo laranja">{{ pendentes(linha) }} aguardando aprovação</span>
            <span v-if="linha.status === 'ativa' && !aprovadas(linha)" class="selo vermelho">sem peça aprovada: não vai ao ar</span>
          </div>
        </div>
      </div>
    </template>
    <template #formulario="{ form }">
      <OcupacaoPrevia :form="form" />
    </template>
    <template #acoes="{ linha }">
      <button v-if="linha.status === 'aguardando' || linha.status === 'rascunho'" class="btn pequeno destaque" @click="aprovar(linha)"><Icone nome="check" :tamanho="14" /> Aprovar</button>
      <button v-else-if="pendentes(linha)" class="btn pequeno destaque" @click="aprovarPecas(linha)"><Icone nome="check" :tamanho="14" /> Aprovar peças</button>
      <button v-if="linha.status === 'ativa'" class="btn pequeno" @click="mudar(linha, 'pausada')">Pausar</button>
      <button v-else-if="linha.status === 'pausada'" class="btn pequeno" @click="mudar(linha, 'ativa')">Retomar</button>
    </template>
  </CrudPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CrudPage from '../components/CrudPage.vue'
import Icone from '../components/Icone.vue'
import OcupacaoPrevia from '../components/OcupacaoPrevia.vue'
import { corStatus, op, type Campo } from '../campos'
import { data, resumoVeiculacao } from '../format'
import { avisar, erro } from '../toast'

const crud = ref<InstanceType<typeof CrudPage>>()

const campos: Campo[] = [
  { key: 'nome', label: 'Nome da campanha', obrigatorio: true, lista: true },
  { key: 'cliente_id', label: 'Anunciante', tipo: 'relacao', relacao: 'clientes', lista: true },

  // espaço comprado
  { key: 'duracao', label: 'Duração do espaço (segundos)', tipo: 'numero', dica: 'Tamanho do espaço vendido (ex.: 10, 15 ou 30s). Imagens ficam esse tempo; vídeos precisam caber nele.' },
  { key: 'prioridade', label: 'Inserções por ciclo', tipo: 'numero', dica: 'De 1 a 5. Cada inserção ocupa um espaço no ciclo (ex.: 2 × 15s = 30s, planos Destaque).' },

  // peças
  {
    key: 'rotacao',
    label: 'Rodízio das peças',
    tipo: 'select',
    inteira: true,
    opcoes: op(['sequencial', 'Sequencial — as peças se alternam igualmente, na ordem'], ['peso', 'Por peso — define quanto cada peça aparece (ex.: 70% oferta, 30% marca)']),
  },
  { key: 'pecas', label: 'Peças (criativos)', tipo: 'pecas' },
  { key: 'link_qr', label: 'Link do QR code da campanha', dica: 'Site, WhatsApp (wa.me/55…) ou Instagram. Cada peça pode ter um link próprio. Cada leitura é contada no relatório.', inteira: true },

  // veiculação
  { key: 'inicio', label: 'Início', tipo: 'data', lista: true },
  { key: 'fim', label: 'Fim', tipo: 'data', lista: true },
  {
    key: 'dias_semana',
    label: 'Dias da semana',
    tipo: 'checks',
    opcoes: op(['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']),
    dica: 'Nenhum marcado = todos os dias.',
  },
  { key: 'horarios', label: 'Faixas de horário', tipo: 'horarios', lista: true },
  { key: 'tipo_tela', label: 'Onde exibir', tipo: 'select', opcoes: op(['todas', 'Carros e estabelecimentos'], ['carro', 'Só carros de app'], ['estabelecimento', 'Só estabelecimentos']), lista: true },
  { key: 'telas_alvo', label: 'Telas específicas', tipo: 'telas' },
  {
    key: 'status',
    label: 'Status da campanha',
    tipo: 'select',
    lista: true,
    selo: corStatus,
    opcoes: op(['aguardando', 'Aguardando aprovação'], ['ativa', 'Ativa'], ['pausada', 'Pausada'], ['rascunho', 'Rascunho'], ['encerrada', 'Encerrada']),
  },
]
campos.find((c) => c.key === 'inicio')!.celula = (v) => data(v)
campos.find((c) => c.key === 'fim')!.celula = (v) => data(v)
campos.find((c) => c.key === 'horarios')!.celula = (_v, l) => resumoVeiculacao(l)

type Linha = Record<string, any>
const pecas = (l: Linha): Linha[] => l.pecas || []
const capa = (l: Linha) => pecas(l).find((p) => p.status === 'aprovada') || pecas(l)[0] || null
const pendentes = (l: Linha) => pecas(l).filter((p) => p.status === 'aguardando').length
const aprovadas = (l: Linha) => pecas(l).filter((p) => p.status === 'aprovada').length
const textoPecas = (l: Linha) => {
  const n = pecas(l).length
  return n ? `${n} peça${n > 1 ? 's' : ''} · ${l.duracao || 15}s × ${l.prioridade || 1}${l.rotacao === 'peso' ? ' · por peso' : ''}` : 'sem peças'
}

async function mudar(linha: Linha, status: string) {
  try {
    await crud.value!.atualizar(linha.id, { status })
    avisar(status === 'ativa' ? 'Campanha no ar' : 'Campanha pausada')
  } catch (e) {
    erro(e)
  }
}

/** Aprovar a campanha aprova junto as peças que estavam aguardando. */
async function aprovar(linha: Linha) {
  if (!pecas(linha).length) {
    erro('Adicione ao menos uma peça antes de aprovar (botão Editar).')
    return
  }
  try {
    await crud.value!.atualizar(linha.id, { status: 'ativa', pecas: pecas(linha).map((p) => ({ ...p, status: p.status === 'aguardando' ? 'aprovada' : p.status })) })
    avisar('Campanha aprovada e no ar')
  } catch (e) {
    erro(e)
  }
}

async function aprovarPecas(linha: Linha) {
  try {
    await crud.value!.atualizar(linha.id, { pecas: pecas(linha).map((p) => ({ ...p, status: p.status === 'aguardando' ? 'aprovada' : p.status })) })
    avisar('Peças aprovadas')
  } catch (e) {
    erro(e)
  }
}
</script>

<style scoped>
.nome-camp { display: flex; align-items: center; gap: 10px; }
.mini { position: relative; width: 64px; height: 40px; border-radius: 6px; background: #1e1e1e; overflow: hidden; display: grid; place-items: center; color: #fff; font-size: 0.7rem; flex-shrink: 0; }
.mini img, .mini video { width: 100%; height: 100%; object-fit: cover; }
.mini .qtd { position: absolute; right: 3px; bottom: 3px; background: var(--laranja); color: var(--grafite); font-weight: 800; font-size: 0.65rem; padding: 0 5px; border-radius: 999px; }
.sub { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; margin-top: 2px; }
</style>
