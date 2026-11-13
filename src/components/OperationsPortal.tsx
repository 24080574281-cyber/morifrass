import React, { useEffect, useState } from 'react';
import {
  Factory,
  FlaskConical,
  LayoutDashboard,
  PackageCheck,
  CheckCircle2,
  Plus,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch, formatDate, formatRupiah } from '../lib/api';
import type { ActiveTab, AuthUser } from '../types';

interface OperationsPortalProps {
  mode: 'production' | 'quality' | 'admin' | 'distributor';
  user: AuthUser | null;
  onTraceBatch: (batchCode: string) => void;
  onNotify: (msg: string, isError?: boolean) => void;
  onOpenAuth: () => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const OperationsPortal: React.FC<OperationsPortalProps> = ({
  mode,
  user,
  onTraceBatch,
  onNotify,
  onOpenAuth,
}) => {
  // Production state
  const [prodData, setProdData] = useState<any>(null);
  const [batchQtyKg, setBatchQtyKg] = useState(100);
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [formulationNote, setFormulationNote] = useState(
    'Formulasi awal (dapat diedit admin — Frass BSF 50%, Kompos 30%, Biochar 12%, Kelor 8%).'
  );
  const [compPcts, setCompPcts] = useState({ bsf: 50, kompos: 30, biochar: 12, kelor: 8 });

  // Quality state
  const [qcTests, setQcTests] = useState<any[]>([]);
  const [editingQc, setEditingQc] = useState<any>(null);

  // Admin overview + orders + market/edu CRUD
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);

  // Distributor state
  const [distBatchCode, setDistBatchCode] = useState('BATCH-MF-2026-001');
  const [distRegion, setDistRegion] = useState('Surabaya & Malang Raya');
  const [distName, setDistName] = useState('Mitra Logistik Agritech');
  const [trackingInputs, setTrackingInputs] = useState<Record<number, string>>({});

  const loadData = async () => {
    if (!user) return;
    try {
      if (mode === 'production' && user.role === 'admin') {
        const res = await apiFetch('/api/production');
        setProdData(res);
      } else if (mode === 'quality' && user.role === 'admin') {
        const res = await apiFetch('/api/quality');
        setQcTests(res.tests || []);
      } else if (mode === 'admin' && user.role === 'admin') {
        const [ov, ord, mkt, edu] = await Promise.all([
          apiFetch('/api/admin/overview'),
          apiFetch('/api/orders'),
          apiFetch('/api/market'),
          apiFetch('/api/edu'),
        ]);
        setAdminOverview(ov);
        setOrders(ord.orders || []);
        setBundles(mkt.bundles || []);
        setRewards(edu.rewards || []);
      } else if (mode === 'distributor' && (user.role === 'distributor' || user.role === 'admin')) {
        const ord = await apiFetch('/api/orders');
        setOrders(ord.orders || []);
      }
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode, user?.id, user?.role]);

  // Access Guards
  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-[#5D4037] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#144A17]">Masuk Diperlukan</h2>
        <p className="text-sm text-[#5B665C] mt-1 mb-5">Modul operasional memerlukan autentikasi sesuai peran pengguna.</p>
        <button type="button" onClick={onOpenAuth} className="px-6 py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold">
          Masuk Sekarang
        </button>
      </div>
    );
  }

  const forbidden =
    (mode === 'production' && user.role !== 'admin') ||
    (mode === 'quality' && user.role !== 'admin') ||
    (mode === 'admin' && user.role !== 'admin') ||
    (mode === 'distributor' && user.role !== 'distributor' && user.role !== 'admin');

  if (forbidden) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-[#ba1a1a] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#144A17]">Akses Terbatas</h2>
        <p className="text-sm text-[#5B665C] mt-1">
          Peran akun Anda (<strong>{user.role}</strong>) tidak memiliki hak akses untuk modul ini.
        </p>
      </div>
    );
  }

  // Handlers
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalPct = compPcts.bsf + compPcts.kompos + compPcts.biochar + compPcts.kelor;
    if (totalPct !== 100) {
      onNotify(`Total persentase komposisi harus 100% (saat ini ${totalPct}%).`, true);
      return;
    }
    try {
      const res = await apiFetch<any>('/api/production/batches', {
        method: 'POST',
        body: JSON.stringify({
          quantityKg: batchQtyKg,
          productionDate: batchDate,
          packagingDate: batchDate,
          formulationNote,
          compositions: [
            { rawMaterialId: 1, supplierId: 1, materialName: 'Frass Black Soldier Fly (BSF)', percentage: compPcts.bsf, origin: 'Bojonegoro, Jatim' },
            { rawMaterialId: 4, supplierId: 4, materialName: 'Kompos Matang Terfermentasi', percentage: compPcts.kompos, origin: 'Sidoarjo, Jatim' },
            { rawMaterialId: 3, supplierId: 3, materialName: 'Biochar Sekam Padi', percentage: compPcts.biochar, origin: 'Ngawi, Jatim' },
            { rawMaterialId: 2, supplierId: 2, materialName: 'Serbuk Daun Kelor (Moringa oleifera)', percentage: compPcts.kelor, origin: 'Sumenep, Madura' },
          ],
        }),
      });
      onNotify(`Batch ${res.batchCode} dibuat, stok bertambah, dan QR Code unik siap dipindai!`);
      loadData();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleSaveQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQc) return;
    try {
      await apiFetch(`/api/quality/${editingQc.batch_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          moisturePct: editingQc.moisture_pct,
          phLevel: editingQc.ph_level,
          npkSummary: editingQc.npk_summary,
          cOrganicPct: editingQc.c_organic_pct,
          cnRatio: editingQc.cn_ratio,
          labResultSummary: editingQc.lab_result_summary,
          testDate: editingQc.test_date,
          documentRef: editingQc.document_ref,
          status: editingQc.status,
        }),
      });
      setEditingQc(null);
      onNotify('Hasil Quality Control diperbarui & dicatat ke simulasi ledger.');
      loadData();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      {/* ======================================================== */}
      {/* 2. MORI-PRODUCTION */}
      {/* ======================================================== */}
      {mode === 'production' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Factory className="w-6 h-6 text-[#2E7D32]" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#144A17]">MORI-PRODUCTION · Manajemen Produksi & Stok</h1>
              <p className="text-xs text-[#5B665C]">Buat batch otomatis, kelola formulasi awal, dan cetak QR Code MORI-CHAIN.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateBatch} className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-6 space-y-3.5">
              <h2 className="text-base font-bold text-[#144A17]">Buat Batch Produksi Baru</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Jumlah Produksi (kg / pcs)</label>
                  <input
                    type="number"
                    min={10}
                    value={batchQtyKg}
                    onChange={(e) => setBatchQtyKg(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tanggal Produksi</label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={(e) => setBatchDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Komposisi Formulasi Awal (Total 100%)</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="p-2 rounded-lg bg-[#F9FBF7] border border-[#E3E8DF]">
                    Frass BSF (%)
                    <input
                      type="number"
                      value={compPcts.bsf}
                      onChange={(e) => setCompPcts({ ...compPcts, bsf: Number(e.target.value) })}
                      className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                    />
                  </label>
                  <label className="p-2 rounded-lg bg-[#F9FBF7] border border-[#E3E8DF]">
                    Kompos (%)
                    <input
                      type="number"
                      value={compPcts.kompos}
                      onChange={(e) => setCompPcts({ ...compPcts, kompos: Number(e.target.value) })}
                      className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                    />
                  </label>
                  <label className="p-2 rounded-lg bg-[#F9FBF7] border border-[#E3E8DF]">
                    Biochar (%)
                    <input
                      type="number"
                      value={compPcts.biochar}
                      onChange={(e) => setCompPcts({ ...compPcts, biochar: Number(e.target.value) })}
                      className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                    />
                  </label>
                  <label className="p-2 rounded-lg bg-[#F9FBF7] border border-[#E3E8DF]">
                    Daun Kelor (%)
                    <input
                      type="number"
                      value={compPcts.kelor}
                      onChange={(e) => setCompPcts({ ...compPcts, kelor: Number(e.target.value) })}
                      className="w-full mt-1 h-8 px-2 rounded border border-[#D7DED3] bg-white"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Catatan Formulasi</label>
                <textarea
                  rows={2}
                  value={formulationNote}
                  onChange={(e) => setFormulationNote(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#D7DED3] text-xs"
                />
              </div>

              <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" /> Buat Batch & Generate QR Unik
              </button>
            </form>

            <div className="lg:col-span-7 space-y-6">
              {/* Inventory Summary */}
              <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
                <h2 className="text-sm font-bold text-[#144A17] mb-3">Persediaan Bahan Baku & Produk Jadi</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(prodData?.inventory || []).map((inv: any) => (
                    <div key={inv.id} className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#1C241D]">{inv.item_name}</p>
                        <p className="text-[11px] text-[#5B665C]">{inv.item_type === 'finished_good' ? 'Produk Jadi' : 'Bahan Baku'}</p>
                      </div>
                      <span className="font-mono font-bold text-[#144A17] tabular-nums">
                        {inv.quantity} {inv.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Production Batches */}
              <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
                <h2 className="text-sm font-bold text-[#144A17] mb-3">Riwayat Batch Produksi</h2>
                <div className="space-y-3">
                  {(prodData?.batches || []).map((b: any) => (
                    <div key={b.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-mono font-bold text-[#144A17]">{b.batch_code}</p>
                        <p className="text-[#5B665C]">
                          {b.pouches_produced} pouch 1 kg · Prod: {formatDate(b.production_date)} · QC: <strong>{b.qc_status}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onTraceBatch(b.batch_code)}
                        className="px-3 py-1.5 rounded-lg border border-[#5D4037] text-[#5D4037] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EFEBE9]"
                      >
                        <QrCode className="w-3.5 h-3.5" /> Lihat QR Passport
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MORI-QUALITY */}
      {/* ======================================================== */}
      {mode === 'quality' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-[#2E7D32]" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#144A17]">MORI-QUALITY · Pengendalian Mutu Batch</h1>
              <p className="text-xs text-[#5B665C]">Seluruh status mutu berdasarkan hasil pengujian laboratorium yang diinput admin.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              {qcTests.map((t) => (
                <div key={t.id} className="bg-white border border-[#E3E8DF] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-mono font-bold text-[#144A17]">{t.batch_code}</p>
                    <p className="text-[#5B665C] mt-0.5">
                      Air: {t.moisture_pct ?? '-'}% · pH: {t.ph_level ?? '-'} · C-Org: {t.c_organic_pct ?? '-'}% · C/N: {t.cn_ratio ?? '-'}
                    </p>
                    <p className="font-semibold text-[#2E7D32] mt-1">Status: {t.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingQc({ ...t })}
                    className="px-3.5 py-2 rounded-lg bg-[#144A17] text-white font-semibold"
                  >
                    Input / Edit Uji Lab
                  </button>
                </div>
              ))}
            </div>

            {editingQc && (
              <form onSubmit={handleSaveQc} className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-6 space-y-3">
                <h2 className="text-base font-bold text-[#144A17]">Form Uji Lab · {editingQc.batch_code}</h2>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <label>
                    Kadar Air (%)
                    <input
                      type="number"
                      step="0.1"
                      value={editingQc.moisture_pct ?? ''}
                      onChange={(e) => setEditingQc({ ...editingQc, moisture_pct: e.target.value })}
                      className="w-full mt-1 h-9 px-2.5 rounded-lg border border-[#D7DED3]"
                    />
                  </label>
                  <label>
                    pH
                    <input
                      type="number"
                      step="0.1"
                      value={editingQc.ph_level ?? ''}
                      onChange={(e) => setEditingQc({ ...editingQc, ph_level: e.target.value })}
                      className="w-full mt-1 h-9 px-2.5 rounded-lg border border-[#D7DED3]"
                    />
                  </label>
                  <label>
                    C-Organik (%)
                    <input
                      type="number"
                      step="0.1"
                      value={editingQc.c_organic_pct ?? ''}
                      onChange={(e) => setEditingQc({ ...editingQc, c_organic_pct: e.target.value })}
                      className="w-full mt-1 h-9 px-2.5 rounded-lg border border-[#D7DED3]"
                    />
                  </label>
                  <label>
                    Rasio C/N
                    <input
                      type="number"
                      step="0.1"
                      value={editingQc.cn_ratio ?? ''}
                      onChange={(e) => setEditingQc({ ...editingQc, cn_ratio: e.target.value })}
                      className="w-full mt-1 h-9 px-2.5 rounded-lg border border-[#D7DED3]"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={editingQc.npk_summary || ''}
                  onChange={(e) => setEditingQc({ ...editingQc, npk_summary: e.target.value })}
                  placeholder="Unsur hara (mis. N 2.8% · P 1.9% · K 2.4%)"
                  className="w-full h-9 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <input
                  type="text"
                  value={editingQc.document_ref || ''}
                  onChange={(e) => setEditingQc({ ...editingQc, document_ref: e.target.value })}
                  placeholder="Nomor Dokumen Uji Lab"
                  className="w-full h-9 px-3 rounded-lg border border-[#D7DED3] text-xs"
                />
                <select
                  value={editingQc.status}
                  onChange={(e) => setEditingQc({ ...editingQc, status: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs bg-white font-semibold"
                >
                  <option>Menunggu pengujian</option>
                  <option>Dalam pemeriksaan</option>
                  <option>Lulus pemeriksaan</option>
                  <option>Memerlukan evaluasi</option>
                </select>
                <textarea
                  rows={2}
                  value={editingQc.lab_result_summary || ''}
                  onChange={(e) => setEditingQc({ ...editingQc, lab_result_summary: e.target.value })}
                  placeholder="Ringkasan hasil uji..."
                  className="w-full p-2.5 rounded-lg border border-[#D7DED3] text-xs"
                />
                <button type="submit" className="w-full py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold">
                  Simpan Hasil Pengujian
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. ADMIN DASHBOARD */}
      {/* ======================================================== */}
      {mode === 'admin' && adminOverview && (
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-6 h-6 text-[#2E7D32]" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#144A17]">Dashboard Ekosistem Admin MORIFRASS</h1>
              <p className="text-xs text-[#5B665C]">Ringkasan penjualan, stok, QC, QR scan, poin MORI-EDU, dan pengelolaan CRUD.</p>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {[
              { label: 'Total Pendapatan', value: formatRupiah(adminOverview.kpis.total_revenue) },
              { label: 'Produk Terjual', value: `${adminOverview.kpis.total_units} pcs` },
              { label: 'Pesanan / Pelanggan', value: `${adminOverview.kpis.total_orders} / ${adminOverview.kpis.customers}` },
              { label: 'Stok Jadi / Bahan', value: `${adminOverview.kpis.finishedStock} / ${adminOverview.kpis.rawStock}` },
              { label: 'Batch / QR Scan', value: `${adminOverview.kpis.batches} / ${adminOverview.kpis.qrScans}×` },
              { label: 'Poin / Voucher', value: `${adminOverview.kpis.pointsDistributed} / ${adminOverview.kpis.vouchersRedeemed}` },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-[#E3E8DF] rounded-xl p-4">
                <p className="text-[11px] text-[#5B665C]">{k.label}</p>
                <p className="text-base font-extrabold text-[#144A17] mt-1 tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Clean Bar Charts (Monthly Sales & User Activity) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#144A17]">Grafik Penjualan Bulanan (Simulasi + Aktual)</h2>
                <span className="text-[11px] text-[#5B665C]">IDR</span>
              </div>
              <div className="h-44 flex items-end gap-4 pt-4">
                {adminOverview.monthlySalesSeries.map((m: any) => {
                  const maxRev = Math.max(...adminOverview.monthlySalesSeries.map((x: any) => x.revenue), 1);
                  const hPct = Math.max(15, Math.round((m.revenue / maxRev) * 100));
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-mono text-[#5B665C] tabular-nums">{(m.revenue / 1000000).toFixed(1)}jt</span>
                      <div className="w-full bg-[#2E7D32] rounded-t-lg transition-all" style={{ height: `${hPct}%` }} />
                      <span className="text-xs font-semibold text-[#1C241D]">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-[#144A17] mb-4">Aktivitas Pengguna & Ketertelusuran</h2>
              <div className="space-y-3">
                {adminOverview.activitySeries.map((act: any) => (
                  <div key={act.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#1C241D]">{act.label}</span>
                      <span className="font-bold text-[#144A17] tabular-nums">{act.value}</span>
                    </div>
                    <div className="h-2.5 bg-[#F1F4EF] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#144A17] rounded-full"
                        style={{ width: `${Math.min(100, Math.max(10, act.value * 2))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Orders Management */}
          <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#144A17] mb-3">Kelola Pesanan & Konfirmasi Pembayaran</h2>
            <div className="space-y-2.5">
              {orders.map((o) => (
                <div key={o.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-mono font-bold text-[#144A17]">
                      {o.order_code} · {o.customer_name}
                    </p>
                    <p className="text-[#5B665C]">
                      {o.total_items} pcs · {formatRupiah(o.grand_total)} · {o.payment_method} ({o.payment_status})
                    </p>
                  </div>
                  <select
                    value={o.status}
                    onChange={async (e) => {
                      await apiFetch(`/api/orders/${o.id}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: e.target.value }),
                      });
                      onNotify(`Status pesanan ${o.order_code} diperbarui.`);
                      loadData();
                    }}
                    className="h-9 px-3 rounded-lg border border-[#D7DED3] bg-white text-xs font-semibold"
                  >
                    <option>Menunggu pembayaran</option>
                    <option>Pembayaran dikonfirmasi</option>
                    <option>Diproses</option>
                    <option>Dikemas</option>
                    <option>Dalam pengiriman</option>
                    <option>Selesai</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Bundle & Reward Admin Editors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-[#144A17] mb-3">Pengaturan Paket MORI-MARKET</h2>
              <div className="space-y-2.5">
                {bundles.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-[#1C241D]">{b.name} ({b.quantity_units} pcs)</p>
                      <p className="text-[#5B665C] tabular-nums">Harga: {formatRupiah(b.bundle_price)} (Hemat {formatRupiah(b.discount_amount)})</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const nextPrice = b.bundle_price === 99000 ? 95000 : b.bundle_price;
                        const input = window.prompt(`Ubah harga bundling untuk ${b.name}:`, String(b.bundle_price));
                        if (!input) return;
                        await apiFetch(`/api/admin/bundles/${b.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ bundle_price: Number(input || nextPrice) }),
                        });
                        onNotify(`Harga ${b.name} diperbarui.`);
                        loadData();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#144A17] text-[#144A17] font-semibold"
                    >
                      Ubah Harga
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
              <h2 className="text-sm font-bold text-[#144A17] mb-3">Pengaturan Reward & Voucher MORI-EDU</h2>
              <div className="space-y-2.5">
                {rewards.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-[#1C241D]">{r.title}</p>
                      <p className="text-[#5B665C] tabular-nums">{r.points_cost} poin · Kuota sisa {r.remaining_quota}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const input = window.prompt(`Ubah poin penukaran untuk ${r.title}:`, String(r.points_cost));
                        if (!input) return;
                        await apiFetch(`/api/admin/rewards/${r.id}`, {
                          method: 'PUT',
                          body: JSON.stringify({ pointsCost: Number(input) }),
                        });
                        onNotify(`Poin reward diperbarui.`);
                        loadData();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#2E7D32] text-[#2E7D32] font-semibold"
                    >
                      Edit Poin
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. DISTRIBUTOR PORTAL */}
      {/* ======================================================== */}
      {mode === 'distributor' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <PackageCheck className="w-6 h-6 text-[#2E7D32]" />
            <div>
              <h1 className="text-2xl font-extrabold text-[#144A17]">Portal Distributor & Pengiriman</h1>
              <p className="text-xs text-[#5B665C]">Perbarui resi pengiriman pesanan dan catat wilayah distribusi di MORI-CHAIN.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-[#E3E8DF] rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-[#144A17]">Daftar Pengiriman Pesanan</h2>
              {orders.map((o) => (
                <div key={o.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-mono font-bold text-[#144A17]">{o.order_code}</span>
                    <span className="font-semibold text-[#2E7D32]">{o.status}</span>
                  </div>
                  <p className="text-[#5B665C]">
                    Tujuan: {o.recipient_name} · {o.address}, {o.city} ({o.courier})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={trackingInputs[o.id] ?? o.tracking_number ?? ''}
                      onChange={(e) => setTrackingInputs({ ...trackingInputs, [o.id]: e.target.value })}
                      placeholder="Masukkan No. Resi"
                      className="flex-1 h-9 px-3 rounded-lg border border-[#D7DED3] bg-white text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/orders/${o.id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            status: 'Dalam pengiriman',
                            trackingNumber: trackingInputs[o.id] || `MF-RESI-${o.id}`,
                          }),
                        });
                        onNotify(`Pesanan ${o.order_code} berstatus Dalam pengiriman.`);
                        loadData();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#2E7D32] text-white font-semibold"
                    >
                      Kirim
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/orders/${o.id}/status`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'Selesai' }),
                        });
                        onNotify(`Pesanan ${o.order_code} ditandai Selesai.`);
                        loadData();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#144A17] text-white font-semibold inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch(`/api/trace/${encodeURIComponent(distBatchCode)}/distribution`, {
                  method: 'POST',
                  body: JSON.stringify({ distributionRegion: distRegion, distributorName: distName, notes: 'Diperbarui oleh Distributor' }),
                });
                onNotify(`Log distribusi batch ${distBatchCode} dicatat ke MORI-CHAIN!`);
              }}
              className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-5 space-y-3 self-start"
            >
              <h2 className="text-sm font-bold text-[#144A17]">Catat Distribusi Batch ke MORI-CHAIN</h2>
              <input
                type="text"
                value={distBatchCode}
                onChange={(e) => setDistBatchCode(e.target.value)}
                placeholder="Batch ID"
                className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs font-mono"
              />
              <input
                type="text"
                value={distRegion}
                onChange={(e) => setDistRegion(e.target.value)}
                placeholder="Wilayah Distribusi"
                className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
              />
              <input
                type="text"
                value={distName}
                onChange={(e) => setDistName(e.target.value)}
                placeholder="Nama Mitra Distribusi"
                className="w-full h-10 px-3 rounded-lg border border-[#D7DED3] text-xs"
              />
              <button type="submit" className="w-full py-2.5 rounded-lg bg-[#5D4037] text-white text-xs font-semibold">
                Perbarui Ledger Distribusi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
