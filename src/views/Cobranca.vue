<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Cobrança</h1>
        <p>Faturas em aberto, lembretes por WhatsApp e baixa de pagamentos.</p>
      </div>
      <div class="barra-ferramentas">
        <input v-model="competencia" type="month" class="mes" aria-label="Competência" />
        <button class="btn destaque" :disabled="gerando" @click="gerar">{{ gerando ? 'Gerando…' : 'Gerar faturas do mês' }}</button>
      </div>
    </div>

    <div class="abas">
      <button :class="{ ativa: aba === 'aberto' }" @click="aba = 'aberto'">Em aberto <span class="selo">{{ abertas.length }}</span></button>
      <button :class="{ ativa: aba === 'todas' }" @click="aba = 'todas'">Todas as faturas</button>
    </div>

    <div v-if="aba === 'aberto'" class="cartao">
      <div class="resumo">
        <div><span>Em aberto</span><strong>{{ moeda(total(abertas)) }}</strong></div>
        <div><span>Vencido</span><strong class="vermelho">{{ moeda(total(vencidas)) }}</strong></div>
        <div><span>Vence em 7 dias</span><strong>{{ moeda(total(proximas)) }}</strong></div>
      </div>
      <div class="tabela-wrap">
        <table v-if="abertas.length" class="tabela">
          <thead>
            <tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Situação</th><th class="num">Valor</th><th class="acoes"></th></tr>
          </thead>
          <tbody>
            <tr v-for="f in abertas" :key="f.id">
              <td><strong>{{ f.cliente }}</strong><div class="mudo pequeno">{{ f.telefone || 'sem WhatsApp' }}</div></td>
              <td>{{ f.descricao }}</td>
              <td>{{ data(f.vencimento) }}</td>
              <td>
                <span v-if="f.dias_atraso > 0" class="selo vermelho">{{ f.dias_atraso }} dia(s) de atraso</span>
                <span v-else-if="f.dias_atraso === 0" class="selo laranja">vence hoje</span>
                <span v-else class="selo">em {{ -f.dias_atraso }} dia(s)</span>
              </td>
              <td class="num">{{ moeda(f.valor) }}</td>
              <td class="acoes">
                <a v-if="f.telefone" class="btn pequeno" :href="linkWhats(f)" target="_blank" rel="noopener"><Icone nome="whatsapp" :tamanho="14" /> Lembrar</a>
                <button class="btn pequeno fantasma" @click="copiar(f)">Copiar texto</button>
                <button class="btn pequeno destaque" @click="pagar(f)"><Icone nome="check" :tamanho="14" /> Recebido</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="vazio"><strong>Nenhuma fatura em aberto</strong>Use “Gerar faturas do mês” para criar as mensalidades dos clientes ativos.</div>
      </div>
    </div>

    <CrudPage v-else ref="crud" recurso="faturas" :campos="camposFatura" rotulo-novo="Nova fatura avulsa" :padrao="{ status: 'aberta', vencimento: hoje() }" @alterado="carregar" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import CrudPage from '../components/CrudPage.vue'
import Icone from '../components/Icone.vue'
import { corStatus, op, type Campo } from '../campos'
import { data, hoje, mesAtual, moeda, soDigitos } from '../format'
import { avisar, erro } from '../toast'

const aba = ref<'aberto' | 'todas'>('aberto')
const abertas = ref<any[]>([])
const config = ref<Record<string, any>>({})
const competencia = ref(mesAtual())
const gerando = ref(false)

const vencidas = computed(() => abertas.value.filter((f) => f.dias_atraso > 0))
const proximas = computed(() => abertas.value.filter((f) => f.dias_atraso <= 0 && f.dias_atraso >= -7))
const total = (l: any[]) => l.reduce((s, f) => s + Number(f.valor), 0)

const camposFatura: Campo[] = [
  { key: 'cliente_id', label: 'Cliente', tipo: 'relacao', relacao: 'clientes', obrigatorio: true, lista: true },
  { key: 'descricao', label: 'Descrição', lista: true },
  { key: 'competencia', label: 'Competência (AAAA-MM)' },
  { key: 'valor', label: 'Valor (R$)', tipo: 'dinheiro', lista: true },
  { key: 'vencimento', label: 'Vencimento', tipo: 'data', obrigatorio: true, lista: true },
  { key: 'status', label: 'Status', tipo: 'select', lista: true, selo: corStatus, opcoes: op(['aberta', 'Aberta'], ['paga', 'Paga'], ['cancelada', 'Cancelada']) },
  { key: 'pago_em', label: 'Pago em', tipo: 'data', lista: true },
  { key: 'forma_pagamento', label: 'Forma de pagamento', tipo: 'select', opcoes: op(['', '—'], ['pix', 'Pix'], ['boleto', 'Boleto'], ['cartao', 'Cartão'], ['dinheiro', 'Dinheiro'], ['transferencia', 'Transferência']) },
]

function mensagem(f: any) {
  const modelo: string =
    config.value.mensagem_cobranca || 'Olá {cliente}! A fatura {descricao} de {valor} vence em {vencimento}. Chave Pix: {pix}. Obrigado!'
  return modelo
    .replace(/{cliente}/g, f.cliente)
    .replace(/{descricao}/g, f.descricao || '')
    .replace(/{valor}/g, moeda(f.valor))
    .replace(/{vencimento}/g, data(f.vencimento))
    .replace(/{pix}/g, config.value.chave_pix || '(informe a chave Pix em Configurações)')
    .replace(/{empresa}/g, config.value.empresa || 'Publicar')
}

function linkWhats(f: any) {
  let tel = soDigitos(f.telefone)
  if (tel.length <= 11) tel = '55' + tel
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensagem(f))}`
}

async function copiar(f: any) {
  await navigator.clipboard.writeText(mensagem(f))
  avisar('Mensagem copiada')
}

async function pagar(f: any) {
  const forma = prompt('Forma de pagamento (pix, boleto, cartao, dinheiro):', 'pix')
  if (forma === null) return
  try {
    await api.post(`/faturas/${f.id}/pagar`, { forma })
    avisar('Pagamento registrado')
    await carregar()
  } catch (e) {
    erro(e)
  }
}

async function gerar() {
  gerando.value = true
  try {
    const r = await api.post('/faturas/gerar', { competencia: competencia.value })
    avisar(r.criadas ? `${r.criadas} fatura(s) criada(s)` : 'Nenhuma fatura nova: já existiam ou não há clientes com mensalidade')
    await carregar()
  } catch (e) {
    erro(e)
  } finally {
    gerando.value = false
  }
}

async function carregar() {
  try {
    const [lista, cfg] = await Promise.all([api.get('/cobranca'), api.get('/config')])
    abertas.value = lista
    config.value = cfg.config || {}
  } catch (e) {
    erro(e)
  }
}

onMounted(carregar)
</script>

<style scoped>
.mes { width: auto; }
.abas { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--borda); }
.abas button { border: none; background: none; font: inherit; font-weight: 600; color: var(--texto-2); padding: 10px 14px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; gap: 6px; align-items: center; }
.abas button.ativa { color: var(--texto); border-bottom-color: var(--laranja); }
.resumo { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--borda); }
.resumo div { padding: 14px 18px; }
.resumo div + div { border-left: 1px solid var(--borda); }
.resumo span { font-size: 0.8rem; color: var(--texto-2); display: block; }
.resumo strong { font-size: 1.25rem; }
.vermelho { color: var(--vermelho); }
</style>
