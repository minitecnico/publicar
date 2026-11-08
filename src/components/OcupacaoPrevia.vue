<template>
  <div class="previa-ocupacao" :class="estado">
    <template v-if="!r">
      <span class="mudo">Calculando disponibilidade…</span>
    </template>
    <template v-else>
      <div class="topo">
        <strong>{{ titulo }}</strong>
        <span class="mudo pequeno">
          Ocupa <strong>{{ r.segundos }}s</strong> de um ciclo de {{ r.ciclo }}s ({{ pct }}% de share) ·
          ≈ {{ porHora }} exibições por hora em cada tela
        </span>
      </div>
      <ul v-if="r.conflitos.length" class="conflitos">
        <li v-for="c in r.conflitos.slice(0, 6)" :key="c.tela">
          <strong>{{ c.tela }}</strong> — lotado {{ c.dia }} às {{ String(c.hora).padStart(2, '0') }}h ({{ c.livre }}s livres)
        </li>
        <li v-if="r.conflitos.length > 6" class="mudo">e mais {{ r.conflitos.length - 6 }} tela(s)</li>
      </ul>
      <p v-if="naoReserva" class="mudo pequeno nota">Rascunho e campanha encerrada não ocupam espaço. A checagem vale ao aprovar.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api } from '../api'

interface Resultado { ciclo: number; segundos: number; conflitos: { tela: string; dia: string; hora: number; livre: number }[] }
const props = defineProps<{ form: Record<string, any> }>()
const r = ref<Resultado | null>(null)

const naoReserva = computed(() => ['rascunho', 'encerrada'].includes(props.form.status))
const pct = computed(() => (r.value ? Math.round((r.value.segundos / r.value.ciclo) * 100) : 0))
const porHora = computed(() => {
  if (!r.value) return 0
  const ins = Math.max(1, Math.min(5, Math.round(Number(props.form.prioridade) || 1)))
  // no ciclo cheio, cada inserção aparece uma vez por ciclo
  return Math.round((3600 / r.value.ciclo) * ins)
})
const estado = computed(() => (!r.value ? '' : r.value.conflitos.length ? 'ruim' : 'bom'))
const titulo = computed(() =>
  !r.value ? '' : r.value.conflitos.length ? `Sem espaço em ${r.value.conflitos.length} tela(s)` : 'Cabe no inventário de todas as telas escolhidas',
)

let t: number | undefined
let seq = 0
watch(
  () => [props.form.id, props.form.duracao, props.form.prioridade, props.form.tipo_tela, props.form.telas_alvo, props.form.dias_semana, props.form.horarios, props.form.inicio, props.form.fim, props.form.status],
  () => {
    clearTimeout(t)
    t = window.setTimeout(async () => {
      const n = ++seq
      try {
        const res = await api.post<Resultado>('/campanhas/verificar', {
          id: props.form.id,
          duracao: props.form.duracao,
          prioridade: props.form.prioridade,
          tipo_tela: props.form.tipo_tela,
          telas_alvo: props.form.telas_alvo,
          dias_semana: props.form.dias_semana,
          horarios: props.form.horarios,
          inicio: props.form.inicio,
          fim: props.form.fim,
          status: naoReserva.value ? 'aguardando' : props.form.status,
        })
        if (n === seq) r.value = res
      } catch { /* prévia é só informativa */ }
    }, 400)
  },
  { deep: true, immediate: true },
)
onBeforeUnmount(() => clearTimeout(t))
</script>

<style scoped>
.previa-ocupacao { border: 1px solid var(--borda); border-radius: 8px; padding: 12px 14px; background: #fbfaf8; display: flex; flex-direction: column; gap: 6px; }
.previa-ocupacao.bom { border-color: #bfe3cb; background: var(--verde-claro); }
.previa-ocupacao.bom .topo > strong { color: var(--verde); }
.previa-ocupacao.ruim { border-color: #f1c5c0; background: var(--vermelho-claro); }
.previa-ocupacao.ruim .topo > strong { color: var(--vermelho); }
.topo { display: flex; flex-direction: column; gap: 2px; }
.conflitos { margin: 4px 0 0; padding-left: 18px; font-size: 0.88rem; }
.nota { margin: 0; }
</style>
