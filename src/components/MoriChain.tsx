import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  QrCode,
  ShieldCheck,
  Search,
  Upload,
  Camera,
  Factory,
  FlaskConical,
  Truck,
  Link2,
  Download,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, formatDate } from '../lib/api';

interface MoriChainProps {
  initialBatchCode?: string;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const MoriChain: React.FC<MoriChainProps> = ({ initialBatchCode, onNotify }) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [query, setQuery] = useState(initialBatchCode || 'BATCH-MF-2026-001');
  const [passport, setPassport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadBatches = async () => {
    try {
      const data = await apiFetch<{ batches: any[] }>('/api/trace');
      setBatches(data.batches || []);
    } catch {
      // ignore
    }
  };

  const fetchPassport = async (code: string) => {
    const clean = code.replace(/^MORIFRASS:/i, '').trim();
    if (!clean) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ passport: any }>(`/api/trace/${encodeURIComponent(clean)}`);
      setPassport(data.passport);
      setQuery(data.passport.batch_code);
    } catch (err: any) {
      onNotify(err.message, true);
      setPassport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
    fetchPassport(initialBatchCode || 'BATCH-MF-2026-001');
    return () => stopCamera();
  }, [initialBatchCode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCameraScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          scanVideoFrame();
        }
      }, 150);
    } catch {
      onNotify('Kamera tidak tersedia. Gunakan fitur Upload Gambar QR atau pilih Batch ID.', true);
    }
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code?.data) {
          stopCamera();
          onNotify(`QR Code terdeteksi: ${code.data}`);
          fetchPassport(code.data);
          return;
        }
      }
    }
    if (streamRef.current) {
      requestAnimationFrame(scanVideoFrame);
    }
  };

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height);
      if (decoded?.data) {
        onNotify(`QR terbaca: ${decoded.data}`);
        fetchPassport(decoded.data);
      } else {
        onNotify('QR Code tidak terbaca dari gambar tersebut.', true);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      {/* Header & Scanner Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#144A17]">MORI-CHAIN Product Passport</h1>
          <p className="text-sm text-[#5B665C]">
            Ketertelusuran batch berbasis QR Code unik & pencatatan simulasi Blockchain ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cameraActive ? stopCamera : startCameraScan}
            className="px-4 py-2.5 rounded-lg bg-[#2E7D32] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#144A17]"
          >
            <Camera className="w-4 h-4" />
            {cameraActive ? 'Hentikan Kamera' : 'Scan Kamera QR'}
          </button>
          <label className="px-4 py-2.5 rounded-lg border border-[#5D4037] text-[#5D4037] bg-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#EFEBE9]">
            <Upload className="w-4 h-4" />
            Upload Gambar QR
            <input type="file" accept="image/*" onChange={handleUploadQrImage} className="hidden" />
          </label>
        </div>
      </div>

      {/* Camera Preview if active */}
      {cameraActive && (
        <div className="mb-6 bg-black rounded-2xl overflow-hidden max-w-md mx-auto relative">
          <video ref={videoRef} className="w-full h-64 object-cover" muted playsInline />
          <p className="text-center text-white text-xs py-2 bg-[#144A17]">Arahkan kamera ke QR Code kemasan MORIFRASS</p>
        </div>
      )}

      {/* Search & Quick Batch Pills */}
      <div className="bg-white border border-[#E3E8DF] rounded-2xl p-4 sm:p-5 mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchPassport(query);
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5B665C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Masukkan Batch ID (mis. BATCH-MF-2026-001)"
              className="w-full h-11 pl-10 pr-4 rounded-lg border border-[#D7DED3] bg-[#F9FBF7] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20]"
          >
            {loading ? 'Mencari...' : 'Verifikasi Batch'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-[#5B665C]">Batch Terdaftar:</span>
          {batches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => fetchPassport(b.batch_code)}
              className={`px-3 py-1 rounded-md text-xs font-mono font-semibold border transition-colors ${
                passport?.batch_code === b.batch_code
                  ? 'bg-[#144A17] text-white border-[#144A17]'
                  : 'bg-[#F9FBF7] text-[#144A17] border-[#E3E8DF] hover:bg-[#F1F4EF]'
              }`}
            >
              {b.batch_code}
            </button>
          ))}
        </div>
      </div>

      {/* Product Passport Output */}
      {passport && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left QR Card & Batch Summary */}
          <div className="lg:col-span-4 bg-white border border-[#E3E8DF] rounded-2xl p-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#144A17] text-[#A5D6A7] text-xs font-semibold mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              {passport.verification_status}
            </div>

            {passport.qr_data_url && (
              <div className="bg-[#F9FBF7] border border-[#E3E8DF] rounded-xl p-4 inline-block mb-4">
                <img src={passport.qr_data_url} alt={`QR ${passport.batch_code}`} className="w-44 h-44 mx-auto" />
              </div>
            )}

            <h2 className="text-lg font-extrabold text-[#144A17] font-mono">{passport.batch_code}</h2>
            <p className="text-xs text-[#5B665C] mt-1">{passport.product_name} ({passport.net_weight_kg} kg)</p>

            {passport.qr_data_url && (
              <a
                href={passport.qr_data_url}
                download={`${passport.batch_code}-QR.png`}
                className="mt-4 w-full py-2 px-4 rounded-lg border border-[#2E7D32] text-[#2E7D32] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#F1F4EF]"
              >
                <Download className="w-3.5 h-3.5" /> Unduh QR Batch (Uji Scan)
              </a>
            )}

            <div className="mt-5 pt-4 border-t border-[#E3E8DF] text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5B665C]">Tgl Produksi</span>
                <span className="font-semibold">{formatDate(passport.production_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B665C]">Tgl Pengemasan</span>
                <span className="font-semibold">{formatDate(passport.packaging_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B665C]">Jumlah Kemasan</span>
                <span className="font-semibold tabular-nums">{passport.pouches_produced} pcs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B665C]">Total Scan QR</span>
                <span className="font-semibold tabular-nums">{passport.scan_count}×</span>
              </div>
            </div>
          </div>

          {/* Right Passport Details */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Komposisi & Pemasok */}
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6">
              <div className="flex items-center gap-2 text-[#144A17] font-bold text-base mb-4">
                <Factory className="w-5 h-5 text-[#2E7D32]" />
                Asal Bahan Baku & Pemasok Terhubung
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {passport.compositions?.map((c: any) => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#1C241D]">{c.material_name}</p>
                      <span className="text-xs font-bold text-[#2E7D32] tabular-nums">{c.percentage}%</span>
                    </div>
                    <p className="text-[11px] text-[#5B665C] mt-1">
                      Pemasok: {c.supplier_name || 'Internal'} · {c.origin}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Hasil Quality Control */}
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 text-[#144A17] font-bold text-base">
                  <FlaskConical className="w-5 h-5 text-[#2E7D32]" />
                  Quality Control & Uji Lab
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F1F4EF] text-[#144A17] border border-[#E3E8DF]">
                  {passport.qualityTest?.status || 'Menunggu pengujian'}
                </span>
              </div>

              {passport.qualityTest?.status === 'Menunggu pengujian' ? (
                <div className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] text-xs text-[#5B665C] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#F9A825]" />
                  Hasil uji laboratorium belum diinput admin untuk batch ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                    <p className="text-[#5B665C]">Kadar Air</p>
                    <p className="text-sm font-bold text-[#144A17] tabular-nums mt-0.5">
                      {passport.qualityTest?.moisture_pct ?? '-'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                    <p className="text-[#5B665C]">pH Tanah/Pupuk</p>
                    <p className="text-sm font-bold text-[#144A17] tabular-nums mt-0.5">
                      {passport.qualityTest?.ph_level ?? '-'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                    <p className="text-[#5B665C]">C-Organik</p>
                    <p className="text-sm font-bold text-[#144A17] tabular-nums mt-0.5">
                      {passport.qualityTest?.c_organic_pct ?? '-'}%
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                    <p className="text-[#5B665C]">Rasio C/N</p>
                    <p className="text-sm font-bold text-[#144A17] tabular-nums mt-0.5">
                      {passport.qualityTest?.cn_ratio ?? '-'}
                    </p>
                  </div>
                </div>
              )}
              {passport.qualityTest?.npk_summary && (
                <p className="text-xs text-[#5B665C] mt-3">
                  Unsur Hara: <strong className="text-[#1C241D]">{passport.qualityTest.npk_summary}</strong> ·{' '}
                  {passport.qualityTest.lab_result_summary}
                </p>
              )}
            </div>

            {/* 3. Distribusi & Simulasi Blockchain Ledger */}
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 text-[#144A17] font-bold text-base">
                  <Link2 className="w-5 h-5 text-[#2E7D32]" />
                  Riwayat Pencatatan Ledger
                </div>
                <span className="text-[11px] font-semibold text-[#5D4037] bg-[#EFEBE9] px-2.5 py-1 rounded-md">
                  Simulasi Ledger Prototype (Bukan Mainnet)
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#5B665C] mb-4 pb-3 border-b border-[#E3E8DF]">
                <Truck className="w-4 h-4 text-[#2E7D32]" />
                <span>
                  Distribusi: <strong className="text-[#1C241D]">{passport.distribution_region}</strong> ({passport.distributor_name})
                </span>
              </div>

              <div className="space-y-2.5">
                {passport.ledgerRecords?.map((rec: any) => (
                  <div key={rec.id} className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#144A17]">
                        Block #{rec.block_number} · {rec.action_type}
                      </span>
                      <span className="font-mono text-[11px] text-[#5B665C]">{rec.timestamp}</span>
                    </div>
                    <p className="text-[#41493f] mt-1">{rec.payload_summary}</p>
                    <p className="font-mono text-[10px] text-[#5B665C] mt-1 truncate">
                      TxID: {rec.tx_id} · Hash: {rec.record_hash}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
