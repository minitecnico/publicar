<template>
  <div class="publico">
    <header class="topo">
      <img src="/logo.png" alt="" class="logo" />
      <div>
        <span class="empresa">{{ r?.campanha.empresa || 'Relatório de campanha' }}</span>
        <h1>{{ r?.campanha.nome || 'Carregando…' }}</h1>
        <p v-if="r" class="mudo">
          {{ r.campanha.cliente || '' }}{{ r.campanha.cliente ? ' · ' : '' }}{{ data(r.de) }} a {{ data(r.ate) }}
          · <span class="selo" :class="r.campanha.status === 'ativa' ? 'verde' : ''">{{ r.campanha.status === 'ativa' ? 'no ar' : r.campanha.status }}</span>
        </p>
      </div>
      <button class="btn nao-imprimir" @click="imprimir">Imprimir / PDF</button>
    </header>

    <div v-if="falha" class="cartao pad vazio-pub"><strong>{{ falha }}</strong></div>

    <template v-else-if="r">
      <section class="kpis">
        <div class="kpi"><span>Exibições</span><strong>{{ numero(r.resumo.exibicoes) }}</strong><em>peças exibidas por completo</em></div>
        <div class="kpi destaque"><span>Impactos</span><strong>{{ numero(r.resumo.impactos) }}</strong><em>pessoas × exibições</em></div>
        <div class="kpi"><span>Alcance</span><strong>{{ numero(r.resumo.alcance) }}</strong><em>pessoas diferentes</em></div>
        <div class="kpi"><span>Frequência</span><strong>{{ r.resumo.frequencia ? r.resumo.frequencia.toLocaleString('pt-BR') + '×' : '—' }}</strong><em>vezes que cada pessoa viu</em></div>
        <div class="kpi"><span>Telas</span><strong>{{ r.por_tela.length }}</strong><em>{{ r.por_bairro.length }} região(ões)</em></div>
        <div class="kpi"><span>QR lidos</span><strong>{{ numero(r.resumo.qr) }}</strong><em>acessos pelo QR code</em></div>
      </section>

      <section v-if="r.cupons" class="cartao pad bloco">
        <h2>Prova de venda · cupom "{{ r.cupons.oferta }}"</h2>
        <div class="kpis">
          <div class="kpi"><span>Cupons gerados</span><strong>{{ numero(r.cupons.gerados) }}</strong><em>clientes que leram o QR</em></div>
          <div class="kpi destaque"><span>Usados na loja</span><strong>{{ numero(r.cupons.usados) }}</strong><em>{{ r.cupons.conversao.toLocaleString('pt-BR') }}% de conversão</em></div>
          <div class="kpi"><span>Vendas</span><strong>{{ (r.cupons.vendas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</strong><em>informadas na validação</em></div>
        </div>
      </section>

      <section class="cartao pad bloco">
        <h2>Exibições por dia</h2>
        <BarrasDias :serie="r.por_dia" :num-dias="numDias" :ate="r.ate" titulo="Exibições por dia" />
      </section>

      <section class="cartao pad bloco">
        <h2>Horários em que a campanha mais apareceu</h2>
        <BarrasHoras :serie="r.por_hora" />
      </section>

      <div class="duas">
        <section class="cartao pad bloco">
          <h2>Por região</h2>
          <table class="tabela">
            <thead><tr><th>Bairro / região</th><th class="num">Telas</th><th class="num">Exibições</th><th class="num">Impactos</th></tr></thead>
            <tbody><tr v-for="b in r.por_bairro" :key="b.bairro"><td>{{ b.bairro }}</td><td class="num">{{ b.telas }}</td><td class="num">{{ numero(b.total) }}</td><td class="num">{{ numero(Math.round(b.impactos)) }}</td></tr></tbody>
          </table>
        </section>
        <section v-if="r.por_peca.length" class="cartao pad bloco">
          <h2>Por peça</h2>
          <table class="tabela">
            <thead><tr><th>Peça</th><th class="num">Exibições</th></tr></thead>
            <tbody>
              <tr v-for="p in r.por_peca" :key="p.id">
                <td><div class="peca"><span class="mini"><img v-if="p.midia_tipo === 'imagem'" :src="p.midia_url" alt="" /><span v-else>{{ p.midia_tipo === 'video' ? 'Vídeo' : 'YT' }}</span></span>{{ p.nome || 'Peça' }}</div></td>
                <td class="num">{{ numero(p.total) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <p class="rodape-pub mudo pequeno">
        Atualizado às {{ hora(r.gerado_em) }} · atualiza sozinho a cada 5 minutos. As telas enviam a prova de exibição em lotes,
        então os números de hoje podem levar algumas horas para fechar. Exibição conta só quando a peça passou por completo com a tela ativa.
        Impactos e alcance são estimativas de audiência.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import BarrasDias from '../components/BarrasDias.vue'
import BarrasHoras from '../components/BarrasHoras.vue'
import { data, numero } from '../format'

const route = useRoute()
const r = ref<any>(null)
const falha = ref('')
let intervalo: number | undefined

const numDias = computed(() => {
  if (!r.value) return 7
  const d = Math.round((Date.parse(r.value.ate) - Date.parse(r.value.de)) / 86400000) + 1
  return Math.min(31, Math.max(7, d))
})
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const imprimir = () => window.print()

async function carregar() {
  try {
    const res = await fetch(`/api/publico/campanha/${encodeURIComponent(String(route.params.token))}`, { cache: 'no-store' })
    const corpo = await res.json()
    if (!res.ok) { falha.value = corpo.erro || 'Relatório indisponível'; return }
    falha.value = ''
    r.value = corpo
    document.title = `${corpo.campanha.nome} · Relatório`
  } catch {
    if (!r.value) falha.value = 'Sem conexão. Tente de novo em instantes.'
  }
}

onMounted(() => {
  carregar()
  intervalo = window.setInterval(carregar, 5 * 60 * 1000)
})
onBeforeUnmount(() => clearInterval(intervalo))
</script>

<style scoped>
.publico { max-width: 1080px; margin: 0 auto; padding: 24px 16px 40px; }
.topo { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; flex-wrap: wrap; }
.topo > div { flex: 1; min-width: 220px; }
.logo { width: 72px; height: 72px; object-fit: contain; background: #fff; border-radius: 14px; border: 1px solid var(--borda); padding: 6px; }
.empresa { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--texto-2); font-weight: 700; }
.topo h1 { margin: 2px 0 4px; font-size: 1.6rem; }
.topo p { margin: 0; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.kpi { background: var(--branco); border: 1px solid var(--borda); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
.kpi span { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-2); font-weight: 600; }
.kpi strong { font-size: 1.7rem; font-variant-numeric: tabular-nums; }
.kpi em { font-style: normal; font-size: 0.78rem; color: var(--texto-2); }
.kpi.destaque { background: var(--laranja-claro); border-color: #f3d3a6; }
.bloco { margin-top: 14px; }
.bloco h2 { font-size: 1.05rem; margin: 0 0 10px; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.peca { display: flex; align-items: center; gap: 10px; }
.mini { width: 48px; height: 27px; border-radius: 5px; background: #1e1e1e; overflow: hidden; display: grid; place-items: center; color: #fff; font-size: 0.62rem; flex-shrink: 0; }
.mini img { width: 100%; height: 100%; object-fit: cover; }
.rodape-pub { margin-top: 18px; line-height: 1.5; }
.vazio-pub { text-align: center; padding: 40px; }
@media (max-width: 760px) { .kpis { grid-template-columns: 1fr 1fr; } .duas { grid-template-columns: 1fr; } }
</style>
