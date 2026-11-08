/**
 * Pix "copia e cola" estático com valor (BR Code, padrão EMV do Banco Central).
 * Funciona em qualquer app de banco: lê a chave, o valor e o identificador da cobrança.
 */
const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`

/** Sem acentos e só caracteres aceitos pelo BR Code. */
const limpar = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim().slice(0, max).toUpperCase() || 'NA'

function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function pixCopiaECola(o: { chave: string; nome: string; cidade: string; valor: number; txid: string }) {
  const chave = o.chave.trim()
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave)
  const txid = o.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const payload =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (o.valor > 0 ? campo('54', o.valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(o.nome, 25)) +
    campo('60', limpar(o.cidade, 15)) +
    campo('62', campo('05', txid)) +
    '6304'
  return payload + crc16(payload)
}
