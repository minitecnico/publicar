<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Inventário</h1>
        <p>Quanto do ciclo de anúncios ({{ inv?.ciclo ?? '…' }}s) já está vendido em cada tela e em cada hora. Use para saber o que ainda dá para vender.</p>
      </div>
      <div class="barra-ferramentas nao-imprimir">
        <label class="linha pequeno">Dia <input v-model="dia" type="date" @change="carregar" /></label>
        <select v-model="tipo" class="filtro">
          <option value="">Todas as telas</option>
          <option value="carro">Só carros</option>
          <option value="estabelecimento">Só estabelecimentos</option>
        </select>
        <label class="check pequeno"><input v-model="madrugada" type="checkbox" /> Mostrar madrugada</label>
      </div>
    </div>

    <div v-if="inv" class="grade-cards">
      <div class="cartao pad kpi">
        <span class="mudo pequeno">Ocupação média ({{ horaIni }}h–{{ horaFim }}h)</span>
        <strong>{{ ocupacaoMedia }}%</strong>
        <span class="mudo pequeno">{{ NOMES_DIAS[inv.dia_semana] }}, {{ data(inv.data) }}</span>
      </div>
      <div class="cartao pad kpi">
        <span class="mudo pequeno">Espaços de 15s livres</span>
        <strong>{{ numero(espacosLivres) }}</strong>
        <span class="mudo pequeno">somando telas × horas exibidas</span>
      </div>
      <div class="cartao pad kpi">
        <span class="mudo pequeno">Horário mais vendido</span>
        <strong>{{ horaPico == null ? '—' : `${String(horaPico.hora).padStart(2, '0')}h` }}</strong>
        <span class="mudo pequeno">{{ horaPico ? `${horaPico.pct}% ocupado em média` : 'nada vendido neste dia' }}</span>
      </div>
      <div class="cartao pad kpi">
        <span class="mudo pequeno">Células lotadas</span>
        <strong :class="{ alerta: lotadas > 0 }">{{ lotadas }}</strong>
        <span class="mudo pequeno">tela × hora acima de 85%</span>
      </div>
    </div>

    <div class="cartao secao">
      <div class="legenda nao-imprimir">
        <span><i class="cel n0" /> livre</span>
        <span><i class="cel n1" /> até 50%</span>
        <span><i class="cel n2" /> até 85%</span>
        <span><i class="cel n3" /> quase lotado</span>
        <span><i class="cel n4" /> lotado</span>
        <span class="mudo pequeno">Passe o mouse para ver os segundos livres. Clique na tela para ver as campanhas.</span>
      </div>
      <div class="tabela-wrap">
        <table v-if="telas.length" class="mapa">
          <thead>
            <tr>
              <th class="nome-col">Tela</th>
              <th v-for="h in horas" :key="h" class="h">{{ String(h).padStart(2, '0') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="t in telas" :key="t.id">
              <tr class="linha-tela" @click="aberta = aberta === t.id ? null : t.id">
                <td class="nome-col">
                  <strong>{{ t.nome }}</strong>
                  <span class="mudo pequeno">{{ t.tipo === 'carro' ? 'carro' : 'estab.' }}{{ t.bairro ? ' · ' + t.bairro : '' }}</span>
                </td>
                <td v-for="h in horas" :key="h" class="h">
                  <span class="cel" :class="nivel(t.horas[h])" :title="dica(t, h)">{{ pct(t.horas[h]) || '' }}</span>
                </td>
              </tr>
              <tr v-if="aberta === t.id" class="detalhe">
                <td :colspan="horas.length + 1">
                  <span v-if="!t.campanhas.length" class="mudo">Nenhuma campanha vendida para esta tela neste dia.</span>
                  <span v-for="c in t.campanhas" :key="c.id" class="selo" :class="c.status === 'ativa' ? 'verde' : 'laranja'">{{ c.nome }} · {{ c.segundos }}s</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <div v-else class="vazio">
          <strong>{{ carregando ? 'Carregando…' : 'Nenhuma tela ativa' }}</strong>
          <span v-if="!carregando">Cadastre telas em “Telas” para ver o inventário.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import { data, hoje, numero } from '../format'
import { erro } from '../toast'

interface TelaInv { id: number; nome: string; tipo: string; bairro: string | null; horas: number[]; campanhas: { id: number; nome: string; segundos: number; status: string }[] }
interface Inv { data: string; dia_semana: number; ciclo: number; telas: TelaInv[] }

const NOMES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const ESPACO = 15

const dia = ref(hoje())
const tipo = ref('')
const madrugada = ref(false)
const inv = ref<Inv | null>(null)
const carregando = ref(true)
const aberta = ref<number | null>(null)

const horaIni = computed(() => (madrugada.value ? 0 : 6))
const horaFim = computed(() => 23)
const horas = computed(() => Array.from({ length: horaFim.value - horaIni.value + 1 }, (_, i) => horaIni.value + i))
const telas = computed(() => (inv.value?.telas || []).filter((t) => !tipo.value || t.tipo === tipo.value))

const ciclo = () => inv.value?.ciclo || 120
const pct = (s: number) => Math.round((s / ciclo()) * 100)
function nivel(s: number) {
  const p = s / ciclo()
  if (p <= 0) return 'n0'
  if (p <= 0.5) return 'n1'
  if (p <= 0.85) return 'n2'
  if (p < 1) return 'n3'
  return 'n4'
}
function dica(t: TelaInv, h: number) {
  const usado = t.horas[h]
  const livre = Math.max(0, ciclo() - usado)
  return `${t.nome} · ${String(h).padStart(2, '0')}h: ${usado}s vendidos de ${ciclo()}s (${pct(usado)}%) · ${livre}s livres = ${Math.floor(livre / ESPACO)} espaço(s) de ${ESPACO}s`
}

const celulas = computed(() => telas.value.flatMap((t) => horas.value.map((h) => t.horas[h])))
const ocupacaoMedia = computed(() => {
  const c = celulas.value
  return c.length ? Math.round((c.reduce((s, v) => s + Math.min(v, ciclo()), 0) / (c.length * ciclo())) * 100) : 0
})
const espacosLivres = computed(() => celulas.value.reduce((s, v) => s + Math.floor(Math.max(0, ciclo() - v) / ESPACO), 0))
const lotadas = computed(() => celulas.value.filter((v) => v / ciclo() > 0.85).length)
const horaPico = computed(() => {
  if (!telas.value.length) return null
  let melhor: { hora: number; pct: number } | null = null
  for (const h of horas.value) {
    const media = telas.value.reduce((s, t) => s + t.horas[h], 0) / telas.value.length
    const p = Math.round((media / ciclo()) * 100)
    if (p > 0 && (!melhor || p > melhor.pct)) melhor = { hora: h, pct: p }
  }
  return melhor
})

async function carregar() {
  carregando.value = true
  try {
    inv.value = await api.get<Inv>(`/inventario?data=${dia.value}`)
  } catch (e) {
    erro(e)
  } finally {
    carregando.value = false
  }
}
onMounted(carregar)
</script>

<style scoped>
.filtro { width: auto; }
.check { display: flex; align-items: center; gap: 6px; }
.check input { width: auto; }
.kpi { display: flex; flex-direction: column; gap: 4px; }
.kpi strong { font-size: 1.7rem; font-variant-numeric: tabular-nums; }
.kpi strong.alerta { color: var(--vermelho); }
.legenda { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 12px 14px; border-bottom: 1px solid var(--borda); font-size: 0.85rem; }
.legenda span { display: inline-flex; align-items: center; gap: 6px; }
.legenda .cel { width: 16px; height: 16px; }
.mapa { border-collapse: separate; border-spacing: 2px; width: 100%; font-size: 0.8rem; }
.mapa th { font-weight: 600; color: var(--texto-2); padding: 6px 2px; }
.mapa .nome-col { text-align: left; min-width: 180px; padding: 4px 10px; position: sticky; left: 0; background: var(--branco); z-index: 1; }
.mapa .nome-col strong, .mapa .nome-col span { display: block; white-space: nowrap; }
.mapa .h { text-align: center; padding: 0; min-width: 34px; }
.linha-tela { cursor: pointer; }
.linha-tela:hover .nome-col { background: #fcfbf9; }
.cel { display: grid; place-items: center; height: 32px; border-radius: 5px; font-weight: 600; font-variant-numeric: tabular-nums; font-size: 0.72rem; }
i.cel { display: inline-block; height: 16px; }
.n0 { background: #f1efea; color: transparent; }
.n1 { background: var(--verde-claro); color: var(--verde); }
.n2 { background: var(--laranja-claro); color: var(--laranja-escuro); }
.n3 { background: #f6c98f; color: #6d3f0b; }
.n4 { background: var(--vermelho); color: #fff; }
.detalhe td { padding: 8px 10px 12px; background: #fbfaf8; }
.detalhe .selo { margin: 0 6px 6px 0; }
</style>
