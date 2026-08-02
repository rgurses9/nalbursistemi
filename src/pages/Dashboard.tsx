import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Sale } from '../types';
import { format, isToday, isThisMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const salesQ = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
        const salesSnapshot = await getDocs(salesQ);
        const salesData = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
        setSales(salesData);

        const productsQ = query(collection(db, 'products'));
        const productsSnapshot = await getDocs(productsQ);
        const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        setProducts(productsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const todaySales = sales.filter(s => isToday(parseISO(s.createdAt)));
  const monthSales = sales.filter(s => isThisMonth(parseISO(s.createdAt)));

  const dailyTotal = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  const monthlyTotal = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cashTotal = monthSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
  const creditTotal = monthSales.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);

  const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert);

  // Group sales by day for chart
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

  if (loading) return <div className="p-8 text-center text-lg text-neutral-500">Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-gray-400 mb-2">
            <h3 className="font-bold text-xs uppercase tracking-widest">GÜNLÜK KAZANÇ</h3>
          </div>
          <p className="text-3xl font-black text-gray-900 mt-2">₺{dailyTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-gray-400 mb-2">
            <h3 className="font-bold text-xs uppercase tracking-widest">AYLIK KAZANÇ</h3>
          </div>
          <p className="text-3xl font-black text-green-600 mt-2">₺{monthlyTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-gray-400 mb-2">
            <h3 className="font-bold text-xs uppercase tracking-widest">AYLIK NAKİT</h3>
          </div>
          <p className="text-3xl font-black text-blue-600 mt-2">₺{cashTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-gray-400 mb-2">
            <h3 className="font-bold text-xs uppercase tracking-widest">AYLIK K. KARTI</h3>
          </div>
          <p className="text-3xl font-black text-purple-600 mt-2">₺{creditTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 h-96 flex flex-col">
          <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-6">AYLIK SATIŞ GRAFİĞİ</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₺${val}`} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '5 5' }} />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={4} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-orange-50 p-6 rounded-3xl border border-orange-100 overflow-hidden flex flex-col h-96">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-orange-700 font-bold text-xs uppercase tracking-widest">AZALAN ÜRÜNLER</h4>
            <span className="flex items-center text-red-600 font-bold bg-red-100 px-3 py-1 rounded-full text-xs animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5"></span>
              {lowStockProducts.length} Kritik
            </span>
          </div>
          
          <div className="flex-1 overflow-auto space-y-2 pr-2">
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
    </div>
  );
}
