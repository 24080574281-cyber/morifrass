import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiFetch, getAuthToken, setAuthToken } from './lib/api';
import type { ActiveTab, AuthUser, CartItem, ProductBundle } from './types';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { MoriMarket } from './components/MoriMarket';
import { MoriChain } from './components/MoriChain';
import { MoriEdu } from './components/MoriEdu';
import { OperationsPortal } from './components/OperationsPortal';
import { MoriSupply } from './components/MoriSupply';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [traceBatchCode, setTraceBatchCode] = useState('BATCH-MF-2026-001');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register-partner'>('login');
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const notify = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshUser = async () => {
    if (!getAuthToken()) return;
    try {
      const data = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
    apiFetch('/api/market')
      .then((d) => setBundles(d.bundles || []))
      .catch(() => {});

    // Deep link QR scan support (?batch=BATCH-MF-2026-001)
    const params = new URLSearchParams(window.location.search);
    const b = params.get('batch');
    if (b) {
      setTraceBatchCode(b);
      setActiveTab('chain');
    }
  }, []);

  const handleAddToCart = (bundle: ProductBundle, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.bundle.id === bundle.id);
      if (existing) {
        return prev.map((c) => (c.bundle.id === bundle.id ? { ...c, quantity: c.quantity + qty } : c));
      }
      return [...prev, { bundle, quantity: qty }];
    });
    notify(`${qty}× ${bundle.name} ditambahkan ke keranjang.`);
  };

  const handleUpdateCartQty = (bundleId: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.bundle.id !== bundleId));
    } else {
      setCart((prev) => prev.map((c) => (c.bundle.id === bundleId ? { ...c, quantity: qty } : c)));
    }
  };

  const handleRemoveFromCart = (bundleId: number) => {
    setCart((prev) => prev.filter((c) => c.bundle.id !== bundleId));
  };

  const handleTraceBatch = (batchCode: string) => {
    setTraceBatchCode(batchCode);
    setActiveTab('chain');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cartCount = cart.reduce((s, item) => s + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#F9FBF7] text-[#1C241D]">
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigate}
        user={user}
        cartCount={cartCount}
        onOpenAuth={() => {
          setAuthInitialMode('login');
          setAuthModalOpen(true);
        }}
        onOpenCart={() => {
          setActiveTab('market');
          setCartOpen(true);
        }}
      />

      <main>
        {activeTab === 'home' && (
          <LandingPage
            onNavigate={navigate}
            onTraceBatch={handleTraceBatch}
            onOpenPartnerRegister={() => {
              setAuthInitialMode('register-partner');
              setAuthModalOpen(true);
            }}
            bundles={bundles}
            onQuickBuyBundle={(b) => {
              handleAddToCart(b, 1);
              navigate('market');
              setCartOpen(true);
            }}
          />
        )}

        {activeTab === 'market' && (
          <MoriMarket
            user={user}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onRemoveFromCart={handleRemoveFromCart}
            onClearCart={() => setCart([])}
            cartOpen={cartOpen}
            setCartOpen={setCartOpen}
            onTraceBatch={handleTraceBatch}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            onNotify={notify}
            onRefreshUser={refreshUser}
          />
        )}

        {activeTab === 'chain' && <MoriChain initialBatchCode={traceBatchCode} onNotify={notify} />}

        {activeTab === 'edu' && (
          <MoriEdu
            user={user}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            onNotify={notify}
            onRefreshUser={refreshUser}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'supply' && (
          <MoriSupply
            user={user}
            onNotify={notify}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
          />
        )}

        {(activeTab === 'production' ||
          activeTab === 'quality' ||
          activeTab === 'admin' ||
          activeTab === 'distributor') && (
          <OperationsPortal
            mode={activeTab}
            user={user}
            onTraceBatch={handleTraceBatch}
            onNotify={notify}
            onOpenAuth={() => {
              setAuthInitialMode('login');
              setAuthModalOpen(true);
            }}
            onNavigate={navigate}
          />
        )}

        {activeTab === 'profile' && user && (
          <ProfileView
            user={user}
            onRefreshUser={refreshUser}
            onLogout={() => {
              setAuthToken(null);
              setUser(null);
              navigate('home');
              notify('Anda telah keluar dari akun.');
            }}
            onNotify={notify}
          />
        )}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
        onSuccess={(u) => {
          setUser(u);
          refreshUser();
        }}
        onNotify={notify}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-20 lg:bottom-6 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold ${
            toast.isError
              ? 'bg-[#FFEBEE] border-[#ba1a1a] text-[#93000a]'
              : 'bg-[#144A17] border-[#2E7D32] text-white'
          }`}
        >
          {toast.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-[#A5D6A7]" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
