import type { StateStorage } from 'zustand/middleware'
import { encryptString, decryptString } from './device-crypto'

// Async zustand `StateStorage` that transparently encrypts persisted values at
// rest using the device-bound key (see device-crypto.ts). zustand/persist fully
// supports async storage, so getItem/setItem may return promises.
//
// Values are stored as `enc:v1:<iv.ct>`. On read we detect the prefix: encrypted
// values are decrypted; anything else is treated as legacy plaintext and passed
// through unchanged (so existing users' caches survive the upgrade and get
// re-written encrypted on the next persist). If decryption fails (e.g. the
// device key was cleared), we drop the entry rather than crash hydration.

const ENC_PREFIX = 'enc:v1:'

// Per-key write serialization. Because encryption is async, two setItem calls
// for the same key can have their encrypt() promises resolve OUT OF ORDER — a
// stale earlier snapshot could then land in localStorage after a newer one,
// silently dropping the most recent change (e.g. a just-appended report). We
// chain each key's writes so they apply strictly in call order: the newest
// snapshot issued always wins. Each link captures its value, so if several
// writes queue up they still encrypt/store in the order they were requested.
const writeChains = new Map<string, Promise<void>>()

export function createEncryptedStorage(): StateStorage {
  return {
    getItem: async (name) => {
      let raw: string | null
      try { raw = localStorage.getItem(name) } catch { return null }
      if (raw == null) return null
      if (!raw.startsWith(ENC_PREFIX)) return raw // legacy plaintext passthrough
      try {
        return await decryptString(raw.slice(ENC_PREFIX.length))
      } catch {
        // Key missing/rotated or ciphertext corrupt — treat as no data.
        try { localStorage.removeItem(name) } catch { /* noop */ }
        return null
      }
    },
    setItem: (name, value) => {
      const prev = writeChains.get(name) ?? Promise.resolve()
      const next = prev
        .catch(() => { /* isolate: a failed prior write must not break the chain */ })
        .then(async () => {
          let payload: string
          try {
            payload = ENC_PREFIX + (await encryptString(value))
          } catch {
            // Encryption unavailable → fail closed: never persist the sensitive
            // corpus in plaintext. Data stays in memory for the session only.
            console.warn(`[encrypted-storage] encryption unavailable; skipped persisting ${name}`)
            return
          }
          try {
            localStorage.setItem(name, payload)
          } catch (err) {
            console.warn('[encrypted-storage] setItem failed', name, err)
          }
        })
      writeChains.set(name, next)
      // Prune the chain reference once settled so the map doesn't grow unbounded.
      next.finally(() => { if (writeChains.get(name) === next) writeChains.delete(name) })
      return next
    },
    removeItem: (name) => {
      // Sequence removal behind any pending writes so it can't be overtaken.
      const prev = writeChains.get(name) ?? Promise.resolve()
      const next = prev
        .catch(() => { /* ignore prior write failure */ })
        .then(() => { try { localStorage.removeItem(name) } catch { /* noop */ } })
      writeChains.set(name, next)
      next.finally(() => { if (writeChains.get(name) === next) writeChains.delete(name) })
      return next
    },
  }
}
