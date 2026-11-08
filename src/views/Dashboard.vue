<template>
  <div>
    <div class="cabecalho-pagina">
      <div>
        <h1>Olá, {{ primeiroNome }}</h1>
        <p>Resumo da operação em {{ hojeFmt }}.</p>
      </div>
      <div class="barra-ferramentas">
        <RouterLink to="/campanhas" class="btn destaque"><Icone nome="mais" /> Nova campanha</RouterLink>
      </div>
    </div>

    <div class="grade-cards">
      <div class="cartao pad stat">
        <span>Exibições hoje</span>
        <strong>{{ numero(d.exibicoes_hoje) }}</strong>
      </div>
      <div class="cartao pad stat">
        <span>Telas online</span>
        <strong>{{ d.telas_online || 0 }} <small>/ {{ d.telas || 0 }}</small></strong>
      </div>
      <div class="cartao pad stat">
        <span>Campanhas no ar</span>
        <strong>{{ d.campanhas || 0 }}</strong>
      </div>
      <div class="cartao pad stat">
        <span>Receita recorrente</span>
        <strong>{{ moeda(d.receita_recorrente) }}</strong>
        <em>{{ d.clientes || 0 }} clientes ativos</em>
      </div>
      <div class="cartao pad stat">
        <span>Recebido no mês</span>
        <strong>{{ moeda(d.recebido_mes) }}</strong>
      </div>
      <div class="cartao pad stat" :class="{ alerta: d.vencido > 0 }">
        <span>A receber</span>
        <strong>{{ moeda(d.a_receber) }}</strong>
        <em v-if="d.vencido > 0">{{ moeda(d.vencido) }} vencido</em>
      </div>
    </div>

    <div class="duas-colunas secao">
      <div class="cartao pad">
        <h2>Exibições nos últimos 7 dias</h2>
        <p class="mudo pequeno" style="margin: 4px 0 10px">Prova de exibição enviada pelas telas.</p>
        <BarrasDias :serie="d.serie_7dias || []" titulo="Exibições por dia" />
      </div>
      <div class="cartao pad">
        <h2>Pendências</h2>
        <ul class="pendencias">
          <li v-if="aguardando">
            <span class="selo laranja">{{ aguardando }}</span> campanha(s) aguardando aprovação
            <RouterLink to="/campanhas">Revisar</RouterLink>
          </li>
          <li v-if="offline">
            <span class="selo vermelho">{{ offline }}</span> tela(s) sem sinal há mais de 25 min
            <RouterLink to="/telas">Ver telas</RouterLink>
          </li>
          <li v-if="d.vencido > 0">
            <span class="selo vermelho">{{ moeda(d.vencido) }}</span> em faturas vencidas
            <RouterLink to="/cobranca">Cobrar</RouterLink>
          </li>
          <li v-if="!aguardando && !offline && !(d.vencido > 0)" class="mudo">Tudo em dia.</li>
        </ul>
        <div v-if="!d.telas" class="primeiros-passos">
          <h3>Primeiros passos</h3>
          <ol>
            <li><RouterLink to="/clientes">Cadastre um cliente</RouterLink></li>
            <li><RouterLink to="/telas">Crie uma tela</RouterLink> e abra o player no tablet</li>
            <li><RouterLink to="/campanhas">Suba uma campanha</RouterLink> e aprove</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import { sessao } from '../auth'
import BarrasDias from '../components/BarrasDias.vue'
import Icone from '../components/Icone.vue'
import { moeda, numero, online } from '../format'
import { erro } from '../toast'

const d = ref<Record<string, any>>({})
const aguardando = ref(0)
const offline = ref(0)
const primeiroNome = computed(() => (sessao.usuario?.nome || '').split(' ')[0])
const hojeFmt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

onMounted(async () => {
  try {
    const [dash, camps, telas] = await Promise.all([api.get('/dashboard'), api.get('/campanhas'), api.get('/telas')])
    d.value = dash
    aguardando.value = camps.filter((c: any) => c.status === 'aguardando').length
    offline.value = telas.filter((t: any) => t.status === 'ativa' && !online(t.ultimo_ping)).length
  } catch (e) {
    erro(e)
  }
})
</script>

<style scoped>
.stat span { display: block; font-size: 0.82rem; color: var(--texto-2); font-weight: 550; }
.stat strong { display: block; font-size: 1.6rem; font-weight: 700; margin-top: 6px; font-variant-numeric: tabular-nums; }
.stat strong small { font-size: 0.95rem; color: var(--texto-2); font-weight: 500; }
.stat em { display: block; font-style: normal; font-size: 0.8rem; color: var(--texto-2); margin-top: 2px; }
.stat.alerta em { color: var(--vermelho); font-weight: 600; }
.duas-colunas { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }
.pendencias { list-style: none; padding: 0; margin: 12px 0 0; display: flex; flex-direction: column; gap: 10px; }
.pendencias li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pendencias a { margin-left: auto; font-size: 0.85rem; font-weight: 600; }
.primeiros-passos { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--borda); }
.primeiros-passos ol { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
@media (max-width: 900px) { .duas-colunas { grid-template-columns: 1fr; } }
</style>
