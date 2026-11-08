/** Mesma metodologia de server/audiencia.ts, para prévias no painel. */
export interface PadroesAudiencia {
  carro: { corridas: number; passageiros: number; permanencia: number; horas: number; visibilidade: number }
  estabelecimento: { fluxo: number; permanencia: number; horas: number; visibilidade: number }
}

export const PADRAO_AUDIENCIA: PadroesAudiencia = {
  carro: { corridas: 15, passageiros: 1.4, permanencia: 20, horas: 10, visibilidade: 0.9 },
  estabelecimento: { fluxo: 120, permanencia: 15, horas: 10, visibilidade: 0.5 },
}

export function comPadrao(cfg: any): PadroesAudiencia {
  const c = cfg || {}
  return {
    carro: { ...PADRAO_AUDIENCIA.carro, ...limpo(c.carro) },
    estabelecimento: { ...PADRAO_AUDIENCIA.estabelecimento, ...limpo(c.estabelecimento) },
  }
}
const limpo = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== '' && v != null && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]))

const n = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))

/** Audiência estimada de uma tela (campos vazios usam os padrões). */
export function audienciaTela(t: Record<string, any>, p: PadroesAudiencia) {
  const carro = t.tipo === 'carro'
  const pessoas = carro
    ? (n(t.corridas_dia) ?? p.carro.corridas) * (n(t.passageiros_corrida) ?? p.carro.passageiros)
    : n(t.fluxo_dia) ?? p.estabelecimento.fluxo
  const permanencia = n(t.permanencia_min) ?? (carro ? p.carro.permanencia : p.estabelecimento.permanencia)
  const horas = n(t.horas_operacao) ?? (carro ? p.carro.horas : p.estabelecimento.horas)
  const vis = carro ? p.carro.visibilidade : p.estabelecimento.visibilidade
  const publico = ((pessoas / Math.max(1, horas)) * permanencia) / 60
  return { pessoas, permanencia, horas, vis, publico, impactosPorExibicao: publico * vis }
}
