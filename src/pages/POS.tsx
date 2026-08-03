import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, SaleItem } from '../types';
import { Trash2, Search, Plus, Minus, CreditCard, Camera, ShoppingCart, X } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import jsQR from 'jsqr';
import { getProducts, invalidateSales } from '../lib/cache';

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
    getProducts().then(data => setProducts(data));
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const stopScanner = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const onScanSuccess = useCallback((decodedText: string) => {
    stopScanner();
    let skuOrId = decodedText.trim();
    // If QR value is a URL like /p/PRODUCT_ID, extract the ID
    if (skuOrId.includes('/p/')) {
      skuOrId = skuOrId.split('/p/').pop() || skuOrId;
    }
    addProductToCart(skuOrId);
  }, [stopScanner]);

  const tickScan = useCallback(() => {
    const video = videoRef.current;
    const canvas = scannerCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(tickScan);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    // Try BarcodeDetector first (Chrome Android native, fastest)
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39'] });
      detector.detect(canvas).then((codes: any[]) => {
        if (codes.length > 0) {
          onScanSuccess(codes[0].rawValue);
        } else {
          animFrameRef.current = requestAnimationFrame(tickScan);
        }
      }).catch(() => {
        // BarcodeDetector failed — fall through to jsQR
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code) {
          onScanSuccess(code.data);
        } else {
          animFrameRef.current = requestAnimationFrame(tickScan);
        }
      });
    } else {
      // iOS Safari / Firefox: use jsQR (pure JS, works everywhere)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code) {
        onScanSuccess(code.data);
      } else {
        animFrameRef.current = requestAnimationFrame(tickScan);
      }
    }
  }, [onScanSuccess]);

  const startScanner = async () => {
    setError('');
    try {
      // Explicitly request camera permission — this is the critical step
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setScanning(true);
      // Wait for the video element to mount before assigning
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            animFrameRef.current = requestAnimationFrame(tickScan);
          }).catch(console.error);
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kamera iznini açın.');
      } else if (err.name === 'NotFoundError') {
        setError('Kamera bulunamadı. Cihazınızda kamera mevcut mu?');
      } else {
        setError('Kamera başlatılamadı: ' + (err.message || err.name));
      }
      setScanning(false);
    }
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
          createdByEmail: user?.email ?? '',
          createdByName: user?.displayName || user?.email?.split('@')[0] || 'Bilinmiyor',
          createdAt: new Date().toISOString()
        });
      });

      setCart([]);
      // Invalidate caches so Dashboard and Products show fresh data
      invalidateSales();
      invalidateProducts();
      alert("Satış başarıyla tamamlandı!");

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Satış işlemi başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">

      {/* Search & QR bar — always visible at top */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 shrink-0">
        <div className="flex items-center gap-2 w-full">
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
              className="shrink-0 bg-gray-800 text-white px-5 py-3 rounded-2xl font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              Ekle
            </button>
          </form>
          <button
            type="button"
            onClick={scanning ? stopScanner : startScanner}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-200 transition-all font-bold"
          >
            <Camera className="w-5 h-5" />
            <span className="hidden sm:inline">{scanning ? 'KAPAT' : 'QR TARA'}</span>
          </button>
        </div>
        {error && <p className="text-red-500 mt-3 font-medium text-sm">{error}</p>}
      </div>

      {/* Fullscreen camera overlay */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="absolute top-4 right-4 z-50">
            <button onClick={stopScanner} className="bg-white/20 hover:bg-white/30 text-white rounded-full p-3 backdrop-blur-sm">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute top-4 left-4 right-16 z-50">
            <p className="text-white font-bold text-sm bg-black/50 rounded-xl px-3 py-2 backdrop-blur-sm">QR kodu veya barkodu kamera çerçevesine tutun</p>
          </div>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 border-4 border-white rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
          <canvas ref={scannerCanvasRef} className="hidden" />
        </div>
      )}

      {/* Cart — scrollable middle section */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1 px-4">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs text-gray-400 uppercase sticky top-0 bg-white">
              <tr>
                <th className="py-3">Ürün Adı</th>
                <th className="py-3">Adet</th>
                <th className="py-3 hidden sm:table-cell">Birim</th>
                <th className="py-3 text-right">Toplam</th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody className="text-base font-medium">
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 italic">
                    Satışa başlamak için ürün ekleyin
                  </td>
                </tr>
              ) : (
                cart.map(item => (
                  <tr key={item.productId} className="border-b border-gray-50">
                    <td className="py-3 font-semibold text-gray-900 text-sm leading-tight max-w-[120px]">{item.name}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1 w-fit">
                        <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white rounded"><Minus className="w-3 h-3"/></button>
                        <span className="w-5 text-center text-sm font-bold">x{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, 1)} className="p-1 hover:bg-white rounded"><Plus className="w-3 h-3"/></button>
                      </div>
                    </td>
                    <td className="py-3 text-sm hidden sm:table-cell">₺{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right font-bold text-gray-900 text-sm">₺{(item.price * item.quantity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total + Payment buttons — ALWAYS visible at bottom, never pushed off screen */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-500 text-sm">Toplam Ürün: {cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">✓ Stoklar otomatik düşürülecektir.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">GENEL TOPLAM</p>
            <p className="text-3xl font-black text-gray-900">₺{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleCheckout('cash')}
            disabled={cart.length === 0 || loading}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:shadow-none text-white py-4 rounded-2xl text-base font-black shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            NAKİT
          </button>
          <button
            onClick={() => handleCheckout('credit')}
            disabled={cart.length === 0 || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none text-white py-4 rounded-2xl text-base font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            KART
          </button>
        </div>
      </div>

    </div>
  );
}
