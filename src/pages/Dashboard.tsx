import React, { useEffect, useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Sale } from '../types';
import { getProducts, getSales, setSalesCache } from '../lib/cache';
import { format, isToday, isThisMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Trash2, ShoppingBag, Clock, CreditCard, Banknote, ChevronDown, ChevronUp, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../components/AuthProvider';

// Skeleton pulse block
const Sk = ({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) => (
  <div className={`${w} ${h} bg-gray-200 rounded-xl animate-pulse`} />
);

export default function Dashboard() {
  const { role } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);

  const fetchData = async (force = false) => {
    try {
      const [salesData, productsData] = await Promise.all([
        getSales(force),
        getProducts(force),
      ]);
      setSales(salesData);
      setProducts(productsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const todaySales = sales.filter(s => isToday(parseISO(s.createdAt)));
  const monthSales = sales.filter(s => isThisMonth(parseISO(s.createdAt)));

  const dailyTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const monthlyTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cashTotal = monthSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
  const creditTotal = monthSales.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);

  const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert);

  const salesByDay = monthSales.reduce((acc, sale) => {
    const day = format(parseISO(sale.createdAt), 'dd MMM', { locale: tr });
    acc[day] = (acc[day] || 0) + sale.totalAmount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(salesByDay).map(([date, total]) => ({ date, total })).reverse();

  const handleExport = () => {
    const exportData = sales.map(s => ({
      'Tarih': format(parseISO(s.createdAt), 'dd.MM.yyyy HH:mm'),
      'Toplam Tutar (TL)': s.totalAmount,
      'Ödeme Yöntemi': s.paymentMethod === 'cash' ? 'Nakit' : 'Kredi Kartı',
      'Satılan Ürünler': s.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Satışlar");
    XLSX.writeFile(wb, `Satis_Raporu_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm('Bu satışı silmek istediğinize emin misiniz?')) return;
    setDeletingId(saleId);
    try {
      await deleteDoc(doc(db, 'sales', saleId));
      const updated = sales.filter(s => s.id !== saleId);
      setSales(updated);
      setSalesCache(updated); // keep cache in sync
    } catch (err) {
      console.error(err);
      alert('Satış silinirken hata oluştu.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <Sk w="w-40" h="h-8" />
        <Sk w="w-36" h="h-10" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 space-y-3">
            <Sk w="w-24" h="h-3" />
            <Sk w="w-32" h="h-7" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 p-6 h-72 flex items-center justify-center">
          <Sk w="w-full" h="h-full" />
        </div>
        <div className="lg:col-span-4 bg-gray-50 rounded-3xl border border-gray-100 p-6 h-72 space-y-3">
          {[...Array(5)].map((_, i) => <Sk key={i} h="h-8" />)}
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4">
        {[...Array(4)].map((_, i) => <Sk key={i} h="h-16" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={handleExport}
          className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors font-bold text-sm"
        >
          <Download className="w-4 h-4" />
          EXCEL DIŞA AKTAR
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-2">GÜNLÜK KAZANÇ</p>
          <p className="text-2xl font-black text-gray-900">₺{dailyTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">{todaySales.length} satış</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-2">AYLIK KAZANÇ</p>
          <p className="text-2xl font-black text-green-600">₺{monthlyTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">{monthSales.length} satış</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-2">AYLIK NAKİT</p>
          <p className="text-2xl font-black text-blue-600">₺{cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-200">
          <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mb-2">AYLIK K. KARTI</p>
          <p className="text-2xl font-black text-purple-600">₺{creditTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Chart + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-72 flex flex-col">
          <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-4">AYLIK SATIŞ GRAFİĞİ</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₺${val}`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip formatter={(val: number) => [`₺${val.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, 'Satış']} />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} dot={{ r: 3, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-orange-50 p-6 rounded-3xl border border-orange-100 overflow-hidden flex flex-col h-72">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-orange-700 font-bold text-xs uppercase tracking-widest">AZALAN ÜRÜNLER</h4>
            <span className="flex items-center text-red-600 font-bold bg-red-100 px-3 py-1 rounded-full text-xs animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5"></span>
              {lowStockProducts.length} Kritik
            </span>
          </div>
          <div className="flex-1 overflow-auto space-y-2 pr-1">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.map(p => (
                <div key={p.id} className="flex justify-between text-sm py-2 border-b border-orange-100/50">
                  <span className="text-orange-900 truncate mr-2" title={p.name}>{p.name}</span>
                  <span className="font-bold text-red-600 whitespace-nowrap">Kalan: {p.stock}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-orange-400 py-8 text-sm font-medium">Kritik stok seviyesinde ürün bulunmuyor.</div>
            )}
          </div>
        </div>
      </div>

      {/* Sales History - full list with delete */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Satış Geçmişi</h2>
            <p className="text-sm text-gray-400 mt-0.5">Tüm satışlar — ürün detayı, saat ve ödeme yöntemi</p>
          </div>
          <span className="bg-blue-50 text-blue-600 font-bold text-sm px-4 py-1.5 rounded-full">{sales.length} Satış</span>
        </div>

        {sales.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Henüz satış kaydı bulunmuyor.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sales.map(sale => {
              const saleDate = parseISO(sale.createdAt);
              const isExpanded = expandedSale === sale.id;
              const isCash = sale.paymentMethod === 'cash';

              return (
                <div key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Sale row */}
                  <div className="px-6 py-4 flex items-center gap-4">
                    {/* Payment icon */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isCash ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {isCash
                        ? <Banknote className="w-5 h-5 text-green-600" />
                        : <CreditCard className="w-5 h-5 text-blue-600" />
                      }
                    </div>

                    {/* Date + time + staff */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">
                          {isToday(saleDate)
                            ? 'Bugün'
                            : format(saleDate, 'd MMMM yyyy', { locale: tr })}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {format(saleDate, 'HH:mm')}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCash ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isCash ? 'Nakit' : 'Kredi Kartı'}
                        </span>
                        {/* Staff badge */}
                        {sale.createdByName && (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            <User className="w-3 h-3" />
                            {sale.createdByName}
                          </span>
                        )}
                      </div>
                      {/* Product summary */}
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {sale.items.map(i => `${i.name} ×${i.quantity}`).join(' · ')}
                      </p>
                    </div>

                    {/* Total */}
                    <div className="text-right shrink-0">
                      <p className="font-black text-gray-900">₺{sale.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-400">{sale.items.reduce((s, i) => s + i.quantity, 0)} ürün</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setExpandedSale(isExpanded ? null : sale.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Detay"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {role === 'admin' && (
                        <button
                          onClick={() => handleDeleteSale(sale.id!)}
                          disabled={deletingId === sale.id}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                          title="Satışı Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded product details */}
                  {isExpanded && (
                    <div className="px-6 pb-4">
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        {/* Staff info */}
                        {(sale.createdByName || sale.createdByEmail) && (
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                            <div className="w-7 h-7 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 font-medium">Personel</p>
                              <p className="text-sm font-bold text-gray-800">{sale.createdByName || '—'}</p>
                              {sale.createdByEmail && (
                                <p className="text-xs text-gray-400">{sale.createdByEmail}</p>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Satılan Ürünler</p>
                        <div className="space-y-2">
                          {sale.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                                  {item.quantity}
                                </span>
                                <span className="font-medium text-gray-800">{item.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-gray-900">₺{(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                <span className="text-gray-400 text-xs ml-1">(₺{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} × {item.quantity})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between items-center">
                          <span className="text-xs text-gray-400 font-medium">TOPLAM</span>
                          <span className="font-black text-gray-900">₺{sale.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
