import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Target,
  Gift,
  Trophy,
  CheckCircle2,
  Clock,
  Award,
  PlayCircle,
  X,
  ArrowRight,
} from 'lucide-react';
import { apiFetch, formatDate, formatRupiah } from '../lib/api';
import type { ActiveTab, AuthUser } from '../types';

interface MoriEduProps {
  user: AuthUser | null;
  onOpenAuth: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
  onRefreshUser: () => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const MoriEdu: React.FC<MoriEduProps> = ({
  user,
  onOpenAuth,
  onNotify,
  onRefreshUser,
  onNavigate,
}) => {
  const [eduTab, setEduTab] = useState<'learn' | 'quiz' | 'mission' | 'rewards' | 'leaderboard'>('learn');
  const [eduData, setEduData] = useState<any>(null);
  const [activeMaterial, setActiveMaterial] = useState<any>(null);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);

  // Leaderboard state
  const [lbPeriod, setLbPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const loadEdu = async () => {
    try {
      const data = await apiFetch('/api/edu');
      setEduData(data);
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const loadLeaderboard = async (period: 'daily' | 'weekly' | 'monthly') => {
    try {
      const data = await apiFetch<{ leaderboard: any[] }>(`/api/edu/leaderboard?period=${period}`);
      setLeaderboard(data.leaderboard || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadEdu();
  }, [user?.id]);

  useEffect(() => {
    loadLeaderboard(lbPeriod);
  }, [lbPeriod]);

  const handleCompleteLearn = async (materialId: number, type: 'article' | 'video') => {
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await apiFetch<{ pointsAwarded: number }>(`/api/edu/learn/${materialId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      if (res.pointsAwarded > 0) {
        onNotify(`+${res.pointsAwarded} MORI-POINTS ditambahkan!`);
      } else {
        onNotify('Aktivitas sudah tercatat sebelumnya.');
      }
      loadEdu();
      onRefreshUser();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await apiFetch('/api/edu/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: quizAnswers }),
      });
      setQuizResult(res);
      if (res.pointsAwarded > 0) {
        onNotify(`Selamat! Skor ${res.scorePct}% (+${res.pointsAwarded} poin)`);
      } else {
        onNotify(`Skor Anda ${res.scorePct}%. Raih minimal 80% untuk mendapat 30 poin.`);
      }
      loadEdu();
      onRefreshUser();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleClaimMission = async (missionId: number) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await apiFetch<{ pointsAwarded: number }>(`/api/edu/missions/${missionId}/claim`, {
        method: 'POST',
      });
      onNotify(`Misi diklaim! +${res.pointsAwarded} MORI-POINTS`);
      loadEdu();
      onRefreshUser();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const handleRedeemReward = async (rewardId: number) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await apiFetch<{ voucherCode: string; title: string }>(`/api/edu/rewards/${rewardId}/redeem`, {
        method: 'POST',
      });
      onNotify(`Voucher ${res.voucherCode} (${res.title}) otomatis masuk ke MORI-MARKET!`);
      loadEdu();
      onRefreshUser();
    } catch (err: any) {
      onNotify(err.message, true);
    }
  };

  const profile = eduData?.userEdu?.profile;
  const levels: any[] = eduData?.levels || [];
  const currentPts = profile?.points_total ?? 0;
  const nextLevel = levels.find((l) => l.min_points > currentPts) || levels[levels.length - 1];
  const progressPct = nextLevel
    ? Math.min(100, Math.round((currentPts / Math.max(1, nextLevel.min_points)) * 100))
    : 100;

  const progressMap = new Map<number, any>();
  (eduData?.userEdu?.progress || []).forEach((p: any) => progressMap.set(p.material_id, p));

  const userMissionMap = new Map<number, any>();
  (eduData?.userEdu?.userMissions || []).forEach((um: any) => userMissionMap.set(um.mission_id, um));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 lg:pb-12">
      {/* Mascot Guide & Points/Level Banner */}
      <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6 mb-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 flex items-center gap-4">
          <img
            src="/assets/aistudio/MORIFRASS_Bee_Farmer_Mascot_69774a65.png"
            alt="Maskot Pemandu MORI-EDU"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0 bg-[#F9FBF7] rounded-2xl p-1.5 border border-[#E3E8DF]"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider">MORI-EDU · Pemandu Sirkular</p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#144A17] mt-0.5">
              {user ? `Halo, ${profile?.full_name?.split(' ')[0] || 'Sobat Tani'}!` : 'Belajar Agritech & Raih Voucher Belanja'}
            </h1>
            <p className="text-xs sm:text-sm text-[#5B665C] mt-1">
              {user
                ? `Level: ${profile?.level_name || 'Seed Beginner'} · ${eduData?.userEdu?.badges?.length || 0} Badge terbuka`
                : 'Masuk untuk mengumpulkan poin dari materi, kuis, dan misi harian.'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#F9FBF7] border border-[#E3E8DF] rounded-xl p-4">
          {user ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div>
                  <p className="text-[11px] text-[#5B665C]">Poin Tersedia</p>
                  <p className="text-lg font-extrabold text-[#144A17] tabular-nums">{profile?.points_available ?? 0}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#5B665C]">Total Poin</p>
                  <p className="text-lg font-extrabold text-[#2E7D32] tabular-nums">{profile?.points_total ?? 0}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#5B665C]">Ditukarkan</p>
                  <p className="text-lg font-extrabold text-[#5D4037] tabular-nums">{profile?.points_redeemed ?? 0}</p>
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-[#5B665C] mb-1">
                <span>Menuju {nextLevel?.name || 'Max'}</span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2 bg-[#E3E8DF] rounded-full overflow-hidden">
                <div className="h-full bg-[#2E7D32] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#5B665C]">Simpan progres belajar & tukar voucher belanja otomatis.</p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-lg bg-[#144A17] text-white text-xs font-semibold whitespace-nowrap"
              >
                Masuk
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
        {[
          { id: 'learn', label: 'MORI-LEARN', icon: BookOpen },
          { id: 'quiz', label: 'MORI-QUIZ', icon: HelpCircle },
          { id: 'mission', label: 'MORI-MISSION', icon: Target },
          { id: 'rewards', label: 'MORI-REWARDS', icon: Gift },
          { id: 'leaderboard', label: 'LEADERBOARD', icon: Trophy },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setEduTab(t.id as any)}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap border transition-colors ${
              eduTab === t.id
                ? 'bg-[#144A17] text-white border-[#144A17]'
                : 'bg-white text-[#5B665C] border-[#E3E8DF] hover:text-[#144A17]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MORI-LEARN */}
      {eduTab === 'learn' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(eduData?.materials || []).map((m: any) => {
            const prog = progressMap.get(m.id);
            const done = !!prog?.article_completed;
            return (
              <div key={m.id} className="bg-white border border-[#E3E8DF] rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#5B665C] mb-2">
                    <span className="font-semibold text-[#2E7D32]">{m.category}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {m.estimated_minutes} mnt
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#1C241D] leading-snug">{m.title}</h3>
                  <p className="text-xs text-[#5B665C] mt-2 line-clamp-2">{m.summary}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E3E8DF] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5D4037]">+{m.points_reward} poin</span>
                  <button
                    type="button"
                    onClick={() => setActiveMaterial(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      done
                        ? 'bg-[#F1F4EF] text-[#2E7D32]'
                        : 'bg-[#144A17] text-white hover:bg-[#1B5E20]'
                    }`}
                  >
                    {done ? 'Selesai ✓' : 'Pelajari'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: MORI-QUIZ */}
      {eduTab === 'quiz' && (
        <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6 max-w-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#E3E8DF] mb-5">
            <div>
              <h2 className="text-lg font-bold text-[#144A17]">Kuis Pengetahuan Pertanian Organik</h2>
              <p className="text-xs text-[#5B665C]">Raih nilai minimal 80% untuk mendapatkan +30 MORI-POINTS otomatis.</p>
            </div>
            {quizResult && (
              <div className="text-right">
                <p className="text-xl font-extrabold text-[#144A17] tabular-nums">{quizResult.scorePct}%</p>
                <p className="text-[11px] text-[#2E7D32] font-semibold">
                  {quizResult.correctCount}/{quizResult.totalCount} Benar
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitQuiz} className="space-y-6">
            {(eduData?.questions || []).map((q: any, idx: number) => {
              const resItem = quizResult?.results?.find((r: any) => r.questionId === q.id);
              return (
                <div key={q.id} className="p-4 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                  <p className="text-[11px] font-semibold text-[#5D4037] uppercase mb-1">
                    Soal {idx + 1} · {q.question_type === 'true_false' ? 'Benar / Salah' : q.question_type === 'image_guess' ? 'Tebak Gambar' : 'Pilihan Ganda'}
                  </p>
                  <p className="text-sm font-bold text-[#1C241D] mb-3">{q.question}</p>
                  {q.image_hint && (
                    <img
                      src={q.image_hint}
                      alt="Petunjuk Gambar Kuis"
                      className="w-44 h-auto rounded-lg border border-[#E3E8DF] mb-3 bg-white p-2"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt: string) => {
                      const selected = quizAnswers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className={`text-left px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                            selected
                              ? 'border-[#144A17] bg-[#144A17] text-white'
                              : 'border-[#D7DED3] bg-white text-[#1C241D] hover:border-[#2E7D32]'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {resItem && (
                    <div
                      className={`mt-3 p-3 rounded-lg text-xs ${
                        resItem.isCorrect ? 'bg-[#E8F5E9] text-[#144A17]' : 'bg-[#FFEBEE] text-[#93000a]'
                      }`}
                    >
                      <strong>{resItem.isCorrect ? 'Benar!' : `Kurang tepat (Jawaban: ${resItem.correctAnswer}).`}</strong>{' '}
                      {resItem.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-[#144A17] text-white text-sm font-semibold hover:bg-[#1B5E20]"
            >
              Periksa Skor Kuis
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: MORI-MISSION + LEVELS + BADGES */}
      {eduTab === 'mission' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-lg font-bold text-[#144A17] mb-2">Misi Harian & Mingguan</h2>
            {(eduData?.missions || []).map((m: any) => {
              const um = userMissionMap.get(m.id);
              const progress = um?.progress_count || 0;
              const completed = !!um?.completed;
              const claimed = !!um?.claimed;
              return (
                <div key={m.id} className="bg-white border border-[#E3E8DF] rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-[#5D4037] uppercase">
                      {m.mission_type === 'daily' ? 'Misi Harian' : 'Misi Mingguan'} · +{m.points_reward} Poin
                    </p>
                    <h3 className="text-sm font-bold text-[#1C241D] mt-0.5">{m.title}</h3>
                    <p className="text-xs text-[#5B665C] mt-0.5">
                      {m.description} ({progress}/{m.target_count})
                    </p>
                  </div>
                  {claimed ? (
                    <span className="text-xs font-semibold text-[#2E7D32] whitespace-nowrap">Diklaim ✓</span>
                  ) : completed ? (
                    <button
                      type="button"
                      onClick={() => handleClaimMission(m.id)}
                      className="px-4 py-2 rounded-lg bg-[#F9A825] text-[#1C241D] text-xs font-bold whitespace-nowrap"
                    >
                      Klaim +{m.points_reward}
                    </button>
                  ) : (
                    <span className="text-xs text-[#5B665C] whitespace-nowrap">Berjalan</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* 5 Levels */}
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
              <h3 className="text-base font-bold text-[#144A17] mb-3">5 Level MORI-EDU</h3>
              <div className="space-y-2.5">
                {levels.map((l: any) => {
                  const unlocked = currentPts >= l.min_points;
                  return (
                    <div
                      key={l.id}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        unlocked ? 'bg-[#F1F4EF] border-[#2E7D32]' : 'bg-[#F9FBF7] border-[#E3E8DF] opacity-75'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-[#144A17]">
                          Lv.{l.level_number} {l.name}
                        </p>
                        <p className="text-[11px] text-[#5B665C]">{l.perk_summary}</p>
                      </div>
                      <span className="font-mono font-bold text-[#144A17] tabular-nums">{l.min_points} pt</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Badges */}
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-5">
              <h3 className="text-base font-bold text-[#144A17] mb-3">Lencana (MORI-BADGES)</h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { code: 'ECO_LEARNER', name: 'Eco Learner' },
                  { code: 'ORGANIC_EXPERT', name: 'Organic Fertilizer Expert' },
                  { code: 'BSF_MASTER', name: 'BSF Knowledge Master' },
                  { code: 'GREEN_HERO', name: 'Green Agriculture Hero' },
                  { code: 'MORIFRASS_CHAMPION', name: 'MORIFRASS Champion' },
                ].map((b) => {
                  const has = (eduData?.userEdu?.badges || []).some((ub: any) => ub.badge_code === b.code);
                  return (
                    <div
                      key={b.code}
                      className={`px-3.5 py-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        has ? 'bg-[#F1F4EF] border-[#2E7D32] text-[#144A17] font-semibold' : 'bg-[#F9FBF7] border-[#E3E8DF] text-[#5B665C]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Award className={`w-4 h-4 ${has ? 'text-[#F9A825]' : 'text-[#C1C9BB]'}`} />
                        {b.name}
                      </span>
                      <span>{has ? 'Terbuka' : 'Terkunci'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MORI-REWARDS (Voucher Bridge to MORI-MARKET) */}
      {eduTab === 'rewards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(eduData?.rewards || []).map((rw: any) => (
              <div key={rw.id} className="bg-white border border-[#E3E8DF] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-[#2E7D32]">{rw.points_cost} MORI-POINTS</p>
                  <h3 className="text-lg font-bold text-[#144A17] mt-1">{rw.title}</h3>
                  <p className="text-xs text-[#5B665C] mt-2">
                    Min. belanja {formatRupiah(rw.min_purchase)} · Berlaku {rw.valid_days} hari · Kuota sisa {rw.remaining_quota}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRedeemReward(rw.id)}
                  className="mt-5 w-full py-2.5 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20]"
                >
                  Tukar {rw.points_cost} Poin
                </button>
              </div>
            ))}
          </div>

          {user && (
            <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#144A17]">Voucher Saya di MORI-MARKET</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('market')}
                  className="text-xs font-semibold text-[#2E7D32] inline-flex items-center gap-1 hover:underline"
                >
                  Belanja Sekarang <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {(eduData?.userEdu?.vouchers || []).length === 0 ? (
                <p className="text-xs text-[#5B665C]">Belum ada voucher. Tukarkan poin Anda di atas!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {eduData.userEdu.vouchers.map((v: any) => (
                    <div key={v.id} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF]">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#144A17]">{v.code}</span>
                        <span className={`text-[11px] font-semibold ${v.is_used ? 'text-[#5B665C]' : 'text-[#2E7D32]'}`}>
                          {v.is_used ? 'Sudah Dipakai' : 'Aktif'}
                        </span>
                      </div>
                      <p className="text-xs text-[#1C241D] mt-1">{v.reward_title}</p>
                      <p className="text-[11px] text-[#5B665C] mt-1">Berlaku s/d {formatDate(v.expires_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LEADERBOARD */}
      {eduTab === 'leaderboard' && (
        <div className="bg-white border border-[#E3E8DF] rounded-2xl p-6 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-[#144A17]">Peringkat MORI-EDU</h2>
              <p className="text-xs text-[#5B665C]">Privasi nama dapat diatur di halaman Profil Anda.</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#F1F4EF] rounded-lg">
              {[
                { id: 'daily', label: 'Harian' },
                { id: 'weekly', label: 'Mingguan' },
                { id: 'monthly', label: 'Bulanan' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLbPeriod(p.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    lbPeriod === p.id ? 'bg-white text-[#144A17] shadow-xs' : 'text-[#5B665C]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {leaderboard.map((row) => (
              <div key={row.userId} className="p-3.5 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#144A17] text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    {row.rank}
                  </span>
                  <img
                    src={row.avatarUrl}
                    alt={row.displayName}
                    className="w-9 h-9 rounded-full object-contain bg-white border border-[#E3E8DF]"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="text-sm font-bold text-[#1C241D]">{row.displayName}</p>
                    <p className="text-[11px] text-[#5B665C]">
                      {row.levelName} · {row.badgeCount} Badge {row.isSimulation ? '· Demo' : ''}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-[#2E7D32] tabular-nums">{row.points} pt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Article Reader Modal */}
      {activeMaterial && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8DF] rounded-2xl w-full max-w-lg p-6 relative max-h-[88vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveMaterial(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#F1F4EF]"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-xs font-semibold text-[#2E7D32]">{activeMaterial.category}</p>
            <h3 className="text-xl font-extrabold text-[#144A17] mt-1">{activeMaterial.title}</h3>
            <p className="text-sm text-[#5B665C] mt-2">{activeMaterial.summary}</p>

            <div className="mt-4 space-y-2">
              {activeMaterial.content_points?.map((pt: string, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-[#F9FBF7] border border-[#E3E8DF] text-xs text-[#1C241D] flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D32] shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await handleCompleteLearn(activeMaterial.id, 'article');
                  setActiveMaterial(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#144A17] text-white text-xs font-semibold hover:bg-[#1B5E20]"
              >
                Selesai Membaca (+{activeMaterial.points_reward} Poin)
              </button>
              {activeMaterial.video_url && (
                <button
                  type="button"
                  onClick={() => handleCompleteLearn(activeMaterial.id, 'video')}
                  className="py-2.5 px-4 rounded-lg border border-[#2E7D32] text-[#2E7D32] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F1F4EF]"
                >
                  <PlayCircle className="w-4 h-4" /> Video (+15 Poin)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
