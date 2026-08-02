import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { useAuth } from '../components/AuthProvider';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Search, Image as ImageIcon } from 'lucide-react';

export default function Labels() {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [printQueue, setPrintQueue] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));
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

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 font-bold">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrintSingle = (product: Product) => {
    setPrintQueue([product]);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintAll = () => {
    setPrintQueue(filteredProducts);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto hide-on-print">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Etiket & QR Yazdırma</h1>
          <p className="text-gray-500 mt-1">Termal yazıcılar için ürün karekod etiketleri oluşturun.</p>
        </div>
        <button 
          onClick={handlePrintAll}
          disabled={filteredProducts.length === 0}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-colors font-bold shadow-lg shadow-blue-200"
        >
          <Printer className="w-5 h-5" />
          TÜMÜNÜ YAZDIR ({filteredProducts.length})
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Ürün adı veya SKU ile ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {loading ? (
            <p className="col-span-full text-center py-8 text-gray-400">Yükleniyor...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="col-span-full text-center py-8 text-gray-400">Ürün bulunamadı.</p>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="border border-gray-200 rounded-2xl p-4 flex flex-col items-center text-center bg-gray-50/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-24 h-24 mb-3 bg-white border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <h3 className="font-bold text-gray-900 text-sm line-clamp-2 mb-1 h-10">{product.name}</h3>
                <p className="text-blue-600 font-black mb-3">₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                <button 
                  onClick={() => handlePrintSingle(product)}
                  className="w-full mt-auto bg-gray-900 hover:bg-black text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Yazdır
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- PRINT ONLY CONTAINER --- */}
      <div className="print-only">
        {printQueue.map((product, index) => (
          <div key={`${product.id}-${index}`} className="label-container">
            <div className="label-header">
              <span className="label-brand">DEMİRKIRANLAR</span>
            </div>
            
            <div className="label-content">
              <div className="label-qr">
                <QRCodeSVG value={`${window.location.origin}/p/${product.id}`} size={80} level="M" includeMargin={false} />
                <span className="label-sku">{product.sku}</span>
              </div>
              
              <div className="label-info">
                <h2 className="label-name">{product.name}</h2>
                <div className="label-price-stock">
                  <span className="label-price">₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                  <span className="label-stock">Stok: {product.stock} {product.unit || 'Adet'}</span>
                </div>
              </div>

              {product.imageUrl && (
                 <div className="label-image">
                    <img src={product.imageUrl} alt="Ürün" />
                 </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
