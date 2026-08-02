import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, CheckSquare, Square, CheckCheck } from 'lucide-react';

export default function QRPrint() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'products'));
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(products.map(p => p.id)));
  const clearAll = () => setSelected(new Set());

  const printedProducts = printMode && selected.size > 0
    ? products.filter(p => selected.has(p.id))
    : products;

  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => window.print(), 200);
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header — hidden on print */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Raf Etiketleri (QR)</h1>
          <p className="text-gray-500 mt-1">
            Yazdırmak istediğiniz ürünleri seçin, ardından "Etiketleri Yazdır" butonuna tıklayın.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold shadow-lg shadow-blue-200 shrink-0"
        >
          <Printer className="w-5 h-5" />
          ETİKETLERİ YAZDIR {selected.size > 0 ? `(${selected.size} ürün)` : '(Tümü)'}
        </button>
      </div>

      {/* Selection panel — hidden on print */}
      <div className="print:hidden bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-gray-700 text-sm uppercase tracking-widest">
            Ürün Seçimi
            <span className="ml-2 text-blue-600">{selected.size > 0 ? `${selected.size} seçildi` : 'Seçim yok — tümü yazdırılır'}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-blue-600 border border-gray-200 px-3 py-1.5 rounded-xl hover:border-blue-300 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Tümünü Seç
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-red-600 border border-gray-200 px-3 py-1.5 rounded-xl hover:border-red-300 transition-colors"
            >
              Seçimi Temizle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {products.map(product => {
            const isSelected = selected.has(product.id);
            return (
              <button
                key={product.id}
                onClick={() => toggleSelect(product.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 text-blue-800'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isSelected
                  ? <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                  : <Square className="w-4 h-4 text-gray-300 shrink-0" />
                }
                <span className="truncate">{product.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Label grid */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-none print:shadow-none print:p-0 print:bg-transparent">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 print:gap-2 print:grid-cols-4">
          {printedProducts.map(product => (
            <div
              key={product.id}
              className="border-2 border-dashed border-gray-200 rounded-xl p-2 flex flex-col items-center justify-center gap-1 bg-white print:border-gray-300"
              style={{ width: '4cm', height: '6cm' }}
            >
              <QRCodeSVG
                value={`${window.location.origin}/p/${product.id}`}
                size={110}
                level="H"
              />
              <p className="text-center text-[9px] font-bold text-gray-800 leading-tight mt-1 px-1 break-words w-full">
                {product.name}
              </p>
              <p className="text-center text-[8px] text-gray-400 font-mono">{product.sku}</p>
              <p className="text-center text-[9px] font-black text-gray-900">
                ₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
