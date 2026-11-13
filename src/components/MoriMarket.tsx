import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Star,
  ShieldCheck,
  QrCode,
  Package,
  Truck,
  CheckCircle2,
  Tag,
  X,
} from 'lucide-react';
import { apiFetch, formatDate, formatRupiah } from '../lib/api';
import type { AuthUser, CartItem, ProductBundle } from '../types';

interface MoriMarketProps {
  user: AuthUser | null;
  cart: CartItem[];
  onAddToCart: (bundle: ProductBundle, qty?: number) => void;
  onUpdateCartQty: (bundleId: number, qty: number) => void;
  onRemoveFromCart: (bundleId: number) => void;
  onClearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  onTraceBatch: (batchCode: string) => void;
  onOpenAuth: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
  onRefreshUser: () => void;
}

const ORDER_STEPS = [
  'Menunggu pembayaran',
  'Pembayaran dikonfirmasi',
  'Diproses',
  'Dikemas',
  'Dalam pengiriman',
  'Selesai',
];

export const MoriMarket: React.FC<MoriMarketProps> = ({
  user,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onClearCart,
  cartOpen,
  setCartOpen,
  onTraceBatch,
  onOpenAuth,
  onNotify,
  onRefreshUser,
}) => {
  const [marketData, setMarketData] = useState<any>(null);
  const [selectedBundle, setSelectedBundle] = useState<ProductBundle | null>(null);
  const [qty, setQty] = useState(1);
  const [detailTab, setDetailTab] = useState<'komposisi' | 'penggunaan' | 'ulasan'>('komposisi');
  const [subView, setSubView] = useState<'shop' | 'orders'>('shop');

  // Orders & Reviews
  const [orders, setOrders] = useState<any[]>([]);
  const [reviewTargetOrder, setReviewTargetOrder] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState('');

  // Checkout Form
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [courier, setCourier] = useState('JNE Cargo');
  const [paymentMethod, setPaymentMethod] = useState<'Transfer Bank' | 'QRIS' | 'E-Wallet' | 'Pembayaran Manual Prototype'>('QRIS');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    voucherDiscount: number;
    shippingDiscount: number;
  } | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadMarket = async () => {
    try {
      const data = await apiFetch('/api/market');
      setMarketData(data);
      if (data.bundles?.length && !selectedBundle) {
        setSelectedBundle(data.bundles[0]);
      }
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const loadOrders = async () => {
    if (!user) return;
    try {
      const data = await apiFetch<{ orders: any[] }>('/api/orders');
      setOrders(data.orders || []);
    } catch {
      // ignore if guest
    }
  };

  useEffect(() => {
    loadMarket();
  }, []);

  useEffect(() => {
    if (user) {
      setRecipientName(user.profile?.full_name || '');
      setPhone(user.profile?.phone || '');
      setAddress(user.profile?.address || '');
      setCity(user.profile?.city || '');
      loadOrders();
    }
  }, [user]);

  const shippingCost = courier === 'JNE Cargo' ? 15000 : courier === 'SiCepat' ? 14000 : 12000;
  const normalSubtotal = cart.reduce((s, item) => s + item.bundle.normal_price * item.quantity, 0);
  const bundleSubtotal = cart.reduce((s, item) => s + item.bundle.bundle_price * item.quantity, 0);
  const bundleDiscount = Math.max(0, normalSubtotal - bundleSubtotal);
  const totalPouches = cart.reduce((s, item) => s + item.bundle.quantity_units * item.quantity, 0);

  const voucherDiscount = appliedVoucher?.voucherDiscount || 0;
  const shippingDiscount = appliedVoucher?.shippingDiscount || 0;
  const grandTotal = Math.max(0, bundleSubtotal - voucherDiscount + shippingCost - shippingDiscount);

  const handleValidateVoucher = async (codeOverride?: string) => {
    const code = (codeOverride ?? voucherCode).trim().toUpperCase();
    if (!code) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await apiFetch<any>('/api/orders/validate-voucher', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal: bundleSubtotal, shippingCost }),
      });
      setVoucherCode(res.voucher.code);
      setAppliedVoucher({
        code: res.voucher.code,
        voucherDiscount: res.voucherDiscount,
        shippingDiscount: res.shippingDiscount,
      });
      onNotify(`Voucher ${res.voucher.code} berhasil diterapkan!`);
    } catch (err: any) {
      setAppliedVoucher(null);
      onNotify(err.message, true);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const res = await apiFetch<any>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((c) => ({ bundleId: c.bundle.id, quantity: c.quantity })),
          voucherCode: appliedVoucher?.code || undefined,
          courier,
          shippingService: 'Reguler',
          shippingCost,
          recipientName,
          phone,
          address,
          city,
          paymentMethod,
        }),
      });
      onClearCart();
      setAppliedVoucher(null);
      setVoucherCode('');
      setCartOpen(false);
      setSubView('orders');
      onNotify(`Pesanan ${res.orderCode} dibuat! Menunggu konfirmasi pembayaran (${paymentMethod} - Simulasi Prototype).`);
      loadMarket();
      loadOrders();
      onRefreshUser();
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTargetOrder) return;
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId: reviewTargetOrder,
          rating: reviewRating,
          comment: reviewComment,
          photoUrl: reviewPhotoUrl,
        }),
      });
      onNotify('Ulasan Anda berhasil disimpan!');
      setReviewTargetOrder(null);
      setReviewComment('');
      setReviewPhotoUrl('');
      loadMarket();
      loadOrders();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const product = marketData?.product;
  const bundles: ProductBundle[] = marketData?.bundles || [];
  const reviews: any[] = marketData?.reviews || [];
  const activeVouchers = (user?.vouchers || []).filter((v) => !v.is_used && new Date(v.expires_at).getTime() > Date.now());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      {/* Module Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#144A17]">MORI-MARKET</h1>
          <p className="text-sm text-[#5B665C]">Pupuk Bioaktif Organik 1 kg — pilih paket hemat sesuai kebutuhan lahan.</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-[#F1F4EF] border border-[#E3E8DF] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubView('shop')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              subView === 'shop' ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
            }`}
          >
            Beli Produk
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                setSubView('orders');
                loadOrders();
              }
            }}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              subView === 'orders' ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
            }`}
          >
            Riwayat Pesanan {orders.length > 0 ? `(${orders.length})` : ''}
          </button>
        </div>
      </div>

      {subView === 'shop' ? (
        <>
          {/* Single Product Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Product Visual & Specs */}
            <div className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-6">
              <div className="bg-[#F9FBF7] rounded-xl p-6 flex items-center justify-center mb-5">
                <img
                  src={product?.image_url || '/assets/aistudio/image_817a15a9.png'}
                  alt={product?.name || 'MORIFRASS 1 kg'}
                  className="w-64 sm:w-72 h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center border-t border-[#E3E8DF] pt-4">
                <div>
                  <p className="text-[11px] text-[#5B665C]">Netto</p>
                  <p className="text-sm font-bold text-[#144A17]">{product?.net_weight_kg || 1} kg</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#5B665C]">Stok Tersedia</p>
                  <p className="text-sm font-bold text-[#144A17] tabular-nums">{product?.stock ?? 0} pcs</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#5B665C]">Terjual</p>
                  <p className="text-sm font-bold text-[#144A17] tabular-nums">{product?.total_sold ?? 0}+</p>
                </div>
              </div>

              {/* Traceability Link */}
              {marketData?.latestBatch && (
                <div className="mt-4 pt-4 border-t border-[#E3E8DF] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#1C241D]">Batch Terbaru: {marketData.latestBatch.batch_code}</p>
                    <p className="text-[11px] text-[#2E7D32]">QC: {marketData.latestBatch.qc_status || 'Terdaftar'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTraceBatch(marketData.latestBatch.batch_code)}
                    className="px-3 py-1.5 rounded-lg border border-[#5D4037] text-[#5D4037] text-xs font-semibold hover:bg-[#EFEBE9] inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Cek Passport
                  </button>
                </div>
              )}
            </div>

            {/* Right Purchase Module */}
            <div className="lg:col-span-7 bg-white border border-[#E3E8DF] rounded-2xl p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#5B665C] mb-2">
                <span className="font-semibold text-[#2E7D32]">Pupuk Padat Organik</span>
                <span aria-hidden="true">·</span>
                <span>Standing Pouch 1 kg</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#1C241D]">
                  <Star className="w-3.5 h-3.5 text-[#F9A825] fill-current" />
                  {product?.avg_rating ?? 4.9} ({product?.review_count ?? 0} ulasan)
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#144A17]">
                {product?.name || 'MORIFRASS – Pupuk Bioaktif Organik'}
              </h2>
              <p className="text-sm text-[#5B665C] mt-2 leading-relaxed">
                {product?.description}
              </p>

              {/* Bundle Selector (3 packages for single 1 kg product) */}
              <div className="mt-6">
                <p className="text-xs font-bold text-[#1C241D] uppercase tracking-wider mb-3">
                  Pilih Paket Pembelian
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {bundles.map((b) => {
                    const isSelected = selectedBundle?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBundle(b)}
                        className={`text-left p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-[#144A17] bg-[#F1F4EF] ring-1 ring-[#144A17]'
                            : 'border-[#E3E8DF] bg-white hover:border-[#2E7D32]'
                        }`}
                      >
                        <p className="text-xs font-semibold text-[#5D4037]">{b.quantity_units} Kemasan (1 kg)</p>
                        <p className="text-sm font-bold text-[#1C241D] mt-0.5">{b.name}</p>
                        {b.discount_amount > 0 && (
                          <p className="text-[11px] text-[#5B665C] line-through mt-2 tabular-nums">
                            {formatRupiah(b.normal_price)}
                          </p>
                        )}
                        <p className="text-lg font-extrabold text-[#144A17] tabular-nums mt-0.5">
                          {formatRupiah(b.bundle_price)}
                        </p>
                        {b.discount_amount > 0 && (
                          <p className="text-[11px] font-semibold text-[#2E7D32] mt-0.5 tabular-nums">
                            Hemat {formatRupiah(b.discount_amount)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity + Add to Cart */}
              {selectedBundle && (
                <div className="mt-6 pt-6 border-t border-[#E3E8DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#5B665C]">
                      Total ({selectedBundle.quantity_units * qty} kg · {selectedBundle.name})
                    </p>
                    <p className="text-2xl font-extrabold text-[#144A17] tabular-nums">
                      {formatRupiah(selectedBundle.bundle_price * qty)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-[#D7DED3] rounded-lg bg-[#F9FBF7]">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="p-2.5 text-[#144A17] hover:bg-[#E6E9E4] rounded-l-lg"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        className="p-2.5 text-[#144A17] hover:bg-[#E6E9E4] rounded-r-lg"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAddToCart(selectedBundle, qty);
                        setQty(1);
                      }}
                      className="flex-1 sm:flex-initial px-6 py-3 rounded-lg bg-[#144A17] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Tambah ke Keranjang
                    </button>
                  </div>
                </div>
              )}

              {/* Concise Product Information Tabs */}
              <div className="mt-8 border-t border-[#E3E8DF] pt-5">
                <div className="flex items-center gap-4 border-b border-[#E3E8DF] mb-4">
                  {[
                    { id: 'komposisi', label: 'Komposisi' },
                    { id: 'penggunaan', label: 'Cara Penggunaan' },
                    { id: 'ulasan', label: `Ulasan (${reviews.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailTab(t.id as any)}
                      className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                        detailTab === t.id
                          ? 'border-[#144A17] text-[#144A17]'
                          : 'border-transparent text-[#5B665C] hover:text-[#144A17]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {detailTab === 'komposisi' && (
                  <p className="text-sm text-[#41493f] leading-relaxed">{product?.composition_text}</p>
                )}

                {detailTab === 'penggunaan' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                      <p className="font-bold text-[#144A17]">1. Taburkan</p>
                      <p className="text-[#5B665C] mt-1">100–200 g/m² merata di sekitar zona akar.</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                      <p className="font-bold text-[#144A17]">2. Aduk Tanah</p>
                      <p className="text-[#5B665C] mt-1">Campurkan ringan dengan tanah atas atau kompos.</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                      <p className="font-bold text-[#144A17]">3. Berkala</p>
                      <p className="text-[#5B665C] mt-1">Ulangi aplikasi setiap 2–4 minggu sekali.</p>
                    </div>
                  </div>
                )}

                {detailTab === 'ulasan' && (
                  <div className="space-y-3">
                    {reviews.length === 0 ? (
                      <p className="text-xs text-[#5B665C]">Belum ada ulasan terverifikasi.</p>
                    ) : (
                      reviews.map((r) => (
                        <div key={r.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#1C241D]">
                              {r.reviewer_name} {r.reviewer_city ? `· ${r.reviewer_city}` : ''}
                            </p>
                            <div className="flex items-center gap-0.5 text-[#F9A825]">
                              {Array.from({ length: r.rating }).map((_, idx) => (
                                <Star key={idx} className="w-3 h-3 fill-current" />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-[#41493f] mt-1.5">{r.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Order History & 6-Step Tracker */
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-10 text-center">
              <Package className="w-10 h-10 text-[#5B665C] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#1C241D]">Belum ada riwayat pesanan</p>
              <button
                type="button"
                onClick={() => setSubView('shop')}
                className="mt-4 px-5 py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold"
              >
                Mulai Belanja MORIFRASS
              </button>
            </div>
          ) : (
            orders.map((o) => {
              const stepIdx = ORDER_STEPS.indexOf(o.status);
              return (
                <div key={o.id} className="bg-white border border-[#E3E8DF] rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E3E8DF]">
                    <div>
                      <p className="text-xs text-[#5B665C] font-mono">
                        {o.order_code} · {formatDate(o.created_at)}
                      </p>
                      <p className="text-sm font-bold text-[#144A17] mt-0.5">
                        {o.total_items} Kemasan (1 kg) · Total {formatRupiah(o.grand_total)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F4EF] text-[#144A17] border border-[#E3E8DF]">
                        {o.status}
                      </span>
                      <p className="text-[11px] text-[#5B665C] mt-1">
                        {o.payment_method} ({o.payment_status}) · {o.reference_code}
                      </p>
                    </div>
                  </div>

                  {/* 6-step Progress */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 py-4">
                    {ORDER_STEPS.map((st, idx) => {
                      const done = idx <= stepIdx;
                      return (
                        <div
                          key={st}
                          className={`p-2 rounded-lg text-[11px] font-medium border ${
                            done
                              ? 'bg-[#F1F4EF] border-[#2E7D32] text-[#144A17]'
                              : 'bg-[#F9FBF7] border-[#E3E8DF] text-[#5B665C]'
                          }`}
                        >
                          {idx + 1}. {st}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5B665C] pt-2 border-t border-[#E3E8DF]">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#2E7D32]" />
                      <span>
                        {o.courier} ({o.shipping_status}) {o.tracking_number ? `· Resi: ${o.tracking_number}` : ''} · {o.city}
                      </span>
                    </div>

                    {o.status === 'Selesai' && !o.has_reviewed && (
                      <button
                        type="button"
                        onClick={() => setReviewTargetOrder(o.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#F9A825] text-[#1C241D] font-bold hover:bg-[#F59E0B]"
                      >
                        Beri Ulasan
                      </button>
                    )}
                    {o.has_reviewed && (
                      <span className="inline-flex items-center gap-1 text-[#2E7D32] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Diulas
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Review Modal (Only for Completed Orders) */}
      {reviewTargetOrder && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-md p-6 relative">
            <button
              type="button"
              onClick={() => setReviewTargetOrder(null)}
              className="absolute top-4 right-4 text-[#5B665C]"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-[#144A17] mb-3">Ulasan Pembeli Terverifikasi</h3>
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Rating Bintang</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReviewRating(n)}
                      className={`p-1.5 rounded-lg border ${
                        n <= reviewRating ? 'border-[#F9A825] text-[#F9A825]' : 'border-[#E3E8DF] text-[#C1C9BB]'
                      }`}
                    >
                      <Star className="w-5 h-5 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Komentar</label>
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#D7DED3] text-sm"
                  placeholder="Bagikan hasil penggunaan di tanaman Anda..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">URL Foto Ulasan (Opsional)</label>
                <input
                  type="url"
                  value={reviewPhotoUrl}
                  onChange={(e) => setReviewPhotoUrl(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                  placeholder="https://..."
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#144A17] text-white text-sm font-semibold hover:bg-[#1B5E20]"
              >
                Kirim Ulasan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Over Cart & Checkout Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#E3E8DF] flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#144A17]">Keranjang & Checkout</h3>
              <button type="button" onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg hover:bg-[#F1F4EF]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-10 h-10 text-[#C1C9BB] mx-auto mb-2" />
                  <p className="text-sm text-[#5B665C]">Keranjang belanja kosong.</p>
                </div>
              ) : (
                <>
                  {/* Items */}
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.bundle.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#E3E8DF] bg-[#F9FBF7]">
                        <div>
                          <p className="text-sm font-bold text-[#1C241D]">{item.bundle.name}</p>
                          <p className="text-xs text-[#5B665C]">
                            {item.bundle.quantity_units} pouch (1 kg) × {formatRupiah(item.bundle.bundle_price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateCartQty(item.bundle.id, item.quantity - 1)}
                            className="p-1 rounded border border-[#D7DED3] bg-white"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateCartQty(item.bundle.id, item.quantity + 1)}
                            className="p-1 rounded border border-[#D7DED3] bg-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFromCart(item.bundle.id)}
                            className="p-1 text-[#ba1a1a] hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* MORI-EDU Voucher Picker */}
                  <div className="p-4 rounded-xl border border-[#E3E8DF] bg-[#F1F4EF]">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#144A17] mb-2">
                      <Tag className="w-4 h-4" />
                      Voucher MORI-EDU Terintegrasi
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        placeholder="Kode voucher (contoh: MORI-ONGKIR-DEMO)"
                        className="flex-1 h-10 px-3 rounded-lg border border-[#D7DED3] bg-white text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleValidateVoucher()}
                        className="px-3.5 h-10 rounded-lg bg-[#2E7D32] text-white text-xs font-semibold"
                      >
                        Pakai
                      </button>
                    </div>
                    {activeVouchers.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {activeVouchers.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleValidateVoucher(v.code)}
                            className="px-2.5 py-1 rounded-md bg-white border border-[#2E7D32] text-[11px] font-semibold text-[#144A17] hover:bg-[#E6E9E4]"
                          >
                            {v.code} · {v.reward_type === 'free_shipping' ? 'Gratis Ongkir' : formatRupiah(v.discount_amount)}
                          </button>
                        ))}
                      </div>
                    )}
                    {appliedVoucher && (
                      <p className="text-[11px] font-semibold text-[#2E7D32] mt-2">
                        Voucher {appliedVoucher.code} aktif! Potongan:{' '}
                        {formatRupiah(appliedVoucher.voucherDiscount + appliedVoucher.shippingDiscount)}
                      </p>
                    )}
                  </div>

                  {/* Shipping & Payment Form */}
                  <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3">
                    <p className="text-xs font-bold text-[#144A17] uppercase">Alamat & Pengiriman</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Nama Penerima"
                        className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                      />
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="No. HP / WA"
                        className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Alamat lengkap pengiriman"
                      className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Kota / Kabupaten"
                        className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                      />
                      <select
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                        className="h-10 px-2.5 rounded-lg border border-[#D7DED3] text-xs bg-white"
                      >
                        <option value="JNE Cargo">JNE Cargo (Rp15.000)</option>
                        <option value="SiCepat">SiCepat Gokil (Rp14.000)</option>
                        <option value="J&T Express">J&T Express (Rp12.000)</option>
                      </select>
                    </div>

                    <p className="text-xs font-bold text-[#144A17] uppercase pt-2">Metode Pembayaran (Simulasi Prototype)</p>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs bg-white"
                    >
                      <option value="QRIS">QRIS (Simulasi Prototype)</option>
                      <option value="Transfer Bank">Transfer Bank (Simulasi Prototype)</option>
                      <option value="E-Wallet">E-Wallet (Simulasi Prototype)</option>
                      <option value="Pembayaran Manual Prototype">Pembayaran Manual Prototype</option>
                    </select>
                    <p className="text-[11px] text-[#5D4037] bg-[#EFEBE9] px-3 py-2 rounded-lg">
                      Catatan Prototype: Payment gateway eksternal belum terhubung; pembayaran akan berstatus Menunggu Konfirmasi Admin.
                    </p>
                  </form>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-[#E3E8DF] bg-[#F9FBF7] space-y-2 text-xs">
                <div className="flex justify-between text-[#5B665C]">
                  <span>Subtotal ({totalPouches} pouch 1 kg)</span>
                  <span className="tabular-nums">{formatRupiah(normalSubtotal)}</span>
                </div>
                {bundleDiscount > 0 && (
                  <div className="flex justify-between text-[#2E7D32] font-semibold">
                    <span>Diskon Bundling</span>
                    <span className="tabular-nums">-{formatRupiah(bundleDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#5B665C]">
                  <span>Ongkos Kirim ({courier})</span>
                  <span className="tabular-nums">{formatRupiah(shippingCost)}</span>
                </div>
                {(voucherDiscount > 0 || shippingDiscount > 0) && (
                  <div className="flex justify-between text-[#2E7D32] font-semibold">
                    <span>Potongan Voucher MORI-EDU</span>
                    <span className="tabular-nums">-{formatRupiah(voucherDiscount + shippingDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-[#144A17] pt-2 border-t border-[#E3E8DF]">
                  <span>Total Pembayaran</span>
                  <span className="tabular-nums">{formatRupiah(grandTotal)}</span>
                </div>

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={checkingOut}
                  className="mt-3 w-full py-3 rounded-lg bg-[#144A17] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {checkingOut ? 'Memproses Pesanan...' : user ? 'Buat Pesanan Sekarang' : 'Masuk untuk Checkout'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
