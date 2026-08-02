import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { Package, ArrowLeft } from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'products', id)).then(docSnap => {
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        }
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">Yükleniyor...</div>;
  if (!product) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500 font-bold">Ürün bulunamadı!</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full mb-4">
        <Link to="/" className="inline-flex items-center text-gray-500 hover:text-gray-900 font-bold text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> Panele Dön
        </Link>
      </div>
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-32 h-32 object-contain bg-gray-50 rounded-3xl mx-auto shadow-md" />
        ) : (
          <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-blue-200">
            <Package className="w-10 h-10" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-black text-gray-900 leading-tight uppercase">{product.name}</h1>
          <p className="text-gray-500 font-mono mt-2 font-bold tracking-widest">{product.sku}</p>
        </div>
        <div className="py-6 border-y border-gray-100">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">GÜNCEL FİYAT</p>
          <p className="text-5xl font-black text-gray-900">
            ₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm font-bold text-gray-400 mt-2">Birim: {product.unit || 'Adet'}</p>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase">Son Güncelleme: {new Date(product.updatedAt || product.createdAt).toLocaleDateString('tr-TR')}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex justify-between items-center">
          <span className="font-bold text-gray-500 uppercase text-xs tracking-widest">Stok Durumu</span>
          <span className={`font-black text-lg ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {product.stock > 0 ? `${product.stock} ${product.unit || 'Adet'}` : 'Tükendi'}
          </span>
        </div>
      </div>
    </div>
  );
}
