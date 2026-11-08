/**
 * Conteúdo automático leve para as telas (clima, cotações, manchetes locais e de esportes).
 *
 * O servidor busca as fontes (gratuitas, sem chave) e guarda o resultado no D1 (tabela settings),
 * renovando no máximo a cada 30 min por empresa (~48 gravações/dia). O player recebe tudo junto com a
 * programação, sem requisição extra, e guarda para tocar offline: poucos KB, quase nada de 4G.
 */

export interface Conteudo {
  atualizado_em: string
  cidade: string | null
  local?: { lat: number; lng: number; nome: string } | null
  clima?: {
    temp: number
    codigo: number
    dia: boolean
    dias: { data: string; max: number; min: number; chuva: number; codigo: number }[]
  } | null
  cotacao?: { moedas: { codigo: string; nome: string; valor: number; variacao: number }[] } | null
  noticias?: { titulo: string; fonte: string }[] | null
  esportes?: { titulo: string; fonte: string }[] | null
}

const VALIDADE_MS = 30 * 60 * 1000
const chave = (tid: string) => `conteudo:${tid}`
const tempo = () => AbortSignal.timeout(6000)

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: tempo(), headers: { 'User-Agent': 'Publicar-DOOH/1.0' } })
  if (!r.ok) throw new Error(`${r.status} em ${url}`)
  return r.json() as Promise<T>
}

/** Converte entidades HTML comuns dos títulos de RSS. */
const texto = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim()

/** Lê manchetes de um RSS do Google Notícias (o título vem como "Manchete - Fonte"). */
async function manchetes(url: string, max = 8) {
  const r = await fetch(url, { signal: tempo(), headers: { 'User-Agent': 'Publicar-DOOH/1.0' } })
  if (!r.ok) throw new Error(`${r.status} em RSS`)
  const xml = await r.text()
  const itens = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 25)
  const out: { titulo: string; fonte: string }[] = []
  const vistos = new Set<string>()
  for (const [, item] of itens) {
    const bruto = texto(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
    const fonte = texto(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '')
    const titulo = fonte && bruto.endsWith(` - ${fonte}`) ? bruto.slice(0, -(fonte.length + 3)) : bruto
    // manchete curta lê melhor na tela; descarta repetidas
    if (titulo.length < 25 || titulo.length > 140 || vistos.has(titulo)) continue
    vistos.add(titulo)
    out.push({ titulo, fonte })
    if (out.length >= max) break
  }
  return out
}

async function localizar(cidade: string) {
  const [nome, uf] = cidade.split(/\s*[-,/]\s*/)
  const r = await json<{ results?: { latitude: number; longitude: number; name: string; admin1?: string }[] }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=10&language=pt&countryCode=BR`,
  )
  const lista = r.results || []
  const UFS: Record<string, string> = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' }
  const estado = uf ? UFS[uf.toUpperCase()] || uf : null
  const achado = (estado && lista.find((l) => (l.admin1 || '').toLowerCase() === estado.toLowerCase())) || lista[0]
  return achado ? { lat: achado.latitude, lng: achado.longitude, nome: achado.name } : null
}

async function buscarTudo(cidade: string | null, anterior: Conteudo | null): Promise<Conteudo> {
  const novo: Conteudo = { atualizado_em: new Date().toISOString(), cidade, local: anterior?.cidade === cidade ? anterior?.local : null }
  if (cidade && !novo.local) novo.local = await localizar(cidade).catch(() => null)
  const loc = novo.local
  const [clima, cotacao, noticias, esportes] = await Promise.allSettled([
    loc
      ? json<{ current: { temperature_2m: number; weather_code: number; is_day: number }; daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[]; weather_code: number[] } }>(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=America%2FSao_Paulo&forecast_days=3`,
        ).then((r) => ({
          temp: Math.round(r.current.temperature_2m),
          codigo: r.current.weather_code,
          dia: r.current.is_day === 1,
          dias: r.daily.time.map((d, i) => ({
            data: d,
            max: Math.round(r.daily.temperature_2m_max[i]),
            min: Math.round(r.daily.temperature_2m_min[i]),
            chuva: r.daily.precipitation_probability_max[i] ?? 0,
            codigo: r.daily.weather_code[i],
          })),
        }))
      : Promise.reject(new Error('sem cidade')),
    json<Record<string, { bid: string; pctChange: string; name: string }>>('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL').then((r) => ({
      moedas: [
        { codigo: 'USD', nome: 'Dólar', valor: Number(r.USDBRL?.bid), variacao: Number(r.USDBRL?.pctChange) },
        { codigo: 'EUR', nome: 'Euro', valor: Number(r.EURBRL?.bid), variacao: Number(r.EURBRL?.pctChange) },
      ].filter((m) => Number.isFinite(m.valor) && m.valor > 0),
    })),
    cidade
      ? manchetes(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${cidade.split(/\s*[-,/]\s*/)[0]}" when:2d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`)
      : Promise.reject(new Error('sem cidade')),
    manchetes('https://news.google.com/rss/headlines/section/topic/SPORTS?hl=pt-BR&gl=BR&ceid=BR:pt-419'),
  ])
  // fonte que falhou mantém o último valor bom
  novo.clima = clima.status === 'fulfilled' ? clima.value : anterior?.clima ?? null
  novo.cotacao = cotacao.status === 'fulfilled' && cotacao.value.moedas.length ? cotacao.value : anterior?.cotacao ?? null
  novo.noticias = noticias.status === 'fulfilled' && noticias.value.length ? noticias.value : anterior?.noticias ?? null
  novo.esportes = esportes.status === 'fulfilled' && esportes.value.length ? esportes.value : anterior?.esportes ?? null
  return novo
}

/**
 * Devolve o conteúdo guardado. Se estiver velho, renova em segundo plano (a tela não espera);
 * na primeira vez, espera a busca (até ~6 s).
 */
export async function obterConteudo(db: D1Database, tid: string, cidade: string | null, emSegundoPlano: (p: Promise<unknown>) => void) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(chave(tid)).first<{ value: string }>()
  let atual: Conteudo | null = null
  try { atual = row ? JSON.parse(row.value) : null } catch { /* recomeça */ }
  const velho = !atual || atual.cidade !== cidade || Date.now() - Date.parse(atual.atualizado_em) > VALIDADE_MS
  if (!velho) return atual
  const renovar = buscarTudo(cidade, atual).then(async (novo) => {
    await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').bind(chave(tid), JSON.stringify(novo)).run()
    return novo
  })
  if (atual) {
    emSegundoPlano(renovar.catch(() => null))
    return atual
  }
  return renovar.catch(() => null)
}
