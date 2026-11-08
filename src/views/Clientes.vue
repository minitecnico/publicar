<template>
  <CrudPage
    recurso="clientes"
    titulo="Clientes"
    subtitulo="Anunciantes e estabelecimentos. A mensalidade gera a fatura automática na Cobrança."
    rotulo-novo="Novo cliente"
    :campos="campos"
    :padrao="{ tipo: 'anunciante', status: 'ativo', dia_vencimento: 10, valor_mensal: 0, modulos: [] }"
  >
    <template #acoes="{ linha }">
      <button class="btn pequeno" title="Link do portal: o cliente vê campanhas, envia artes e paga" @click="portal(linha)"><Icone nome="link" :tamanho="14" /> Portal</button>
      <button v-if="linha.token_portal" class="btn pequeno fantasma perigo" title="O link atual deixa de funcionar" @click="revogar(linha)">Revogar</button>
    </template>
  </CrudPage>
</template>

<script setup lang="ts">
import { api } from '../api'
import CrudPage from '../components/CrudPage.vue'
import Icone from '../components/Icone.vue'
import { avisar, erro } from '../toast'

/** Portal do anunciante: link exclusivo (sem senha). Copia e abre a conversa no WhatsApp do cliente. */
async function portal(l: Record<string, any>) {
  try {
    const { token } = await api.post<{ token: string }>(`/clientes/${l.id}/portal`)
    l.token_portal = token
    const url = `${location.origin}/portal/${token}`
    try { await navigator.clipboard.writeText(url) } catch { /* sem permissão de cópia */ }
    const fone = String(l.telefone || '').replace(/\D/g, '')
    if (fone && confirm('Link copiado. Enviar agora pelo WhatsApp do cliente?')) {
      const n = fone.length <= 11 ? `55${fone}` : fone
      window.open(`https://wa.me/${n}?text=${encodeURIComponent(`Olá, ${l.contato || l.nome}! Este é o seu portal de anunciante: acompanhe suas campanhas, envie artes novas e pague suas faturas. ${url}`)}`, '_blank', 'noopener')
    } else avisar('Link do portal copiado')
  } catch (e) {
    erro(e)
  }
}
async function revogar(l: Record<string, any>) {
  if (!confirm(`Revogar o portal de ${l.nome}? O link atual deixa de funcionar.`)) return
  try {
    await api.del(`/clientes/${l.id}/portal`)
    l.token_portal = null
    avisar('Portal revogado')
  } catch (e) {
    erro(e)
  }
}
import { corStatus, op, type Campo } from '../campos'

const PLANOS = op(
  ['', '— sem plano —'],
  ['Teste 15 dias', 'Teste 15 dias (R$ 190)'],
  ['Bairro', 'Bairro — 10 carros (R$ 390)'],
  ['Cidade', 'Cidade — 30 carros (R$ 990)'],
  ['Destaque', 'Destaque — 30 carros, 30 s (R$ 1.690)'],
  ['Start', 'Start — 1 tela (R$ 59)'],
  ['Pro', 'Pro — até 3 telas (R$ 119)'],
  ['Parceiro', 'Parceiro da rede (R$ 0)'],
  ['Personalizado', 'Personalizado'],
)

const campos: Campo[] = [
  { key: 'nome', label: 'Nome / razão social', obrigatorio: true, lista: true },
  { key: 'tipo', label: 'Tipo', tipo: 'select', lista: true, opcoes: op(['anunciante', 'Anunciante'], ['estabelecimento', 'Estabelecimento (tem tela)'], ['ambos', 'Anunciante e estabelecimento']) },
  { key: 'documento', label: 'CPF / CNPJ' },
  { key: 'segmento', label: 'Segmento', dica: 'Ex.: barbearia, padaria, clínica, academia' , lista: true },
  { key: 'contato', label: 'Pessoa de contato' },
  { key: 'telefone', label: 'WhatsApp', tipo: 'telefone', lista: true, dica: 'Com DDD. Usado na cobrança por WhatsApp.' },
  { key: 'email', label: 'E-mail', tipo: 'email' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'endereco', label: 'Endereço', inteira: true },
  { key: 'plano', label: 'Plano', tipo: 'select', opcoes: PLANOS, lista: true },
  { key: 'valor_mensal', label: 'Mensalidade (R$)', tipo: 'dinheiro', lista: true },
  { key: 'dia_vencimento', label: 'Dia de vencimento', tipo: 'numero' },
  {
    key: 'modulos',
    label: 'Módulos ativos para este cliente',
    tipo: 'checks',
    opcoes: op(['mobilidade', 'Mídia em carros'], ['tela', 'Central multimídia'], ['fila', 'Fila de atendimento'], ['cardapio', 'Cardápio digital'], ['senha', 'Chamada de senha'], ['relatorios', 'Relatório mensal']),
  },
  { key: 'status', label: 'Status', tipo: 'select', lista: true, selo: corStatus, opcoes: op(['ativo', 'Ativo'], ['pausado', 'Pausado'], ['cancelado', 'Cancelado']) },
  { key: 'observacoes', label: 'Observações', tipo: 'textarea' },
]
</script>
