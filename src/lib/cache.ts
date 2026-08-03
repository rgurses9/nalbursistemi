/**
 * Uygulama genelinde Firestore verilerini önbellekleyen basit bir store.
 * Sayfa geçişlerinde Firebase'e tekrar sorgu atmaz; veriler zaten bellekte.
 * Sadece açık gereksinim varsa (ürün eklendi, satış yapıldı vb.) invalidate edilir.
 */
import { collection, getDocs, orderBy, query, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { Product, Sale } from '../types';

type CacheEntry<T> = {
  data: T[];
  loadedAt: number;
  unsubscribe?: () => void;
};

const TTL = 5 * 60 * 1000; // 5 dakika

const cache: {
  products: CacheEntry<Product> | null;
  sales: CacheEntry<Sale> | null;
} = {
  products: null,
  sales: null,
};

// ─── Products ───────────────────────────────────────────────────────────────

export async function getProducts(forceRefresh = false): Promise<Product[]> {
  const now = Date.now();
  if (!forceRefresh && cache.products && now - cache.products.loadedAt < TTL) {
    return cache.products.data;
  }
  const snap = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
  cache.products = { data, loadedAt: now };
  return data;
}

export function invalidateProducts() {
  cache.products = null;
}

export function setProductsCache(data: Product[]) {
  cache.products = { data, loadedAt: Date.now() };
}

// ─── Sales ──────────────────────────────────────────────────────────────────

export async function getSales(forceRefresh = false): Promise<Sale[]> {
  const now = Date.now();
  if (!forceRefresh && cache.sales && now - cache.sales.loadedAt < TTL) {
    return cache.sales.data;
  }
  const snap = await getDocs(query(collection(db, 'sales'), orderBy('createdAt', 'desc')));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
  cache.sales = { data, loadedAt: now };
  return data;
}

export function invalidateSales() {
  cache.sales = null;
}

export function setSalesCache(data: Sale[]) {
  cache.sales = { data, loadedAt: Date.now() };
}
