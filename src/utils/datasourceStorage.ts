const DB_NAME = 'ashby-datasources'
const DB_VERSION = 1
const STORE_NAME = 'xlsx-files'

type StoredDatasource = {
  filename: string
  blob: Blob
  type: string
  lastModified: number
}

function openDatasourceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'filename' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open datasource storage.'))
  })
}

function runStoreOperation<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatasourceDb().then((db) =>
    new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Datasource storage request failed.'))
      transaction.oncomplete = () => db.close()
      transaction.onerror = () => {
        db.close()
        reject(transaction.error ?? new Error('Datasource storage transaction failed.'))
      }
      // e.g. QuotaExceededError aborts the transaction without a request error; don't leave the promise pending.
      transaction.onabort = () => {
        db.close()
        reject(transaction.error ?? new Error('Datasource storage transaction was aborted.'))
      }
    }),
  )
}

/**
 * Reads a file into memory within `timeoutMs`. A file picked from disk stays linked to the disk
 * file: once the workbook is saved again or locked (e.g. open in Excel) it can no longer be read.
 * An in-memory copy keeps working.
 */
export async function toMemoryFile(file: File, filename = file.name, timeoutMs = 15_000): Promise<File> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const buffer = await Promise.race([
      file.arrayBuffer(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Reading the file did not finish within ${timeoutMs / 1000} s.`)), timeoutMs)
      }),
    ])
    return new File([buffer], filename, { type: file.type, lastModified: file.lastModified })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Reads a datasource file into memory; if that fails, reads the copy from `fallback` (browser
 * storage) instead. Throws the first error when neither can be read.
 */
export async function readDatasourceWithFallback(file: File, fallback: () => Promise<File | undefined>, timeoutMs?: number): Promise<File> {
  try {
    return await toMemoryFile(file, file.name, timeoutMs)
  } catch (error) {
    const stored = await fallback().catch(() => undefined)
    if (!stored) throw error
    try {
      return await toMemoryFile(stored, file.name, timeoutMs)
    } catch {
      throw error
    }
  }
}

/** Stores the file (read into memory first) and returns the in-memory copy. */
export async function cacheDatasourceFile(file: File, filename = file.name): Promise<File> {
  const cachedFile = await toMemoryFile(file, filename)

  const entry: StoredDatasource = {
    filename,
    blob: cachedFile,
    type: cachedFile.type,
    lastModified: cachedFile.lastModified,
  }

  await runStoreOperation('readwrite', (store) => store.put(entry))
  return cachedFile
}

export async function getCachedDatasourceFile(filename: string): Promise<File | undefined> {
  const entry = await runStoreOperation<StoredDatasource | undefined>('readonly', (store) => store.get(filename))
  if (!entry) {
    return undefined
  }

  return new File([entry.blob], entry.filename, { type: entry.type, lastModified: entry.lastModified })
}

export async function clearCachedDatasourceFiles(): Promise<void> {
  await runStoreOperation('readwrite', (store) => store.clear())
}
