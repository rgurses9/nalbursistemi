import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, SaleItem } from '../types';
import { Html5Qrcode } from 'html5-qrcode';
import { Trash2, Search, Plus, Minus, CreditCard, Camera, ShoppingCart } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

export default function POS() {
  const { user } = useAuth();
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchMatches, setSearchMatches] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (searchInput.length > 1) {
      setSearchMatches(products.filter(p => 
        p.name.toLowerCase().includes(searchInput.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchInput.toLowerCase())
      ));
    } else {
      setSearchMatches([]);
    }
  }, [searchInput, products]);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanner = async () => {
    setScanning(true);
    setError('');
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }
      
      await scannerRef.current.start(
        { facingMode: "environment" }, // Arka kamera
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Başarılı okuma
          onScanSuccess(decodedText);
        },
        () => {
          // Hataları görmezden gel (sürekli tarama yapıyor)
        }
      );
    } catch (err: any) {
      console.error(err);
      setError('Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.error(e);
      }
    }
    setScanning(false);
  };

  const onScanSuccess = (decodedText: string) => {
    stopScanner(); // Okur okumaz kapat
    addProductToCart(decodedText); // Sepete ekle
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput) return;
    await addProductToCart(searchInput);
    setSearchInput('');
  };

  const addProductToCart = async (skuOrId: string) => {
    setError('');
    setLoading(true);
    try {
      // First try by ID
      let productDoc = await getDoc(doc(db, 'products', skuOrId));
      let productData = productDoc.exists() ? { id: productDoc.id, ...productDoc.data() } as Product : null;

      // If not found, try by SKU
      if (!productData) {
        const q = query(collection(db, 'products'), where('sku', '==', skuOrId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          productData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
        }
      }

      if (productData) {
        setCart(prev => {
          const existing = prev.find(item => item.productId === productData!.id);
          if (existing) {
            return prev.map(item => item.productId === productData!.id ? { ...item, quantity: item.quantity + 1 } : item);
          }
          return [...prev, { productId: productData!.id, name: productData!.name, price: productData!.price, quantity: 1 }];
        });
      } else {
        setError('Ürün bulunamadı!');
      }
    } catch (err) {
      console.error(err);
      setError('Arama hatası.');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async (method: 'cash' | 'credit') => {
    if (cart.length === 0) return;
    setLoading(true);
    setError('');

    try {
      await runTransaction(db, async (transaction) => {
        // Verify stock for all items
        for (const item of cart) {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) {
            throw new Error(`${item.name} bulunamadı.`);
          }
          const currentStock = productDoc.data().stock;
          if (currentStock < item.quantity) {
            throw new Error(`${item.name} için yeterli stok yok. (Mevcut: ${currentStock})`);
          }
        }

        // Deduct stock and create sale record
        for (const item of cart) {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await transaction.get(productRef);
          const currentStock = productDoc.data()!.stock;
          transaction.update(productRef, {
            stock: currentStock - item.quantity,
            updatedAt: new Date().toISOString()
          });
        }

        const saleRef = doc(collection(db, 'sales'));
        transaction.set(saleRef, {
          items: cart,
          totalAmount,
          paymentMethod: method,
          createdBy: user?.uid,
          createdAt: new Date().toISOString()
        });
      });

      setCart([]);
      alert("Satış başarıyla tamamlandı!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Satış işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden">
      {/* Left side: Search & Scanner */}
      <div className="md:col-span-8 flex flex-col space-y-4 overflow-hidden">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-3 w-full">
            <form onSubmit={handleManualSearch} className="flex gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Barkod veya Ürün Adı..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
                {searchMatches.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl max-h-60 overflow-auto">
                    {searchMatches.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          addProductToCart(p.id);
                          setSearchInput('');
                          setSearchMatches([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{p.sku}</p>
                        </div>
                        <span className="font-black text-blue-600">₺{p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 bg-gray-800 text-white px-6 py-3 rounded-2xl font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                Ekle
              </button>
            </form>
            <button
              type="button"
              onClick={scanning ? stopScanner : startScanner}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-bold"
            >
              <Camera className="w-5 h-5" />
              <span>{scanning ? 'KAPAT' : 'QR TARA'}</span>
            </button>
          </div>
          {error && <p className="text-red-500 mb-4 font-medium">{error}</p>}
          
          {scanning && (
            <div className="mb-4">
              <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-gray-200"></div>
            </div>
          )}

          <div className="flex-1 overflow-auto border-y border-gray-100 py-4">
            <table className="w-full text-left border-collapse">
              <thead className="text-xs text-gray-400 uppercase">
                <tr>
                  <th className="pb-4">Ürün Adı</th>
                  <th className="pb-4">Adet</th>
                  <th className="pb-4">Birim Fiyat</th>
                  <th className="pb-4 text-right">Toplam</th>
                  <th className="pb-4"></th>
                </tr>
              </thead>
              <tbody className="text-lg font-medium">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 italic">
                      Satışa başlamak için ürün ekleyin
                    </td>
                  </tr>
                ) : (
                  cart.map(item => (
                    <tr key={item.productId} className="border-b border-gray-50">
                      <td className="py-4 font-semibold text-gray-900">{item.name}</td>
                      <td className="py-4 text-gray-500 font-mono">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1 w-fit">
                          <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white rounded"><Minus className="w-4 h-4"/></button>
                          <span className="w-6 text-center text-sm">x{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-white rounded"><Plus className="w-4 h-4"/></button>
                        </div>
                      </td>
                      <td className="py-4">₺{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 text-right font-bold text-gray-900">₺{(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 p-2">
                          <Trash2 className="w-5 h-5"/>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-6 flex justify-between items-end">
            <div>
              <p className="text-gray-500">Toplam Ürün: {cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
              <p className="text-sm text-blue-600 font-medium mt-1">✓ Stoklar otomatik düşürülecektir.</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 uppercase font-bold tracking-wider">GENEL TOPLAM</p>
              <p className="text-5xl font-black text-gray-900 mt-1">₺{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
              <div className="flex gap-4 mt-6">
                <button 
                  onClick={() => handleCheckout('cash')}
                  disabled={cart.length === 0 || loading}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:shadow-none text-white py-4 rounded-2xl text-lg font-black shadow-xl shadow-green-100 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-6 h-6" />
                  NAKİT
                </button>
                <button 
                  onClick={() => handleCheckout('credit')}
                  disabled={cart.length === 0 || loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none text-white py-4 rounded-2xl text-lg font-black shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-6 h-6" />
                  KART
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="md:col-span-4 flex flex-col space-y-4">
         <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex-1 flex flex-col justify-center items-center text-center">
            <ShoppingCart className="w-12 h-12 opacity-20 text-orange-900 mb-3" />
            <h4 className="text-orange-900 font-bold text-base mb-1">Hızlı İşlem</h4>
            <p className="text-sm text-orange-700">QR kod veya barkod okutarak ürünleri hızlıca sepete ekleyebilirsiniz.</p>
         </div>
      </div>
    </div>
  );
}
