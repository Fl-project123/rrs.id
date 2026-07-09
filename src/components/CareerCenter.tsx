import React from 'react';
import { UserCareer, CareerRank } from '../types';
import { Award, Compass, ArrowRight, ShieldCheck, Clipboard, AlertOctagon, Heart, Server } from 'lucide-react';
import { motion } from 'motion/react';

interface CareerCenterProps {
  career: UserCareer;
  onResetCareer: () => void;
  onExit: () => void;
}

export default function CareerCenter({
  career,
  onResetCareer,
  onExit
}: CareerCenterProps) {
  
  const getRankDescription = (rank: CareerRank) => {
    switch (rank) {
      case CareerRank.Magang:
        return 'Pangkat awal setelah registrasi. Hanya berhak memegang lokomotif langsiran terbatas atau mengawal stasiun sepi di Zona 2.';
      case CareerRank.Muda:
        return 'Sertifikasi Masinis Muda. Membuka izin mengemudikan rangkaian KRL Commuter Line Formasi Pendek (8 Kereta) melintasi sebagian Zona 2 dan 3.';
      case CareerRank.Madya:
        return 'Sertifikasi Masinis Madya. Membuka izin membawa KRL Formasi Panjang (10-12 Kereta) dan kereta penumpang jarak jauh CC201 (KA Pangrango) melintasi jalur cepat.';
      case CareerRank.Utama:
        return 'Masinis Utama / Legenda Jalan Baja. Memegang hak komando penuh atas lokomotif CC206 Double Header, stasiun sentral (Manggarai), atau bertindak sebagai Ketua Dispatcher.';
      default:
        return 'Regulasi standard.';
    }
  };

  const getPointsToNextRank = () => {
    if (career.points < 100) return { target: 100, diff: 100 - career.points, pct: (career.points / 100) * 100 };
    if (career.points < 300) return { target: 300, diff: 300 - career.points, pct: ((career.points - 100) / 200) * 100 };
    if (career.points < 600) return { target: 600, diff: 600 - career.points, pct: ((career.points - 300) / 300) * 100 };
    return { target: 9999, diff: 0, pct: 100 };
  };

  const progress = getPointsToNextRank();

  return (
    <div id="career-center-panel" className="bg-[#0b0f19] text-gray-100 min-h-screen p-5 flex flex-col font-sans select-none border-t-4 border-indigo-500">
      
      {/* Header bar */}
      <div className="flex justify-between items-center border-b border-indigo-950/60 pb-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white font-black px-2.5 py-1 rounded text-xs select-all uppercase tracking-widest flex items-center gap-1.5">
            <Clipboard size={15} />
            <span>Pusdiklat Career</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Sistem Kepangkatan Perkeretaapian (SDM)</h1>
            <p className="text-[10px] text-slate-450 font-mono">Daftar Riwayat Prestasi Masinis & PPKA Indonesia</p>
          </div>
        </div>

        <button 
          id="btn-quit-career"
          onClick={onExit}
          className="bg-slate-800 hover:bg-slate-700 font-bold text-xs px-3 py-1 rounded transition-all text-slate-300"
        >
          Kembali ke Terminal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        
        {/* Left column: Profile card and stats */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Main profile card */}
          <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5 text-center flex flex-col items-center gap-3 shadow-lg">
            
            {/* Avatar icon */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-slate-900 border-2 border-white font-black text-lg ${
              career.hasLicense ? 'bg-indigo-500' : 'bg-slate-500'
            }`}>
              {career.username.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <h2 className="text-sm font-bold text-white select-all">{career.username}</h2>
              <span className="text-[10px] bg-slate-800 border border-slate-700 text-amber-400 capitalize px-2 py-0.5 rounded font-bold font-mono inline-block mt-1">
                {career.rank} Sektor
              </span>
            </div>

            {/* License verification badge */}
            <div className="w-full bg-[#0d1221] p-2.5 rounded-lg border border-slate-800 flex items-center justify-center gap-2 mt-2">
              <ShieldCheck className={career.hasLicense ? 'text-[#1dd1a1]' : 'text-slate-500'} size={18} />
              <span className="text-xs font-mono font-bold leading-none">
                {career.hasLicense ? 'LISENSI REKOR TERVALIDASI' : 'BELUM MEMILIKI LISENSI'}
              </span>
            </div>

            {/* Total balance */}
            <div className="w-full grid grid-cols-2 gap-2 mt-1">
              <div className="bg-[#0d1221] p-2 rounded text-center border border-slate-800">
                <span className="text-[9px] text-slate-500 block">TOTAL POIN</span>
                <span className="text-sm font-black font-mono text-[#1dd1a1]">{career.points} Pts</span>
              </div>
              <div className="bg-[#0d1221] p-2 rounded text-center border border-slate-800">
                <span className="text-[9px] text-slate-500 block">STATUS PLAT</span>
                <span className="text-sm font-black font-mono text-indigo-400">Offline/Sync</span>
              </div>
            </div>

            {/* Reset account button */}
            <button
              id="btn-reset-career"
              onClick={() => {
                if (window.confirm('Yakin ingin mereset seluruh akumulasi poin dan lisensi Anda kembali ke nol?')) {
                  onResetCareer();
                }
              }}
              className="mt-4 text-[9px] text-red-500 hover:text-red-400 underline font-mono active:scale-95 transition-transform"
            >
              Reset Riwayat Pendidikan (Pusdiklat)
            </button>
          </div>

          {/* Stats Breakdown */}
          <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
              <Compass size={14} className="text-indigo-400" />
              <span>Indikator Buku Log Masinis</span>
            </h3>

            <div className="flex flex-col gap-3 font-mono text-xs">
              {[
                { label: 'Dinas Sukses', val: career.stats.tripsCompleted, color: 'text-white' },
                { label: 'Presisi Berhenti Peron', val: career.stats.platformStopsCorrect, color: 'text-emerald-400' },
                { label: 'Pelanggaran Melaju (Speeding)', val: career.stats.speedInfractions, color: 'text-yellow-400' },
                { label: 'Sinyal Merah Diterobos', val: career.stats.redSignalViolations, color: 'text-red-400' },
                { label: 'Tabrakan / Collision', val: career.stats.collisions, color: 'text-red-500 font-extrabold' }
              ].map(st => (
                <div key={st.label} className="flex justify-between items-center bg-[#0d1221] px-3 py-2 rounded border border-slate-800">
                  <span className="text-slate-400 leading-none">{st.label}</span>
                  <span className={`font-black leading-none ${st.color}`}>{st.val}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column: Progress track tiers and descriptions */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Progress bar to next rank */}
          <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Jenjang Pencapaian Karir Terdekat</h3>
            
            <div className="flex justify-between items-center text-xs font-mono text-slate-300 mb-2">
              <span>Raihan Aktif: <strong className="text-amber-400 font-bold">{career.rank}</strong></span>
              {progress.target !== 9999 ? (
                <span>Butuh <strong className="text-emerald-400 font-bold">{progress.diff} Poin</strong> lagi ke pangkat berikutnya</span>
              ) : (
                <span className="text-emerald-400 font-bold">Pangkat Tertinggi Tercapai!</span>
              )}
            </div>

            {/* Beautiful slide progress bar */}
            <div className="w-full bg-[#0d1221] h-3.5 rounded-full overflow-hidden border border-slate-800 flex items-center p-0.5">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-[#1dd1a1] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress.pct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
              <span>Magang (0)</span>
              <span>Muda (100)</span>
              <span>Madya (300)</span>
              <span>Utama (600+)</span>
            </div>
          </div>

          {/* Descriptive unlock matrix list */}
          <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5 flex-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Matriks Kualifikasi Jabatan Kerja (SOP)</h3>
            
            <div className="flex flex-col gap-4">
              {[
                { name: CareerRank.Magang, minPoints: '0 Poin', access: 'Sertifikasi Langsir', color: 'border-slate-800/80 bg-[#0d1221]/50' },
                { name: CareerRank.Muda, minPoints: '100 Poin', access: 'KRL Commuter Line 8-Gerbong (JR205)', color: 'border-blue-900 bg-[#0c1428]/40' },
                { name: CareerRank.Madya, minPoints: '300 Poin', access: 'KRL Commuter Line 12-Gerbong & CC201 KA Pangrango Sektor Bogor', color: 'border-indigo-900 bg-[#0e1230]/40' },
                { name: CareerRank.Utama, minPoints: '600 Poin', access: 'Bebas Kendali CC206 Double Header, Sinyal Kompleks Manggarai, Chief Dispatcher Sektor', color: 'border-amber-900 bg-[#1a1410]/20' }
              ].map(tier => {
                const isMyCurrent = career.rank === tier.name;
                return (
                  <div key={tier.name} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-all ${tier.color} ${isMyCurrent ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-white capitalize">{tier.name} Sektor</h4>
                        {isMyCurrent && (
                          <span className="bg-indigo-600 text-white font-extrabold text-[8px] font-mono px-1.5 py-0.5 rounded leading-none">
                            AKTIF SEKARANG
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{getRankDescription(tier.name)}</p>
                    </div>

                    <div className="text-left sm:text-right font-mono self-start sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-850/80 w-full sm:w-auto">
                      <div className="text-[10px] text-indigo-400 font-bold block">Minimal: {tier.minPoints}</div>
                      <div className="text-[9px] text-slate-400 block mt-0.5">Izin: {tier.access}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
