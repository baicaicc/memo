/**
 * 云端存档接口的纯逻辑（MEMO-6）。存储与请求解析由 server/api/* 入口注入，便于单测。
 * 每个恢复码一条记录 profiles/<码>.json，存整份档案；写入时与已存档案合并，任一端都不会冲掉另一端的成绩。
 */
import { mergeProfiles, normalizeCode, sanitizeProfile, type Profile } from '../src/sync/profile'

/** 线上为 EdgeOne Makers Blob 存储（见 server/store.ts），测试用内存实现 */
export interface ProfileStore {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

const keyOf = (code: string) => `profiles/${code}.json`

interface StoredDoc {
  profile: Profile
  createdAt: number
  updatedAt: number
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** 只接受规范形态的码，避免同一档案出现多种写法的 key */
function parseCode(x: unknown): string | null {
  return typeof x === 'string' && normalizeCode(x) === x ? x : null
}

async function load(store: ProfileStore, code: string): Promise<StoredDoc | null> {
  const raw = await store.get(keyOf(code))
  if (!raw) return null
  try {
    const doc = JSON.parse(raw) as StoredDoc
    const profile = sanitizeProfile(doc.profile)
    return profile ? { ...doc, profile } : null
  } catch {
    return null
  }
}

export async function handleSync(store: ProfileStore, body: unknown, now = Date.now()): Promise<Response> {
  const b = (body ?? {}) as { code?: unknown; profile?: unknown }
  const code = parseCode(b.code)
  const incoming = sanitizeProfile(b.profile)
  if (!code || !incoming) return json({ error: 'bad_request' }, 400)

  const existing = await load(store, code)
  const profile = existing ? mergeProfiles(existing.profile, incoming) : incoming
  const doc: StoredDoc = { profile, createdAt: existing?.createdAt ?? now, updatedAt: now }
  await store.put(keyOf(code), JSON.stringify(doc))
  return json({ profile })
}

export async function handleProfile(store: ProfileStore, url: URL): Promise<Response> {
  const code = parseCode(url.searchParams.get('code'))
  if (!code) return json({ error: 'bad_request' }, 400)
  const doc = await load(store, code)
  if (!doc) return json({ error: 'not_found' }, 404)
  return json({ profile: doc.profile })
}

/** 存储暂时不可用时给前端明确的 503，前端会置为离线、下次再补传 */
export function storeUnavailable(): Response {
  return json({ error: 'store_unavailable' }, 503)
}

export function badRequest(): Response {
  return json({ error: 'bad_request' }, 400)
}
