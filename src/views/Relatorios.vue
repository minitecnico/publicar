<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Relatórios</h1>
        <p>Prova de exibição e audiência estimada por campanha: exibições, impactos, alcance, frequência, CPM e leituras de QR.</p>
      </div>
      <div class="barra-ferramentas nao-imprimir">
        <label class="linha pequeno">De <input v-model="de" type="date" /></label>
        <label class="linha pequeno">até <input v-model="ate" type="date" /></label>
        <button class="btn" @click="carregar">Atualizar</button>
        <button class="btn" @click="imprimir"><Icone nome="imprimir" /> Imprimir / PDF</button>
      </div>
    </div>

    <div class="cartao tabela-wrap">
      <table v-if="linhas.length" class="tabela">
        <thead>
          <tr>
            <th>Campanha</th><th>Anunciante</th><th>Status</th>
            <th class="num">Exibições</th><th class="num">Impactos</th><th class="num">Alcance</th><th class="num">Freq.</th>
            <th class="num">CPM</th><th class="num">QR</th><th class="acoes nao-imprimir"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in linhas" :key="l.id">
            <td><strong>{{ l.nome }}</strong></td>
            <td>{{ l.cliente || '—' }}</td>
            <td><span class="selo" :class="corStatus(l.status)">{{ l.status }}</span></td>
            <td class="num">{{ numero(l.exibicoes) }}</td>
            <td class="num">{{ numero(l.impactos) }}</td>
            <td class="num">{{ numero(l.alcance) }}</td>
            <td class="num">{{ l.frequencia ? l.frequencia.toLocaleString('pt-BR') + '×' : '—' }}</td>
            <td class="num">{{ l.cpm != null ? moeda(l.cpm) : '—' }}</td>
            <td class="num">{{ numero(l.qr) }}</td>
            <td class="acoes nao-imprimir"><button class="btn pequeno fantasma" @click="detalhar(l)">Detalhar</button></td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3"><strong>Total</strong></td>
            <td class="num"><strong>{{ numero(soma('exibicoes')) }}</strong></td>
            <td class="num"><strong>{{ numero(soma('impactos')) }}</strong></td>
            <td class="num"><strong>{{ numero(soma('alcance')) }}</strong></td>
            <td></td><td></td>
            <td class="num"><strong>{{ numero(soma('qr')) }}</strong></td>
            <td class="nao-imprimir"></td>
          </tr>
        </tfoot>
      </table>
      <div v-else class="vazio"><strong>Sem campanhas no período</strong>As exibições aparecem aqui assim que as telas começam a tocar.</div>
    </div>
    <p class="mudo pequeno nota-cpm">CPM aparece quando a campanha tem "Valor investido" preenchido. Impactos e alcance são estimativas; veja a metodologia no detalhe.</p>

    <Modal :aberto="!!det" :titulo="`Relatório: ${det?.nome}`" larga @fechar="det = null">
      <div v-if="det && !detalhe" class="mudo">Carregando…</div>
      <div v-if="det && detalhe" class="relatorio">
        <p class="mudo" style="margin-top: 0">{{ data(detalhe.de) }} a {{ data(detalhe.ate) }} · {{ det.cliente || 'sem anunciante' }}</p>

        <div class="kpis">
          <div class="kpi"><span>Exibições</span><strong>{{ numero(detalhe.resumo.exibicoes) }}</strong></div>
          <div class="kpi destaque"><span>Impactos</span><strong>{{ numero(detalhe.resumo.impactos) }}</strong><em>pessoas × exibições</em></div>
          <div class="kpi"><span>Alcance</span><strong>{{ numero(detalhe.resumo.alcance) }}</strong><em>pessoas diferentes</em></div>
          <div class="kpi"><span>Frequência</span><strong>{{ detalhe.resumo.frequencia ? detalhe.resumo.frequencia.toLocaleString('pt-BR') + '×' : '—' }}</strong><em>vezes que cada pessoa viu</em></div>
          <div class="kpi"><span>CPM</span><strong>{{ detalhe.resumo.cpm != null ? moeda(detalhe.resumo.cpm) : '—' }}</strong><em>{{ detalhe.resumo.investimento != null ? `${moeda(detalhe.resumo.investimento)} no período` : 'informe o valor investido' }}</em></div>
          <div class="kpi"><span>QR lidos</span><strong>{{ numero(detalhe.resumo.qr) }}</strong><em>{{ detalhe.resumo.impactos ? `${((detalhe.resumo.qr / detalhe.resumo.impactos) * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} a cada mil impactos` : '' }}</em></div>
        </div>

        <div v-if="detalhe.por_peca?.length" class="bloco">
          <h3>Por peça</h3>
          <table class="tabela">
            <thead><tr><th>Peça</th><th>Status</th><th class="num">Exibições</th><th class="num">Share</th></tr></thead>
            <tbody>
              <tr v-for="p in detalhe.por_peca" :key="p.id">
                <td>
                  <div class="peca-nome">
                    <span class="mini"><img v-if="p.midia_tipo === 'imagem'" :src="p.midia_url" alt="" /><video v-else-if="p.midia_tipo === 'video'" :src="p.midia_url" muted preload="metadata" /><span v-else>YT</span></span>
                    {{ p.nome || 'Peça ' + p.id }}
                  </div>
                </td>
                <td><span class="selo" :class="corStatus(p.status)">{{ p.status }}</span></td>
                <td class="num">{{ numero(p.total) }}</td>
                <td class="num">{{ totalPecas ? Math.round((p.total / totalPecas) * 100) + '%' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="duas bloco">
          <div>
            <h3>Por dia</h3>
            <table class="tabela">
              <thead><tr><th>Dia</th><th class="num">Exibições</th><th class="num">Impactos</th><th class="num">QR</th></tr></thead>
              <tbody>
                <tr v-for="d in detalhe.por_dia" :key="d.dia"><td>{{ data(d.dia) }}</td><td class="num">{{ numero(d.total) }}</td><td class="num">{{ numero(Math.round(d.impactos)) }}</td><td class="num">{{ d.qr }}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3>Por tela</h3>
            <table class="tabela">
              <thead><tr><th>Tela</th><th class="num">Exibições</th><th class="num">Impactos</th><th class="num">QR</th></tr></thead>
              <tbody>
                <tr v-for="t in detalhe.por_tela" :key="t.id"><td>{{ t.nome }} <span class="mudo pequeno">{{ t.bairro }}</span></td><td class="num">{{ numero(t.total) }}</td><td class="num">{{ numero(Math.round(t.impactos)) }}</td><td class="num">{{ t.qr }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <details class="metodologia bloco" open>
          <summary>Como calculamos</summary>
          <ul>
            <li><strong>Público no momento</strong> = pessoas por dia ÷ horas ligada × minutos diante da tela (cada tela tem seus números; vazios usam os padrões abaixo).</li>
            <li><strong>Impactos</strong> = exibições × público no momento × visibilidade (carro {{ detalhe.metodologia.carro.visibilidade }}, estabelecimento {{ detalhe.metodologia.estabelecimento.visibilidade }}).</li>
            <li><strong>Alcance</strong> = pessoas que tiveram ao menos uma oportunidade de ver, somadas por tela e dia. <strong>Frequência</strong> = impactos ÷ alcance.</li>
            <li><strong>CPM</strong> = investimento no período ÷ impactos × 1.000.</li>
            <li>
              Padrões — carro: {{ detalhe.metodologia.carro.corridas }} corridas/dia × {{ detalhe.metodologia.carro.passageiros }} passageiros, corridas de
              {{ detalhe.metodologia.carro.permanencia }} min, {{ detalhe.metodologia.carro.horas }} h/dia · estabelecimento:
              {{ detalhe.metodologia.estabelecimento.fluxo }} pessoas/dia, {{ detalhe.metodologia.estabelecimento.permanencia }} min de espera,
              {{ detalhe.metodologia.estabelecimento.horas }} h/dia.
            </li>
          </ul>
        </details>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import Icone from '../components/Icone.vue'
import Modal from '../components/Modal.vue'
import { corStatus } from '../campos'
import { data, diasAtras, hoje, moeda, numero } from '../format'
import { erro } from '../toast'

const de = ref(diasAtras(29))
const ate = ref(hoje())
const linhas = ref<any[]>([])
const det = ref<any>(null)
const detalhe = ref<any>(null)
const totalPecas = computed(() => (detalhe.value?.por_peca || []).reduce((s: number, p: any) => s + Number(p.total || 0), 0))
const soma = (k: string) => linhas.value.reduce((s, l) => s + Number(l[k] || 0), 0)

async function carregar() {
  try {
    const r = await api.get(`/relatorios?de=${de.value}&ate=${ate.value}`)
    linhas.value = r.campanhas
  } catch (e) {
    erro(e)
  }
}

async function detalhar(l: any) {
  det.value = l
  detalhe.value = null
  try {
    detalhe.value = await api.get(`/relatorios/campanha/${l.id}?de=${de.value}&ate=${ate.value}`)
  } catch (e) {
    erro(e)
  }
}

const imprimir = () => window.print()
onMounted(carregar)
</script>

<style scoped>
input[type='date'] { width: auto; }
tfoot td { border-top: 2px solid var(--borda); background: #fbfaf8; }
.nota-cpm { margin: 8px 2px 0; }
.relatorio { display: flex; flex-direction: column; gap: 4px; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.kpi { border: 1px solid var(--borda); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; background: #fbfaf8; }
.kpi span { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-2); font-weight: 600; }
.kpi strong { font-size: 1.45rem; font-variant-numeric: tabular-nums; }
.kpi em { font-style: normal; font-size: 0.75rem; color: var(--texto-2); }
.kpi.destaque { background: var(--laranja-claro); border-color: #f3d3a6; }
.bloco { margin-top: 16px; }
.bloco h3 { margin-bottom: 6px; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.peca-nome { display: flex; align-items: center; gap: 10px; }
.mini { width: 48px; height: 27px; border-radius: 5px; background: #1e1e1e; overflow: hidden; display: grid; place-items: center; color: #fff; font-size: 0.65rem; flex-shrink: 0; }
.mini img, .mini video { width: 100%; height: 100%; object-fit: cover; }
.metodologia summary { cursor: pointer; font-weight: 600; }
.metodologia ul { margin: 8px 0 0; padding-left: 18px; font-size: 0.85rem; color: var(--texto-2); display: flex; flex-direction: column; gap: 4px; }
@media (max-width: 700px) { .duas, .kpis { grid-template-columns: 1fr 1fr; } }
</style>
