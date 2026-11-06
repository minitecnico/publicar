#!/usr/bin/env node
/**
 * Provisiona a infraestrutura do Publicar na Cloudflare (plano grátis) e gera o wrangler.toml.
 *
 * - Cria o banco D1 "publicar-db" se não existir
 * - Cria o namespace KV "publicar-media" se não existir (mídias, sem cartão de crédito)
 * - Opcional: cria o bucket R2 "publicar-media" (USE_R2=true; exige cartão cadastrado)
 * - Cria o projeto Pages (padrão "publicar" → publicar.pages.dev) se não existir
 * - Reescreve o wrangler.toml com os IDs reais
 *
 * É idempotente: pode rodar em todo deploy. Requer CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID.
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PROJETO = process.env.PAGES_PROJECT || 'publicar'
const BANCO = process.env.D1_NAME || 'publicar-db'
const KV = process.env.KV_TITLE || 'publicar-media'
const BUCKET = process.env.R2_BUCKET || 'publicar-media'
const USAR_R2 = String(process.env.USE_R2 || '').toLowerCase() === 'true'

for (const v of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
  if (!process.env[v]) {
    console.error(`✖ Falta a variável ${v}. Configure em GitHub → Settings → Secrets and variables → Actions.`)
    process.exit(1)
  }
}

function wrangler(args, { ignorarErro = false } = {}) {
  try {
    return execSync(`npx wrangler ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    const saida = `${e.stdout || ''}${e.stderr || ''}`
    if (ignorarErro) return saida
    console.error(saida)
    throw e
  }
}

/** Extrai o primeiro array JSON da saída do wrangler (ele às vezes imprime avisos antes). */
function json(saida) {
  // ignora linhas de aviso como "▲ [WARNING] ..." e acha o início real do array
  const inicio = saida.match(/^\s*\[\s*($|\{|\]|")/m)
  const i = inicio ? inicio.index + inicio[0].indexOf('[') : -1
  const j = saida.lastIndexOf(']')
  if (i < 0 || j < 0) throw new Error(`Saída inesperada do wrangler:\n${saida}`)
  return JSON.parse(saida.slice(i, j + 1))
}

// 1. D1
let banco = json(wrangler('d1 list --json')).find((d) => d.name === BANCO)
if (!banco) {
  console.log(`• Criando banco D1 "${BANCO}"…`)
  wrangler(`d1 create ${BANCO}`)
  banco = json(wrangler('d1 list --json')).find((d) => d.name === BANCO)
}
const bancoId = banco.uuid || banco.id
console.log(`✔ D1 ${BANCO}: ${bancoId}`)

// 2. KV
const acharKv = () => json(wrangler('kv namespace list')).find((n) => n.title === KV || n.title.endsWith(`-${KV}`))
let kv = acharKv()
if (!kv) {
  console.log(`• Criando namespace KV "${KV}"…`)
  wrangler(`kv namespace create ${KV}`)
  kv = acharKv()
}
console.log(`✔ KV ${KV}: ${kv.id}`)

// 3. R2 (opcional)
if (USAR_R2) {
  const r = wrangler(`r2 bucket create ${BUCKET}`, { ignorarErro: true })
  if (/already exists|já existe|10004/i.test(r) || /Created bucket/i.test(r)) console.log(`✔ R2 ${BUCKET}`)
  else console.log(`⚠ R2: ${r.trim().split('\n').pop()} (o sistema continua usando o KV)`)
}

// 4. Projeto Pages
const p = wrangler(`pages project create ${PROJETO} --production-branch main`, { ignorarErro: true })
if (/already exists|8000002/i.test(p)) console.log(`✔ Pages ${PROJETO} (já existia)`)
else if (/Successfully created/i.test(p)) console.log(`✔ Pages ${PROJETO} criado`)
else console.log(`ℹ Pages: ${p.trim().split('\n').slice(-2).join(' ')}`)

// 5. wrangler.toml
const toml = `# GERADO AUTOMATICAMENTE por scripts/provision.mjs no deploy. Não edite à mão no CI.
name = "${PROJETO}"
pages_build_output_dir = "dist"
compatibility_date = "2026-10-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "${BANCO}"
database_id = "${bancoId}"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "MEDIA_KV"
id = "${kv.id}"
${USAR_R2 ? `\n[[r2_buckets]]\nbinding = "MEDIA"\nbucket_name = "${BUCKET}"\n` : ''}`
writeFileSync('wrangler.toml', toml)
console.log('✔ wrangler.toml atualizado')
