import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Navigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleCreateTestUser = async () => {
    setError('');
    setLoading(true);
    try {
      const email = 'admin@demirkan.local';
      const userCred = await createUserWithEmailAndPassword(auth, email, 'demirkan123');
      await setDoc(doc(db, 'userRoles', userCred.user.uid), {
        role: 'admin',
        email: email,
        username: 'admin',
        name: 'Sistem Yöneticisi',
        createdAt: new Date().toISOString()
      });
      alert('Test kullanıcısı oluşturuldu!\n\nKullanıcı Adı: admin\nŞifre: demirkan123\n\nBilgilerle giriş yapabilirsiniz.');
      setUsername('admin');
      setPassword('demirkan123');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        alert('Test kullanıcısı zaten mevcut.\nKullanıcı Adı: admin\nŞifre: demirkan123');
        setUsername('admin');
        setPassword('demirkan123');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Firebase panelinden "Email/Password" girişi etkinleştirilmelidir!');
      } else {
        setError('Oluşturulamadı: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loginEmail = username.includes('@') ? username : `${username}@demirkan.local`;
      await login(loginEmail, password);
    } catch (err: any) {
      setError('Giriş başarısız. Bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-200 p-8 text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Package className="w-8 h-8" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase leading-tight mb-2">
            DEMİRKIRANLAR ALÜMİNYUM
          </h1>
          <p className="text-gray-500 font-bold text-xs uppercase tracking-widest leading-relaxed">
            Plastik Demir Doğrama<br/>Yapı Malz. İnş. San. Tic. Ltd. Şti.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Kullanıcı Adı</label>
            <input 
              required 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Şifre</label>
            <input 
              required 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none font-medium" 
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-2xl text-lg transition-all shadow-lg shadow-blue-200 flex items-center justify-center mt-6"
          >
            {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
          </button>
        </form>

        <div className="pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleCreateTestUser}
            disabled={loading}
            className="text-xs font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
          >
            TEST İÇİN YÖNETİCİ OLUŞTUR
          </button>
        </div>
      </div>
    </div>
  );
}
