import React from 'react';
import {
  ShoppingBag,
  QrCode,
  GraduationCap,
  Truck,
  Factory,
  FlaskConical,
  LayoutDashboard,
  User,
  Home,
  PackageCheck,
} from 'lucide-react';
import type { ActiveTab, AuthUser } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: AuthUser | null;
  cartCount: number;
  onOpenAuth: () => void;
  onOpenCart: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  cartCount,
  onOpenAuth,
  onOpenCart,
}) => {
  const role = user?.role;

  // Build concise single-line nav items based on RBAC
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'home', label: 'Beranda' },
    { id: 'market', label: 'MORI-MARKET' },
    { id: 'chain', label: 'MORI-CHAIN' },
    { id: 'edu', label: 'MORI-EDU' },
  ];

  if (role === 'supplier' || role === 'petani_kelor' || role === 'supplier_bsf') {
    navItems.push({ id: 'supply', label: 'MORI-SUPPLY' });
  } else if (role === 'distributor') {
    navItems.push({ id: 'distributor', label: 'Distribusi' });
  } else if (role === 'admin') {
    navItems.push(
      { id: 'supply', label: 'Supply' },
      { id: 'production', label: 'Produksi' },
      { id: 'quality', label: 'Quality' },
      { id: 'admin', label: 'Admin' }
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E3E8DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Official Brand Logo */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D32] rounded-lg py-1"
          >
            <img
              src="/assets/aistudio/MORIFRASS_Organic_Bioactive_Fertilizer_Logo_8dbbbcf4.png"
              alt="MORIFRASS Logo"
              className="h-9 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="text-lg font-extrabold tracking-tight text-[#144A17] whitespace-nowrap">
              MORIFRASS
            </span>
          </button>

          {/* Zone 2: Concise Navigation Links */}
          <nav className="hidden lg:flex items-center gap-5 overflow-x-auto">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                    active
                      ? 'border-[#144A17] text-[#144A17] font-semibold'
                      : 'border-transparent text-[#5B665C] hover:text-[#144A17]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action + Cart / Account */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Keranjang Belanja"
              className="relative p-2.5 rounded-lg border border-[#E3E8DF] bg-[#F9FBF7] text-[#144A17] hover:bg-[#E6E9E4] transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2E7D32] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20] transition-colors whitespace-nowrap shrink-0"
              >
                <User className="w-3.5 h-3.5" />
                <span className="max-w-[110px] truncate">{user.profile?.full_name?.split(' ')[0] || 'Profil'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20] transition-colors whitespace-nowrap shrink-0"
              >
                Masuk / Daftar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (<= 15% viewport height, Bio-Trace spec) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-[#E3E8DF] px-2 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
            activeTab === 'home' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Beranda</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('market')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
            activeTab === 'market' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Market</span>
        </button>

        {/* Central Scan QR Action */}
        <button
          type="button"
          onClick={() => setActiveTab('chain')}
          className="-mt-4 flex flex-col items-center justify-center px-3.5 py-2 rounded-full bg-[#2E7D32] text-white shadow-md"
        >
          <QrCode className="w-5 h-5" />
          <span className="text-[9px] font-semibold mt-0.5">Scan QR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('edu')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
            activeTab === 'edu' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>MORI-EDU</span>
        </button>

        {role === 'admin' ? (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              activeTab === 'admin' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Admin</span>
          </button>
        ) : role === 'supplier' || role === 'petani_kelor' || role === 'supplier_bsf' ? (
          <button
            type="button"
            onClick={() => setActiveTab('supply')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              activeTab === 'supply' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Supply</span>
          </button>
        ) : role === 'distributor' ? (
          <button
            type="button"
            onClick={() => setActiveTab('distributor')}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              activeTab === 'distributor' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Distribusi</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (user ? setActiveTab('profile') : onOpenAuth())}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              activeTab === 'profile' ? 'text-[#144A17] font-semibold' : 'text-[#5B665C]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{user ? 'Profil' : 'Masuk'}</span>
          </button>
        )}
      </nav>

      {/* Role Sub-bar on mobile for Admin to access Production/Quality/Supply quickly */}
      {role === 'admin' && (
        <div className="lg:hidden bg-[#F1F4EF] border-b border-[#E3E8DF] px-3 py-1.5 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'admin' as ActiveTab, label: 'Ringkasan', icon: LayoutDashboard },
            { id: 'supply' as ActiveTab, label: 'Supply', icon: Truck },
            { id: 'production' as ActiveTab, label: 'Produksi', icon: Factory },
            { id: 'quality' as ActiveTab, label: 'Quality', icon: FlaskConical },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveTab(m.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                activeTab === m.id ? 'bg-[#144A17] text-white' : 'bg-white text-[#5B665C] border border-[#E3E8DF]'
              }`}
            >
              <m.icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
