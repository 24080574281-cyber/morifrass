import React, { useState } from 'react';
import {
  QrCode,
  ShieldCheck,
  Sprout,
  Recycle,
  ArrowRight,
  Star,
  Award,
  Layers,
  Leaf,
  Droplets,
  Flame,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import type { ActiveTab, ProductBundle } from '../types';
import { formatRupiah } from '../lib/api';

interface LandingPageProps {
  onNavigate: (tab: ActiveTab) => void;
  onTraceBatch: (batchCode: string) => void;
  onOpenPartnerRegister: () => void;
  bundles: ProductBundle[];
  onQuickBuyBundle: (bundle: ProductBundle) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onTraceBatch,
  onOpenPartnerRegister,
  bundles,
  onQuickBuyBundle,
}) => {
  const [quickBatch, setQuickBatch] = useState('BATCH-MF-2026-001');

  const handleQuickTrace = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickBatch.trim()) {
      onTraceBatch(quickBatch.trim());
    }
  };

  return (
    <div className="pb-20 lg:pb-0">
      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-12 lg:pt-12 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Hero Copy (Concise & High Impact) */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-wider text-[#2E7D32] uppercase mb-3">
              INTEGRATE · PRODUCE · TRACE · MARKET · EDUCATE
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#144A17] leading-tight tracking-tight text-balance mb-4">
              Growing Sustainability, Empowering Agriculture.
            </h1>
            <p className="text-base text-[#5B665C] leading-relaxed max-w-xl mb-7">
              Ekosistem agritech sirkular yang mengolah frass Black Soldier Fly (BSF) dan daun kelor menjadi pupuk bioaktif organik terverifikasi QR & Blockchain.
            </p>

            {/* Primary + Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="px-6 py-3 rounded-lg bg-[#144A17] text-white text-sm font-semibold hover:bg-[#1B5E20] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                Jelajahi Produk
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('chain')}
                className="px-5 py-3 rounded-lg border border-[#2E7D32] text-[#2E7D32] text-sm font-semibold hover:bg-[#F1F4EF] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <QrCode className="w-4 h-4" />
                Lacak Produk
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-[#5D4037]">
              <button
                type="button"
                onClick={() => onNavigate('edu')}
                className="hover:text-[#144A17] underline underline-offset-4 whitespace-nowrap"
              >
                Belajar di MORI-EDU
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenPartnerRegister}
                className="hover:text-[#144A17] underline underline-offset-4 whitespace-nowrap"
              >
                Bergabung sebagai Mitra
              </button>
            </div>
          </div>

          {/* Right Hero Visual: Official Packaging + Mascot */}
          <div className="lg:col-span-6 bg-white border border-[#E3E8DF] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-center gap-6 relative overflow-hidden">
            <img
              src="/assets/aistudio/image_817a15a9.png"
              alt="Kemasan MORIFRASS 1 kg Standing Pouch"
              className="w-48 sm:w-56 h-auto object-contain drop-shadow-md"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <img
                src="/assets/aistudio/MORIFRASS_Bee_Farmer_Mascot_69774a65.png"
                alt="Maskot Petani BSF MORIFRASS"
                className="w-36 sm:w-40 h-auto object-contain mb-3"
                referrerPolicy="no-referrer"
              />
              <p className="text-xs font-semibold text-[#5D4037]">Pupuk Bioaktif Organik · Netto 1 kg</p>
              <p className="text-lg font-bold text-[#144A17] tabular-nums">Mulai Rp35.000 / pouch</p>
              <p className="text-xs text-[#5B665C] mt-1">Frass BSF + Daun Kelor + Biochar</p>
            </div>
          </div>
        </div>

        {/* 4-Metric Proof Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {[
            { label: 'Bahan Utama Sirkular', value: 'BSF + Kelor' },
            { label: 'Dosis Anjuran Hemat', value: '100–200 g/m²' },
            { label: 'Ketertelusuran Batch', value: 'QR + Ledger' },
            { label: 'Reward Belajar', value: 'Poin -> Voucher' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-[#E3E8DF] rounded-xl px-5 py-4">
              <p className="text-xs text-[#5B665C]">{stat.label}</p>
              <p className="text-base sm:text-lg font-bold text-[#144A17] mt-0.5 tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. EKONOMI SIRKULAR & BAHAN BAKU */}
      <section className="bg-[#F1F4EF] border-y border-[#E3E8DF] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#144A17]">Komposisi & Ekonomi Sirkular</h2>
              <p className="text-sm text-[#5B665C] mt-1">Mengubah limbah organik menjadi nutrisi tanah bernilai tinggi.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('supply')}
              className="text-sm font-semibold text-[#2E7D32] hover:text-[#144A17] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              Lihat Jaringan Pemasok <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Recycle,
                title: 'Frass BSF',
                desc: 'Kaya nitrogen organik, mikroba baik, dan kitin alami.',
              },
              {
                icon: Leaf,
                title: 'Daun Kelor',
                desc: 'Biostimulan zeatin dan mineral alami pemacu tunas.',
              },
              {
                icon: Flame,
                title: 'Biochar Sekam Padi',
                desc: 'Pori mikro penjaga kelembaban dan rumah mikroba tanah.',
              },
              {
                icon: Droplets,
                title: 'Kompos Matang',
                desc: 'Menstabilkan rasio C/N serta struktur gembur tanah.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#E3E8DF] rounded-xl p-5">
                <item.icon className="w-6 h-6 text-[#2E7D32] mb-3" />
                <h3 className="text-base font-bold text-[#1C241D]">{item.title}</h3>
                <p className="text-xs text-[#5B665C] mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PREVIEW MORI-MARKET & MORI-CHAIN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Preview MORI-MARKET (3 Bundling Cards) */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#144A17]">MORI-MARKET · Kemasan 1 kg</h2>
                <p className="text-sm text-[#5B665C]">Satu formulasi bioaktif unggulan dalam 3 pilihan paket.</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('market')}
                className="text-sm font-semibold text-[#2E7D32] hover:underline whitespace-nowrap"
              >
                Buka Market
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {bundles.map((b) => (
                <div key={b.id} className="bg-white border border-[#E3E8DF] rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#5D4037]">{b.quantity_units} Kemasan (1 kg)</p>
                    <h3 className="text-base font-bold text-[#1C241D] mt-1">{b.name}</h3>
                    <div className="mt-3">
                      {b.discount_amount > 0 && (
                        <p className="text-xs text-[#5B665C] line-through tabular-nums">{formatRupiah(b.normal_price)}</p>
                      )}
                      <p className="text-xl font-extrabold text-[#144A17] tabular-nums">{formatRupiah(b.bundle_price)}</p>
                      {b.discount_amount > 0 && (
                        <p className="text-xs font-semibold text-[#2E7D32] mt-0.5 tabular-nums">Hemat {formatRupiah(b.discount_amount)}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickBuyBundle(b)}
                    className="mt-4 w-full py-2 px-3 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20] transition-colors"
                  >
                    Pilih Paket
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preview MORI-CHAIN */}
          <div className="lg:col-span-5 bg-white border border-[#E3E8DF] rounded-2xl p-6">
            <div className="flex items-center gap-2.5 text-[#144A17] mb-2">
              <ShieldCheck className="w-5 h-5 text-[#2E7D32]" />
              <h2 className="text-xl font-bold">Lacak Batch di MORI-CHAIN</h2>
            </div>
            <p className="text-xs text-[#5B665C] leading-relaxed mb-4">
              Setiap pouch dilengkapi QR Code unik untuk memeriksa asal pemasok, tanggal produksi, hasil uji QC, dan simulasi ledger pencatatan.
            </p>
            <form onSubmit={handleQuickTrace} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={quickBatch}
                onChange={(e) => setQuickBatch(e.target.value)}
                placeholder="Contoh: BATCH-MF-2026-001"
                className="flex-1 h-11 px-3.5 rounded-lg border border-[#D7DED3] bg-[#F9FBF7] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              />
              <button
                type="submit"
                className="h-11 px-4 rounded-lg bg-[#5D4037] text-white text-xs font-semibold hover:bg-[#4A322B] transition-colors whitespace-nowrap"
              >
                Buka Passport
              </button>
            </form>
            <div className="mt-4 pt-4 border-t border-[#E3E8DF] flex items-center justify-between text-xs text-[#5B665C]">
              <span>Batch Tersedia: BATCH-MF-2026-001, 002</span>
              <button type="button" onClick={() => onNavigate('chain')} className="text-[#2E7D32] font-semibold hover:underline">
                Scan QR
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PREVIEW MORI-EDU & TESTIMONI */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* MORI-EDU Card */}
          <div className="lg:col-span-6 bg-[#144A17] text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
            <img
              src="/assets/aistudio/MORIFRASS_Bee_Farmer_Mascot_69774a65.png"
              alt="Pemandu MORI-EDU"
              className="w-28 h-28 object-contain bg-white rounded-2xl p-2 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-xs font-semibold text-[#A5D6A7] uppercase tracking-wider">MORI-EDU Gamifikasi</p>
              <h3 className="text-xl sm:text-2xl font-bold mt-1">Belajar Pertanian, Tukar Voucher Belanja</h3>
              <p className="text-xs sm:text-sm text-[#E0E3DE] mt-2 leading-relaxed">
                Baca materi, jawab kuis, raih 5 level hingga MORIFRASS Guardian, dan tukar poin menjadi voucher gratis ongkir atau diskon di MORI-MARKET.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('edu')}
                className="mt-4 px-5 py-2.5 rounded-lg bg-[#F9A825] text-[#1C241D] text-xs font-bold hover:bg-[#F59E0B] transition-colors inline-flex items-center gap-2"
              >
                <Award className="w-4 h-4" />
                Mulai Belajar di MORI-EDU
              </button>
            </div>
          </div>

          {/* Customer Testimonials */}
          <div className="lg:col-span-6 bg-white border border-[#E3E8DF] rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#144A17] mb-4">Pengalaman Mitra & Petani</h3>
              <div className="space-y-4">
                <div className="pb-4 border-b border-[#E3E8DF]">
                  <div className="flex items-center gap-1 text-[#F9A825] mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-[#1C241D]">
                    "Pertumbuhan daun sawi & cabai di Batu lebih seragam dalam 14 hari. Scan QR batch langsung tampilkan pemasok kelornya."
                  </p>
                  <p className="text-xs text-[#5B665C] mt-1 font-medium">Budi Santoso · Petani Hortikultura, Malang</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[#F9A825] mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-[#1C241D]">
                    "Paket Grosir 5 kg lebih hemat, dan poin dari kuis MORI-EDU langsung mengurangi ongkos kirim."
                  </p>
                  <p className="text-xs text-[#5B665C] mt-1 font-medium">Sari Wulandari · Kebun Organik, Kediri</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="bg-white border-t border-[#E3E8DF] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/assets/aistudio/MORIFRASS_Organic_Bioactive_Fertilizer_Logo_8dbbbcf4.png"
                alt="MORIFRASS"
                className="h-8 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="font-extrabold text-[#144A17]">MORIFRASS</span>
            </div>
            <p className="text-xs text-[#5B665C] leading-relaxed">
              Growing Sustainability, Empowering Agriculture. Platform agritech ekonomi sirkular berbasis frass BSF & daun kelor.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-[#144A17] mb-2">Navigasi Modul</h4>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-[#5B665C]">
              <button type="button" onClick={() => onNavigate('market')} className="text-left hover:text-[#144A17]">MORI-MARKET</button>
              <button type="button" onClick={() => onNavigate('chain')} className="text-left hover:text-[#144A17]">MORI-CHAIN</button>
              <button type="button" onClick={() => onNavigate('edu')} className="text-left hover:text-[#144A17]">MORI-EDU</button>
              <button type="button" onClick={onOpenPartnerRegister} className="text-left hover:text-[#144A17]">Daftar Mitra</button>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-[#144A17] mb-2">Kontak Ekosistem</h4>
            <div className="space-y-1.5 text-xs text-[#5B665C]">
              <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#2E7D32]" /> Surabaya & Bojonegoro, Jawa Timur</p>
              <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#2E7D32]" /> halo@morifrass.id</p>
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#2E7D32]" /> +62 811-2233-4455</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
