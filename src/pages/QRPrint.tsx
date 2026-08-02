import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';

export default function QRPrint() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Raf Etiketleri (QR)</h1>
          <p className="text-gray-500 mt-1">4x6 cm formatında raf etiketlerini yazdırın.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold shadow-lg shadow-blue-200"
        >
          <Printer className="w-5 h-5" />
          ETİKETLERİ YAZDIR
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 print:border-none print:shadow-none print:p-0 print:bg-transparent">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 print:gap-2 print:grid-cols-4">
          {products.map(product => (
            <div key={product.id} className="border-2 border-dashed border-gray-200 rounded-xl p-2 flex flex-col items-center justify-center bg-white relative overflow-hidden" style={{ width: '4cm', height: '6cm' }}>
              <div className="flex flex-col items-center">
                <QRCodeSVG value={`${window.location.origin}/p/${product.id}`} size={120} level="H" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
