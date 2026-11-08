<template>
  <CrudPage
    recurso="motoristas"
    titulo="Motoristas"
    subtitulo="Parceiros com tablet no carro. O repasse do mês (fixo ou por hora de tela ligada) aparece no Financeiro."
    rotulo-novo="Novo motorista"
    :campos="campos"
    :padrao="{ status: 'ativo', nivel: 'bronze', repasse_fixo: 60, modelo_repasse: 'hora', valor_hora: 0.5 }"
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
  {
    key: 'modelo_repasse',
    label: 'Modelo de repasse',
    tipo: 'select',
    lista: true,
    opcoes: op(['hora', 'Por hora de tela ligada (recomendado)'], ['fixo', 'Fixo mensal']),
    celula: (v) => (v === 'hora' ? 'Por hora' : 'Fixo'),
  },
  { key: 'valor_hora', label: 'Valor por hora ligada (R$)', tipo: 'dinheiro', mostrarSe: (f) => f.modelo_repasse === 'hora', dica: 'Ex.: R$ 0,50/h × 10 h/dia × 26 dias = R$ 130/mês. Nível prata e ouro ganham bônus (Configurações).' },
  { key: 'repasse_fixo', label: 'Repasse fixo mensal (R$)', tipo: 'dinheiro', mostrarSe: (f) => f.modelo_repasse !== 'hora' },
  { key: 'nivel', label: 'Nível', tipo: 'select', lista: true, selo: (v) => NIVEL[v] ?? '', opcoes: op(['bronze', 'Bronze'], ['prata', 'Prata'], ['ouro', 'Ouro']) },
  { key: 'status', label: 'Status', tipo: 'select', lista: true, selo: corStatus, opcoes: op(['ativo', 'Ativo'], ['inativo', 'Inativo']) },
]
</script>
