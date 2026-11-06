<template>
  <CrudPage
    recurso="motoristas"
    titulo="Motoristas"
    subtitulo="Parceiros com tablet no carro. O repasse mensal aparece no Financeiro."
    rotulo-novo="Novo motorista"
    :campos="campos"
    :padrao="{ status: 'ativo', nivel: 'bronze', repasse_fixo: 60 }"
  />
</template>

<script setup lang="ts">
import CrudPage from '../components/CrudPage.vue'
import { corStatus, op, type Campo } from '../campos'

const NIVEL: Record<string, string> = { bronze: 'laranja', prata: '', ouro: 'verde' }
const campos: Campo[] = [
  { key: 'nome', label: 'Nome completo', obrigatorio: true, lista: true },
  { key: 'cpf', label: 'CPF' },
  { key: 'telefone', label: 'WhatsApp', tipo: 'telefone', lista: true },
  { key: 'pix', label: 'Chave Pix (para repasse)' },
  { key: 'veiculo', label: 'Veículo', lista: true, dica: 'Modelo e cor' },
  { key: 'placa', label: 'Placa', lista: true },
  { key: 'apps', label: 'Apps em que roda', dica: 'Ex.: Uber, 99, inDrive' },
  { key: 'repasse_fixo', label: 'Repasse fixo mensal (R$)', tipo: 'dinheiro', lista: true },
  { key: 'nivel', label: 'Nível', tipo: 'select', lista: true, selo: (v) => NIVEL[v] ?? '', opcoes: op(['bronze', 'Bronze'], ['prata', 'Prata'], ['ouro', 'Ouro']) },
  { key: 'status', label: 'Status', tipo: 'select', lista: true, selo: corStatus, opcoes: op(['ativo', 'Ativo'], ['inativo', 'Inativo']) },
]
</script>
