<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Financeiro</h1>
        <p>Resultado do mês: faturas recebidas, outras entradas, despesas e repasses aos motoristas.</p>
      </div>
      <div class="barra-ferramentas">
        <input v-model="mes" type="month" class="mes" aria-label="Mês" @change="carregar" />
      </div>
    </div>

    <div class="grade-cards">
      <div class="cartao pad stat"><span>Faturas recebidas</span><strong>{{ moeda(f.receitas_faturas) }}</strong><em>{{ f.faturas_pagas || 0 }} pagamento(s)</em></div>
      <div class="cartao pad stat"><span>Outras entradas</span><strong>{{ moeda(f.outras_entradas) }}</strong></div>
      <div class="cartao pad stat"><span>Despesas</span><strong>{{ moeda(f.saidas) }}</strong></div>
      <div class="cartao pad stat"><span>Repasses a motoristas</span><strong>{{ moeda(f.repasses_motoristas) }}</strong></div>
      <div class="cartao pad stat resultado" :class="{ negativo: f.resultado < 0 }"><span>Resultado do mês</span><strong>{{ moeda(f.resultado) }}</strong></div>
    </div>

    <div class="secao">
      <h2>Lançamentos</h2>
      <CrudPage
        ref="crud"
        recurso="lancamentos"
        :campos="camposLanc"
        rotulo-novo="Novo lançamento"
        :padrao="{ tipo: 'saida', data: hoje() }"
        :filtro="(l) => String(l.data || '').startsWith(mes)"
        @alterado="carregar"
      />
    </div>

    <div v-if="f.repasses?.length" class="secao">
      <h2>Repasses do mês</h2>
      <div class="cartao tabela-wrap">
        <table class="tabela">
          <thead><tr><th>Motorista</th><th>Nível</th><th>Modelo</th><th class="num">Horas ligada</th><th>Chave Pix</th><th class="num">Repasse</th></tr></thead>
          <tbody>
            <tr v-for="r in f.repasses" :key="r.id">
              <td><strong>{{ r.nome }}</strong> <span class="mudo pequeno">{{ r.telas }} tela(s)</span></td>
              <td><span class="selo" style="text-transform: capitalize">{{ r.nivel }}</span></td>
              <td>
                <template v-if="r.modelo_repasse === 'hora'">{{ moeda(r.valor_hora) }}/h<span v-if="r.bonus_pct" class="selo verde">+{{ r.bonus_pct }}%</span></template>
                <template v-else>Fixo</template>
              </td>
              <td class="num">{{ r.horas.toLocaleString('pt-BR') }} h</td>
              <td>{{ r.pix || '—' }}</td>
              <td class="num"><strong>{{ moeda(r.valor) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import CrudPage from '../components/CrudPage.vue'
import { op, type Campo } from '../campos'
import { data, hoje, mesAtual, moeda } from '../format'
import { erro } from '../toast'

const mes = ref(mesAtual())
const f = ref<Record<string, any>>({})

const camposLanc: Campo[] = [
  { key: 'data', label: 'Data', tipo: 'data', obrigatorio: true, lista: true, celula: (v) => data(v) },
  { key: 'tipo', label: 'Tipo', tipo: 'select', lista: true, opcoes: op(['saida', 'Despesa'], ['entrada', 'Entrada']), selo: (v) => (v === 'entrada' ? 'verde' : 'vermelho') },
  {
    key: 'categoria',
    label: 'Categoria',
    tipo: 'select',
    lista: true,
    opcoes: op(['equipamento', 'Equipamento (tablets, suportes)'], ['dados', 'Chips / internet'], ['marketing', 'Marketing'], ['comissao', 'Comissão de vendas'], ['taxas', 'Taxas bancárias'], ['infraestrutura', 'Infraestrutura'], ['producao', 'Produção de vídeos'], ['outros', 'Outros']),
  },
  { key: 'descricao', label: 'Descrição', lista: true },
  { key: 'valor', label: 'Valor (R$)', tipo: 'dinheiro', lista: true },
]

async function carregar() {
  try {
    f.value = await api.get(`/financeiro?mes=${mes.value}`)
  } catch (e) {
    erro(e)
  }
}
onMounted(carregar)
</script>

<style scoped>
.mes { width: auto; }
.stat span { display: block; font-size: 0.82rem; color: var(--texto-2); font-weight: 550; }
.stat strong { display: block; font-size: 1.4rem; font-weight: 700; margin-top: 6px; font-variant-numeric: tabular-nums; }
.stat em { display: block; font-style: normal; font-size: 0.8rem; color: var(--texto-2); }
.resultado { background: var(--grafite); border-color: var(--grafite); }
.resultado span { color: #bdbab3; }
.resultado strong { color: var(--laranja); }
.resultado.negativo strong { color: #ff8a80; }
</style>
