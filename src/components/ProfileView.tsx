import React, { useState } from 'react';
import { Bell, LogOut, Shield, Tag, UserCheck } from 'lucide-react';
import { apiFetch, formatDate, formatRupiah } from '../lib/api';
import type { AuthUser } from '../types';

interface ProfileViewProps {
  user: AuthUser;
  onRefreshUser: () => void;
  onLogout: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onRefreshUser,
  onLogout,
  onNotify,
}) => {
  const [fullName, setFullName] = useState(user.profile?.full_name || '');
  const [phone, setPhone] = useState(user.profile?.phone || '');
  const [address, setAddress] = useState(user.profile?.address || '');
  const [city, setCity] = useState(user.profile?.city || '');
  const [anon, setAnon] = useState(!!user.profile?.leaderboard_anonymous);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone, address, city, leaderboardAnonymous: anon }),
      });
      onNotify('Profil & pengaturan privasi berhasil disimpan.');
      onRefreshUser();
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  const handleReadNotifications = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    onRefreshUser();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <img
            src={user.profile?.avatar_url || '/assets/aistudio/MORIFRASS_Bee_Farmer_Mascot_69774a65.png'}
            alt="Avatar"
            className="w-14 h-14 rounded-2xl object-contain bg-white border border-[#E3E8DF] p-1"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#144A17]">{user.profile?.full_name}</h1>
            <p className="text-xs text-[#5B665C]">
              {user.email} · Peran: <strong className="uppercase text-[#144A17]">{user.role}</strong> · {user.profile?.level_name || 'Seed Beginner'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" /> Keluar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile Form */}
        <form onSubmit={handleSave} className="lg:col-span-6 bg-white border border-[#E3E8DF] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#144A17] font-bold text-base">
            <UserCheck className="w-5 h-5 text-[#2E7D32]" /> Data Akun & Privasi
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">No. HP / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Kota</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Alamat Pengiriman</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-sm"
            />
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] cursor-pointer">
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => setAnon(e.target.checked)}
              className="w-4 h-4 accent-[#144A17]"
            />
            <span className="text-xs text-[#1C241D]">
              <Shield className="w-3.5 h-3.5 inline mr-1 text-[#2E7D32]" />
              Samarkan nama saya pada Leaderboard MORI-EDU
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20]"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>

        {/* Vouchers & Notifications */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6">
            <div className="flex items-center gap-2 text-[#144A17] font-bold text-base mb-3">
              <Tag className="w-5 h-5 text-[#2E7D32]" /> Dompet Voucher MORI-MARKET
            </div>
            {(user.vouchers || []).length === 0 ? (
              <p className="text-xs text-[#5B665C]">Belum ada voucher aktif. Tukar poin di MORI-EDU.</p>
            ) : (
              <div className="space-y-2">
                {user.vouchers?.map((v) => (
                  <div key={v.id} className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono font-bold text-[#144A17]">{v.code}</p>
                      <p className="text-[#5B665C]">{v.reward_title}</p>
                    </div>
                    <span className={`font-semibold ${v.is_used ? 'text-[#5B665C]' : 'text-[#2E7D32]'}`}>
                      {v.is_used ? 'Terpakai' : `Min ${formatRupiah(v.min_purchase)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[#144A17] font-bold text-base">
                <Bell className="w-5 h-5 text-[#2E7D32]" /> Notifikasi
              </div>
              <button type="button" onClick={handleReadNotifications} className="text-xs text-[#2E7D32] font-semibold hover:underline">
                Tandai dibaca
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(user.notifications || []).map((n) => (
                <div key={n.id} className={`p-3 rounded-xl border text-xs ${n.is_read ? 'bg-[#F9FBF7] border-[#E3E8DF]' : 'bg-[#F1F4EF] border-[#2E7D32]'}`}>
                  <div className="flex justify-between">
                    <p className="font-bold text-[#144A17]">{n.title}</p>
                    <span className="text-[10px] text-[#5B665C]">{formatDate(n.created_at)}</span>
                  </div>
                  <p className="text-[#41493f] mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
