import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db } from '../lib/firebase';
import { UserRole } from '../types';
import { Users, Plus, Shield } from 'lucide-react';
import config from '../../firebase-applet-config.json'; // using relative path from src/pages

export default function UserManagement() {
  const [users, setUsers] = useState<(UserRole & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'staff' });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'userRoles'));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (UserRole & { id: string })[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      // 1. Create a secondary Firebase app instance to avoid logging out the current admin
      const secondaryApp = initializeApp(config, 'SecondaryAppInstance_' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create the user in Auth
      const loginEmail = formData.username.includes('@') ? formData.username : `${formData.username}@demirkan.local`;
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, loginEmail, formData.password);
      await updateProfile(userCred.user, { displayName: formData.name });

      // 3. Write role to Firestore using the PRIMARY app (which is authenticated as Admin)
      await setDoc(doc(db, 'userRoles', userCred.user.uid), {
        role: formData.role,
        email: loginEmail,
        username: formData.username,
        name: formData.name,
        createdAt: new Date().toISOString()
      });

      // 4. Sign out the secondary app to clean up
      await secondaryAuth.signOut();

      setIsModalOpen(false);
      setFormData({ name: '', username: '', password: '', role: 'staff' });
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Kullanıcı oluşturulurken bir hata oluştu.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-colors font-bold shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          YENİ KULLANICI
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto p-4 md:p-6">
          <table className="w-full text-left border-collapse">
            <thead className="text-xs text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="pb-4 border-b border-gray-100">İsim</th>
                <th className="pb-4 border-b border-gray-100">Kullanıcı Adı / E-Posta</th>
                <th className="pb-4 border-b border-gray-100">Yetki</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {loading ? (
                <tr><td colSpan={3} className="py-8 text-center text-gray-400 italic">Yükleniyor...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-gray-400 italic">Kayıtlı kullanıcı yok.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 font-bold text-gray-900">{u.name || 'İsimsiz'}</td>
                    <td className="py-4 text-gray-500">{(u as any).username || u.email || u.id}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role === 'admin' ? 'YÖNETİCİ' : 'PERSONEL'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Yeni Kullanıcı Oluştur</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-full">Kapat</button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 md:p-8 space-y-6">
              {error && <div className="text-red-600 bg-red-50 p-3 rounded-xl text-sm font-bold">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ad Soyad</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 outline-none font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Kullanıcı Adı</label>
                <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 outline-none font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Şifre</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 outline-none font-medium" minLength={6} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Yetki</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-3.5 rounded-2xl border border-gray-200 focus:border-blue-500 outline-none font-medium bg-white">
                  <option value="staff">Personel (Satış Yapabilir)</option>
                  <option value="admin">Yönetici (Tam Yetki)</option>
                </select>
              </div>
              <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-500 hover:bg-gray-100 rounded-2xl font-bold transition-colors">İptal</button>
                <button type="submit" disabled={creating} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-2xl font-bold transition-colors shadow-lg shadow-blue-200">
                  {creating ? 'Oluşturuluyor...' : 'OLUŞTUR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
