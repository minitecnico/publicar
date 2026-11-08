import { padroesAudiencia, type PadroesAudiencia } from './audiencia'
import { carregarGrade, configCiclo, conflitos, lista, mascara, minutos, normalizar, ocupacao, segundosNoCiclo, type Janela, type TelaGrade } from './grade'

/** Audiência de uma tela (mesma metodologia de audiencia.ts). */
export function audienciaTela(t: Record<string, unknown>, p: PadroesAudiencia) {
  const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  const carro = t.tipo === 'carro'
  const pessoas = carro ? (n(t.corridas_dia) ?? p.carro.corridas) * (n(t.passageiros_corrida) ?? p.carro.passageiros) : n(t.fluxo_dia) ?? p.estabelecimento.fluxo
  const perm = n(t.permanencia_min) ?? (carro ? p.carro.permanencia : p.estabelecimento.permanencia)
  const horas = n(t.horas_operacao) ?? (carro ? p.carro.horas : p.estabelecimento.horas)
  const vis = carro ? p.carro.visibilidade : p.estabelecimento.visibilidade
  return { pessoas, horas, impPorExib: ((pessoas / Math.max(1, horas)) * perm * vis) / 60 }
}

/** Horas por dia cobertas pelas faixas (vazio = dia todo). */
function horasDasFaixas(h: Janela[]) {
  if (!h.length) return 24
  const total = h.reduce((s, j) => {
    const i = minutos(j.ini)
    const f = minutos(j.fim)
    return s + (f > i ? f - i : f === i ? 1440 : 1440 - i + f)
  }, 0)
  return Math.min(24, total / 60)
}

const normal = (s: unknown) => String(s || '').trim().toLowerCase()

/**
 * Completa os pacotes com as métricas de venda: telas incluídas, audiência, impactos/mês,
 * ocupação atual dessas telas e horários, preço sugerido (dinâmico) e CPM.
 */
export async function anexarMetricasPacotes(db: D1Database, tid: string, pacotes: Record<string, unknown>[]) {
  if (!pacotes.length) return
  const [padroes, ciclo, grade, telasRes] = await Promise.all([
    padroesAudiencia(db, tid),
    configCiclo(db, tid),
    carregarGrade(db, tid),
    db.prepare("SELECT * FROM telas WHERE tenant_id = ? AND status = 'ativa'").bind(tid).all<Record<string, unknown>>(),
  ])
  const telas = telasRes.results
  const hojeStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const vigentes = grade.campanhas.filter((c) => !c.fim || c.fim >= hojeStr)

  for (const p of pacotes) {
    const bairros = lista<string>(p.bairros).map(normal).filter(Boolean)
    const alvo = telas.filter((t) => (p.tipo_tela === 'todas' || t.tipo === p.tipo_tela) && (!bairros.length || bairros.includes(normal(t.bairro))))
    // o pacote visto como uma campanha, para medir ocupação e espaço livre
    const comoCampanha = normalizar({ ...p, id: -1, status: 'aguardando', telas_alvo: alvo.map((t) => t.id), inicio: hojeStr, fim: null })
    const m = mascara(comoCampanha)
    const posicoes = m.filter(Boolean).length || 1
    const telasGrade = alvo as unknown as TelaGrade[]
    const ocup = ocupacao(telasGrade, vigentes)
    let somaOcup = 0
    for (const t of telasGrade) {
      const v = ocup.get(t.id) || []
      for (let i = 0; i < 168; i++) if (m[i]) somaOcup += Math.min(1, v[i] / ciclo.capacidade)
    }
    const ocupacaoMedia = alvo.length ? somaOcup / (alvo.length * posicoes) : 0
    const lotadas = conflitos(comoCampanha, vigentes, telasGrade, ciclo.capacidade).length

    const dias = lista<number>(p.dias_semana).length || 7
    const diasMes = (dias * 30) / 7
    const horasFaixa = horasDasFaixas(lista<Janela>(p.horarios))
    const insercoes = Math.max(1, Math.min(5, Number(p.prioridade) || 1))
    let pessoasDia = 0
    let impactosMes = 0
    let exibicoesMes = 0
    for (const t of alvo) {
      const a = audienciaTela(t, padroes)
      pessoasDia += a.pessoas
      // exibições/dia = horas em que a tela roda na faixa × ciclos por hora × inserções
      const exibDia = ((Math.min(horasFaixa, a.horas) * 3600) / ciclo.ciclo) * insercoes
      exibicoesMes += exibDia * diasMes
      impactosMes += exibDia * a.impPorExib * diasMes
    }
    const base = Number(p.preco_base) || 0
    const preco = Number(p.dinamico) ? Math.round((base * (1 + 0.5 * ocupacaoMedia)) / 10) * 10 : base
    p.metricas = {
      telas: alvo.length,
      telas_ids: alvo.map((t) => t.id),
      bairros: [...new Set(alvo.map((t) => String(t.bairro || '').trim()).filter(Boolean))],
      pessoas_dia: Math.round(pessoasDia),
      exibicoes_mes: Math.round(exibicoesMes),
      impactos_mes: Math.round(impactosMes),
      ocupacao: Math.round(ocupacaoMedia * 100),
      telas_lotadas: lotadas,
      segundos: segundosNoCiclo(comoCampanha),
      preco_sugerido: preco,
      cpm: impactosMes ? Math.round((preco / impactosMes) * 1000 * 100) / 100 : null,
    }
  }
}

/** Pacotes sugeridos para começar (preços de exemplo: ajuste à sua praça). */
export function pacotesSugeridos(bairroPrincipal: string | null) {
  return [
    { nome: 'Cidade inteira', descricao: 'Todas as telas, o dia todo, todos os dias.', tipo_tela: 'todas', bairros: '[]', duracao: 15, prioridade: 1, dias_semana: '[]', horarios: '[]', preco_base: 600, dinamico: 1 },
    {
      nome: bairroPrincipal ? `Bairro: ${bairroPrincipal}` : 'Bairro',
      descricao: 'Telas de um bairro: ideal para o comércio local. Edite para escolher os bairros.',
      tipo_tela: 'todas',
      bairros: JSON.stringify(bairroPrincipal ? [bairroPrincipal] : []),
      duracao: 15,
      prioridade: 1,
      dias_semana: '[]',
      horarios: '[]',
      preco_base: 300,
      dinamico: 1,
    },
    {
      nome: 'Horário nobre',
      descricao: 'Almoço e fim de tarde, quando há mais gente na rua, com o dobro de inserções.',
      tipo_tela: 'todas',
      bairros: '[]',
      duracao: 15,
      prioridade: 2,
      dias_semana: '[]',
      horarios: JSON.stringify([{ ini: '11:00', fim: '14:00' }, { ini: '17:00', fim: '21:00' }]),
      preco_base: 450,
      dinamico: 1,
    },
  ]
}
