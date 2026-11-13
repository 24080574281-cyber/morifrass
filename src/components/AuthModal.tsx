import React, { useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import type { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register-partner';
  onSuccess: (user: AuthUser) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Customer / Petani', email: 'petani@morifrass.id', pass: 'morifrass123' },
  { label: 'Petani Kelor', email: 'kelor@morifrass.id', pass: 'morifrass123' },
  { label: 'Supplier BSF', email: 'bsf@morifrass.id', pass: 'morifrass123' },
  { label: 'Admin / Tim Produksi', email: 'admin@morifrass.id', pass: 'morifrass123' },
  { label: 'Distributor', email: 'distributor@morifrass.id', pass: 'morifrass123' },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccess,
  onNotify,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode === 'register-partner' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState<'customer' | 'petani_kelor' | 'supplier_bsf'>(
    initialMode === 'register-partner' ? 'petani_kelor' : 'customer'
  );
  const [companyName, setCompanyName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('Petani Daun Kelor');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
        onNotify(`Berhasil masuk sebagai ${res.user.profile?.full_name || res.user.email}`);
        onClose();
      } else {
        const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            fullName,
            phone,
            city,
            role,
            companyName,
            supplierCategory,
          }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
        onNotify('Registrasi berhasil! Selamat datang di ekosistem MORIFRASS.');
        onClose();
      }
    } catch (err: any) {
      onNotify(err.message || 'Autentikasi gagal', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E3E8DF] rounded-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#5B665C] hover:bg-[#F1F4EF]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <img
            src="/assets/aistudio/MORIFRASS_Organic_Bioactive_Fertilizer_Logo_8dbbbcf4.png"
            alt="MORIFRASS"
            className="h-9 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <div>
            <h2 className="text-lg font-bold text-[#144A17]">{mode === 'login' ? 'Masuk ke MORIFRASS' : 'Daftar Akun Baru'}</h2>
            <p className="text-xs text-[#5B665C]">Satu akun terintegrasi untuk seluruh ekosistem</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F4EF] rounded-lg mb-5">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'login' ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Masuk
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'register' ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Daftar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1C241D] mb-1">Jenis Akun</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('customer')}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-semibold ${
                      role === 'customer' ? 'border-[#144A17] bg-[#F1F4EF] text-[#144A17]' : 'border-[#D7DED3] text-[#5B665C]'
                    }`}
                  >
                    Pembeli
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('petani_kelor');
                      setSupplierCategory('Petani Daun Kelor');
                    }}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-semibold ${
                      role === 'petani_kelor' ? 'border-[#144A17] bg-[#F1F4EF] text-[#144A17]' : 'border-[#D7DED3] text-[#5B665C]'
                    }`}
                  >
                    Petani Kelor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('supplier_bsf');
                      setSupplierCategory('Peternak BSF');
                    }}
                    className={`py-2 px-2 rounded-lg border text-[11px] font-semibold ${
                      role === 'supplier_bsf' ? 'border-[#144A17] bg-[#F1F4EF] text-[#144A17]' : 'border-[#D7DED3] text-[#5B665C]'
                    }`}
                  >
                    Supplier BSF
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C241D] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-[#D7DED3] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  placeholder="Contoh: Ahmad Fauzi"
                />
              </div>
              {(role === 'petani_kelor' || role === 'supplier_bsf') && (
                <div>
                  <label className="block text-xs font-semibold text-[#1C241D] mb-1">
                    {role === 'petani_kelor' ? 'Nama Kelompok Tani / Kebun Kelor' : 'Nama Usaha / Peternakan BSF'}
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[#D7DED3] text-sm"
                    placeholder={role === 'petani_kelor' ? 'Poktan Kelor Sejahtera' : 'BSF Agro Mandiri'}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#1C241D] mb-1">No. HP / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[#D7DED3] text-sm"
                    placeholder="0812..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C241D] mb-1">Kota / Kab</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-[#D7DED3] text-sm"
                    placeholder="Malang"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1C241D] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#D7DED3] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              placeholder="nama@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1C241D] mb-1">Kata Sandi</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-[#D7DED3] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#144A17] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors disabled:opacity-60"
          >
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk Sekarang' : 'Buat Akun'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-5 pt-4 border-t border-[#E3E8DF]">
            <p className="text-[11px] font-semibold text-[#5D4037] mb-2">
              Akun Demo Simulasi (Klik untuk isi cepat):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.pass);
                  }}
                  className="text-left px-2.5 py-2 rounded-lg border border-[#E3E8DF] bg-[#F9FBF7] hover:bg-[#F1F4EF] transition-colors"
                >
                  <p className="text-[11px] font-bold text-[#144A17]">{acc.label}</p>
                  <p className="text-[10px] text-[#5B665C] truncate">{acc.email}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
