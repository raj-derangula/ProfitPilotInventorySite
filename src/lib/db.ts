/**
 * IndexedDB service layer for ProfitPilot.
 *
 * Stores: inventory, archive, sales, corrections
 * Migrates data from localStorage on first use.
 */

const DB_NAME = 'profitpilot';
const DB_VERSION = 1;

// --- Data Types ---

export interface InventoryItem {
  id: string;
  productName: string;
  category: string;
  sourcePlatform: string;
  pricePaid: string;
  costPrice?: string;
  quantity: string;
  originalQuantityPurchased: string;
  productImage?: string;
  visualDescription: string;
  aiConfidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderItem {
  productName: string;
  salePrice: string;
  quantitySold: string;
}

export interface SaleRecord {
  id: string;
  productsSold: SalesOrderItem[];
  dateOfSale: string; // ISO string
}

export interface AiCorrection {
  id: string;
  originalSuggestion: string;
  correctedValue: string;
  field: string;
  timestamp: string;
}

// --- DB Connection ---

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('inventory')) {
        db.createObjectStore('inventory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('archive')) {
        db.createObjectStore('archive', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('corrections')) {
        db.createObjectStore('corrections', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// --- Generic helpers ---

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function putManyInStore<T>(storeName: string, items: T[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteFromStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Public API ---

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Normalize legacy items from localStorage that lack new fields
function normalizeItem(item: any, genId = true): InventoryItem {
  return {
    id: item.id || (genId ? generateId() : ''),
    productName: item.productName || '',
    category: item.category || '',
    sourcePlatform: item.sourcePlatform || '',
    pricePaid: String(item.pricePaid ?? '0'),
    costPrice: item.costPrice ? String(item.costPrice) : undefined,
    quantity: String(item.quantity ?? '0'),
    originalQuantityPurchased: String(item.originalQuantityPurchased ?? item.quantity ?? '0'),
    productImage: item.productImage || undefined,
    visualDescription: item.visualDescription || '',
    aiConfidence: typeof item.aiConfidence === 'number' ? item.aiConfidence : 0,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function normalizeSale(sale: any): SaleRecord {
  return {
    id: sale.id || generateId(),
    productsSold: Array.isArray(sale.productsSold) ? sale.productsSold : [],
    dateOfSale: sale.dateOfSale
      ? (typeof sale.dateOfSale === 'string' ? sale.dateOfSale : new Date(sale.dateOfSale).toISOString())
      : new Date().toISOString(),
  };
}

// --- Migration from localStorage ---

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const migrated = localStorage.getItem('__profitpilot_migrated');
  if (migrated === '1') return;

  try {
    // Migrate inventory (productDetails)
    const invRaw = localStorage.getItem('productDetails');
    if (invRaw) {
      const items: any[] = JSON.parse(invRaw);
      if (Array.isArray(items)) {
        await putManyInStore('inventory', items.map(i => normalizeItem(i)));
      }
    }

    // Migrate archive (purchasedProducts)
    const archRaw = localStorage.getItem('purchasedProducts');
    if (archRaw) {
      const items: any[] = JSON.parse(archRaw);
      if (Array.isArray(items)) {
        await putManyInStore('archive', items.map(i => normalizeItem(i)));
      }
    }

    // Migrate sales
    const salesRaw = localStorage.getItem('sales');
    if (salesRaw) {
      const sales: any[] = JSON.parse(salesRaw);
      if (Array.isArray(sales)) {
        await putManyInStore('sales', sales.map(s => normalizeSale(s)));
      }
    }

    localStorage.setItem('__profitpilot_migrated', '1');
  } catch (e) {
    console.error('Migration from localStorage failed:', e);
  }
}

// Initialize: open DB and run migration
let initPromise: Promise<void> | null = null;

export function initDB(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await getDB();
    await migrateFromLocalStorage();
  })();
  return initPromise;
}

// --- Inventory ---

export async function getInventory(): Promise<InventoryItem[]> {
  await initDB();
  return getAllFromStore<InventoryItem>('inventory');
}

export async function putInventoryItem(item: InventoryItem): Promise<void> {
  await initDB();
  return putInStore('inventory', item);
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await initDB();
  return deleteFromStore('inventory', id);
}

export async function setInventory(items: InventoryItem[]): Promise<void> {
  await initDB();
  await clearStore('inventory');
  if (items.length > 0) {
    await putManyInStore('inventory', items);
  }
}

// --- Archive ---

export async function getArchive(): Promise<InventoryItem[]> {
  await initDB();
  return getAllFromStore<InventoryItem>('archive');
}

export async function putArchiveItem(item: InventoryItem): Promise<void> {
  await initDB();
  return putInStore('archive', item);
}

export async function deleteArchiveItem(id: string): Promise<void> {
  await initDB();
  return deleteFromStore('archive', id);
}

export async function setArchive(items: InventoryItem[]): Promise<void> {
  await initDB();
  await clearStore('archive');
  if (items.length > 0) {
    await putManyInStore('archive', items);
  }
}

// --- Sales ---

export async function getSales(): Promise<SaleRecord[]> {
  await initDB();
  return getAllFromStore<SaleRecord>('sales');
}

export async function putSale(sale: SaleRecord): Promise<void> {
  await initDB();
  return putInStore('sales', sale);
}

export async function deleteSale(id: string): Promise<void> {
  await initDB();
  return deleteFromStore('sales', id);
}

export async function setSales(sales: SaleRecord[]): Promise<void> {
  await initDB();
  await clearStore('sales');
  if (sales.length > 0) {
    await putManyInStore('sales', sales);
  }
}

// --- Corrections ---

export async function getCorrections(): Promise<AiCorrection[]> {
  await initDB();
  return getAllFromStore<AiCorrection>('corrections');
}

export async function addCorrection(correction: AiCorrection): Promise<void> {
  await initDB();
  return putInStore('corrections', correction);
}

export async function clearCorrections(): Promise<void> {
  await initDB();
  return clearStore('corrections');
}

// --- Helpers for backward compatibility ---
// These helpers produce summary text for the Gemini prompt context

export async function getItemHistorySummary(): Promise<string> {
  const archive = await getArchive();
  if (archive.length === 0) return 'No previous items in history.';

  // Group by category, limit to recent 100 items for token budget
  const recent = archive
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  const lines = recent.map(item => {
    const parts = [item.productName];
    if (item.category) parts.push(`[${item.category}]`);
    if (item.sourcePlatform) parts.push(`from ${item.sourcePlatform}`);
    return parts.join(' ');
  });

  return `User's item history (${archive.length} total, showing recent ${recent.length}):\n${lines.join('\n')}`;
}

export async function getRecentCorrections(): Promise<string> {
  const corrections = await getCorrections();
  if (corrections.length === 0) return '';

  const recent = corrections
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  const lines = recent.map(c =>
    `- Field "${c.field}": AI said "${c.originalSuggestion}" but correct was "${c.correctedValue}"`
  );

  return `Recent user corrections to AI suggestions:\n${lines.join('\n')}`;
}

// --- Export normalizeItem for use by other modules ---
export { normalizeItem, normalizeSale };
