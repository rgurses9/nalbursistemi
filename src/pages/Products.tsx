import React, { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { Plus, Edit2, Trash2, Search, X, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { getProducts, setProductsCache, invalidateProducts } from '../lib/cache';

const Sk = ({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) => (
  <div className={`${w} ${h} bg-gray-200 rounded-xl animate-pulse`} />
);

export default function Products() {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: '',
    stock: '',
    minStockAlert: '',
    category: '',
    unit: 'Adet',
    imageUrl: ''
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);


  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const base64 = await compressImage(file);
      setFormData(prev => ({ ...prev, imageUrl: base64 }));
    } catch (err) {
      console.error(err);
      alert('Görsel işlenirken bir hata oluştu.');
    } finally {
      setUploading(false);
    }
  };

  const fetchProducts = async (force = false) => {
    if (!force) setLoading(true);
    try {
      const data = await getProducts(force);
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [lastCategorizedName, setLastCategorizedName] = useState('');

  const handleAutoCategorize = async (nameOverride?: string) => {
    const nameToCategorize = typeof nameOverride === 'string' ? nameOverride : formData.name;
    if (!nameToCategorize || nameToCategorize === lastCategorizedName) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: nameToCategorize })
      });
      const data = await res.json();
      if (data.category) {
        setFormData(prev => ({ ...prev, category: data.category }));
        setLastCategorizedName(nameToCategorize);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };


  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setLastCategorizedName(product.name);
      setFormData({
        name: product.name,
        sku: product.sku,
        price: product.price.toString(),
        stock: product.stock.toString(),
        minStockAlert: product.minStockAlert.toString(),
        category: product.category || '',
        unit: product.unit || 'Adet',
        imageUrl: product.imageUrl || ''
      });
    } else {
      setEditingProduct(null);
      setLastCategorizedName('');
      // Generate sequential SKU starting from 1
      const generateSKU = () => {
        const numericSkus = products
          .map(p => parseInt(p.sku, 10))
          .filter(n => !isNaN(n));
        
        if (numericSkus.length === 0) return '1';
        return (Math.max(...numericSkus) + 1).toString();
      };
      setFormData({ name: '', sku: generateSKU(), price: '', stock: '', minStockAlert: '', category: '', unit: 'Adet', imageUrl: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct && editingProduct.price.toString() !== formData.price) {
      if (!window.confirm(`Fiyatı ${editingProduct.price}₺ den ${formData.price}₺ ye güncellemek istediğinize emin misiniz?`)) {
        return;
      }
    }

    const productData = {
      name: formData.name,
      sku: formData.sku,
      price: Number(formData.price),
      stock: Number(formData.stock),
      minStockAlert: Number(formData.minStockAlert),
      category: formData.category,
      unit: formData.unit,
      imageUrl: formData.imageUrl,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        // Optimistic cache update
        const updated = products.map(p => p.id === editingProduct.id ? { ...p, ...productData } : p);
        setProducts(updated);
        setProductsCache(updated);
      } else {
        const ref = await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
        const newProduct = { id: ref.id, ...productData, createdAt: new Date().toISOString() } as Product;
        const updated = [...products, newProduct];
        setProducts(updated);
        setProductsCache(updated);
      }
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert('İşlem başarısız oldu.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        const updated = products.filter(p => p.id !== id);
        setProducts(updated);
        setProductsCache(updated);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPercentage, setBulkPercentage] = useState('10');
  const [bulkLoading, setBulkLoading] = useState(false);
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCategory) return;
    
    if (!window.confirm(`${bulkCategory} kategorisindeki tüm ürünlere %${bulkPercentage} zam yapmak istediğinize emin misiniz?`)) {
      return;
    }

    setBulkLoading(true);
    try {
      const percentage = Number(bulkPercentage);
      const categoryProducts = products.filter(p => p.category === bulkCategory);
      
      for (const p of categoryProducts) {
        const newPrice = p.price * (1 + (percentage / 100));
        await updateDoc(doc(db, 'products', p.id), {
          price: newPrice,
          updatedAt: new Date().toISOString()
        });
      }
      
      setIsBulkModalOpen(false);
      // Refresh from server after bulk update
      invalidateProducts();
      await fetchProducts(true);
      alert('Toplu fiyat güncellemesi tamamlandı.');
    } catch (err) {
      console.error(err);
      alert('Toplu güncelleme sırasında hata oluştu.');
    } finally {
      setBulkLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <Sk w="w-48" h="h-9" />
        <Sk w="w-40" h="h-10" />
      </div>
      <div className="bg-white rounded-3xl border border-gray-100 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <Sk h="h-32" />
              <Sk w="w-3/4" h="h-4" />
              <Sk w="w-1/2" h="h-3" />
              <Sk h="h-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Envanter & Ürünler</h1>
        {role === 'admin' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-colors font-bold shadow-sm"
            >
              TOPLU GÜNCELLEME
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-colors font-bold shadow-lg shadow-blue-200"
            >
              <Plus className="w-5 h-5" />
              YENİ ÜRÜN EKLE
            </button>
          </div>
        )}
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
        
        <div className="overflow-x-auto p-4 md:p-6">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="pb-4 border-b border-gray-100">SKU</th>
                <th className="pb-4 border-b border-gray-100">Ürün Adı</th>
                <th className="pb-4 border-b border-gray-100">Kategori</th>
                <th className="pb-4 border-b border-gray-100">Fiyat</th>
                <th className="pb-4 border-b border-gray-100">Stok</th>
                {role === 'admin' && <th className="pb-4 border-b border-gray-100 text-right">İşlemler</th>}
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {loading ? (
                <tr><td colSpan={role === 'admin' ? 6 : 5} className="py-8 text-center text-gray-400 italic">Yükleniyor...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={role === 'admin' ? 6 : 5} className="py-8 text-center text-gray-400 italic">Ürün bulunamadı.</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 text-gray-400 font-mono text-xs">{product.sku}</td>
                    <td className="py-4 font-bold text-gray-900 text-base">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <span>{product.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-500">{product.category}</td>
                    <td className="py-4 font-black text-gray-900">₺{product.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${product.stock <= product.minStockAlert ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {product.stock}
                      </span>
                    </td>
                    {role === 'admin' && (
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleOpenModal(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">{editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ürün Adı</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} onBlur={() => handleAutoCategorize()} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">SKU (Barkod No)</label>
                  <input required type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-mono text-sm bg-gray-50" readOnly={!editingProduct} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Kategori</label>
                    {aiLoading && <span className="text-[10px] text-blue-600 font-bold">YAPAY ZEKA DÜŞÜNÜYOR...</span>}
                  </div>
                  <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder={aiLoading ? "Yapay zeka kategoriyi buluyor..." : "Kategori girin"} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Birim</label>
                  <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium bg-white">
                    <option value="Adet">Adet</option>
                    <option value="Kg">Kg</option>
                    <option value="Metre">Metre</option>
                    <option value="Litre">Litre</option>
                  </select>
                </div>

                <div className="border border-gray-100 p-4 rounded-2xl bg-gray-50/50 space-y-3">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Ürün Görseli</label>
                  
                  {formData.imageUrl ? (
                    <div className="relative w-32 h-32 mx-auto border border-gray-200 rounded-2xl overflow-hidden group shadow-sm bg-white">
                      <img src={formData.imageUrl} alt="Ürün önizleme" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                        className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs"
                      >
                        Kaldır
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all bg-white hover:bg-blue-50/10 min-h-[110px]">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                        <span className="text-xs font-bold text-gray-600">
                          {uploading ? 'Yükleniyor...' : 'Görsel Seç / Çek'}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">Cihazdan veya kameradan</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Fiyat (₺)</label>
                  <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-black text-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Stok Miktarı</label>
                  <input required type="number" min="0" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Kritik Stok</label>
                  <input required type="number" min="0" value={formData.minStockAlert} onChange={e => setFormData({...formData, minStockAlert: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-lg" />
                </div>
              </div>
              <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                <button type="button" onClick={handleCloseModal} className="px-6 py-3 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold transition-colors">İptal</button>
                <button type="submit" className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-blue-200">
                  {editingProduct ? 'GÜNCELLE' : 'KAYDET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Kategoriye Göre Toplu Zam</h2>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleBulkUpdate} className="p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Kategori Seçin</label>
                <select required value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium bg-white">
                  <option value="">Seçiniz</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Zam Oranı (%)</label>
                <input required type="number" min="1" max="100" value={bulkPercentage} onChange={e => setBulkPercentage(e.target.value)} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-black text-lg" />
              </div>
              <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsBulkModalOpen(false)} className="px-6 py-3 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold transition-colors">İptal</button>
                <button type="submit" disabled={bulkLoading} className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-purple-200">
                  {bulkLoading ? 'UYGULANIYOR...' : 'UYGULA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
