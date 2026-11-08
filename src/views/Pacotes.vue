<template>
  <CrudPage
    ref="crud"
    recurso="pacotes"
    titulo="Pacotes"
    subtitulo="Pacotes prontos para vender: audiência, impactos por mês e preço sugerido pela ocupação atual das telas."
    rotulo-novo="Novo pacote"
    :campos="campos"
    :padrao="{ status: 'ativo', tipo_tela: 'todas', bairros: [], duracao: 15, prioridade: 1, dias_semana: [], horarios: [], preco_base: 0, dinamico: '1' }"
  >
    <template #ferramentas>
      <button v-if="crud && !crud.linhas.length" class="btn" @click="criarSugeridos">Criar pacotes sugeridos</button>
      <button class="btn" title="Página pública com números, bairros e pacotes, para mandar ao cliente" @click="abrirMidiaKit">Mídia kit</button>
    </template>
    <template #celula-nome="{ linha }">
      <strong>{{ linha.nome }}</strong>
      <div class="mudo pequeno">{{ resumo(linha) }}</div>
    </template>
    <template #celula-metricas="{ linha }">
      <div v-if="linha.metricas" class="metr">
        <span><b>{{ linha.metricas.telas }}</b> telas</span>
        <span><b>{{ numero(linha.metricas.pessoas_dia) }}</b> pessoas/dia</span>
        <span><b>{{ numero(linha.metricas.impactos_mes) }}</b> impactos/mês</span>
      </div>
    </template>
    <template #celula-ocupacao="{ linha }">
      <template v-if="linha.metricas">
        <div class="barra-ocup"><i :style="{ width: Math.min(100, linha.metricas.ocupacao) + '%' }" :class="nivel(linha.metricas.ocupacao)" /></div>
        <span class="pequeno">{{ linha.metricas.ocupacao }}% vendido</span>
        <div v-if="linha.metricas.telas_lotadas" class="pequeno lotado">{{ linha.metricas.telas_lotadas }} tela(s) sem espaço</div>
      </template>
    </template>
    <template #celula-preco="{ linha }">
      <template v-if="linha.metricas">
        <strong>{{ moeda(linha.metricas.preco_sugerido) }}</strong><span class="mudo pequeno">/mês</span>
        <div v-if="linha.dinamico && linha.metricas.preco_sugerido !== linha.preco_base" class="mudo pequeno">base {{ moeda(linha.preco_base) }}</div>
        <div v-if="linha.metricas.cpm != null" class="mudo pequeno">CPM {{ moeda(linha.metricas.cpm) }}</div>
      </template>
    </template>
    <template #acoes="{ linha }">
      <button class="btn pequeno destaque" :disabled="!linha.metricas?.telas" @click="vender(linha)">Criar campanha</button>
    </template>
  </CrudPage>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import CrudPage from '../components/CrudPage.vue'
import { corStatus, op, type Campo } from '../campos'
import { moeda, numero, resumoVeiculacao } from '../format'
import { avisar, erro } from '../toast'

const crud = ref<InstanceType<typeof CrudPage>>()
const router = useRouter()

const campos = reactive<Campo[]>([
  { key: 'nome', label: 'Nome do pacote', obrigatorio: true, lista: true },
  { key: 'metricas', label: 'Audiência', lista: true, mostrarSe: () => false },
  { key: 'ocupacao', label: 'Ocupação', lista: true, mostrarSe: () => false },
  { key: 'preco', label: 'Preço sugerido', lista: true, mostrarSe: () => false },
  { key: 'descricao', label: 'Descrição para o cliente', tipo: 'textarea' },
  { key: 'tipo_tela', label: 'Onde exibe', tipo: 'select', opcoes: op(['todas', 'Carros e estabelecimentos'], ['carro', 'Só carros de app'], ['estabelecimento', 'Só estabelecimentos']) },
  { key: 'bairros', label: 'Bairros', tipo: 'checks', opcoes: [], dica: 'Nenhum marcado = todos os bairros.' },
  { key: 'duracao', label: 'Duração do espaço (s)', tipo: 'numero' },
  { key: 'prioridade', label: 'Inserções por ciclo', tipo: 'numero', dica: 'De 1 a 5.' },
  { key: 'dias_semana', label: 'Dias da semana', tipo: 'checks', opcoes: op(['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']), dica: 'Nenhum = todos os dias.' },
  { key: 'horarios', label: 'Faixas de horário', tipo: 'horarios' },
  { key: 'preco_base', label: 'Preço base mensal (R$)', tipo: 'dinheiro' },
  {
    key: 'dinamico',
    label: 'Preço dinâmico',
    tipo: 'select',
    opcoes: op(['1', 'Sim: sobe até +50% conforme a ocupação'], ['0', 'Não: preço fixo']),
    dica: 'Como passagem aérea: quanto mais vendido o horário/região, mais caro o espaço que sobra.',
  },
  { key: 'status', label: 'Status', tipo: 'select', lista: true, selo: corStatus, opcoes: op(['ativo', 'Ativo'], ['inativo', 'Inativo']) },
])

const resumo = (l: Record<string, any>) =>
  `${l.duracao}s × ${l.prioridade} · ${resumoVeiculacao(l)}${l.metricas?.bairros?.length && (l.bairros || []).length ? ' · ' + l.metricas.bairros.join(', ') : ''}`
const nivel = (p: number) => (p > 85 ? 'alto' : p > 50 ? 'medio' : 'baixo')

async function criarSugeridos() {
  try {
    const r = await api.post<{ criados: number }>('/pacotes/sugeridos')
    avisar(`${r.criados} pacotes criados: ajuste os preços à sua praça`)
    await crud.value?.carregar()
  } catch (e) {
    erro(e)
  }
}

/** Abre o mídia kit público (o link fica fixo: dá para mandar ao cliente e ele sempre vê os números do dia). */
async function abrirMidiaKit() {
  try {
    const { token } = await api.post<{ token: string }>('/midiakit/link')
    const url = `${location.origin}/midiakit/${token}`
    try { await navigator.clipboard.writeText(url); avisar('Link do mídia kit copiado') } catch { /* sem permissão de cópia */ }
    window.open(url, '_blank', 'noopener')
  } catch (e) {
    erro(e)
  }
}

function vender(l: Record<string, any>) {
  router.push({ path: '/campanhas', query: { pacote: String(l.id) } })
}

onMounted(async () => {
  // opções de bairro vêm das telas cadastradas
  try {
    const telas = await api.get<{ bairro: string | null }[]>('/telas')
    const bairros = [...new Set(telas.map((t) => (t.bairro || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    campos.find((c) => c.key === 'bairros')!.opcoes = bairros.map((b) => ({ valor: b, rotulo: b }))
  } catch { /* sem telas */ }
})
</script>

<style scoped>
.metr { display: flex; flex-direction: column; gap: 1px; font-size: 0.85rem; }
.barra-ocup { width: 120px; height: 8px; background: #efede8; border-radius: 999px; overflow: hidden; margin-bottom: 3px; }
.barra-ocup i { display: block; height: 100%; border-radius: 999px; }
.barra-ocup .baixo { background: var(--verde); }
.barra-ocup .medio { background: var(--laranja); }
.barra-ocup .alto { background: var(--vermelho); }
.lotado { color: var(--vermelho); }
</style>
