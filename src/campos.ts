export type TipoCampo =
  | 'texto'
  | 'numero'
  | 'dinheiro'
  | 'data'
  | 'select'
  | 'textarea'
  | 'relacao'
  | 'cor'
  | 'midia'
  | 'telas'
  | 'conteudo'
  | 'checks'
  | 'telefone'
  | 'email'

export interface Opcao {
  valor: string
  rotulo: string
}

export interface Campo {
  key: string
  label: string
  tipo?: TipoCampo
  opcoes?: Opcao[]
  /** recurso usado em selects de relação (clientes, motoristas, telas) */
  relacao?: 'clientes' | 'motoristas' | 'telas'
  /** filtro opcional para a relação */
  filtroRelacao?: (r: Record<string, any>) => boolean
  /** aparece como coluna na tabela */
  lista?: boolean
  obrigatorio?: boolean
  dica?: string
  inteira?: boolean
  mostrarSe?: (form: Record<string, any>) => boolean
  /** formatação da célula na tabela */
  celula?: (valor: any, linha: Record<string, any>, rel: Record<string, Record<number, Record<string, any>>>) => string
  /** classe do selo na tabela, se o campo deve aparecer como selo */
  selo?: (valor: any) => string
}

export const op = (...pares: [string, string][]): Opcao[] => pares.map(([valor, rotulo]) => ({ valor, rotulo }))

export const STATUS_COR: Record<string, string> = {
  ativo: 'verde',
  ativa: 'verde',
  paga: 'verde',
  aguardando: 'laranja',
  aberta: 'laranja',
  rascunho: '',
  pausado: '',
  pausada: '',
  encerrada: '',
  cancelado: 'vermelho',
  cancelada: 'vermelho',
  inativa: 'vermelho',
  inativo: 'vermelho',
}
export const corStatus = (v: any) => STATUS_COR[String(v)] ?? ''
