import React, { useState, useMemo } from 'react';
import { Radio, Building2, MapPin, Users, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { STATIONS } from '../data/tracks';
import { PpkaAuthority } from '../types';

interface OnlinePlayerLite {
  id: string;
  username: string;
  role: string;
  ppkaAuthorityKey?: string | null;
}

interface PpkaAuthorityGateProps {
  onlinePlayers: OnlinePlayerLite[];
  myUsername: string;
  onSelect: (authority: PpkaAuthority) => void;
  onCancel: () => void;
}

const ZONE_LABELS: Record<number, string> = {
  1: 'Zona 1: Jakarta Kota - Manggarai',
  2: 'Zona 2: Tebet - Depok',
  3: 'Zona 3: Citayam - Bogor',
  4: 'Zona 4: Lingkar Pasar Senen'
};

const PK_MAX_PER_ZONE = 5;
const PPKA_MAX_PER_STATION = 1;
const PPKA_MAX_MANGGARAI = 3; // Manggarai punya percabangan (JAKK<->Bogor<->Pasar Senen), jadi butuh lebih dari 1 PPKA

export default function PpkaAuthorityGate({ onlinePlayers, myUsername, onSelect, onCancel }: PpkaAuthorityGateProps) {
  const [mode, setMode] = useState<'choose' | 'pk' | 'station'>('choose');

  // Live occupancy count per authority key ("PK-1", "STATION-MRI", dst), dihitung dari
  // presence pemain lain yang sedang online sebagai PPKA. Diri sendiri dikecualikan supaya
  // tidak menghitung slot yang sudah kita tempati saat memilih ulang.
  const occupancy = useMemo(() => {
    const counts: Record<string, number> = {};
    onlinePlayers.forEach(p => {
      if (p.role === 'PPKA' && p.ppkaAuthorityKey && p.username !== myUsername) {
        counts[p.ppkaAuthorityKey] = (counts[p.ppkaAuthorityKey] || 0) + 1;
      }
    });
    return counts;
  }, [onlinePlayers, myUsername]);

  const zones = [1, 2, 3, 4] as const;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 font-mono">
      <div className="bg-[#0b0f19] border-2 border-indigo-950 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-[#0e1424] px-5 py-4 border-b border-indigo-950/80 flex items-center gap-3">
          <div className="p-2 bg-indigo-950 rounded-lg border border-indigo-900 text-indigo-400">
            <Radio size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest text-indigo-300 uppercase">Penugasan Dinas PPKA</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Pilih otoritas Anda sebelum masuk pos pengendalian. Anda hanya bisa mengatur wesel/sinyal di dalam wilayah otoritas ini.</p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {mode === 'choose' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setMode('pk')}
                className="bg-[#0d1527] hover:bg-[#131e38] border-2 border-indigo-950 hover:border-indigo-600 rounded-xl p-5 text-left transition-all cursor-pointer flex flex-col gap-2"
              >
                <Building2 size={24} className="text-indigo-400" />
                <span className="text-sm font-black text-white uppercase">PK (Pusat Kendali)</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">Memegang otoritas SATU zona penuh (semua stasiun di zona tersebut). Maks {PK_MAX_PER_ZONE} orang per zona.</span>
              </button>
              <button
                onClick={() => setMode('station')}
                className="bg-[#0d1527] hover:bg-[#131e38] border-2 border-indigo-950 hover:border-indigo-600 rounded-xl p-5 text-left transition-all cursor-pointer flex flex-col gap-2"
              >
                <MapPin size={24} className="text-emerald-400" />
                <span className="text-sm font-black text-white uppercase">PPKA Stasiun</span>
                <span className="text-[10px] text-slate-400 leading-relaxed">Memegang otoritas SATU stasiun saja. Maks {PPKA_MAX_PER_STATION} orang per stasiun (Manggarai maks {PPKA_MAX_MANGGARAI} karena punya percabangan).</span>
              </button>
            </div>
          )}

          {mode === 'pk' && (
            <div className="flex flex-col gap-2">
              <button onClick={() => setMode('choose')} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 mb-2 cursor-pointer">
                <ArrowLeft size={12} /> Kembali
              </button>
              {zones.map(zone => {
                const key = `PK-${zone}`;
                const count = occupancy[key] || 0;
                const isFull = count >= PK_MAX_PER_ZONE;
                return (
                  <button
                    key={zone}
                    disabled={isFull}
                    onClick={() => onSelect({ type: 'PK', zone })}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between transition-all text-left ${
                      isFull
                        ? 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed'
                        : 'bg-[#0d1527] border-indigo-950 hover:border-indigo-600 cursor-pointer'
                    }`}
                  >
                    <span className="text-xs font-bold text-white">{ZONE_LABELS[zone]}</span>
                    <span className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg ${isFull ? 'bg-red-950 text-red-400 border border-red-900' : 'bg-indigo-950 text-indigo-300 border border-indigo-900'}`}>
                      {isFull ? <Lock size={10} /> : <Users size={10} />}
                      <span>{count}/{PK_MAX_PER_ZONE}{isFull ? ' PENUH' : ''}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {mode === 'station' && (
            <div className="flex flex-col gap-2">
              <button onClick={() => setMode('choose')} className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 mb-2 cursor-pointer">
                <ArrowLeft size={12} /> Kembali
              </button>
              {zones.map(zone => (
                <div key={zone} className="mb-1">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider block mb-1.5 mt-2">{ZONE_LABELS[zone]}</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {STATIONS.filter(st => st.zone === zone).map(st => {
                      const key = `STATION-${st.id}`;
                      const maxSlots = st.id === 'MRI' ? PPKA_MAX_MANGGARAI : PPKA_MAX_PER_STATION;
                      const count = occupancy[key] || 0;
                      const isFull = count >= maxSlots;
                      return (
                        <button
                          key={st.id}
                          disabled={isFull}
                          onClick={() => onSelect({ type: 'Station', stationId: st.id, zone: st.zone })}
                          className={`p-2 rounded-lg border flex flex-col gap-0.5 transition-all text-left ${
                            isFull
                              ? 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed'
                              : 'bg-[#0d1527] border-indigo-950 hover:border-indigo-600 cursor-pointer'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-white truncate">{st.name}</span>
                          <span className={`flex items-center gap-1 text-[9px] font-black ${isFull ? 'text-red-400' : 'text-indigo-300'}`}>
                            {isFull ? <Lock size={9} /> : <Users size={9} />}
                            <span>{count}/{maxSlots}{isFull ? ' PENUH' : ''}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-indigo-950/60 bg-[#050811]">
          <button
            onClick={onCancel}
            className="text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wide cursor-pointer"
          >
            &larr; Batal, kembali ke lobi
          </button>
        </div>
      </div>
    </div>
  );
}
