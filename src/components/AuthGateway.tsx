import React, { useState, useEffect } from 'react';
import { UserCareer, CareerRank } from '../types';
import { INITIAL_CAREER, db, firestore } from '../utils/sync';
import { ref, get, set } from 'firebase/database';
import { doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, User, Lock, Calendar, Key, AlertTriangle, Compass, Award, ShieldCheck } from 'lucide-react';

interface AuthGatewayProps {
  onLoginSuccess: (career: UserCareer) => void;
}

export interface UserAccount {
  username: string;
  dob: string; // YYYY-MM-DD
  passwordHash: string;
  career: UserCareer;
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function AuthGateway({ onLoginSuccess }: AuthGatewayProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login form states
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register form states
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regDay, setRegDay] = useState('29');
  const [regMonth, setRegMonth] = useState('5'); // May
  const [regYear, setRegYear] = useState('2010');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Current static server time is 2026-05-29Z
  const currentYear = 2026;
  const currentMonth = 5;
  const currentDay = 29;

  // Initialize preloaded accounts if storage is empty
  useEffect(() => {
    const existing = localStorage.getItem('rrsid_accounts');
    if (!existing) {
      const defaultAccount: UserAccount = {
        username: 'Masinis_Cepat',
        dob: '2000-05-12',
        passwordHash: 'Password123',
        career: {
          username: 'Masinis_Cepat',
          rank: CareerRank.Muda,
          points: 150,
          hasLicense: true,
          stats: {
            tripsCompleted: 2,
            speedInfractions: 1,
            redSignalViolations: 0,
            platformStopsCorrect: 3,
            collisions: 0
          }
        }
      };
      
      const defaultPPKAAcc: UserAccount = {
        username: 'PPKA_Jakarta',
        dob: '1995-10-25',
        passwordHash: 'PPKASandi123',
        career: {
          username: 'PPKA_Jakarta',
          rank: CareerRank.Utama,
          points: 620,
          hasLicense: true,
          stats: {
            tripsCompleted: 12,
            speedInfractions: 0,
            redSignalViolations: 0,
            platformStopsCorrect: 12,
            collisions: 0
          }
        }
      };

      localStorage.setItem('rrsid_accounts', JSON.stringify([defaultAccount, defaultPPKAAcc]));
    }
  }, []);

  const getAccounts = (): UserAccount[] => {
    const raw = localStorage.getItem('rrsid_accounts');
    return raw ? JSON.parse(raw) : [];
  };

  const saveAccounts = (accounts: UserAccount[]) => {
    localStorage.setItem('rrsid_accounts', JSON.stringify(accounts));
  };

  const calculateAge = (byear: number, bmonth: number, bday: number): number => {
    let age = currentYear - byear;
    if (currentMonth < bmonth || (currentMonth === bmonth && currentDay < bday)) {
      age--;
    }
    return age;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedUser = loginUser.trim();
    if (!trimmedUser || !loginPass.trim()) {
      setErrorMsg('Harap masukkan nama dinas dan kata sandi Anda!');
      return;
    }

    const usernameLower = trimmedUser.toLowerCase();
    try {
      // 1. Try to fetch from Firebase Online
      const userRef = ref(db, `user_accounts/${usernameLower}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const cloudAcc = snapshot.val() as UserAccount;
        if (cloudAcc.passwordHash === loginPass) {
          setSuccessMsg('Autentikasi Online Berhasil! Mempersiapkan Kabin...');
          // Save active session
          localStorage.setItem('rrsid_active_username', cloudAcc.username);
          setTimeout(() => {
            onLoginSuccess(cloudAcc.career);
          }, 700);
          return;
        } else {
          setErrorMsg('Kredensial tidak valid! Kata sandi salah.');
          return;
        }
      }
    } catch (err) {
      console.warn('Firebase login check failed, falling back to local credentials:', err);
    }

    // 2. Fallback to Local Storage
    const accounts = getAccounts();
    const match = accounts.find(
      acc => acc.username.toLowerCase() === usernameLower && acc.passwordHash === loginPass
    );

    if (match) {
      setSuccessMsg('Autentikasi Offline Berhasil! Mempersiapkan Kabin...');
      localStorage.setItem('rrsid_active_username', match.username);
      setTimeout(() => {
        onLoginSuccess(match.career);
      }, 700);
    } else {
      setErrorMsg('Kredensial tidak valid! Periksa kembali nama dinas atau sandi Anda.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedUser = regUser.trim();
    if (!trimmedUser) {
      setErrorMsg('Nama dinas / Masinis harus diisi!');
      return;
    }

    if (trimmedUser.length < 3) {
      setErrorMsg('Nama dinas minimal harus terdiri atas 3 karakter!');
      return;
    }

    if (!regPass || regPass.length < 6) {
      setErrorMsg('Kata sandi keamanan akun minimal 6 karakter!');
      return;
    }

    const birthYear = parseInt(regYear, 10);
    const birthMonth = parseInt(regMonth, 10);
    const birthDay = parseInt(regDay, 10);

    // Calculate Age based on Birth Year, Month, Day
    const age = calculateAge(birthYear, birthMonth, birthDay);

    if (age < 8) {
      setErrorMsg(`Usia Anda terdeteksi ${age} tahun. Maaf, batas minimal usia masinis magang sesuai regulasi dilarang di bawah 8 tahun!`);
      return;
    }

    const usernameLower = trimmedUser.toLowerCase();

    // 1. Check if taken on Firebase
    let isTakenOnline = false;
    try {
      const userRef = ref(db, `user_accounts/${usernameLower}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        isTakenOnline = true;
      }
    } catch (err) {
      console.warn('Firebase registration check error:', err);
    }

    if (isTakenOnline) {
      setErrorMsg('Nama dinas tersebut sudah terdaftar di server database! Gunakan nama lain.');
      return;
    }

    // 2. Check local accounts
    const accounts = getAccounts();
    const isTakenLocal = accounts.some(acc => acc.username.toLowerCase() === usernameLower);

    if (isTakenLocal) {
      setErrorMsg('Nama dinas tersebut sudah terdaftar lokal! Gunakan nama lain.');
      return;
    }

    // Create a fresh Career progress for this user
    const freshCareer: UserCareer = {
      ...INITIAL_CAREER,
      username: trimmedUser
    };

    const newAccount: UserAccount = {
      username: trimmedUser,
      dob: `${regYear}-${regMonth.padStart(2, '0')}-${regDay.padStart(2, '0')}`,
      passwordHash: regPass,
      career: freshCareer
    };

    // Save online (Realtime DB credentials and Firestore profile index)
    try {
      const userRef = ref(db, `user_accounts/${usernameLower}`);
      await set(userRef, newAccount);

      // Save structured Career profile to Cloud Firestore users collection
      await setDoc(doc(firestore, 'users', usernameLower), {
        username: trimmedUser,
        rank: freshCareer.rank,
        points: freshCareer.points,
        hasLicense: freshCareer.hasLicense,
        stats: freshCareer.stats,
        updatedAt: new Date().toISOString()
      });
      console.log('Successfully registered user profile to both RTDB and Cloud Firestore!');
    } catch (err) {
      console.warn('Firebase registration sync failed, saved locally only:', err);
    }

    // Save locally
    const nextAccounts = [...accounts, newAccount];
    saveAccounts(nextAccounts);

    setSuccessMsg('Registrasi Berhasil! Silakan Masuk menggunakan akun Anda.');
    setLoginUser(trimmedUser);
    setLoginPass(regPass);
    setTab('login');
    
    // Clear registration inputs
    setRegUser('');
    setRegPass('');
  };

  // Generate Year, Month and Day arrays
  const yearsArray = Array.from({ length: 77 }).map((_, i) => currentYear - i); // From 1950 to 2026
  const daysArray = Array.from({ length: 31 }).map((_, i) => i + 1);

  return (
    <div id="auth-portal-screen" className="min-h-screen bg-[#070a13] text-gray-100 flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
      
      {/* Visual background tracks decors */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f1425] rounded-2xl border border-slate-800 shadow-2xl relative z-10 overflow-hidden flex flex-col">
        
        {/* Colorful top strip */}
        <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500" />

        {/* Brand header panel */}
        <div className="p-6 pb-4 text-center flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-505/10 rounded-xl border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 rotate-12 active:rotate-0 transition-transform">
            <Compass className="animate-spin-slow text-indigo-500" size={26} />
          </div>
          <h1 className="text-xl font-black text-white tracking-widest uppercase">REGISTRASI RRSID</h1>
          <p className="text-[10px] text-slate-400 font-mono mt-1">Multiplayer Kabin Masinis & Pengatur Sinyal PPKA Indonesia</p>
        </div>

        {/* Tab Toggle Controls */}
        <div className="flex border-b border-slate-800 bg-[#0b0e19]">
          <button
            id="tab-btn-login"
            onClick={() => { setTab('login'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-xs font-bold font-mono tracking-wider transition-all text-center ${
              tab === 'login' 
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#0f1425]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            MASUK DINAS
          </button>
          <button
            id="tab-btn-register"
            onClick={() => { setTab('register'); setErrorMsg(''); }}
            className={`flex-1 py-3 text-xs font-bold font-mono tracking-wider transition-all text-center ${
              tab === 'register' 
                ? 'text-indigo-400 border-b-2 border-indigo-500 bg-[#0f1425]' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            DAFTAR ANGGOTA BARU
          </button>
        </div>

        {/* Display Banner Alerts */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-950/40 border-b border-red-900/30 text-red-450 p-3 text-[10px] font-mono leading-relaxed flex items-center gap-2"
            >
              <AlertTriangle className="text-red-500 shrink-0" size={14} />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-950/40 border-b border-emerald-900/30 text-emerald-450 p-3 text-[10px] font-mono leading-relaxed flex items-center gap-2"
            >
              <ShieldCheck className="text-emerald-500 shrink-0" size={14} />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forms Container */}
        <div className="p-6">
          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1.5 flex items-center gap-1.5">
                  <User size={13} className="text-indigo-400" />
                  <span>Nama Dinas Masinis (Username)</span>
                </label>
                <input
                  id="inp-login-username"
                  type="text"
                  placeholder="e.g. Masinis_Cepat"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="bg-[#0b0e19] focus:bg-[#0d1222] border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-650 rounded-lg px-3.5 py-2.5 text-xs w-full focus:outline-none transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1.5 flex items-center gap-1.5">
                  <Lock size={13} className="text-indigo-400" />
                  <span>Kata Sandi Anggota (Password)</span>
                </label>
                <input
                  id="inp-login-password"
                  type="password"
                  placeholder="Masukkan kata sandi..."
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="bg-[#0b0e19] focus:bg-[#0d1222] border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-650 rounded-lg px-3.5 py-2.5 text-xs w-full focus:outline-none transition-all font-mono"
                  required
                />
              </div>

              <button
                id="btn-submit-login"
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white py-3 rounded-lg text-xs font-black tracking-wider uppercase transition-all"
              >
                MASUK DECK UTAMA
              </button>

              {/* Demo Help suggestions to speed up testing clicks */}
              <div className="bg-[#0b0e19] border border-slate-850 p-3 rounded-lg mt-2 text-[10px] text-slate-500 font-mono">
                <span className="text-amber-500 font-bold block mb-1 leading-none">DEMO REKREATIONAL AKUN:</span>
                • Username: <strong className="text-white select-all">Masinis_Cepat</strong><br/>
                • Password: <strong className="text-white select-all">Password123</strong><br/>
                <span className="text-slate-400 mt-1 block leading-tight">Gunakan di atas jika ingin melompati pendaftaran instan!</span>
              </div>

            </form>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1.5 flex items-center gap-1.5">
                  <User size={13} className="text-indigo-400" />
                  <span>Nama Dinas Karyawan (Pendaftaran)</span>
                </label>
                <input
                  id="inp-reg-username"
                  type="text"
                  placeholder="e.g. Masinis_Muda_Rian"
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                  maxLength={18}
                  className="bg-[#0b0e19] focus:bg-[#0d1222] border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-650 rounded-lg px-3.5 py-2.5 text-xs w-full focus:outline-none transition-all font-mono"
                  required
                />
              </div>

              {/* Manual birthdate dropdown selects directly mandated */}
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-400" />
                  <span>Tanggal Lahir (Batas Dinas Usia)</span>
                </label>
                
                <div className="grid grid-cols-3 gap-2">
                  {/* Select day */}
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold mb-0.5 lowercase">Hari</span>
                    <select
                      id="sel-reg-day"
                      value={regDay}
                      onChange={(e) => setRegDay(e.target.value)}
                      className="bg-[#0b0e19] border border-slate-800 text-slate-200 py-1.5 px-2 text-xs rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      {daysArray.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select month */}
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold mb-0.5 lowercase">Bulan</span>
                    <select
                      id="sel-reg-month"
                      value={regMonth}
                      onChange={(e) => setRegMonth(e.target.value)}
                      className="bg-[#0b0e19] border border-slate-800 text-slate-200 py-1.5 px-2 text-xs rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      {INDONESIAN_MONTHS.map((m, idx) => (
                        <option key={m} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select Year */}
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500 font-bold mb-0.5 lowercase">Tahun</span>
                    <select
                      id="sel-reg-year"
                      value={regYear}
                      onChange={(e) => setRegYear(e.target.value)}
                      className="bg-[#0b0e19] border border-slate-800 text-slate-200 py-1.5 px-2 text-xs rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      {yearsArray.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <span className="text-[8px] text-amber-500 font-mono mt-1 block">
                  * Verifikasi Keamanan: Persyaratan minimal melatih masinis magang adalah 8 tahun keatas (Lahir sebelum Mei 2018).
                </span>
              </div>

              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1.5 flex items-center gap-1.5">
                  <Lock size={13} className="text-indigo-400" />
                  <span>Sandi Dinas Akun (Password)</span>
                </label>
                <input
                  id="inp-reg-password"
                  type="password"
                  placeholder="Minimal 6 karakter..."
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  className="bg-[#0b0e19] focus:bg-[#0d1222] border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-650 rounded-lg px-3.5 py-2.5 text-xs w-full focus:outline-none transition-all font-mono"
                  required
                />
              </div>

              <button
                id="btn-submit-register"
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-lg text-xs tracking-wider uppercase transition-all mt-2 font-mono"
              >
                REGISTRASI DAN DAFTARKAN
              </button>

            </form>
          )}
        </div>

      </div>

    </div>
  );
}
