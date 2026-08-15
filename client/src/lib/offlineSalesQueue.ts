export type OfflineSaleKind = "checkout" | "quickCheckout";

export type OfflineSaleRecord = {
  clientReference: string;
  kind: OfflineSaleKind;
  input: Record<string, unknown>;
  queuedAt: number;
};

const DB_NAME = "al-hussam-erp-offline";
const STORE_NAME = "sales";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "clientReference" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline sales storage is unavailable."));
  });
}

export async function enqueueOfflineSale(kind: OfflineSaleKind, input: Record<string, unknown>) {
  const clientReference = typeof input.clientReference === "string" && input.clientReference ? input.clientReference : `offline-${Date.now()}-${crypto.randomUUID()}`;
  const record: OfflineSaleRecord = { clientReference, kind, input: { ...input, clientReference }, queuedAt: Date.now() };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Offline sale could not be queued."));
  });
  database.close();
  return record;
}

export async function listOfflineSales(): Promise<OfflineSaleRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  const database = await openDatabase();
  const records = await new Promise<OfflineSaleRecord[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as OfflineSaleRecord[]).sort((a, b) => a.queuedAt - b.queuedAt));
    request.onerror = () => reject(request.error || new Error("Offline sales could not be read."));
  });
  database.close();
  return records;
}

export async function removeOfflineSale(clientReference: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(clientReference);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Queued sale could not be removed."));
  });
  database.close();
}
