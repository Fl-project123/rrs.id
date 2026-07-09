import React, { useState, useEffect, useRef } from 'react';
import { Radio, Mic, MicOff, Volume2, Info, Check, ShieldAlert } from 'lucide-react';
import { radioAudio } from '../utils/radioAudio';

export interface VhfRadioDinasProps {
  role: 'Masinis' | 'PPKA' | 'Teknisi' | string;
  username: string;
  activeTrainName?: string;
  onSendChatMessage: (msg: string, sender: string) => void;
  selectedZone?: number | string;
}

export default function VhfRadioDinas({
  role,
  username,
  activeTrainName,
  onSendChatMessage,
  selectedZone = 1
}: VhfRadioDinasProps) {
  // VHF radio channels
  const channels = [
    { id: 1, name: 'CH 1: MASINIS <-> PPKA', desc: 'Saluran lintas utama komunikasi masinis kavaleri dengan PPKA pengatur sektor.' },
    { id: 2, name: 'CH 2: PPKA <-> PPKA', desc: 'Saluran inter-sektor antar PPKA stasiun batas untuk aman warta kereta.' },
    { id: 3, name: 'CH 3: TEKNISI <-> PPKA', desc: 'Saluran darurat pemeliharaan prasarana jalan rel, sinyal, wesel, dan rescue.' }
  ];

  // Restrict channels based on role
  let initialChannelId = 1;
  let isChannelLocked = false;
  let allowedChannels = [1, 2, 3];

  if (role === 'Masinis') {
    initialChannelId = 1;
    isChannelLocked = true;
    allowedChannels = [1];
  } else if (role === 'Teknisi') {
    initialChannelId = 3;
    isChannelLocked = true;
    allowedChannels = [3];
  }

  const [activeChannelId, setActiveChannelId] = useState<number>(initialChannelId);
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [radioLogs, setRadioLogs] = useState<{ id: string; time: string; sender: string; msg: string; ch: number }[]>([]);
  const [radioText, setRadioText] = useState<string>('');
  const [activeTransmitter, setActiveTransmitter] = useState<string | null>(null);
  const [audioWaves, setAudioWaves] = useState<number[]>(Array(8).fill(4));

  // Determine call sign
  const getCallSign = () => {
    if (role === 'Masinis') {
      return `Masinis ${username} (${activeTrainName || 'KA-102'})`;
    } else if (role === 'PPKA') {
      return `PPKA Sektor ${selectedZone} (${username})`;
    } else if (role === 'Teknisi') {
      return `Teknisi Sinyal ${username}`;
    }
    return `${role} ${username}`;
  };

  // Sound effects & state for pressing PTT
  const handlePTTPress = () => {
    if (isPTTActive) return;
    setIsPTTActive(true);
    radioAudio.playTxBeep();
    setActiveTransmitter(getCallSign());

    // Send visual audio waves
    const interval = setInterval(() => {
      setAudioWaves(prev => prev.map(() => Math.floor(Math.random() * 26) + 4));
    }, 85);
    (window as any)._waveInterval = interval;
  };

  const handlePTTRelease = () => {
    if (!isPTTActive) return;
    setIsPTTActive(false);
    radioAudio.playRxSquelch();
    setActiveTransmitter(null);
    clearInterval((window as any)._waveInterval);
    setAudioWaves(Array(8).fill(4));

    // If there is written text, send it as a formal radio report
    const messageToSend = radioText.trim();
    if (messageToSend) {
      const callSign = getCallSign();
      const prefix = `🎙️ [RADIO CH ${activeChannelId}] ${callSign}`;
      
      // Dispatch chat message
      onSendChatMessage(`${prefix}: "${messageToSend}"`, 'Radio Komando');

      // Add to local radio log
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setRadioLogs(prev => [
        {
          id: Math.random().toString(),
          time: timeStr,
          sender: callSign,
          msg: messageToSend,
          ch: activeChannelId
        },
        ...prev
      ].slice(0, 15));

      setRadioText('');
    }
  };

  // Preset communication macros based on channel & role
  const getMacros = () => {
    if (role === 'Masinis') {
      return [
        'Sinyal masuk kuning, bersiap masuk peron stasiun.',
        'Semboyan 35 sudah dibunyikan, kereta meluncur berangkat.',
        'Mengalami kendala tekanan angin silinder rem, butuh teknisi penolong!',
        'Kereta telah berhenti sempurna tepat di marka peron.'
      ];
    } else if (role === 'PPKA') {
      if (activeChannelId === 1) {
        return [
          'Masinis KA-102 silakan masuk jalur peron, aman.',
          'Aspek sinyal keluar hijau aman, silakan berangkat.',
          'Harap kurangi kecepatan, ada perbaikan bantalan rel di KM depan.',
          'Berhenti luar stasiun, sinyal masuk aspek merah terhalang sepur!'
        ];
      } else if (activeChannelId === 2) {
        return [
          'PPKA batas stasiun seberang, KRL 205 siap pelepasan sektor.',
          'Warta aman kereta: seluruh wesel stasiun dikunci lurus aman.',
          'Gawat darurat! Terjadi tabrakan sepur di petak kilometer!',
          'Laporan kondisi wesel sektor berfungsi normal sempurna.'
        ];
      } else {
        return [
          'Teknisi penolong, mohon segera merapat ke lokasi gangguan wesel!',
          'Tim evakuasi lori penolong silakan masuk, jalur ditutup sementara.',
          'Terima kasih, wesel dinyatakan bersih dari rintangan sepur.',
          'Cek fisik kelistrikan sinyal otomatis di KM terganggu.'
        ];
      }
    } else if (role === 'Teknisi') {
      return [
        'Pekerjaan perbaikan wesel selesai, kunci jalur dibuka kembali.',
        'Rangkaian sepur lori rescue CC 201 NR siap meluncur evakuasi.',
        'Coupler lori penyelamat berhasil terhubung ke gerbong tabrakan.',
        'Evakuasi tuntas! Seluruh lintasan rel kini bersih dari rintangan sepur.'
      ];
    }
    return ['Hubungi pos koordinasi utama.'];
  };

  return (
    <div id="vhf-radio-ht-dinas" className="bg-[#0b101f] border-2 border-indigo-950 rounded-xl p-4 flex flex-col gap-4 font-sans text-slate-100 shadow-2xl">
      {/* Radio Device Header */}
      <div className="flex items-center justify-between border-b border-indigo-950/80 pb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded border transition-colors ${isPTTActive ? 'bg-red-950 border-red-500 text-red-500 animate-pulse' : 'bg-indigo-950 border-indigo-900 text-indigo-400'}`}>
            <Radio size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-widest text-indigo-300 font-mono">HANDY TALKY VHF DINAS</h3>
            <span className="text-[9px] text-slate-500 font-mono block">KAI STANDARDIZED LINTAS COMMS</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-[#04060c] px-2.5 py-1 rounded border border-indigo-950 text-[10px] font-mono font-bold text-amber-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{role.toUpperCase()} CALLSIGN</span>
        </div>
      </div>

      {/* Digital frequency readout and audio visualizer */}
      <div className="bg-[#04060c] p-3 rounded-lg border border-indigo-950/80 font-mono relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[8px] text-slate-600">
          <Volume2 size={10} className="text-indigo-600" />
          <span>DUPLEX VHF</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 bg-[#020306] p-2 rounded border border-indigo-950/50">
            <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider leading-none">SALURAN AKTIF</span>
            <span className="text-xs font-black text-emerald-400 mt-1 block">
              {channels.find(c => c.id === activeChannelId)?.name}
            </span>
          </div>
          <div className="bg-[#020306] p-2 rounded border border-indigo-950/50 text-center flex flex-col justify-center">
            <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider leading-none">ZONE S.</span>
            <span className="text-xs font-black text-amber-500 mt-1 block">{selectedZone}</span>
          </div>
        </div>

        {/* Live status bar or Waveform indicator */}
        <div className="mt-2.5 bg-[#010204] border border-indigo-950/40 rounded p-2 flex items-center justify-between min-h-11">
          <div className="flex-1 min-w-0 pr-2">
            {isPTTActive ? (
              <div>
                <span className="text-[7.5px] font-extrabold text-red-500 uppercase tracking-widest block animate-pulse">TRANSMITTING (TX)...</span>
                <span className="text-[9px] font-bold text-slate-300 block truncate italic mt-0.5">"{radioText || 'Menahan tombol mic...'}"</span>
              </div>
            ) : activeTransmitter ? (
              <div>
                <span className="text-[7.5px] font-extrabold text-emerald-400 uppercase tracking-widest block animate-pulse">RECEIVING (RX)...</span>
                <span className="text-[9px] font-bold text-white block truncate font-bold mt-0.5">{activeTransmitter}</span>
              </div>
            ) : (
              <div>
                <span className="text-[7.5px] font-bold text-slate-500 block uppercase tracking-widest">TRANSCIEVER STANDBY</span>
                <span className="text-[9px] font-medium text-slate-400 block mt-0.5">Siap digunakan. Tekan PTT untuk bersuara.</span>
              </div>
            )}
          </div>

          {/* Glowing Waveform Bars */}
          <div className="flex items-center gap-0.5 h-6 w-12 shrink-0">
            {audioWaves.map((h, i) => (
              <span
                key={i}
                className={`w-1 rounded transition-all duration-75 ${isPTTActive ? 'bg-red-500 shadow-sm shadow-red-500/50' : activeTransmitter ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-800'}`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Channel selector buttons if not locked */}
      <div>
        <span className="text-[9px] text-[#f59e0b] font-black uppercase tracking-wider block mb-1.5 font-mono">PILIH FREKUENSI RADIO:</span>
        {isChannelLocked ? (
          <div className="bg-[#050811] p-2 rounded border border-indigo-950 flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <ShieldAlert size={12} className="text-amber-500" />
            <span>Kunci Saluran Aktif: Peran Anda ({role}) terkunci di saluran {activeChannelId}.</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 text-[9.5px] font-mono">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => {
                  radioAudio.playTxBeep();
                  setActiveChannelId(ch.id);
                }}
                className={`py-1.5 px-2 rounded font-bold transition-all border cursor-pointer ${
                  activeChannelId === ch.id
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                    : 'bg-[#12192d] border-indigo-950 text-slate-400 hover:text-slate-200 hover:bg-[#1a233e]'
                }`}
              >
                CH {ch.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Push to Talk & Text Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
        {/* Text statement reporter */}
        <div className="md:col-span-8 flex flex-col justify-between gap-2 bg-[#04060c] p-2.5 rounded-lg border border-indigo-950/60">
          <textarea
            value={radioText}
            onChange={(e) => setRadioText(e.target.value)}
            placeholder="Ketik pernyataan radio dinas di sini, lalu TEKAN & TAHAN tombol mic di kanan untuk kirim warta suara..."
            className="w-full bg-[#020306] border border-indigo-950 rounded p-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-600 h-[65px] resize-none"
          />

          {/* Quick macro templates */}
          <div className="flex flex-wrap gap-1">
            <span className="text-[8px] text-slate-500 font-bold uppercase block w-full mb-0.5">Sandi Warta Makro:</span>
            {getMacros().map((mac, idx) => (
              <button
                key={idx}
                onClick={() => setRadioText(mac)}
                className="bg-[#12192d] hover:bg-[#19233f] border border-indigo-950 rounded py-0.5 px-2 text-[9px] text-indigo-400 font-mono font-medium transition-colors text-left truncate max-w-[200px] cursor-pointer"
              >
                ⚡ {mac}
              </button>
            ))}
          </div>
        </div>

        {/* Large mic button */}
        <div className="md:col-span-4 flex flex-col justify-center items-center bg-[#050811] rounded-lg border border-indigo-950/80 p-2 text-center select-none">
          <button
            onMouseDown={handlePTTPress}
            onMouseUp={handlePTTRelease}
            onMouseLeave={handlePTTRelease}
            onTouchStart={(e) => { e.preventDefault(); handlePTTPress(); }}
            onTouchEnd={(e) => { e.preventDefault(); handlePTTRelease(); }}
            className={`w-[90px] h-[90px] rounded-full border-4 flex flex-col items-center justify-center gap-1 shadow-md transition-all duration-100 cursor-pointer ${
              isPTTActive 
                ? 'bg-red-500/15 border-red-500 shadow-lg shadow-red-500/20 text-red-400 animate-pulse'
                : 'bg-[#080d19] hover:bg-[#0f1931] border-indigo-950 text-indigo-400 hover:text-indigo-300'
            }`}
          >
            {isPTTActive ? <Mic size={22} className="animate-bounce" /> : <MicOff size={22} />}
            <span className="text-[8px] font-black tracking-widest font-mono">
              {isPTTActive ? 'ON-MIC' : 'PTT HT'}
            </span>
          </button>
          <span className="text-[7.5px] text-slate-500 font-mono block mt-2">HOLD UNTUK TRANSMISI</span>
        </div>
      </div>

      {/* Communications radio log */}
      <div className="border-t border-indigo-950/60 pt-3">
        <span className="text-[8.5px] font-black text-indigo-400 uppercase tracking-widest font-mono block mb-1.5">MUTASI LOG TRANSMISI RADIO KAI SEKTOR:</span>
        <div className="bg-[#03050a] rounded border border-indigo-950/80 p-2 max-h-[85px] overflow-y-auto flex flex-col gap-1 font-mono text-[9.5px]">
          {radioLogs.length === 0 ? (
            <span className="text-slate-600 text-[9px] italic block text-center">Sunyi... Belum ada laporan warta dinas lintas radio di saluran ini.</span>
          ) : (
            radioLogs.map(log => (
              <div key={log.id} className="text-[9.5px] border-b border-indigo-950/20 pb-1 flex items-center justify-between gap-2 leading-relaxed">
                <span className="text-[#a5b4fc] font-bold min-w-[150px] shrink-0 truncate">[{log.time}] CH {log.ch} - {log.sender}:</span>
                <span className="text-slate-200 flex-1 truncate italic">"{log.msg}"</span>
                <span className="text-emerald-500 font-extrabold shrink-0 flex items-center gap-0.5 text-[8px] bg-emerald-950/30 px-1 py-px rounded border border-emerald-950">
                  <Check size={9} />
                  <span>TERKIRIM</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
