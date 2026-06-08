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
    }),
  )
}

export async function cacheDatasourceFile(file: File, filename = file.name): Promise<File> {
  const cachedFile = file.name === filename
    ? file
    : new File([file], filename, { type: file.type, lastModified: file.lastModified })

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
