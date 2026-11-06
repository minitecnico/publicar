<template>
  <CrudPage
    recurso="clientes"
    titulo="Clientes"
    subtitulo="Anunciantes e estabelecimentos. A mensalidade gera a fatura automática na Cobrança."
    rotulo-novo="Novo cliente"
    :campos="campos"
    :padrao="{ tipo: 'anunciante', status: 'ativo', dia_vencimento: 10, valor_mensal: 0, modulos: [] }"
  />
</template>

<script setup lang="ts">
import CrudPage from '../components/CrudPage.vue'
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
