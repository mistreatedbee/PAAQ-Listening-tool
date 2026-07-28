// AES-256-GCM encryption for database connector secrets.
// The key lives only as the DB_CONNECTOR_ENCRYPTION_KEY edge function
// secret — Postgres itself never sees it, so a DB-level compromise alone
// can never decrypt a stored connection string.

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('DB_CONNECTOR_ENCRYPTION_KEY')
  if (!raw) throw new Error('DB_CONNECTOR_ENCRYPTION_KEY not set')
  const keyBytes = fromBase64(raw)
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { ciphertext: toBase64(new Uint8Array(cipherBuf)), iv: toBase64(iv) }
}

export async function decryptSecret(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey()
  const cipherBytes = fromBase64(ciphertext)
  const ivBytes = fromBase64(iv)
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipherBytes)
  return new TextDecoder().decode(plainBuf)
}

export type DisplayHint = { host: string | null; database: string | null; username: string | null }

/** Non-secret metadata extracted from a connection string, safe to store/show in plaintext. */
export function parseDisplayHint(_engine: string, connectionString: string): DisplayHint {
  try {
    const url = new URL(connectionString)
    const port = url.port ? `:${url.port}` : ''
    const host = url.hostname ? `${url.hostname}${port}` : null
    const database = url.pathname ? url.pathname.replace(/^\//, '') || null : null
    const username = url.username ? decodeURIComponent(url.username) : null
    return { host, database, username }
  } catch {
    return { host: null, database: null, username: null }
  }
}
