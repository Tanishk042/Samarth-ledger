/**
 * Tiny IndexedDB queue used by the offline resilience demo.
 * No dependency, no service-worker state, survives reloads.
 */
const DB_NAME = 'samarth-ledger-offline'
const STORE = 'submissions'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    const request = fn(store)
    transaction.oncomplete = () => {
      db.close()
      resolve(request?.result)
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export function enqueue(item) {
  return tx('readwrite', (store) => store.put(item))
}

export function queueAll() {
  return tx('readonly', (store) => store.getAll())
}

export function dequeue(id) {
  return tx('readwrite', (store) => store.delete(id))
}

export function clearQueue() {
  return tx('readwrite', (store) => store.clear())
}

export const offlineSupported = typeof indexedDB !== 'undefined'
