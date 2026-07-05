import React, { useState, useEffect } from 'react';
import { UserCareer, CareerRank, Train, TrainType, LineDirection, Role } from '../types';
import { TRAIN_SPECS } from '../utils/engine';
import { Compass, Users, PlusCircle, TrainFront, Shield, Lock, Radio, Key, Award, AlertTriangle, Play, Wrench, RefreshCw, Layers, LayoutGrid, CheckCircle, XCircle } from 'lucide-react';
import { firestore, checkExamEligibility } from '../utils/sync';
import { getDocs, collection } from 'firebase/firestore';

interface MultiplayerLobbyProps {
  career: UserCareer;
  activeTrains: Train[];
  onSpawnTrain: (name: string, type: TrainType, direction: LineDirection) => void;
  onTakeoverTrain: (trainId: string) => void;
  onEnterPpkas: () => void;
  onEnterTeknisi: () => void;
  onEnterPusdiklat: () => void;
  onBypassLicense: () => void;
  onUsernameChange: (name: string) => void;
  onlinePlayers?: any[];
}

export default function MultiplayerLobby({
  career,
  activeTrains,
  onSpawnTrain,
  onTakeoverTrain,
  onEnterPpkas,
  onEnterTeknisi,
  onEnterPusdiklat,
  onBypassLicense,
  onUsernameChange,
  onlinePlayers = []
}: MultiplayerLobbyProps) {
  const [roleMode, setRoleMode] = useState<'Masinis' | 'PPKA' | null>(null);
  const [trainName, setTrainName] = useState('KRL Commuter Line #');
  const [selectedType, setSelectedType] = useState<TrainType>(TrainType.KRL_8);
  const [direction, setDirection] = useState<LineDirection>(LineDirection.Hilir);
  const [inputName, setInputName] = useState(career.username);

  // Firestore synchronization states (with offline-first beautiful fallback states)
  const [dbRooms, setDbRooms] = useState<any[]>([
    { id: 'R-4412', roomId: 'R-4412', status: 'LIVE', masinis: ['Masinis_Cepat'], ppkas: { zone1: 'PPKA_Jakarta', zone2: 'PPKA_Depok' } },
    { id: 'R-7801', roomId: 'R-7801', status: 'WAITING', masinis: [], ppkas: { zone3: 'PPKA_Bogor' } }
  ]);
  const [dbPenalties, setDbPenalties] = useState<any[]>([
    { id: 'P-9921', userId: 'Kru_Pelanggar_Sinyal', violationType: 'Menerobos Sinyal CC Sektor 1', banned: true, bannedUntil: new Date(Date.now() + 600000).toISOString(), pointsDeducted: 100, timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: 'P-9922', userId: 'Magang_Akurasi', violationType: 'Sempurna Stop Peron Depok Baru', banned: false, bannedUntil: '', pointsDeducted: 0, timestamp: new Date(Date.now() - 1200000).toISOString() }
  ]);
  const [dbZones, setDbZones] = useState<any[]>([
    { id: 'zone_1', zoneId: 1, maxSpeedLimit: 90, description: "Manggarai Sektor Utara (UP-LINE)" },
    { id: 'zone_2', zoneId: 2, maxSpeedLimit: 90, description: "Depok - Citayam Sektor Tengah" },
    { id: 'zone_3', zoneId: 3, maxSpeedLimit: 90, description: "Bogor Sektor Selatan (DOWN-LINE)" }
  ]);
  const [dbSchedules, setDbSchedules] = useState<any[]>([
    { id: 'AI-KA-01', trainId: 'AI-KA-01', name: 'KRL Commuter Line #1522', path: 'Jakarta Kota ➔ Manggarai ➔ Depok ➔ Bogor (Hilir)' },
    { id: 'AI-KA-02', trainId: 'AI-KA-02', name: 'KA Pangrango CC201 Sektor Bogor', path: 'Bogor ➔ Citayam (Hulu)' },
    { id: 'AI-KA-03', trainId: 'AI-KA-03', name: 'KRL Commuter Line #1344', path: 'Jakarta Kota ➔ Depok ➔ Pasar Minggu (Hilir)' }
  ]);
  const [lobbyViewTab, setLobbyViewTab] = useState<'crews' | 'static-data'>('crews');

  useEffect(() => {
    let active = true;
    const fetchCloudData = async () => {
      // 1. Fetch live rooms
      try {
        const roomsSnap = await getDocs(collection(firestore, 'rooms'));
        if (active && roomsSnap && !roomsSnap.empty) {
          setDbRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.warn('Silent Firestore sync deferred for rooms (running offline):', err);
      }

      // 2. Fetch live penalties
      try {
        const penaltiesSnap = await getDocs(collection(firestore, 'penalties'));
        if (active && penaltiesSnap && !penaltiesSnap.empty) {
          setDbPenalties(penaltiesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()));
        }
      } catch (err) {
        console.warn('Silent Firestore sync deferred for penalties (running offline):', err);
      }

      // 3. Fetch map zones
      try {
        const zonesSnap = await getDocs(collection(firestore, 'map_zones'));
        if (active && zonesSnap && !zonesSnap.empty) {
          setDbZones(zonesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.zoneId - b.zoneId));
        }
      } catch (err) {
        console.warn('Silent Firestore sync deferred for map_zones (running offline):', err);
      }

      // 4. Fetch AI schedules
      try {
        const schedulesSnap = await getDocs(collection(firestore, 'ai_schedules'));
        if (active && schedulesSnap && !schedulesSnap.empty) {
          setDbSchedules(schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.warn('Silent Firestore sync deferred for ai_schedules (running offline):', err);
      }
    };
    fetchCloudData();
    const interval = setInterval(fetchCloudData, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Checks unlocking bounds for trains based on employee career rank
  const isTrainLocked = (type: TrainType): boolean => {
    if (career.rank === CareerRank.Magang) {
      return type !== TrainType.Langsir && type !== TrainType.KRL_8;
    }
    if (career.rank === CareerRank.Muda) {
      return type === TrainType.CC206 || type === TrainType.KRL_12;
    }
    if (career.rank === CareerRank.Madya) {
      return type === TrainType.CC206; // CC206 only for Utama
    }
    return false; // Utama unlocks everything
  };

  const handleSpawn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainName.trim()) return;
    
    // Auto incremental code
    const actualName = trainName.includes('#') 
      ? trainName + Math.floor(1000 + Math.random() * 9000)
      : trainName;

    onSpawnTrain(actualName, selectedType, direction);
  };

  const aiTrains = activeTrains.filter(t => t.isAI);
  const playerTrains = activeTrains.filter(t => !t.isAI);

  if (career.points === 0) {
    return (
      <div id="pts-block-gateway" className="bg-[#0b0e19] text-gray-100 min-h-screen p-6 flex flex-col justify-center items-center font-sans border-t-4 border-red-600">
        <div className="bg-[#121828] border-2 border-red-500 rounded-2xl p-8 max-w-2xl text-center flex flex-col items-center gap-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
            <AlertTriangle size={28} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-wide text-white uppercase text-red-500">Akses Ditolak! Poin PTS Anda 0</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-3 max-w-lg mx-auto font-mono">
              Poin PTS wajib &gt; 0 untuk bermain di server. Selesaikan (atau ulangi) minimal satu ujian sertifikasi Pusdiklat untuk mendapatkan poin kembali secara sah.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mt-3">
            <button
              onClick={onEnterPusdiklat}
              className="bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-slate-950 font-black px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 font-mono cursor-pointer"
            >
              <Play size={16} />
              <span>IKUTI UJIAN PUSDIKLAT UNTUK MENDAPATKAN POIN</span>
            </button>
            
            <button
              onClick={() => {
                localStorage.removeItem('rrsid_active_username');
                window.location.reload();
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-6 py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 font-mono cursor-pointer"
            >
              <XCircle size={14} />
              <span>KEMBALI KE HALAMAN UTAMA (MAIN MENU / LOGOUT)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="multiplayer-lobby" className="bg-[#0a0e1a] text-gray-100 min-h-screen p-4 flex flex-col font-sans border-t-4 border-indigo-600">
      
      {/* Lobby Welcome Panel */}
      <div className="bg-gradient-to-r from-indigo-950/40 via-[#0a0e1a] to-slate-900 rounded-xl border border-indigo-950/40 p-5 mb-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2 tracking-wider">
            <Compass className="text-indigo-500 animate-spin-slow" size={24} />
            <span>RRSID: RAIL ROLE SIMULATOR INDONESIA</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Multiplayer Kabin Masinis & Pengendali Sinyal Utama (PPKA) Lintas Jakarta - Bogor</p>
        </div>

        {/* Username Config */}
        <div className="flex gap-2 bg-[#12192a] p-2 rounded-lg border border-slate-800">
          <input
            id="inp-lobby-username"
            type="text"
            value={inputName}
            maxLength={18}
            onChange={(e) => setInputName(e.target.value)}
            onBlur={() => onUsernameChange(inputName)}
            placeholder="Edit nama dinas..."
            className="bg-[#090d16] border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 font-mono"
          />
          <span className="text-[10px] text-indigo-400 font-bold self-center font-mono">Rank: {career.rank}</span>
        </div>
      </div>
        {/* License Constraint Gate (Pusdiklat Blocks) */}
      {(!career.hasLicense && career.points === 0 && !checkExamEligibility(career)) ? (
        <div className="bg-[#121828] border-2 border-dashed border-indigo-900 rounded-2xl p-8 max-w-2xl mx-auto my-auto text-center flex flex-col items-center gap-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Lock size={28} />
          </div>
          
          <div>
            <h2 className="text-lg font-black tracking-wide text-white uppercase">MASUK SERVER MEWAJIBKAN SERTIFIKASI PUSDIKLAT</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-2 max-w-lg mx-auto">
              Sesuai regulasi Dinas RRSid, setiap calon kru wajib menyelesaikan 3 ujian sertifikasi simulasi lokal (offline) terlebih dahulu agar server utama diisi oleh personel berkompeten tinggi.
            </p>
          </div>

          {/* Status of Certifications */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full bg-[#0a0d16] p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-left">
            <div className="flex items-center gap-2 border-r border-slate-800 pr-2">
              {career.isMasinisCertified ? <CheckCircle className="text-emerald-400 shrink-0" size={14} /> : <XCircle className="text-red-400 shrink-0" size={14} />}
              <div>
                <span className="font-bold text-slate-300 block">1. Masinis</span>
                <span className={career.isMasinisCertified ? "text-emerald-400 text-[10px]" : "text-slate-500 text-[10px]"}>{career.isMasinisCertified ? "LULUS ✅" : "BELUM ❌"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 border-r border-slate-800 px-2">
              {career.isPpkaCertified ? <CheckCircle className="text-emerald-400 shrink-0" size={14} /> : <XCircle className="text-red-400 shrink-0" size={14} />}
              <div>
                <span className="font-bold text-slate-300 block">2. PPKA</span>
                <span className={career.isPpkaCertified ? "text-emerald-400 text-[10px]" : "text-slate-500 text-[10px]"}>{career.isPpkaCertified ? "LULUS ✅" : "BELUM ❌"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-2">
              {career.isTeknisiCertified ? <CheckCircle className="text-emerald-400 shrink-0" size={14} /> : <XCircle className="text-red-400 shrink-0" size={14} />}
              <div>
                <span className="font-bold text-slate-300 block">3. Rescue</span>
                <span className={career.isTeknisiCertified ? "text-emerald-400 text-[10px]" : "text-slate-500 text-[10px]"}>{career.isTeknisiCertified ? "LULUS ✅" : "BELUM ❌"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            {/* Enter Pusdiklat course */}
            <button
              id="btn-lobby-enter-pusdiklat"
              onClick={onEnterPusdiklat}
              className="bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 font-mono cursor-pointer"
            >
              <Award size={16} />
              <span>IKUTI PUSDIKLAT LATIHAN (UJIAN)</span>
            </button>

            {/* Cheat bypass skip trigger for testing */}
            <button
              id="btn-lobby-bypass"
              onClick={onBypassLicense}
              className="bg-slate-800 hover:bg-slate-700 hover:text-white active:translate-y-0.5 text-slate-450 px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 font-mono cursor-pointer"
            >
              <Key size={14} />
              <span>Bypass Evaluasi Lisensi</span>
            </button>
          </div>
          
          <div className="bg-[#0b0e19] border border-slate-900 p-2 text-[10px] text-slate-500 font-mono">
            * Menyelesaikan ke-3 kelas ujian di atas otomatis meloloskan Anda masuk Server Utama RRSid.
          </div>
        </div>
      ) : (
        (!career.hasLicense && (career.points > 0 || checkExamEligibility(career))) ? (
          <div className="bg-[#121828] border-2 border-indigo-500 rounded-2xl p-8 max-w-2xl mx-auto my-auto text-center flex flex-col items-center gap-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award size={28} className="animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-white uppercase">PROFIL DINAS DISYAHKAN</h2>
              <p className="text-xs text-slate-400 leading-relaxed mt-2 max-w-lg mx-auto font-mono">
                Selamat! Anda memiliki dinasan sebesar <strong className="text-emerald-400 font-extrabold">{career.points} PTS</strong> dengan pangkat <strong className="text-indigo-400 font-bold">{career.rank}</strong>. Selamat bergabung di server multiplayer utama.
              </p>
            </div>
            <button
              id="btn-lobby-main"
              onClick={onBypassLicense}
              className="bg-[#10b981] hover:bg-[#34d399] active:translate-y-0.5 text-slate-950 font-black px-12 py-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 font-mono cursor-pointer"
            >
              <Play size={16} />
              <span>MAIN! (MASUK SERVER SEKARANG)</span>
            </button>
          </div>
        ) : (
          
          // Active lobby layout
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 select-none">
          
          {/* Role Sektor recruit column (Left) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* Recruit Role selection boxes */}
            <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
              <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <Users size={14} />
                <span>Pilihlah Peran Dinas Anda</span>
              </h2>

              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">Pilihlah salah satu penugasan aktif Anda hari ini di lintas Commuter Line Jakarta - Bogor.</p>

              <div className="flex flex-col gap-3">
                {/* Driver select */}
                <button
                  id="btn-recruit-masinis"
                  onClick={() => setRoleMode('Masinis')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    roleMode === 'Masinis' 
                      ? 'bg-orange-950/30 border-orange-500 text-white' 
                      : 'bg-[#0f1424] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <TrainFront size={20} className={roleMode === 'Masinis' ? 'text-orange-500' : 'text-slate-500'} />
                    <div>
                      <h3 className="font-extrabold text-xs text-white uppercase">Peran: Masinis (Driver)</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Mengendalikan lokomotif, patuhi sinyal & stop tepat di peron.</p>
                    </div>
                  </div>
                </button>

                {/* PPKA dispatcher select */}
                <button
                  id="btn-recruit-ppka"
                  onClick={onEnterPpkas}
                  className="p-4 rounded-xl border-2 bg-[#0f1424] border-slate-800 text-slate-400 hover:border-slate-700 text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield size={20} className="text-slate-500" />
                    <div>
                      <h3 className="font-extrabold text-xs text-white uppercase">Peran: PPKA (Dispatcher CTC)</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Mengatur wesel beralih sepur, cycles sinyal, amankan perlintasan.</p>
                    </div>
                  </div>
                </button>

                {/* Teknisi select */}
                <button
                  id="btn-recruit-teknisi"
                  onClick={onEnterTeknisi}
                  className="p-4 rounded-xl border-2 bg-[#0f1424] border-slate-800 text-slate-400 hover:border-slate-700 text-left transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Wrench size={20} className="text-amber-500" />
                    <div>
                      <h3 className="font-extrabold text-xs text-white uppercase flex items-center gap-1.5">
                        <span>Peran: Teknisi Jalan Rel & Sinyal</span>
                        <span className="text-[7px] bg-amber-950 text-amber-400 border border-amber-900 px-1 py-0.5 rounded leading-none">BARU</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Menangani kondisi darurat, memperbaiki sinyal & evakuasi tabrakan.</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Mini employee profile card */}
            <div className="bg-[#12192a] rounded-xl border border-slate-800 p-4 font-mono text-center flex flex-col items-center">
              <span className="text-[9px] text-[#2ebd7f] font-black uppercase tracking-wider block mb-1">Status Kepegawaian</span>
              <div className="text-xs text-white font-bold">{career.username}</div>
              <div className="text-[10px] text-amber-500 font-bold capitalize mt-0.5">Pangkat: {career.rank}</div>
              <div className="text-[10px] text-slate-500 mt-1">Total Poin: {career.points} Pts</div>
            </div>

            {/* Real-time Databases directory */}
            <div className="bg-[#12192a] rounded-xl border border-slate-800 p-4 font-mono flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-1 bg-[#0b0f1b] p-1 rounded-lg border border-indigo-950">
                <button
                  id="tab-btn-db-crews"
                  type="button"
                  onClick={() => setLobbyViewTab('crews')}
                  className={`py-1 text-[8px] font-bold rounded text-center transition-all cursor-pointer ${
                    lobbyViewTab === 'crews' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  KRU ONLINE
                </button>
                <button
                  id="tab-btn-db-static"
                  type="button"
                  onClick={() => setLobbyViewTab('static-data')}
                  className={`py-1 text-[8px] font-bold rounded text-center transition-all cursor-pointer ${
                    lobbyViewTab === 'static-data' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  INFORMASI
                </button>
              </div>

              {lobbyViewTab === 'crews' && (
                <>
                  <div className="flex justify-between items-center border-b border-indigo-950 pb-2">
                    <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>KRU AKTIF ONLINE ({onlinePlayers.length})</span>
                    </span>
                    <span className="text-[7px] bg-[#0c1f17] text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-900/30">DB SYSTEM (RTDB)</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {onlinePlayers.length > 0 ? (
                      onlinePlayers.map(p => (
                        <div key={p.id} className="p-2 bg-[#090d16] border border-slate-850 rounded flex justify-between items-center text-left">
                          <div>
                            <div className="text-xs text-slate-100 font-bold flex items-center gap-1 leading-none font-sans">
                              <span>{p.username}</span>
                              {p.role === 'PPKA' && <span className="text-[7px] bg-red-950 border border-red-900 text-red-400 px-1 rounded uppercase font-black">PPKA</span>}
                              {p.role === 'Masinis' && <span className="text-[7px] bg-orange-950 border border-orange-900 text-orange-400 px-1 rounded uppercase font-black">Masinis</span>}
                            </div>
                            <div className="text-[8px] text-slate-400 mt-1">Rank: {p.rank} • Pts: {p.points}</div>
                            {p.trainName && <div className="text-[8px] text-indigo-400 mt-1 italic">🚂 Dines: {p.trainName}</div>}
                          </div>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow shadow-emerald-500"></span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-slate-500 text-center py-2 italic">Mencari rekan dinas online...</div>
                    )}
                  </div>
                </>
 
              )}

              {lobbyViewTab === 'static-data' && (
                <>
                  <div className="flex justify-between items-center border-b border-indigo-950 pb-2">
                    <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                      <LayoutGrid size={11} className="text-emerald-400" />
                      <span>METADATA PETA & BATAS SEKTOR</span>
                    </span>
                    <span className="text-[7px] bg-emerald-950 text-emerald-450 px-1.5 py-0.5 rounded font-bold uppercase border border-emerald-950/30 font-mono">STATIC DB</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1 text-[8px] leading-relaxed font-mono">
                    <div className="border border-slate-850 p-1.5 bg-[#090d16] rounded">
                      <span className="text-[#2ebd7f] font-bold uppercase block mb-1">Batas Lintas Kecepatan:</span>
                      {dbZones.map(z => (
                        <div key={z.id} className="flex justify-between items-center text-slate-300 border-b border-slate-900/30 py-0.5 font-bold">
                          <span>Sektor {z.zoneId}: {z.description}</span>
                          <span className="text-amber-500">{z.maxSpeedLimit} KMH</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border border-slate-850 p-1.5 bg-[#090d16] rounded">
                      <span className="text-indigo-400 font-bold uppercase block mb-1 font-extrabold pb-0.5">Jadwal Rute Autopilot AI KA:</span>
                      {dbSchedules.map(s => (
                        <div key={s.id} className="text-slate-350 border-b border-slate-900/30 py-1 last:border-b-0 font-mono">
                          <span className="font-bold text-slate-200 block">{s.name} ({s.id})</span>
                          <span className="text-[7px] text-slate-600 italic block mt-0.5 font-sans leading-tight">{s.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Sub panels area based on recruitment role (Right) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {/* Masinis Sub choices: Spawning or Take-over AI trains */}
            {roleMode === 'Masinis' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Column A: Spawn new train */}
                <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5 flex flex-col justify-between h-full min-h-[350px]">
                  <form onSubmit={handleSpawn} className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-slate-350 uppercase tracking-widest mb-1 flex items-center gap-1.5 border-b border-indigo-950 pb-2">
                      <PlusCircle size={15} />
                      <span>Berangkatkan Kereta Baru</span>
                    </h3>

                    {/* Inputs */}
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Nama Layanan Rangkaian KA</label>
                      <input
                        id="inp-train-alias"
                        type="text"
                        value={trainName}
                        onChange={(e) => setTrainName(e.target.value)}
                        placeholder="e.g. KRL Commuter Line #"
                        className="bg-[#0c101c] border border-slate-800 rounded px-3 py-2 text-xs w-full focus:outline-none focus:border-indigo-500 font-mono text-slate-100"
                        maxLength={24}
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Arah Jalur Dinas</label>
                      <select
                        id="sel-train-dir"
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as any)}
                        className="bg-[#0c101c] border border-slate-850 rounded px-2 py-1.5 text-xs w-full text-slate-300 font-mono"
                      >
                        <option value={LineDirection.Hilir}>Jalur Hilir (Jakarta Kota ➔ Bogor)</option>
                        <option value={LineDirection.Hulu}>Jalur Hulu (Bogor ➔ Jakarta Kota)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase block mb-2">Pilih Armada Sarana</label>
                      <div className="flex flex-col gap-2 h-[130px] overflow-y-auto pr-1">
                        {(Object.keys(TRAIN_SPECS) as TrainType[]).map(type => {
                          const locked = isTrainLocked(type);
                          const spec = TRAIN_SPECS[type];
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => { if (!locked) setSelectedType(type); }}
                              disabled={locked}
                              className={`p-2 rounded-lg border text-left flex justify-between items-center transition-all ${
                                selectedType === type 
                                  ? 'bg-indigo-950/40 border-indigo-500 text-white' 
                                  : 'bg-[#090d16] border-slate-850 text-slate-450 hover:border-slate-800 disabled:opacity-40'
                              }`}
                            >
                              <div className="font-mono text-[10px]">
                                <span className="font-bold block leading-none">{spec.label}</span>
                                <span className="text-[8px] text-slate-500 block leading-none mt-1">Maks: {spec.maxSpeed} Kph • Massa: {spec.mass} Ton</span>
                              </div>
                              {locked && <Lock size={12} className="text-red-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      id="btn-spawn-train"
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white py-2 px-4 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 uppercase mt-1"
                    >
                      <Play size={13} />
                      <span>Masuk Kabin Kemudi</span>
                    </button>
                  </form>
                </div>

                {/* Column B: Take-Over running trains */}
                <div className="bg-[#12192a] rounded-xl border border-slate-800 p-5 flex flex-col justify-between h-full min-h-[350px]">
                  <div>
                    <h3 className="text-xs font-bold text-slate-350 uppercase tracking-widest mb-2 flex items-center gap-1.5 border-b border-indigo-950 pb-2">
                      <Radio size={15} />
                      <span>Ambil Alih Lintas Laju (Take-Over)</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 mb-3 leading-relaxed font-mono">Pilih armada kereta aktif di sistem untuk langsung kemudikan manual atau ambil alih dinas autopilot AI secara instan.</p>

                    <div className="flex flex-col gap-2.5 max-h-[225px] overflow-y-auto pr-1">
                      {activeTrains.map(t => {
                        const isSelfCur = t.driverName === career.username;
                        return (
                          <div key={t.id} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${
                            t.isAI 
                              ? 'bg-[#0d1222] border-slate-850 hover:border-slate-800' 
                              : isSelfCur 
                                ? 'bg-indigo-950/25 border-indigo-900/60' 
                                : 'bg-[#150f24] border-[#38205f]/40'
                          }`}>
                            <div className="font-mono text-[10px] flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold block leading-none ${t.isAI ? 'text-amber-500' : 'text-fuchsia-400'}`}>
                                  {t.name}
                                </span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded leading-none uppercase ${
                                  t.isAI 
                                    ? 'bg-amber-950/80 border border-amber-900/40 text-amber-400' 
                                    : 'bg-indigo-950 text-indigo-400 border border-indigo-900/40'
                                }`}>
                                  {t.isAI ? 'Autopilot AI' : `Manual: ${t.driverName}`}
                                </span>
                              </div>
                              <span className="text-slate-400 block leading-none mt-1.5">Posisi: KM {t.kp.toFixed(1)} • Speed: {Math.round(t.speed)} Kph</span>
                              <span className="text-[8px] text-slate-500 leading-none block mt-0.5 font-sans">Arah: {t.direction} • {t.type}</span>
                            </div>

                            <button
                              id={`btn-takeover-${t.id}`}
                              onClick={() => onTakeoverTrain(t.id)}
                              className={`font-black px-2.5 py-1.5 rounded text-[9px] font-mono leading-none tracking-wider transition-all cursor-pointer active:scale-95 uppercase ${
                                t.isAI 
                                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950' 
                                  : isSelfCur
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
                              }`}
                            >
                              {isSelfCur ? 'MASUK KABIN' : t.isAI ? 'IKAT KABIN' : 'AMBIL ALIH'}
                            </button>
                          </div>
                        );
                      })}
                      {activeTrains.length === 0 && (
                        <span className="text-slate-500 text-xs font-mono text-center block py-4 font-sans">Tidak ada kereta dinas aktif yang berjalan di seberang lintas saat ini.</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* If no sub role selected yet, show an encouraging panel */}
            {!roleMode && (
              <div className="bg-[#12192a] rounded-xl border border-slate-800 p-8 text-center flex flex-col justify-center items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <Compass size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Menunggu Pemilihan Dinas Pekerjaan</h3>
                  <p className="text-xs text-slate-450 mt-1 max-w-sm leading-relaxed">Pilihlah salah satu menu dinas Masinis atau PPKA Sektor di sebelah kiri untuk me-recruit penugasan aktif Anda hari ini.</p>
                </div>
              </div>
            )}

          </div>

        </div>
        )
      )}

    </div>
  );
}
