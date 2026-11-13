import React, { useEffect, useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  MessageSquare,
  FileText,
  Scale,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Upload,
  FlaskConical,
  X,
  Package,
  Send,
  ArrowLeftRight,
} from 'lucide-react';
import { apiFetch, formatDate, formatRupiah } from '../lib/api';
import type { AuthUser } from '../types';

interface MoriSupplyProps {
  user: AuthUser | null;
  onNotify: (msg: string, isError?: boolean) => void;
  onOpenAuth: () => void;
}

export const MoriSupply: React.FC<MoriSupplyProps> = ({ user, onNotify, onOpenAuth }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Admin vs Supplier sub-tabs
  const isAdmin = user?.role === 'admin';
  const [adminTab, setAdminTab] = useState<'marketplace' | 'rfq_po' | 'inspection' | 'suppliers'>('marketplace');
  const [supplierTab, setSupplierTab] = useState<'offerings' | 'orders' | 'chat_profile'>('offerings');

  // Marketplace Filters (Admin)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCat, setFilterCat] = useState('Semua');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterMinStock, setFilterMinStock] = useState('');
  const [filterVerified, setFilterVerified] = useState('Semua');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Supplier Profile & Evaluation Modal
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [evalScores, setEvalScores] = useState({ timeliness: 5, quality: 5, communication: 5, notes: '' });

  // Chat State
  const [chatSupplier, setChatSupplier] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // RFQ / PO Modals
  const [rfqTarget, setRfqTarget] = useState<any>(null);
  const [rfqForm, setRfqForm] = useState({ quantityKg: 100, targetPrice: 0, deliveryEstimate: '2–3 hari kerja', notes: '' });
  const [poTarget, setPoTarget] = useState<any>(null);
  const [poQty, setPoQty] = useState(100);
  const [poNotes, setPoNotes] = useState('');

  // Supplier Add/Edit Offering Modal
  const [offeringModalOpen, setOfferingModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<any>(null);
  const [offForm, setOffForm] = useState({
    name: '',
    category: 'Daun Kelor Kering',
    pricePerUnit: 15000,
    stockAvailable: 100,
    originRegion: '',
    description: '',
    specifications: '',
    estimatedDelivery: '2–3 hari kerja',
    photoUrl: '',
    qualityDocName: '',
    qualityDocUrl: '',
  });

  // Supplier Profile Edit Form
  const [profileForm, setProfileForm] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    location: '',
    description: '',
  });

  // Inspection Modal (Section D)
  const [inspectTarget, setInspectTarget] = useState<any>(null);
  const [inspForm, setInspForm] = useState({
    actualQuantityKg: '',
    physicalCondition: '',
    moisturePct: '',
    cleanlinessStatus: 'Bersih, bebas benda asing',
    labTestSummary: '',
    labDocName: '',
    labDocUrl: '',
    status: 'Lolos Pemeriksaan' as 'Menunggu Pemeriksaan' | 'Lolos Pemeriksaan' | 'Ditolak',
    notes: '',
  });

  // Supplier Shipping Modal
  const [shipTarget, setShipTarget] = useState<any>(null);
  const [shipTracking, setShipTracking] = useState('');
  const [shipEta, setShipEta] = useState('');

  // RFQ Counter-Offer Modal (Supplier)
  const [counterRfq, setCounterRfq] = useState<any>(null);
  const [counterPrice, setCounterPrice] = useState(0);
  const [counterNotes, setCounterNotes] = useState('');

  const loadSupply = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/supply');
      setData(res);
      if (res.mySupplier) {
        setProfileForm({
          companyName: res.mySupplier.company_name || '',
          contactName: res.mySupplier.contact_name || '',
          phone: res.mySupplier.phone || '',
          location: res.mySupplier.location || '',
          description: res.mySupplier.description || '',
        });
        loadChat(res.mySupplier.id);
      }
    } catch (err: any) {
      onNotify(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async (supplierId: number) => {
    try {
      const res = await apiFetch<{ messages: any[] }>(`/api/supply/chats/${supplierId}`);
      setChatMessages(res.messages || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSupply();
  }, [user?.id, user?.role]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-[#5D4037] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#144A17]">Masuk ke MORI-SUPPLY</h2>
        <p className="text-sm text-[#5B665C] mt-1 mb-5">
          Gunakan akun <strong>Petani Kelor</strong>, <strong>Supplier BSF</strong>, atau <strong>Admin Tim Produksi MORIFRASS</strong>.
        </p>
        <button type="button" onClick={onOpenAuth} className="px-6 py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold">
          Masuk Sekarang
        </button>
      </div>
    );
  }

  const allowedRoles = ['admin', 'supplier', 'petani_kelor', 'supplier_bsf'];
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-[#ba1a1a] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#144A17]">Akses Terbatas</h2>
        <p className="text-sm text-[#5B665C] mt-1">
          Modul MORI-SUPPLY hanya untuk Petani Kelor, Supplier BSF, dan Tim Pengadaan MORIFRASS.
        </p>
      </div>
    );
  }

  const allowedCategories =
    user.role === 'petani_kelor'
      ? ['Daun Kelor Segar', 'Daun Kelor Kering']
      : user.role === 'supplier_bsf'
        ? ['Maggot BSF Kering', 'Frass BSF']
        : ['Daun Kelor Segar', 'Daun Kelor Kering', 'Maggot BSF Kering', 'Frass BSF', 'Biochar Sekam Padi', 'Kompos Matang'];

  const openAddOffering = () => {
    setEditingOffering(null);
    setOffForm({
      name: '',
      category: allowedCategories[0],
      pricePerUnit: user.role === 'petani_kelor' ? 16000 : 5500,
      stockAvailable: 100,
      originRegion: data?.mySupplier?.location || 'Jawa Timur',
      description: '',
      specifications: '',
      estimatedDelivery: '2–3 hari kerja',
      photoUrl: '',
      qualityDocName: '',
      qualityDocUrl: '',
    });
    setOfferingModalOpen(true);
  };

  const openEditOffering = (m: any) => {
    setEditingOffering(m);
    setOffForm({
      name: m.name,
      category: m.category,
      pricePerUnit: m.price_per_unit,
      stockAvailable: m.stock_available,
      originRegion: m.origin_region,
      description: m.description || '',
      specifications: m.specifications || '',
      estimatedDelivery: m.estimated_delivery || '2–3 hari kerja',
      photoUrl: m.photo_url || '',
      qualityDocName: m.quality_doc_name || '',
      qualityDocUrl: m.quality_doc_url || '',
    });
    setOfferingModalOpen(true);
  };

  const handleFileToDataUrl = (file: File, onDone: (dataUrl: string, fileName: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => onDone(String(reader.result || ''), file.name);
    reader.readAsDataURL(file);
  };

  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOffering) {
        await apiFetch(`/api/supply/materials/${editingOffering.id}`, {
          method: 'PUT',
          body: JSON.stringify(offForm),
        });
        onNotify('Penawaran bahan baku diperbarui.');
      } else {
        await apiFetch('/api/supply/materials', {
          method: 'POST',
          body: JSON.stringify(offForm),
        });
        onNotify('Penawaran bahan baku baru ditambahkan.');
      }
      setOfferingModalOpen(false);
      loadSupply();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleSendChat = async (e: React.FormEvent, targetSid: number) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      await apiFetch(`/api/supply/chats/${targetSid}`, {
        method: 'POST',
        body: JSON.stringify({ message: chatInput }),
      });
      setChatInput('');
      loadChat(targetSid);
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const materials: any[] = data?.materials || [];
  const suppliers: any[] = data?.suppliers || [];
  const rfqs: any[] = data?.rfqs || [];
  const transactions: any[] = data?.transactions || [];
  const mySupplier = data?.mySupplier;

  const myMaterials = mySupplier ? materials.filter((m) => m.supplier_id === mySupplier.id) : [];

  const filteredMaterials = materials.filter((m) => {
    if (filterCat !== 'Semua' && m.category !== filterCat) return false;
    if (filterVerified !== 'Semua' && m.verified_status !== filterVerified) return false;
    if (filterLocation && !`${m.origin_region} ${m.supplier_location}`.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (filterMaxPrice && m.price_per_unit > Number(filterMaxPrice)) return false;
    if (filterMinStock && m.stock_available < Number(filterMinStock)) return false;
    if (searchTerm && !`${m.name} ${m.company_name} ${m.category}`.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const comparedItems = materials.filter((m) => compareIds.includes(m.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#144A17] text-white flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#144A17]">
              MORI-SUPPLY · {isAdmin ? 'Procurement Dashboard' : 'Supplier Dashboard'}
            </h1>
            <p className="text-xs text-[#5B665C]">
              {isAdmin
                ? 'Pengadaan B2B daun kelor, maggot BSF kering, frass BSF & verifikasi kualitas aktual.'
                : user.role === 'petani_kelor'
                  ? 'Portal Petani Kelor — tawarkan daun kelor segar & kering ke tim produksi MORIFRASS.'
                  : 'Portal Supplier BSF — tawarkan maggot BSF kering & frass BSF ke tim produksi MORIFRASS.'}
            </p>
          </div>
        </div>

        {/* Navigation Sub-tabs */}
        {isAdmin ? (
          <div className="flex items-center gap-1.5 p-1 bg-[#F1F4EF] border border-[#E3E8DF] rounded-lg overflow-x-auto">
            {[
              { id: 'marketplace', label: 'Marketplace Bahan' },
              { id: 'rfq_po', label: `RFQ & PO (${rfqs.length + transactions.length})` },
              { id: 'inspection', label: 'Verifikasi Kualitas' },
              { id: 'suppliers', label: `Pemasok (${suppliers.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAdminTab(t.id as any)}
                className={`px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap ${
                  adminTab === t.id ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 p-1 bg-[#F1F4EF] border border-[#E3E8DF] rounded-lg overflow-x-auto">
            {[
              { id: 'offerings', label: `Penawaran Saya (${myMaterials.length})` },
              { id: 'orders', label: `Permintaan & PO (${rfqs.length + transactions.length})` },
              { id: 'chat_profile', label: 'Chat & Profil' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSupplierTab(t.id as any)}
                className={`px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap ${
                  supplierTab === t.id ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !data && <p className="text-xs text-[#5B665C] py-8">Memuat data pengadaan...</p>}

      {/* ================================================================= */}
      {/* B. SUPPLIER DASHBOARD (PETANI KELOR & SUPPLIER BSF)               */}
      {/* ================================================================= */}
      {!isAdmin && data && (
        <>
          {supplierTab === 'offerings' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#E3E8DF] rounded-xl p-4">
                <div>
                  <p className="text-sm font-bold text-[#144A17]">{mySupplier?.company_name}</p>
                  <p className="text-xs text-[#5B665C]">
                    {mySupplier?.category} · {mySupplier?.location} · Status: <strong>{mySupplier?.verified_status}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddOffering}
                  className="px-4 py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#1B5E20]"
                >
                  <Plus className="w-4 h-4" /> Tambah Penawaran Bahan Baku
                </button>
              </div>

              {myMaterials.length === 0 ? (
                <div className="bg-white border border-[#E3E8DF] rounded-2xl p-10 text-center">
                  <Package className="w-10 h-10 text-[#C1C9BB] mx-auto mb-2" />
                  <p className="text-sm font-semibold text-[#1C241D]">Belum ada penawaran bahan baku</p>
                  <button
                    type="button"
                    onClick={openAddOffering}
                    className="mt-3 px-4 py-2 rounded-lg bg-[#144A17] text-white text-xs font-semibold"
                  >
                    Buat Penawaran Pertama
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myMaterials.map((m) => (
                    <div
                      key={m.id}
                      className={`bg-white border rounded-2xl overflow-hidden flex flex-col justify-between ${
                        m.is_active ? 'border-[#E3E8DF]' : 'border-[#D7DED3] opacity-65'
                      }`}
                    >
                      <div>
                        <div className="h-40 bg-[#F9FBF7] border-b border-[#E3E8DF] flex items-center justify-center overflow-hidden">
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-4">
                              <Package className="w-8 h-8 text-[#2E7D32] mx-auto mb-1" />
                              <span className="text-[11px] font-semibold text-[#5B665C]">{m.category}</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between text-[11px] text-[#5B665C] mb-1">
                            <span className="font-semibold text-[#2E7D32]">{m.category}</span>
                            <span>{m.approval_status}</span>
                          </div>
                          <h3 className="text-base font-bold text-[#1C241D]">{m.name}</h3>
                          <p className="text-lg font-extrabold text-[#144A17] mt-1 tabular-nums">
                            {formatRupiah(m.price_per_unit)} <span className="text-xs font-normal text-[#5B665C]">/ {m.unit}</span>
                          </p>
                          <p className="text-xs text-[#5B665C] mt-1">
                            Stok: <strong className="tabular-nums">{m.stock_available} {m.unit}</strong> · Kirim: {m.estimated_delivery}
                          </p>
                          <p className="text-xs text-[#41493f] mt-2 line-clamp-2">{m.description || m.specifications}</p>
                          {m.quality_doc_name && (
                            <p className="text-[11px] text-[#5D4037] mt-2 inline-flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> {m.quality_doc_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="px-4 py-3 bg-[#F9FBF7] border-t border-[#E3E8DF] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openEditOffering(m)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#D7DED3] bg-white text-xs font-semibold text-[#144A17] inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/supply/materials/${m.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ isActive: !m.is_active }),
                            });
                            onNotify(m.is_active ? 'Penawaran dinonaktifkan.' : 'Penawaran diaktifkan.');
                            loadSupply();
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-[#D7DED3] bg-white text-xs font-semibold text-[#5B665C] inline-flex items-center gap-1"
                        >
                          {m.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {m.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/supply/materials/${m.id}`, { method: 'DELETE' });
                            onNotify('Penawaran dihapus.');
                            loadSupply();
                          }}
                          className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-red-50"
                          aria-label="Hapus penawaran"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {supplierTab === 'orders' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Incoming RFQs */}
              <div className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-[#144A17]">Permintaan Penawaran (RFQ)</h2>
                {rfqs.length === 0 ? (
                  <p className="text-xs text-[#5B665C]">Belum ada RFQ dari tim pengadaan MORIFRASS.</p>
                ) : (
                  rfqs.map((r) => (
                    <div key={r.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-mono font-bold text-[#144A17]">{r.rfq_code}</span>
                        <span className="font-semibold text-[#2E7D32]">{r.status}</span>
                      </div>
                      <p className="font-bold text-[#1C241D]">
                        {r.material_name} · {r.quantity_kg} kg
                      </p>
                      <p className="text-[#5B665C] tabular-nums">
                        Target Harga: {formatRupiah(r.target_price_per_kg)}/kg{' '}
                        {r.offered_price_per_kg ? `· Penawaran Anda: ${formatRupiah(r.offered_price_per_kg)}/kg` : ''}
                      </p>
                      {r.notes && <p className="text-[#41493f]">{r.notes}</p>}
                      {r.status === 'Menunggu Respon' && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/supply/rfqs/${r.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'Disetujui', offeredPricePerKg: r.target_price_per_kg }),
                              });
                              onNotify('RFQ disetujui sesuai target harga.');
                              loadSupply();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#144A17] text-white font-semibold"
                          >
                            Setujui Harga
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCounterRfq(r);
                              setCounterPrice(r.target_price_per_kg);
                              setCounterNotes('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#2E7D32] text-[#2E7D32] font-semibold"
                          >
                            Ajukan Harga
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/supply/rfqs/${r.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'Ditolak' }),
                              });
                              onNotify('RFQ ditolak.');
                              loadSupply();
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] font-semibold"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Incoming Purchase Orders & Payment History */}
              <div className="lg:col-span-7 bg-white border border-[#E3E8DF] rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-[#144A17]">Purchase Order & Riwayat Transaksi</h2>
                {transactions.length === 0 ? (
                  <p className="text-xs text-[#5B665C]">Belum ada Purchase Order.</p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="p-4 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] space-y-2.5 text-xs">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-[#144A17]">{tx.po_code || `PO-${tx.id}`}</span>
                          <p className="font-bold text-sm text-[#1C241D] mt-0.5">
                            {tx.material_name} · {tx.quantity} {tx.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-sm text-[#144A17] tabular-nums">{formatRupiah(tx.total_price)}</p>
                          <p className="text-[11px] text-[#2E7D32] font-semibold">{tx.payment_status}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5B665C]">
                        <span>Status PO: <strong className="text-[#1C241D]">{tx.status}</strong></span>
                        <span>·</span>
                        <span>Pengiriman: <strong className="text-[#1C241D]">{tx.shipping_status}</strong></span>
                        {tx.tracking_number && (
                          <>
                            <span>·</span>
                            <span className="font-mono">Resi: {tx.tracking_number}</span>
                          </>
                        )}
                      </div>

                      {tx.inspection && (
                        <div className="p-2.5 rounded-lg bg-white border border-[#E3E8DF] text-[11px]">
                          Pemeriksaan Tim MORIFRASS: <strong>{tx.inspection.status}</strong>
                          {tx.inspection.actual_quantity_kg ? ` · Berat Aktual: ${tx.inspection.actual_quantity_kg} kg` : ''}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {tx.status === 'Dipesan' && (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/supply/orders/${tx.id}/status`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'Diterima Pemasok' }),
                                });
                                onNotify('PO diterima! Silakan siapkan pengiriman.');
                                loadSupply();
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#144A17] text-white font-semibold"
                            >
                              Terima PO
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/supply/orders/${tx.id}/status`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ status: 'Ditolak Pemasok' }),
                                });
                                onNotify('PO ditolak.');
                                loadSupply();
                              }}
                              className="px-3.5 py-1.5 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] font-semibold"
                            >
                              Tolak PO
                            </button>
                          </>
                        )}
                        {(tx.status === 'Diterima Pemasok' || tx.status === 'Dipesan') && (
                          <button
                            type="button"
                            onClick={() => {
                              setShipTarget(tx);
                              setShipTracking(`TRK-${Date.now().toString().slice(-4)}`);
                              setShipEta('');
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-[#2E7D32] text-white font-semibold"
                          >
                            Kirim Bahan Baku
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {supplierTab === 'chat_profile' && mySupplier && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Supplier Profile Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/supply/profile', {
                    method: 'PATCH',
                    body: JSON.stringify(profileForm),
                  });
                  onNotify('Profil pemasok berhasil diperbarui.');
                  loadSupply();
                }}
                className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-6 space-y-3"
              >
                <h2 className="text-base font-bold text-[#144A17]">Profil Pemasok</h2>
                <input
                  type="text"
                  required
                  value={profileForm.companyName}
                  onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                  placeholder="Nama Usaha / Poktan"
                  className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <input
                  type="text"
                  required
                  value={profileForm.contactName}
                  onChange={(e) => setProfileForm({ ...profileForm, contactName: e.target.value })}
                  placeholder="Nama Penanggung Jawab"
                  className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="No. WhatsApp"
                    className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                  />
                  <input
                    type="text"
                    value={profileForm.location}
                    onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                    placeholder="Lokasi"
                    className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                  />
                </div>
                <textarea
                  rows={3}
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  placeholder="Deskripsi kapasitas & metode budidaya..."
                  className="w-full p-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold">
                  Simpan Profil
                </button>
              </form>

              {/* Chat with MORIFRASS */}
              <div className="lg:col-span-7 bg-white border border-[#E3E8DF] rounded-2xl p-6 flex flex-col h-[420px]">
                <h2 className="text-base font-bold text-[#144A17] mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#2E7D32]" /> Chat dengan Tim Pengadaan MORIFRASS
                </h2>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3">
                  {chatMessages.map((msg) => {
                    const mine = msg.sender_role !== 'admin';
                    return (
                      <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-[#5B665C] mb-0.5">{msg.sender_name}</span>
                        <div
                          className={`px-3.5 py-2 rounded-xl text-xs max-w-[80%] ${
                            mine ? 'bg-[#144A17] text-white' : 'bg-[#F1F4EF] text-[#1C241D]'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={(e) => handleSendChat(e, mySupplier.id)} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tulis pesan ke tim pengadaan..."
                    className="flex-1 h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                  />
                  <button type="submit" className="px-4 h-10 rounded-lg bg-[#144A17] text-white text-xs font-semibold inline-flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" /> Kirim
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* C & D. MORIFRASS PROCUREMENT DASHBOARD (ADMIN / TIM PRODUKSI)     */}
      {/* ================================================================= */}
      {isAdmin && data && (
        <>
          {/* ADMIN TAB 1: MARKETPLACE + FILTERS + COMPARE */}
          {adminTab === 'marketplace' && (
            <div className="space-y-5">
              {/* Filter Bar */}
              <div className="bg-white border border-[#E3E8DF] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 text-[#5B665C] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari bahan atau pemasok..."
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#D7DED3] text-xs"
                  />
                </div>
                <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="h-10 px-2.5 rounded-lg border border-[#D7DED3] text-xs bg-white">
                  <option value="Semua">Semua Jenis Bahan</option>
                  <option value="Daun Kelor Segar">Daun Kelor Segar</option>
                  <option value="Daun Kelor Kering">Daun Kelor Kering</option>
                  <option value="Maggot BSF Kering">Maggot BSF Kering</option>
                  <option value="Frass BSF">Frass BSF</option>
                  <option value="Biochar Sekam Padi">Biochar Sekam Padi</option>
                  <option value="Kompos Matang">Kompos Matang</option>
                </select>
                <input
                  type="text"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  placeholder="Filter lokasi..."
                  className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <input
                  type="number"
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(e.target.value)}
                  placeholder="Harga max/kg"
                  className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <input
                  type="number"
                  value={filterMinStock}
                  onChange={(e) => setFilterMinStock(e.target.value)}
                  placeholder="Stok min (kg)"
                  className="h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <select value={filterVerified} onChange={(e) => setFilterVerified(e.target.value)} className="h-10 px-2.5 rounded-lg border border-[#D7DED3] text-xs bg-white">
                  <option value="Semua">Semua Status</option>
                  <option value="Terverifikasi">Terverifikasi</option>
                  <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                </select>
              </div>

              {/* Compare Bar */}
              {compareIds.length > 0 && (
                <div className="bg-[#144A17] text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold">
                    {compareIds.length} penawaran dipilih untuk perbandingan harga antarpemasok
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCompareModal(true)}
                      disabled={compareIds.length < 2}
                      className="px-3.5 py-1.5 rounded-lg bg-[#F9A825] text-[#1C241D] text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Bandingkan ({compareIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareIds([])}
                      className="px-2.5 py-1.5 rounded-lg bg-white/15 text-xs"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              {/* Material Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMaterials.map((m) => {
                  const isCompared = compareIds.includes(m.id);
                  const supplierObj = suppliers.find((s) => s.id === m.supplier_id);
                  return (
                    <div key={m.id} className="bg-white border border-[#E3E8DF] rounded-2xl overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="h-36 bg-[#F9FBF7] border-b border-[#E3E8DF] flex items-center justify-center relative overflow-hidden">
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center">
                              <Package className="w-8 h-8 text-[#2E7D32] mx-auto mb-1" />
                              <span className="text-[11px] font-semibold text-[#5B665C]">{m.category}</span>
                            </div>
                          )}
                          <label className="absolute top-2.5 right-2.5 bg-white/95 border border-[#E3E8DF] rounded-lg px-2 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isCompared}
                              onChange={() => {
                                setCompareIds((prev) =>
                                  prev.includes(m.id) ? prev.filter((id) => id !== m.id) : prev.length < 4 ? [...prev, m.id] : prev
                                );
                              }}
                              className="accent-[#144A17]"
                            />
                            Bandingkan
                          </label>
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-[#5B665C]">
                            <span className="font-semibold text-[#2E7D32]">{m.category}</span>
                            <span>{m.approval_status}</span>
                          </div>
                          <h3 className="text-base font-bold text-[#1C241D] leading-snug">{m.name}</h3>
                          <p className="text-xl font-extrabold text-[#144A17] tabular-nums">
                            {formatRupiah(m.price_per_unit)} <span className="text-xs font-normal text-[#5B665C]">/ kg</span>
                          </p>
                          <p className="text-xs text-[#5B665C]">
                            Stok: <strong className="tabular-nums">{m.stock_available} kg</strong> · {m.origin_region} · {m.estimated_delivery}
                          </p>

                          <button
                            type="button"
                            onClick={() => setSelectedSupplier(supplierObj)}
                            className="text-xs font-semibold text-[#5D4037] hover:underline block text-left"
                          >
                            {m.company_name} ({m.verified_status} · ★ {m.supplier_rating})
                          </button>

                          {m.specifications && (
                            <p className="text-[11px] text-[#5B665C] bg-[#F9FBF7] p-2 rounded-lg border border-[#E3E8DF]">
                              {m.specifications}
                            </p>
                          )}
                          {m.quality_doc_name && (
                            <p className="text-[11px] text-[#5D4037]">
                              Dokumen Klaim Pemasok:{' '}
                              {m.quality_doc_url ? (
                                <a
                                  href={m.quality_doc_url}
                                  download={m.quality_doc_name}
                                  className="font-bold underline hover:text-[#144A17]"
                                >
                                  {m.quality_doc_name}
                                </a>
                              ) : (
                                <strong>{m.quality_doc_name}</strong>
                              )}{' '}
                              (Perlu verifikasi aktual saat tiba)
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-[#F9FBF7] border-t border-[#E3E8DF] space-y-2">
                        {m.approval_status === 'Menunggu Persetujuan' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/supply/materials/${m.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ approvalStatus: 'Disetujui' }),
                                });
                                onNotify('Penawaran disetujui.');
                                loadSupply();
                              }}
                              className="py-1.5 rounded-lg bg-[#2E7D32] text-white text-xs font-semibold"
                            >
                              Setujui Penawaran
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/supply/materials/${m.id}`, {
                                  method: 'PUT',
                                  body: JSON.stringify({ approvalStatus: 'Ditolak' }),
                                });
                                onNotify('Penawaran ditolak.');
                                loadSupply();
                              }}
                              className="py-1.5 rounded-lg border border-[#ba1a1a] text-[#ba1a1a] text-xs font-semibold"
                            >
                              Tolak
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRfqTarget(m);
                              setRfqForm({
                                quantityKg: 100,
                                targetPrice: Math.round(m.price_per_unit * 0.95),
                                deliveryEstimate: m.estimated_delivery || '2–3 hari kerja',
                                notes: '',
                              });
                            }}
                            className="py-2 rounded-lg border border-[#144A17] text-[#144A17] text-xs font-semibold hover:bg-[#F1F4EF]"
                          >
                            Kirim RFQ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPoTarget(m);
                              setPoQty(100);
                              setPoNotes('');
                            }}
                            className="py-2 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20]"
                          >
                            Buat PO
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChatSupplier(supplierObj);
                              loadChat(m.supplier_id);
                            }}
                            className="py-2 rounded-lg border border-[#5D4037] text-[#5D4037] text-xs font-semibold inline-flex items-center justify-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADMIN TAB 2: RFQ & PURCHASE ORDER MONITORING */}
          {adminTab === 'rfq_po' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-[#144A17]">Request for Quotation (RFQ)</h2>
                {rfqs.map((r) => (
                  <div key={r.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-mono font-bold text-[#144A17]">{r.rfq_code}</span>
                      <span className="font-semibold text-[#2E7D32]">{r.status}</span>
                    </div>
                    <p className="font-bold text-[#1C241D]">{r.material_name} · {r.company_name}</p>
                    <p className="text-[#5B665C] tabular-nums">
                      {r.quantity_kg} kg · Target {formatRupiah(r.target_price_per_kg)}/kg
                      {r.offered_price_per_kg ? ` · Penawaran Pemasok: ${formatRupiah(r.offered_price_per_kg)}/kg` : ''}
                    </p>
                    {r.supplier_notes && <p className="text-[#41493f] italic">"{r.supplier_notes}"</p>}
                    {(r.status === 'Penawaran Balik' || r.status === 'Disetujui') && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch('/api/supply/orders', {
                            method: 'POST',
                            body: JSON.stringify({
                              rawMaterialId: r.raw_material_id,
                              rfqId: r.id,
                              quantity: r.quantity_kg,
                              quotePrice: r.offered_price_per_kg || r.target_price_per_kg,
                              notes: `Konversi dari ${r.rfq_code}`,
                            }),
                          });
                          onNotify(`RFQ ${r.rfq_code} dikonversi menjadi Purchase Order.`);
                          loadSupply();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#144A17] text-white font-semibold"
                      >
                        Konversi ke Purchase Order (PO)
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="lg:col-span-7 bg-white border border-[#E3E8DF] rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold text-[#144A17]">Purchase Order, Pengiriman & Riwayat Pembelian</h2>
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] space-y-2.5 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-[#144A17]">{tx.po_code || `PO-${tx.id}`}</span>
                        <p className="font-bold text-sm text-[#1C241D]">
                          {tx.material_name} ({tx.quantity} kg) · {tx.company_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-sm text-[#144A17] tabular-nums">{formatRupiah(tx.total_price)}</p>
                        <p className="text-[11px] font-semibold text-[#5D4037]">{tx.payment_status}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5B665C]">
                      <span>Status: <strong className="text-[#1C241D]">{tx.status}</strong></span>
                      <span>·</span>
                      <span>Pengiriman: <strong className="text-[#1C241D]">{tx.shipping_status}</strong></span>
                      {tx.tracking_number && <span>· Resi: <strong className="font-mono">{tx.tracking_number}</strong></span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {tx.payment_status !== 'Dibayar (Simulasi)' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/supply/orders/${tx.id}/status`, {
                              method: 'PATCH',
                              body: JSON.stringify({ paymentStatus: 'Dibayar (Simulasi)' }),
                            });
                            onNotify('Status pembayaran ditandai Dibayar (Simulasi).');
                            loadSupply();
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#2E7D32] text-[#2E7D32] font-semibold"
                        >
                          Tandai Dibayar (Simulasi)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTab('inspection');
                          setInspectTarget(tx);
                          setInspForm({
                            actualQuantityKg: String(tx.inspection?.actual_quantity_kg ?? tx.quantity),
                            physicalCondition: tx.inspection?.physical_condition || '',
                            moisturePct: tx.inspection?.moisture_pct !== null && tx.inspection?.moisture_pct !== undefined ? String(tx.inspection.moisture_pct) : '',
                            cleanlinessStatus: tx.inspection?.cleanliness_status || 'Bersih, bebas benda asing',
                            labTestSummary: tx.inspection?.lab_test_summary || '',
                            labDocName: tx.inspection?.lab_doc_name || '',
                            labDocUrl: tx.inspection?.lab_doc_url || '',
                            status: tx.inspection?.status || 'Menunggu Pemeriksaan',
                            notes: tx.inspection?.notes || '',
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#144A17] text-white font-semibold inline-flex items-center gap-1"
                      >
                        <FlaskConical className="w-3.5 h-3.5" /> Pemeriksaan QC Penerimaan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADMIN TAB 3: D. RAW MATERIAL QUALITY VERIFICATION */}
          {adminTab === 'inspection' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-3">
                <div className="p-4 rounded-xl bg-[#EFEBE9] border border-[#D7DED3] text-xs text-[#5D4037]">
                  <strong>Kebijakan Verifikasi Mutu:</strong> Klaim kualitas dari pemasok tidak otomatis meloloskan bahan baku. Kelayakan & penambahan stok gudang produksi hanya berlaku setelah tim MORIFRASS menginput pemeriksaan aktual dan menetapkan status <strong>Lolos Pemeriksaan</strong>.
                </div>
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-white border border-[#E3E8DF] rounded-xl p-4 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-mono font-bold text-[#144A17]">{tx.po_code || `PO-${tx.id}`} · {tx.material_name}</p>
                      <p className="text-[#5B665C]">{tx.company_name} · Pesan: {tx.quantity} kg</p>
                      <p className="font-semibold text-[#2E7D32] mt-1">
                        Status Pemeriksaan: {tx.inspection?.status || 'Menunggu Pemeriksaan'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectTarget(tx);
                        setInspForm({
                          actualQuantityKg: String(tx.inspection?.actual_quantity_kg ?? tx.quantity),
                          physicalCondition: tx.inspection?.physical_condition || '',
                          moisturePct: tx.inspection?.moisture_pct !== null && tx.inspection?.moisture_pct !== undefined ? String(tx.inspection.moisture_pct) : '',
                          cleanlinessStatus: tx.inspection?.cleanliness_status || 'Bersih, bebas benda asing',
                          labTestSummary: tx.inspection?.lab_test_summary || '',
                          labDocName: tx.inspection?.lab_doc_name || '',
                          labDocUrl: tx.inspection?.lab_doc_url || '',
                          status: tx.inspection?.status || 'Menunggu Pemeriksaan',
                          notes: tx.inspection?.notes || '',
                        });
                      }}
                      className="px-3.5 py-2 rounded-lg bg-[#144A17] text-white font-semibold whitespace-nowrap"
                    >
                      Periksa Bahan
                    </button>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-6">
                {inspectTarget ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await apiFetch(`/api/supply/inspections/${inspectTarget.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(inspForm),
                      });
                      onNotify(`Hasil pemeriksaan ${inspectTarget.po_code || inspectTarget.id} disimpan (${inspForm.status}).`);
                      loadSupply();
                    }}
                    className="bg-white border border-[#E3E8DF] rounded-2xl p-6 space-y-3 text-xs"
                  >
                    <h2 className="text-base font-bold text-[#144A17]">
                      Pemeriksaan Aktual · {inspectTarget.po_code || `PO-${inspectTarget.id}`}
                    </h2>
                    <p className="text-[#5B665C]">
                      {inspectTarget.material_name} (Dipesan: {inspectTarget.quantity} kg)
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="font-semibold">
                        Berat Aktual Diterima (kg)
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={inspForm.actualQuantityKg}
                          onChange={(e) => setInspForm({ ...inspForm, actualQuantityKg: e.target.value })}
                          className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                        />
                      </label>
                      <label className="font-semibold">
                        Kadar Air % (Jika Diuji)
                        <input
                          type="number"
                          step="0.1"
                          value={inspForm.moisturePct}
                          onChange={(e) => setInspForm({ ...inspForm, moisturePct: e.target.value })}
                          placeholder="Opsional"
                          className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                        />
                      </label>
                    </div>

                    <label className="block font-semibold">
                      Kondisi Fisik Bahan Baku
                      <input
                        type="text"
                        required
                        value={inspForm.physicalCondition}
                        onChange={(e) => setInspForm({ ...inspForm, physicalCondition: e.target.value })}
                        placeholder="Mis. Kering merata, warna alami, tidak menggumpal"
                        className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                      />
                    </label>

                    <label className="block font-semibold">
                      Kebersihan & Kontaminasi
                      <input
                        type="text"
                        required
                        value={inspForm.cleanlinessStatus}
                        onChange={(e) => setInspForm({ ...inspForm, cleanlinessStatus: e.target.value })}
                        placeholder="Mis. Bebas plastik, logam, dan jamur"
                        className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                      />
                    </label>

                    <label className="block font-semibold">
                      Hasil Pengujian Laboratorium (Jika Tersedia)
                      <input
                        type="text"
                        value={inspForm.labTestSummary}
                        onChange={(e) => setInspForm({ ...inspForm, labTestSummary: e.target.value })}
                        placeholder="Opsional — ringkasan uji lab internal/eksternal"
                        className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                      />
                    </label>

                    <label className="block p-3 rounded-xl border border-dashed border-[#5D4037] bg-[#F9FBF7] cursor-pointer text-center">
                      <FileText className="w-4 h-4 text-[#5D4037] mx-auto mb-1" />
                      <span className="font-semibold text-[#5D4037] truncate block">
                        {inspForm.labDocName || 'Unggah Dokumen Hasil Uji Lab (Opsional)'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileToDataUrl(f, (url, name) => setInspForm({ ...inspForm, labDocUrl: url, labDocName: name }));
                        }}
                      />
                    </label>

                    <div>
                      <label className="block font-semibold mb-1">Status Verifikasi Akhir Tim MORIFRASS</label>
                      <select
                        value={inspForm.status}
                        onChange={(e) => setInspForm({ ...inspForm, status: e.target.value as any })}
                        className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] bg-white font-bold text-[#144A17]"
                      >
                        <option value="Menunggu Pemeriksaan">Menunggu Pemeriksaan</option>
                        <option value="Lolos Pemeriksaan">Lolos Pemeriksaan (Masuk Stok Gudang)</option>
                        <option value="Ditolak">Ditolak (Tidak Masuk Stok)</option>
                      </select>
                    </div>

                    <textarea
                      rows={2}
                      value={inspForm.notes}
                      onChange={(e) => setInspForm({ ...inspForm, notes: e.target.value })}
                      placeholder="Catatan pemeriksa..."
                      className="w-full p-2.5 rounded-lg border border-[#D7DED3]"
                    />

                    <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white font-semibold">
                      Simpan Hasil Pemeriksaan Aktual
                    </button>
                  </form>
                ) : (
                  <div className="bg-white border border-[#E3E8DF] rounded-2xl p-10 text-center text-xs text-[#5B665C]">
                    Pilih salah satu Purchase Order di sebelah kiri untuk melakukan pemeriksaan penerimaan bahan baku.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADMIN TAB 4: SUPPLIERS + EVALUATION + CHAT */}
          {adminTab === 'suppliers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((s) => (
                <div key={s.id} className="bg-white border border-[#E3E8DF] rounded-2xl p-5 flex flex-col justify-between text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#2E7D32]">{s.category}</span>
                      <span className="font-bold text-[#F9A825] inline-flex items-center gap-0.5">
                        <Star className="w-3.5 h-3.5 fill-current" /> {s.eval_avg || s.rating}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#144A17]">{s.company_name}</h3>
                    <p className="text-[#5B665C] mt-0.5">{s.contact_name} · {s.location}</p>
                    <p className="font-semibold mt-2 text-[#1C241D]">Status: {s.verified_status}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E3E8DF] grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplier(s)}
                      className="py-1.5 rounded-lg border border-[#144A17] text-[#144A17] font-semibold"
                    >
                      Profil & Nilai
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChatSupplier(s);
                        loadChat(s.id);
                      }}
                      className="py-1.5 rounded-lg border border-[#5D4037] text-[#5D4037] font-semibold"
                    >
                      Chat
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = s.verified_status === 'Terverifikasi' ? 'Menunggu Verifikasi' : 'Terverifikasi';
                        await apiFetch(`/api/supply/suppliers/${s.id}/verify`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: next }),
                        });
                        onNotify(`Status ${s.company_name} -> ${next}`);
                        loadSupply();
                      }}
                      className="py-1.5 rounded-lg bg-[#144A17] text-white font-semibold"
                    >
                      {s.verified_status === 'Terverifikasi' ? 'Cabut' : 'Verifikasi'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* MODALS: OFFERING FORM, COMPARE, RFQ, PO, CHAT, SUPPLIER DETAIL    */}
      {/* ================================================================= */}
      {offeringModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setOfferingModalOpen(false)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-[#144A17] mb-4">
              {editingOffering ? 'Edit Penawaran Bahan Baku' : 'Tambah Penawaran Bahan Baku'}
            </h3>
            <form onSubmit={handleSaveOffering} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="font-semibold">
                  Nama Produk
                  <input
                    type="text"
                    required
                    value={offForm.name}
                    onChange={(e) => setOffForm({ ...offForm, name: e.target.value })}
                    placeholder="Mis. Daun Kelor Kering Organik"
                    className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                  />
                </label>
                <label className="font-semibold">
                  Kategori Bahan Baku
                  <select
                    value={offForm.category}
                    onChange={(e) => setOffForm({ ...offForm, category: e.target.value })}
                    className="w-full mt-1 h-10 px-2.5 rounded-lg border border-[#D7DED3] bg-white"
                  >
                    {allowedCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <label className="font-semibold">
                  Harga / kg (Rp)
                  <input
                    type="number"
                    required
                    min={100}
                    value={offForm.pricePerUnit}
                    onChange={(e) => setOffForm({ ...offForm, pricePerUnit: Number(e.target.value) })}
                    className="w-full mt-1 h-10 px-2.5 rounded-lg border border-[#D7DED3]"
                  />
                </label>
                <label className="font-semibold">
                  Stok (kg)
                  <input
                    type="number"
                    required
                    min={0}
                    value={offForm.stockAvailable}
                    onChange={(e) => setOffForm({ ...offForm, stockAvailable: Number(e.target.value) })}
                    className="w-full mt-1 h-10 px-2.5 rounded-lg border border-[#D7DED3]"
                  />
                </label>
                <label className="font-semibold">
                  Estimasi Kirim
                  <input
                    type="text"
                    required
                    value={offForm.estimatedDelivery}
                    onChange={(e) => setOffForm({ ...offForm, estimatedDelivery: e.target.value })}
                    placeholder="2–3 hari"
                    className="w-full mt-1 h-10 px-2.5 rounded-lg border border-[#D7DED3]"
                  />
                </label>
              </div>

              <label className="block font-semibold">
                Lokasi Pemasok / Asal Bahan
                <input
                  type="text"
                  required
                  value={offForm.originRegion}
                  onChange={(e) => setOffForm({ ...offForm, originRegion: e.target.value })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                />
              </label>

              <label className="block font-semibold">
                Deskripsi Produk
                <textarea
                  rows={2}
                  value={offForm.description}
                  onChange={(e) => setOffForm({ ...offForm, description: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-lg border border-[#D7DED3]"
                />
              </label>

              <label className="block font-semibold">
                Spesifikasi (Kadar air, metode pengeringan, kemasan)
                <input
                  type="text"
                  value={offForm.specifications}
                  onChange={(e) => setOffForm({ ...offForm, specifications: e.target.value })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="p-3 rounded-xl border border-dashed border-[#2E7D32] bg-[#F9FBF7] cursor-pointer text-center">
                  <Upload className="w-4 h-4 text-[#2E7D32] mx-auto mb-1" />
                  <span className="font-semibold text-[#144A17]">
                    {offForm.photoUrl ? 'Foto Terunggah ✓' : 'Unggah Foto Bahan'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileToDataUrl(f, (url) => setOffForm({ ...offForm, photoUrl: url }));
                    }}
                  />
                </label>

                <label className="p-3 rounded-xl border border-dashed border-[#5D4037] bg-[#F9FBF7] cursor-pointer text-center">
                  <FileText className="w-4 h-4 text-[#5D4037] mx-auto mb-1" />
                  <span className="font-semibold text-[#5D4037] truncate block">
                    {offForm.qualityDocName || 'Unggah Dokumen Mutu (Opsional)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileToDataUrl(f, (url, name) => setOffForm({ ...offForm, qualityDocUrl: url, qualityDocName: name }));
                    }}
                  />
                </label>
              </div>

              <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white font-semibold mt-2">
                Simpan Penawaran
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-4xl p-6 relative max-h-[90vh] overflow-auto">
            <button type="button" onClick={() => setShowCompareModal(false)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-[#144A17] mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#2E7D32]" /> Perbandingan Harga & Spesifikasi Antarpemasok
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E8DF] text-[#5B665C]">
                    <th className="py-2 pr-4">Parameter</th>
                    {comparedItems.map((m) => (
                      <th key={m.id} className="py-2 px-3 text-[#144A17] font-bold">{m.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8DF]">
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Pemasok</td>
                    {comparedItems.map((m) => <td key={m.id} className="py-2.5 px-3">{m.company_name}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Kategori</td>
                    {comparedItems.map((m) => <td key={m.id} className="py-2.5 px-3">{m.category}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Harga / kg</td>
                    {comparedItems.map((m) => (
                      <td key={m.id} className="py-2.5 px-3 font-extrabold text-[#144A17] tabular-nums">{formatRupiah(m.price_per_unit)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Stok Tersedia</td>
                    {comparedItems.map((m) => <td key={m.id} className="py-2.5 px-3 tabular-nums">{m.stock_available} kg</td>)}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Lokasi</td>
                    {comparedItems.map((m) => <td key={m.id} className="py-2.5 px-3">{m.origin_region}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Estimasi Kirim</td>
                    {comparedItems.map((m) => <td key={m.id} className="py-2.5 px-3">{m.estimated_delivery}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-semibold">Verifikasi</td>
                    {comparedItems.map((m) => <td key={m.id} className="py-2.5 px-3">{m.verified_status} (★ {m.supplier_rating})</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RFQ Modal (Admin) */}
      {rfqTarget && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch<any>('/api/supply/rfqs', {
                method: 'POST',
                body: JSON.stringify({
                  rawMaterialId: rfqTarget.id,
                  quantityKg: rfqForm.quantityKg,
                  targetPricePerKg: rfqForm.targetPrice,
                  deliveryEstimate: rfqForm.deliveryEstimate,
                  notes: rfqForm.notes,
                }),
              });
              onNotify(`RFQ ${res.rfqCode} dikirim ke ${rfqTarget.company_name}.`);
              setRfqTarget(null);
              loadSupply();
            }}
            className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-md p-6 relative space-y-3 text-xs"
          >
            <button type="button" onClick={() => setRfqTarget(null)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-[#144A17]">Kirim Request for Quotation (RFQ)</h3>
            <p className="text-[#5B665C]">{rfqTarget.name} · {rfqTarget.company_name}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="font-semibold">
                Jumlah (kg)
                <input
                  type="number"
                  min={1}
                  value={rfqForm.quantityKg}
                  onChange={(e) => setRfqForm({ ...rfqForm, quantityKg: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                />
              </label>
              <label className="font-semibold">
                Target Harga / kg
                <input
                  type="number"
                  min={100}
                  value={rfqForm.targetPrice}
                  onChange={(e) => setRfqForm({ ...rfqForm, targetPrice: Number(e.target.value) })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
                />
              </label>
            </div>
            <textarea
              rows={2}
              value={rfqForm.notes}
              onChange={(e) => setRfqForm({ ...rfqForm, notes: e.target.value })}
              placeholder="Catatan permintaan penawaran..."
              className="w-full p-2.5 rounded-lg border border-[#D7DED3]"
            />
            <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white font-semibold">
              Kirim RFQ ke Pemasok
            </button>
          </form>
        </div>
      )}

      {/* Create PO Modal (Admin) */}
      {poTarget && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apiFetch<any>('/api/supply/orders', {
                method: 'POST',
                body: JSON.stringify({
                  rawMaterialId: poTarget.id,
                  quantity: poQty,
                  quotePrice: poTarget.price_per_unit,
                  notes: poNotes,
                }),
              });
              onNotify(`Purchase Order ${res.poCode} diterbitkan!`);
              setPoTarget(null);
              loadSupply();
            }}
            className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-md p-6 relative space-y-3 text-xs"
          >
            <button type="button" onClick={() => setPoTarget(null)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-[#144A17]">Terbitkan Purchase Order (PO)</h3>
            <p className="font-semibold text-[#1C241D]">{poTarget.name} · {formatRupiah(poTarget.price_per_unit)}/kg</p>
            <label className="block font-semibold">
              Jumlah Pembelian (kg)
              <input
                type="number"
                min={1}
                value={poQty}
                onChange={(e) => setPoQty(Number(e.target.value))}
                className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
              />
            </label>
            <p className="text-sm font-extrabold text-[#144A17] tabular-nums">
              Total PO: {formatRupiah(poQty * poTarget.price_per_unit)}
            </p>
            <textarea
              rows={2}
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
              placeholder="Catatan pengiriman ke gudang MORIFRASS..."
              className="w-full p-2.5 rounded-lg border border-[#D7DED3]"
            />
            <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white font-semibold">
              Terbitkan Purchase Order
            </button>
          </form>
        </div>
      )}

      {/* Supplier Counter-Offer Modal */}
      {counterRfq && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch(`/api/supply/rfqs/${counterRfq.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'Penawaran Balik', offeredPricePerKg: counterPrice, supplierNotes: counterNotes }),
              });
              onNotify('Penawaran balik dikirim ke tim MORIFRASS.');
              setCounterRfq(null);
              loadSupply();
            }}
            className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-sm p-6 relative space-y-3 text-xs"
          >
            <button type="button" onClick={() => setCounterRfq(null)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-[#144A17]">Ajukan Harga Penawaran · {counterRfq.rfq_code}</h3>
            <label className="block font-semibold">
              Harga Penawaran Anda (Rp/kg)
              <input
                type="number"
                required
                value={counterPrice}
                onChange={(e) => setCounterPrice(Number(e.target.value))}
                className="w-full mt-1 h-10 px-3 rounded-lg border border-[#D7DED3]"
              />
            </label>
            <textarea
              rows={2}
              value={counterNotes}
              onChange={(e) => setCounterNotes(e.target.value)}
              placeholder="Keterangan kesanggupan pengiriman..."
              className="w-full p-2.5 rounded-lg border border-[#D7DED3]"
            />
            <button type="submit" className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white font-semibold">
              Kirim Penawaran Balik
            </button>
          </form>
        </div>
      )}

      {/* Supplier Ship PO Modal */}
      {shipTarget && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch(`/api/supply/orders/${shipTarget.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'Dikirim', trackingNumber: shipTracking, estimatedArrival: shipEta }),
              });
              onNotify('Status pengiriman diperbarui menjadi Dikirim.');
              setShipTarget(null);
              loadSupply();
            }}
            className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-sm p-6 relative space-y-3 text-xs"
          >
            <button type="button" onClick={() => setShipTarget(null)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-[#144A17]">Input Pengiriman {shipTarget.po_code}</h3>
            <input
              type="text"
              required
              value={shipTracking}
              onChange={(e) => setShipTracking(e.target.value)}
              placeholder="Nomor Resi / Surat Jalan"
              className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] font-mono"
            />
            <input
              type="date"
              value={shipEta}
              onChange={(e) => setShipEta(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#D7DED3]"
            />
            <button type="submit" className="w-full py-2.5 rounded-lg bg-[#2E7D32] text-white font-semibold">
              Konfirmasi Dikirim
            </button>
          </form>
        </div>
      )}

      {/* Admin Chat Modal */}
      {chatSupplier && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-md p-5 relative flex flex-col h-[460px]">
            <button type="button" onClick={() => setChatSupplier(null)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-[#144A17] mb-1">Chat dengan {chatSupplier.company_name}</h3>
            <p className="text-[11px] text-[#5B665C] mb-3">{chatSupplier.contact_name} · {chatSupplier.phone}</p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3 border-y border-[#E3E8DF] py-3">
              {chatMessages.map((msg) => {
                const isAdminMsg = msg.sender_role === 'admin';
                return (
                  <div key={msg.id} className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-[#5B665C]">{msg.sender_name}</span>
                    <div
                      className={`px-3 py-2 rounded-xl text-xs max-w-[82%] ${
                        isAdminMsg ? 'bg-[#144A17] text-white' : 'bg-[#F1F4EF] text-[#1C241D]'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={(e) => handleSendChat(e, chatSupplier.id)} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ketik pesan..."
                className="flex-1 h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
              />
              <button type="submit" className="px-4 h-10 rounded-lg bg-[#144A17] text-white text-xs font-semibold">
                Kirim
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Detail & Performance Evaluation Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3E8DF] w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto space-y-4 text-xs">
            <button type="button" onClick={() => setSelectedSupplier(null)} className="absolute top-4 right-4 text-[#5B665C]">
              <X className="w-5 h-5" />
            </button>
            <div>
              <span className="font-semibold text-[#2E7D32]">{selectedSupplier.category} · {selectedSupplier.verified_status}</span>
              <h3 className="text-xl font-extrabold text-[#144A17] mt-0.5">{selectedSupplier.company_name}</h3>
              <p className="text-[#5B665C] mt-1">{selectedSupplier.contact_name} · {selectedSupplier.phone} · {selectedSupplier.location}</p>
              {selectedSupplier.description && <p className="text-[#41493f] mt-2">{selectedSupplier.description}</p>}
            </div>

            <div className="pt-3 border-t border-[#E3E8DF]">
              <h4 className="font-bold text-[#144A17] mb-2">Evaluasi Kinerja Pemasok (★ {selectedSupplier.eval_avg || selectedSupplier.rating})</h4>
              <div className="space-y-2 mb-3">
                {(selectedSupplier.evaluations || []).map((ev: any) => (
                  <div key={ev.id} className="p-2.5 rounded-lg bg-[#F9FBF7] border border-[#E3E8DF]">
                    <p className="font-bold text-[#144A17]">
                      Skor {ev.overall_score}/5 (Waktu {ev.timeliness_score} · Mutu {ev.quality_score} · Komunikasi {ev.communication_score})
                    </p>
                    <p className="text-[#5B665C] mt-0.5">{ev.notes}</p>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await apiFetch('/api/supply/evaluations', {
                      method: 'POST',
                      body: JSON.stringify({
                        supplierId: selectedSupplier.id,
                        timelinessScore: evalScores.timeliness,
                        qualityScore: evalScores.quality,
                        communicationScore: evalScores.communication,
                        notes: evalScores.notes,
                      }),
                    });
                    onNotify('Evaluasi kinerja pemasok tersimpan.');
                    setSelectedSupplier(null);
                    loadSupply();
                  }}
                  className="space-y-2.5 p-3.5 rounded-xl bg-[#F1F4EF]"
                >
                  <p className="font-bold text-[#144A17]">Tambah Evaluasi Baru</p>
                  <div className="grid grid-cols-3 gap-2">
                    <label>
                      Ketepatan Waktu
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={evalScores.timeliness}
                        onChange={(e) => setEvalScores({ ...evalScores, timeliness: Number(e.target.value) })}
                        className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                      />
                    </label>
                    <label>
                      Kesesuaian Mutu
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={evalScores.quality}
                        onChange={(e) => setEvalScores({ ...evalScores, quality: Number(e.target.value) })}
                        className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                      />
                    </label>
                    <label>
                      Komunikasi
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={evalScores.communication}
                        onChange={(e) => setEvalScores({ ...evalScores, communication: Number(e.target.value) })}
                        className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={evalScores.notes}
                    onChange={(e) => setEvalScores({ ...evalScores, notes: e.target.value })}
                    placeholder="Catatan evaluasi kinerja..."
                    className="w-full h-9 px-2.5 rounded border border-[#D7DED3] bg-white"
                  />
                  <button type="submit" className="w-full py-2 rounded-lg bg-[#144A17] text-white font-semibold">
                    Simpan Evaluasi
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
