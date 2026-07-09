import React, { useState, useEffect, useRef } from 'react';
import { Train, LineDirection, TrainType } from '../types';
import { calculateDistance, subscribeToSyncChannel, broadcastStateChange, db } from '../utils/sync';
import { ref, set, onValue, onDisconnect } from 'firebase/database';
import L from 'leaflet';
import { getLatLngFromKp } from '../data/tracks';
import { 
  Radio, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX, 
  Users, 
  Wifi, 
  WifiOff, 
  Activity, 
  HelpCircle, 
  X,
  Compass,
  Zap,
  Info,
  UserCheck,
  Building2,
  TrainFront
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RadioKomandoProps {
  activeTrain: Train;
  allTrains: Train[];
  senderId: string;
}

interface RadioIdentity {
  role: 'Masinis' | 'PPKA' | 'Teknisi';
  kaNumber?: string;
  armadaType?: string;
  stationName?: string;
  name: string;
  // Posisi & id panggilan live milik pemilik identitas ini, dipakai untuk menghitung jarak
  // (radius 5km) dan sebagai target pemanggilan WebRTC lintas role (Masinis<->PPKA/PK,
  // PPKA<->PPKA, Teknisi<->PPKA). Diisi otomatis dari activeTrain, BUKAN diketik manual,
  // supaya selalu akurat mengikuti posisi sungguhan pemain saat ini.
  trainId: string;
  kp: number;
  direction?: 'Hilir' | 'Hulu';
}

export default function RadioKomando({ activeTrain, allTrains, senderId }: RadioKomandoProps) {
  // UI Panels
  const [isOpen, setIsOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'SEKTOR-1' | 'SEKTOR-2' | 'SEKTOR-3'>('SEKTOR-1');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 3. IDENTITY SELECTION STATE
  const [radioIdentity, setRadioIdentity] = useState<RadioIdentity | null>(() => {
    const saved = localStorage.getItem('rrsid_radio_identity');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Identity selection form states
  const [selectedRole, setSelectedRole] = useState<'Masinis' | 'PPKA' | 'Teknisi'>('Masinis');
  const [formKaNumber, setFormKaNumber] = useState('KA 205');
  const [formArmadaType, setFormArmadaType] = useState('KRL JR 205');
  const [formStationName, setFormStationName] = useState('PPKA Manggarai');
  const [formName, setFormName] = useState('');

  // Peers dynamic custom identity registry
  const [peerIdentities, setPeerIdentities] = useState<Record<string, RadioIdentity>>({});

  // Audio state
  const [micState, setMicState] = useState<'disconnected' | 'calling' | 'connected'>('disconnected');
  const [partnerTrain, setPartnerTrain] = useState<Train | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [remotePTTActive, setRemotePTTActive] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [micDenied, setMicDenied] = useState(false);

  // WebRTC references
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const isInitiator = useRef(false);

  // Audio nodes for radio clicks and static noise
  const squelchRef = useRef<AudioNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Initialize Web Audio API for Radio Sound Effects (Squelch, Beeps)
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Play Walkie-Talkie beeps using oscillators
  const playRadioBeep = (type: 'pre' | 'roger') => {
    initAudioContext();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (type === 'pre') {
      // Short walkie-talkie chirp (800Hz to 1200Hz pitch sweep)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // Indonesian KAI classic digital radio "Roger Beep" double-tone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(1240, ctx.currentTime);
      osc2.frequency.setValueAtTime(1330, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.01);
      gain.gain.setValueAtTime(0.04, ctx.currentTime + 0.08);
      
      // Secondary descending tone beep
      setTimeout(() => {
        if (osc1 && ctx) {
          osc1.frequency.setValueAtTime(940, ctx.currentTime);
          osc2.frequency.setValueAtTime(1040, ctx.currentTime);
        }
      }, 80);

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.2);
      osc2.stop(ctx.currentTime + 0.2);
    }
  };

  // Play synthetic radio squelch static noise (white noise burst)
  const playSquelchTail = () => {
    initAudioContext();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.18; // Short tail duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Filter to make static sound muddy/radio-filtered (narrow bandpass)
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  };

  // Build audio analyzer to map microphone input levels into glowing waves
  const setupAudioAnalyzer = (stream: MediaStream) => {
    try {
      initAudioContext();
      const ctx = audioContextRef.current;
      if (!ctx) return;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyzerRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyzerRef.current) return;
        analyzerRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const val = sum / bufferLength;
        setAudioLevel(val / 255); // normalize
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (e) {
      console.warn("Could not setup audio analysis node:", e);
    }
  };

  // Close audio analyzer
  const stopAudioAnalyzer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyzerRef.current = null;
    setAudioLevel(0);
  };

  // --- WEBRTC CORE IMPLEMENTATION ---

  // Request Access to Local Microphone
  const acquireLocalMedia = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
      });
      localStreamRef.current = stream;
      if (stream.getAudioTracks().length > 0) {
        localAudioTrackRef.current = stream.getAudioTracks()[0];
        // Initially keep silent until PTT pushed
        localAudioTrackRef.current.enabled = false;
      }
      setMicDenied(false);
      setIsSimulated(false);
      return stream;
    } catch (err) {
      console.warn("Could not acquire microphone. Falling back to voice simulation mode.", err);
      setMicDenied(true);
      setIsSimulated(true);
      return null;
    }
  };

  // Setup PeerConnection events
  const createPeerConnection = (targetId: string): RTCPeerConnection => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Signaling ICE candidate
        broadcastStateChange('VOICE_SIGNAL', {
          targetId,
          senderId,
          signal: {
            type: 'candidate',
            candidate: event.candidate
          }
        }, senderId);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        // Create HTML audio tag for playback if target track exists
        const audioDomId = `radio-remote-audio-${targetId}`;
        let audioElement = document.getElementById(audioDomId) as HTMLAudioElement;
        if (!audioElement) {
          audioElement = document.createElement('audio');
          audioElement.id = audioDomId;
          audioElement.autoplay = true;
          document.body.appendChild(audioElement);
        }
        audioElement.srcObject = event.streams[0];
        setupAudioAnalyzer(event.streams[0]);
      }
    };

    // Include local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcRef.current = pc;
    return pc;
  };

  // Initiate connection call to target player. Accepts a lightweight "train-like" contact
  // object directly (id/name/kp/driverName) instead of requiring a match inside allTrains,
  // since PPKA/Teknisi contacts are synthetic presence anchors, not physical trains.
  const initiateVoiceConnection = async (target: Train) => {
    initAudioContext();
    const targetTrainId = target.id;

    setMicState('calling');
    setPartnerTrain(target);
    isInitiator.current = true;

    // Acquire mic
    const stream = await acquireLocalMedia();
    const pc = createPeerConnection(targetTrainId);

    // If simulation, we don't build active peer SDP lines but we send mock call packet
    if (!stream || isSimulated) {
      broadcastStateChange('VOICE_SIGNAL', {
        targetId: targetTrainId,
        senderId,
        signal: {
          type: 'simulation_call',
          senderTrain: activeTrain,
          identity: radioIdentity
        }
      }, senderId);
      
      // Wait slightly and mock establish
      setTimeout(() => {
        setMicState('connected');
        playRadioBeep('pre');
      }, 1500);
      return;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      broadcastStateChange('VOICE_SIGNAL', {
        targetId: targetTrainId,
        senderId,
        signal: {
          type: 'offer',
          sdp: offer.sdp,
          senderTrain: activeTrain,
          identity: radioIdentity
        }
      }, senderId);
    } catch (e) {
      console.error("Failed creating WebRTC Offer:", e);
    }
  };

  // Disconnect voice stream instantly
  const disconnectVoice = (broadcast = true) => {
    // Stop PTT first
    if (isPTTActive) {
      handlePTTRelease();
    }

    if (broadcast && partnerTrain) {
      broadcastStateChange('VOICE_SIGNAL', {
        targetId: partnerTrain.id,
        senderId,
        signal: { type: 'disconnect' }
      }, senderId);
    }

    // Close PeerConnection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    stopAudioAnalyzer();
    setMicState('disconnected');
    setPartnerTrain(null);
    setIsIncomingCall(false);
    setRemotePTTActive(false);
  };

  const acceptCall = async () => {
    if (!partnerTrain) return;
    initAudioContext();
    setIsIncomingCall(false);
    setMicState('connected');

    const stream = await acquireLocalMedia();

    if (!stream || isSimulated) {
      broadcastStateChange('VOICE_SIGNAL', {
        targetId: partnerTrain.id,
        senderId,
        signal: { type: 'simulation_accept' }
      }, senderId);
      playRadioBeep('pre');
      return;
    }

    // For real WebRTC we respond with answer
    const pc = createPeerConnection(partnerTrain.id);
    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      broadcastStateChange('VOICE_SIGNAL', {
        targetId: partnerTrain.id,
        senderId,
        signal: {
          type: 'answer',
          sdp: answer.sdp
        }
      }, senderId);

      playRadioBeep('pre');
    } catch (e) {
      console.error("Failed responding with WebRTC Answer:", e);
    }
  };

  const declineCall = () => {
    if (partnerTrain) {
      broadcastStateChange('VOICE_SIGNAL', {
        targetId: partnerTrain.id,
        senderId,
        signal: { type: 'decline' }
      }, senderId);
    }
    disconnectVoice(false);
  };

  // Handle incoming signals
  const handleIncomingSignal = async (incomingSenderId: string, signal: any) => {
    const matchedTrain = allTrains.find(t => t.id === incomingSenderId);
    
    // Track incoming peer custom identity if provided
    if (signal.identity) {
      setPeerIdentities(prev => ({
        ...prev,
        [incomingSenderId]: signal.identity
      }));
    }

    switch (signal.type) {
      case 'offer':
        if (micState === 'disconnected') {
          playRadioBeep('pre');
          setPartnerTrain(matchedTrain || { id: incomingSenderId, name: 'KA Dinas' } as any);
          setIsIncomingCall(true);
          setMicState('calling');

          // Initialize answer PeerConnection
          const pc = createPeerConnection(incomingSenderId);
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        }
        break;

      case 'answer':
        if (micState === 'calling' && pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            setMicState('connected');
            playRadioBeep('pre');
          } catch (e) {
            console.error("Failed completing peer link:", e);
          }
        }
        break;

      case 'candidate':
        if (pcRef.current) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.warn("Failed tracking received ICE candidate:", e);
          }
        }
        break;

      case 'disconnect':
      case 'decline':
        // Partner hung up
        disconnectVoice(false);
        break;

      case 'ptt_active':
        setRemotePTTActive(true);
        playRadioBeep('pre');
        break;

      case 'ptt_inactive':
        setRemotePTTActive(false);
        playSquelchTail();
        playRadioBeep('roger');
        break;

      // Simulations fallbacks
      case 'simulation_call':
        if (micState === 'disconnected') {
          playRadioBeep('pre');
          setPartnerTrain(signal.senderTrain || matchedTrain || { id: incomingSenderId, name: 'KA Jalur Sim', driverName: 'Masinis Komando' } as any);
          setIsIncomingCall(true);
          setMicState('calling');
          setIsSimulated(true);
        }
        break;

      case 'simulation_accept':
        if (micState === 'calling') {
          setMicState('connected');
          playRadioBeep('pre');
        }
        break;
    }
  };

  // --- PUSH TO TALK MECHANISMS ---

  const handlePTTPress = () => {
    if (micState !== 'connected' || !partnerTrain) return;
    initAudioContext();
    setIsPTTActive(true);
    playRadioBeep('pre');

    // Unmute mic track
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.enabled = true;
    }

    if (localStreamRef.current) {
      setupAudioAnalyzer(localStreamRef.current);
    } else {
      // Simulate spectral wave for demo/simulation modes
      let mockLevel = 0.1;
      const interval = setInterval(() => {
        if (!isPTTActive) {
          clearInterval(interval);
          return;
        }
        mockLevel = 0.2 + Math.random() * 0.65;
        setAudioLevel(mockLevel);
      }, 100);
    }

    // Broadcast PTT active event
    broadcastStateChange('VOICE_SIGNAL', {
      targetId: partnerTrain.id,
      senderId,
      signal: { type: 'ptt_active' }
    }, senderId);
  };

  const handlePTTRelease = () => {
    if (!isPTTActive || !partnerTrain) return;
    setIsPTTActive(false);

    // Mute track
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.enabled = false;
    }
    
    stopAudioAnalyzer();
    
    // Play walkie static tail & roger chime release
    playSquelchTail();
    playRadioBeep('roger');

    // Broadcast PTT release
    broadcastStateChange('VOICE_SIGNAL', {
      targetId: partnerTrain.id,
      senderId,
      signal: { type: 'ptt_inactive' }
    }, senderId);
  };

  // Handle incoming offers via Sync Channel Subscriptions
  useEffect(() => {
    const unsub = subscribeToSyncChannel((packet) => {
      if (packet.type === 'VOICE_SIGNAL') {
        const { targetId, senderId: payloadSenderId, signal } = packet.payload;
        // Verify targeted player is me!
        if (targetId === activeTrain.id && payloadSenderId !== senderId) {
          handleIncomingSignal(payloadSenderId, signal);
        }
      } else if (packet.type === 'RADIO_PRESENCE') {
        // Track other peer identities globally in real-time
        const { senderId: peerId, identity } = packet.payload;
        if (peerId !== senderId) {
          setPeerIdentities(prev => ({
            ...prev,
            [peerId]: identity
          }));
        }
      }
    });

    return () => {
      unsub();
      disconnectVoice(false);
    };
  }, [activeTrain.id, senderId, allTrains, micState, radioIdentity]);

  // Load initial radio presences from Firebase RTDB and subscribe to updates
  useEffect(() => {
    const presenceRef = ref(db, 'radio_presence');
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      const updatedPeers: Record<string, RadioIdentity> = {};
      if (data) {
        Object.keys(data).forEach(peerId => {
          if (peerId !== senderId) {
            updatedPeers[peerId] = data[peerId];
          }
        });
      }
      setPeerIdentities(updatedPeers);
    });

    return () => {
      unsubPresence();
    };
  }, [senderId]);

  // Broadcast presence whenever radio identity is established and sync to RTDB
  useEffect(() => {
    if (radioIdentity) {
      // 1. Write presence to RTDB under /radio_presence/${senderId}
      const myPresenceRef = ref(db, `radio_presence/${senderId}`);
      set(myPresenceRef, radioIdentity).catch(err => {
        console.warn('Failed to set radio presence in RTDB:', err);
      });

      // Clear presence on disconnect/tab close
      onDisconnect(myPresenceRef).remove().catch(err => {
        console.warn('onDisconnect radio presence register failed:', err);
      });

      // 2. Broadcast transient state change
      broadcastStateChange('RADIO_PRESENCE', {
        senderId,
        identity: radioIdentity
      }, senderId);
    }
  }, [radioIdentity]);

  // Heartbeat: keep the broadcast kp fresh so 5km proximity detection stays accurate as the
  // player (or the train/lori they're anchored to) moves, WITHOUT requiring the player to
  // re-save their identity. Runs every 6s while an identity is active.
  useEffect(() => {
    if (!radioIdentity) return;
    const interval = setInterval(() => {
      const freshIdentity: RadioIdentity = {
        ...radioIdentity,
        kp: activeTrain.kp,
        direction: activeTrain.direction === LineDirection.Hulu ? 'Hulu' : 'Hilir'
      };
      const myPresenceRef = ref(db, `radio_presence/${senderId}`);
      set(myPresenceRef, freshIdentity).catch(() => {});
      broadcastStateChange('RADIO_PRESENCE', { senderId, identity: freshIdentity }, senderId);
    }, 6000);
    return () => clearInterval(interval);
  }, [radioIdentity, activeTrain.kp, activeTrain.direction, senderId]);

  // Sistem pasangan komunikasi radio (KAI dinas lintas): Masinis hanya bisa menghubungi
  // PPKA/PK, PPKA/PK bisa saling menghubungi sesama PPKA/PK dan juga Masinis & Teknisi,
  // Teknisi hanya bisa menghubungi PPKA/PK. Semua dibatasi radius 5000m (5km).
  const ALLOWED_CONTACT_ROLES: Record<'Masinis' | 'PPKA' | 'Teknisi', Array<'Masinis' | 'PPKA' | 'Teknisi'>> = {
    Masinis: ['PPKA'],
    PPKA: ['Masinis', 'PPKA', 'Teknisi'],
    Teknisi: ['PPKA']
  };

  // Dynamic filter for nearby candidates (Distance < 5000m), dibangun dari roster lintas
  // jaringan (peerIdentities via radio_presence) sehingga PPKA & Teknisi (yang bukan Train
  // fisik di allTrains) tetap bisa ditemukan dan dihubungi, bukan hanya sesama masinis.
  const activeTrainCoords = getLatLngFromKp(activeTrain.kp, activeTrain.direction);

  const nearbyContacts = (Object.entries(peerIdentities) as [string, RadioIdentity][])
    .map(([peerId, ident]) => {
      const peerDirection = ident.direction === 'Hulu' ? LineDirection.Hulu : LineDirection.Hilir;
      const peerCoords = getLatLngFromKp(ident.kp, peerDirection);
      const distance = calculateDistance(activeTrainCoords, peerCoords);
      return { peerId, ident, distance };
    })
    .filter(({ ident, distance }) => {
      if (!radioIdentity) return false;
      const myRole: 'Masinis' | 'PPKA' | 'Teknisi' = radioIdentity.role;
      if (!ALLOWED_CONTACT_ROLES[myRole].includes(ident.role)) return false;
      return distance <= 5000;
    })
    .filter(({ ident, peerId }) => {
      if (!searchQuery) return true;
      const term = searchQuery.toLowerCase();
      return (
        ident.name.toLowerCase().includes(term) ||
        ident.role.toLowerCase().includes(term) ||
        peerId.toLowerCase().includes(term) ||
        (ident.stationName && ident.stationName.toLowerCase().includes(term)) ||
        (ident.kaNumber && ident.kaNumber.toLowerCase().includes(term))
      );
    })
    // Bentuk objek "train-like" ringan agar kompatibel dengan seluruh UI/logika panggilan
    // WebRTC yang sudah ada di bawah (yang mengharapkan bentuk {id, name, kp, driverName}).
    .map(({ peerId, ident, distance }) => ({
      train: {
        id: ident.trainId || peerId,
        name: ident.role === 'Masinis'
          ? `${ident.kaNumber || 'KA'} - ${ident.armadaType || ''}`.trim()
          : ident.role === 'PPKA'
          ? (ident.stationName || ident.name)
          : (ident.stationName || 'Lori Teknisi'),
        driverName: ident.name,
        kp: ident.kp,
        type: ident.role === 'Teknisi' ? TrainType.Langsir : TrainType.KRL_8,
        direction: ident.direction === 'Hulu' ? LineDirection.Hulu : LineDirection.Hilir
      } as unknown as Train,
      distance,
      role: ident.role
    }));

  // Map train types into clean, readable tags
  const getTrainTypeTag = (type: string) => {
    const t = String(type).toUpperCase();
    if (t.includes('KRL')) {
      return { label: 'KRL', color: 'border-cyan-500 text-cyan-400 bg-cyan-950/30' };
    } else if (t.includes('CC')) {
      return { label: 'LOGISTIK', color: 'border-amber-500 text-amber-400 bg-amber-950/30' };
    } else if (t.includes('LANGSIR')) {
      return { label: 'TEKNISI', color: 'border-emerald-500 text-emerald-400 bg-emerald-950/30' };
    }
    return { label: 'COMMUTER', color: 'border-slate-500 text-slate-400 bg-slate-900' };
  };

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const identity: RadioIdentity = {
      role: selectedRole,
      name: formName,
      trainId: activeTrain.id,
      kp: activeTrain.kp,
      direction: activeTrain.direction === LineDirection.Hulu ? 'Hulu' : 'Hilir',
      ...(selectedRole === 'Masinis' 
        ? { kaNumber: formKaNumber, armadaType: formArmadaType } 
        : { stationName: activeTrain.name })
    };

    localStorage.setItem('rrsid_radio_identity', JSON.stringify(identity));
    setRadioIdentity(identity);
    playRadioBeep('pre');

    // Broadcast registration presence
    broadcastStateChange('RADIO_PRESENCE', {
      senderId,
      identity
    }, senderId);
  };

  return (
    <div id="fitted-rrsid-comms" className="pointer-events-auto">
      
      {/* 1. COMPACT HUD HOTKEY KEY mic button with flashing neon active glow */}
      <button
        id="btn-trigger-radio-komando"
        onClick={() => {
          initAudioContext();
          setIsOpen(!isOpen);
        }}
        className={`relative w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-mono font-black text-[11px] uppercase cursor-pointer tracking-wider border transition-all duration-150 ${
          micState === 'connected'
            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/40 animate-pulse'
            : micState === 'calling'
            ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/30 animate-flash'
            : 'bg-[#0d1527] border-indigo-950 text-indigo-400 hover:text-white hover:bg-[#152039]'
        }`}
      >
        <Radio size={14} className={micState !== 'disconnected' ? 'animate-bounce' : ''} />
        <span>VHF RAD KOMANDO</span>
        {micState === 'connected' ? (
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        )}
      </button>

      {/* Real-time Crew Online Board */}
      <div className="mt-2 bg-[#030712]/90 border border-indigo-950/80 rounded-xl p-2.5 font-mono shadow-lg">
        <div className="text-[8px] font-black tracking-wider text-indigo-400 flex items-center gap-1 uppercase mb-1.5 border-b border-indigo-950/50 pb-1">
          <Users size={10} className="text-indigo-500 animate-pulse" />
          <span>KRU VHF AKTIF ({Object.keys(peerIdentities).length + (radioIdentity ? 1 : 0)})</span>
        </div>
        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto custom-scrollbar text-[9px]">
          {radioIdentity && (
            <div className="flex items-center gap-1 text-emerald-400 font-extrabold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>[{radioIdentity.role}] {radioIdentity.name} (Anda)</span>
            </div>
          )}
          {(Object.entries(peerIdentities) as [string, RadioIdentity][]).map(([peerId, ident]) => (
            <div key={peerId} className="flex items-center gap-1 text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>
                [{ident.role}] {ident.role === 'Masinis' ? `${ident.kaNumber} - ` : ''}{ident.name} (Online)
              </span>
            </div>
          ))}
          {!radioIdentity && Object.keys(peerIdentities).length === 0 && (
            <span className="text-slate-600 text-[8px] italic">Radio sepi / off-mic</span>
          )}
        </div>
      </div>

      {/* 2. THE FUTURISTIC TRANSCEIVER WALKIETALKIE CABINET DRAWER */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[2100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-[#0b0f19] border-2 border-indigo-950 rounded-2xl w-full max-w-md shadow-2xl flex flex-col font-sans overflow-hidden text-slate-100"
            >
              {/* Device Header */}
              <div className="bg-[#0e1424] px-4 py-3 border-b border-indigo-950/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-950 rounded border border-indigo-900 text-indigo-400">
                    <Radio size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-widest text-indigo-300 font-mono">RADIO KOMANDO RT-72</h3>
                    <p className="text-[9px] text-slate-500 font-mono leading-none mt-0.5">SISTEM INTEGRASI IDENTITAS RADIO KAI</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* DYNAMIC SWAP: IDENTITY PRELOAD SELECTION VS TRANSCEIVER SCREEN */}
              {!radioIdentity ? (
                /* 3. IDENTITY REGISTRATION FORM */
                <form onSubmit={handleSaveIdentity} className="p-5 flex flex-col gap-4 bg-[#050811]">
                  <div className="text-center pb-2 border-b border-indigo-950/50">
                    <UserCheck className="mx-auto text-orange-500 mb-1.5 animate-bounce" size={20} />
                    <h4 className="text-xs font-black text-slate-200 uppercase font-mono tracking-wider">PILIH IDENTITAS DINAS RADIO</h4>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">Verifikasi tanda panggil kru VHF sebelum transmisi</p>
                  </div>

                  {/* Role Tab selection */}
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('Masinis')}
                      className={`py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        selectedRole === 'Masinis'
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <TrainFront size={13} />
                      <span>Masinis</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('PPKA')}
                      className={`py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        selectedRole === 'PPKA'
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Building2 size={13} />
                      <span>PPKA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('Teknisi')}
                      className={`py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        selectedRole === 'Teknisi'
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <UserCheck size={13} />
                      <span>Teknisi</span>
                    </button>
                  </div>

                  {/* Custom Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                      {selectedRole === 'Masinis' ? 'Nama Masinis' : selectedRole === 'PPKA' ? 'Nama PPKA' : 'Nama Teknisi'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={selectedRole === 'Masinis' ? 'Contoh: Fa\'al, Budi Prasetyo' : 'Contoh: Budi Prasetyo, Hendra'}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-[#02050b] border border-indigo-950/80 rounded-lg px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Conditionally rendered form subsets */}
                  {selectedRole === 'Masinis' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Nomor KA</label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: KA 205"
                          value={formKaNumber}
                          onChange={(e) => setFormKaNumber(e.target.value)}
                          className="w-full bg-[#02050b] border border-indigo-950/80 rounded-lg px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Jenis Armada</label>
                        <select
                          value={formArmadaType}
                          onChange={(e) => setFormArmadaType(e.target.value)}
                          className="w-full bg-[#02050b] border border-indigo-950/80 rounded-lg px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="KRL JR 205">KRL JR 205</option>
                          <option value="CC 201">Lok CC 201</option>
                          <option value="CC 206">Lok CC 206</option>
                        </select>
                      </div>
                    </div>
                  ) : selectedRole === 'PPKA' ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Stasiun / Otoritas Dinas</label>
                      <input
                        type="text"
                        value={activeTrain.name || formStationName}
                        disabled
                        className="w-full bg-[#02050b] border border-indigo-950/80 rounded-lg px-3 py-2 font-mono text-xs text-slate-400 cursor-not-allowed"
                      />
                      <span className="text-[8px] text-slate-600 mt-0.5">Otomatis diambil dari otoritas dinas PPKA Anda saat ini.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-mono font-bold text-slate-400 uppercase">Posisi Dinas Teknisi</label>
                      <input
                        type="text"
                        value={activeTrain.name || 'Lori Teknisi'}
                        disabled
                        className="w-full bg-[#02050b] border border-indigo-950/80 rounded-lg px-3 py-2 font-mono text-xs text-slate-400 cursor-not-allowed"
                      />
                      <span className="text-[8px] text-slate-600 mt-0.5">Otomatis mengikuti posisi lori/rangkaian penolong Anda saat ini (KM {activeTrain.kp.toFixed(1)}).</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-400 text-slate-950 font-black py-2.5 rounded-lg text-xs font-mono transition-transform active:scale-[0.98]"
                  >
                    MULAI DINAS RADIO VHF
                  </button>
                </form>
              ) : (
                <>
                  {/* Status Digital transceiver Screen Area */}
                  <div className="p-4 bg-[#050811] border-b border-indigo-950/40 relative">
                    <div className="absolute top-2 right-4 flex items-center gap-1.5 text-[8.5px] font-mono text-indigo-600">
                      <Activity size={10} className="text-indigo-500 animate-pulse" />
                      <span>{radioIdentity.role.toUpperCase()}: {radioIdentity.name}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono">
                      {/* Freq dial readout */}
                      <div className="col-span-2 bg-[#02050b] p-2.5 rounded-lg border border-indigo-950 text-emerald-400">
                        <span className="text-[7.5px] text-slate-600 block uppercase font-bold tracking-wider leading-none">FREKUENSI KABIN</span>
                        <span className="text-lg font-black leading-none mt-1 block">
                          {activeChannel === 'SEKTOR-1' ? '154.200' : activeChannel === 'SEKTOR-2' ? '154.425' : '154.850'} <span className="text-[9.5px]">MHz</span>
                        </span>
                      </div>

                      {/* Operational Mode status code block */}
                      <div className="bg-[#02050b] p-2.5 rounded-lg border border-indigo-950 text-center flex flex-col justify-center">
                        <span className="text-[7.5px] text-slate-600 block uppercase font-bold tracking-wider leading-none">CHANNEL</span>
                        <span className="text-xs font-black text-amber-400 mt-1 block leading-none">{activeChannel}</span>
                      </div>
                    </div>

                    {/* Simulated Waveform spectral visualizer and live states display */}
                    <div className="mt-3 bg-[#020409] border border-indigo-950/60 rounded-lg p-2.5 flex items-center justify-between min-h-12 overflow-hidden">
                      <div className="flex-1">
                        {micState === 'disconnected' ? (
                          <div>
                            <span className="text-[8.5px] font-bold font-mono text-slate-500 block">STATUS TRANSCEIVER</span>
                            <p className="text-[9.5px] font-mono font-bold uppercase text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <WifiOff size={11} className="text-slate-500" /> STANDBY (KOSONG)
                            </p>
                          </div>
                        ) : micState === 'calling' ? (
                          <div>
                            <span className="text-[8.5px] font-bold font-mono text-amber-500/80 block uppercase animate-pulse">MENYAMBUNGKAN DIAL...</span>
                            <p className="text-[9.5px] font-mono font-black text-amber-400 mt-0.5 truncate uppercase">
                              KONTROL KE {partnerTrain?.name || 'KA SEKTOR'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[8.5px] font-bold font-mono text-emerald-400 block uppercase">SALURAN TERHUBUNG</span>
                            <p className="text-[10px] font-mono font-black text-white mt-0.5 uppercase flex items-center gap-1.5">
                              <Wifi size={11} className="text-emerald-400 animate-pulse" />
                              <span>{partnerTrain?.name} • {partnerTrain?.driverName || 'MASINIS'}</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Waveform graphic audio signals mapping */}
                      <div className="w-16 h-8 flex items-center justify-center gap-0.5 shrink-0 pr-1">
                        {(isPTTActive || remotePTTActive) ? (
                          Array.from({ length: 6 }).map((_, i) => {
                            const levelOffset = audioLevel > 0 ? audioLevel : 0.15;
                            const individualHeight = 4 + (Math.sin(i * 1.5 + Date.now() / 100) * 12 * levelOffset) + (Math.random() * 6 * levelOffset);
                            return (
                              <span
                                key={i}
                                className={`w-1 rounded transition-all duration-75 ${isPTTActive ? 'bg-red-400 shadow shadow-red-500/50' : 'bg-emerald-400 shadow shadow-emerald-500/50'}`}
                                style={{ height: `${Math.max(3, Math.min(28, individualHeight))}px` }}
                              />
                            );
                          })
                        ) : micState === 'connected' ? (
                          <span className="text-[8px] font-mono text-slate-500 tracking-tight font-bold border border-dashed border-slate-800 px-1.5 py-0.5">PTT WAIT</span>
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600">STBY</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. ACTIVE VOICE SESSION CALL CONTROLLER PANEL */}
                  {micState !== 'disconnected' && (
                    <div className="p-4 bg-[#0a0d18] border-b border-indigo-950/80 flex flex-col gap-3.5">
                      <div className="bg-[#030610] p-3 rounded-xl border border-indigo-950 flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-bold font-mono text-slate-500 block uppercase">KRU PEER KANAN-KIRI</span>
                          <span className="text-xs font-black text-indigo-300 uppercase block mt-0.5 leading-none">
                            KM {partnerTrain?.kp?.toFixed(2)} ({nearbyContacts.find(c => c.train.id === partnerTrain?.id)?.distance ? `${Math.round(nearbyContacts.find(c => c.train.id === partnerTrain!.id)!.distance)}m` : 'Radius Dekat'})
                          </span>
                        </div>

                        {/* Alerting buttons */}
                        <div className="flex gap-1.5">
                          {isIncomingCall ? (
                            <>
                              <button
                                onClick={acceptCall}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-[9px] font-mono cursor-pointer flex items-center gap-1 shadow shadow-emerald-400/20 active:translate-y-0.5"
                              >
                                <Phone size={11} />
                                <span>ANGKAT</span>
                              </button>
                              <button
                                onClick={declineCall}
                                className="bg-red-600 hover:bg-red-500 text-white font-black px-3.5 py-1.5 rounded-lg text-[9px] font-mono cursor-pointer flex items-center gap-1 shadow shadow-red-500/20 active:translate-y-0.5"
                              >
                                <PhoneOff size={11} />
                                <span>TOLAK</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => disconnectVoice(true)}
                              className="bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 font-extrabold px-3.5 py-1.5 rounded-lg text-[9.5px] font-mono cursor-pointer flex items-center gap-1 active:translate-y-0.5"
                            >
                              <PhoneOff size={11} />
                              <span>TUTUP ADUAN</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* PUSH TO TALK LARGE KEYING SYSTEM PANEL */}
                      {micState === 'connected' && !isIncomingCall && (
                        <div className="flex flex-col items-center justify-center p-3 bg-[#03050a] rounded-xl border border-dashed border-indigo-950/90 text-center">
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 font-bold mb-3">
                            <Info size={11} className="text-indigo-400" />
                            <span>METODE PUSH-TO-TALK ACTIVE</span>
                          </div>

                          {/* Interactive Trigger block */}
                          <button
                            onMouseDown={handlePTTPress}
                            onMouseUp={handlePTTRelease}
                            onMouseLeave={handlePTTRelease}
                            onTouchStart={(e) => { e.preventDefault(); handlePTTPress(); }}
                            onTouchEnd={(e) => { e.preventDefault(); handlePTTRelease(); }}
                            id="btn-ptt-key"
                            className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center gap-2 select-none active:scale-95 transition-all duration-100 cursor-pointer ${
                              isPTTActive 
                                ? 'bg-red-500/10 border-red-500 shadow-xl shadow-red-500/20 text-red-400 animate-pulse'
                                : remotePTTActive
                                ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400'
                                : 'bg-[#060a14] hover:bg-[#0d152a] border-indigo-950 text-indigo-400 hover:text-indigo-300'
                            }`}
                          >
                            {isPTTActive ? (
                              <Mic size={36} className="animate-bounce" />
                            ) : remotePTTActive ? (
                              <Volume2 size={36} className="animate-pulse" />
                            ) : (
                              <MicOff size={36} />
                            )}
                            
                            <div className="font-mono text-[9px] font-black uppercase tracking-widest text-center px-2">
                              {isPTTActive ? (
                                <span className="text-red-500">BERBICARA! (TX)</span>
                              ) : remotePTTActive ? (
                                <span className="text-emerald-400">PASANGAN (RX)</span>
                              ) : (
                                <span>TEKAN & TAHAN</span>
                              )}
                            </div>
                          </button>

                          <p className="text-[8.5px] text-slate-500 font-mono mt-3.5 max-w-[280px]">
                            * Tahan mouse klik / ketukan layar untuk membuka jalur transmisi suara ke kru lawan. Lepas tombol untuk Roger / Ganti.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. CONTACTS SEARCH LIST PANELS */}
                  {micState === 'disconnected' && (
                    <div className="flex-1 flex flex-col min-h-[220px] max-h-[340px]">
                      {/* Channel selectors tabs */}
                      <div className="grid grid-cols-3 border-b border-indigo-950/60 text-center font-mono">
                        {(['SEKTOR-1', 'SEKTOR-2', 'SEKTOR-3'] as const).map(ch => (
                          <button
                            key={ch}
                            onClick={() => setActiveChannel(ch)}
                            className={`py-2 text-[9.5px] font-black uppercase border-b-2 tracking-tighter cursor-pointer ${
                              activeChannel === ch 
                                ? 'border-indigo-500 text-white bg-[#0e1424]/40' 
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {ch === 'SEKTOR-1' ? 'S.1 MRG' : ch === 'SEKTOR-2' ? 'S.2 DPK' : 'S.3 BOO'}
                          </button>
                        ))}
                      </div>

                      {/* Filtering search bar */}
                      <div className="p-2 border-b border-indigo-950/40 bg-[#080c15]">
                        <div className="relative flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Cari Nomor KA, Stasiun, Nama Kru..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-[#03060a] border border-indigo-950/80 rounded-lg px-3 py-1.5 font-mono text-[10px] text-zinc-100 placeholder-slate-600 focus:outline-none focus:border-indigo-600"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              localStorage.removeItem('rrsid_radio_identity');
                              set(ref(db, `radio_presence/${senderId}`), null).catch(err => {
                                console.warn('Failed to clear radio presence in RTDB:', err);
                              });
                              setRadioIdentity(null);
                            }}
                            className="bg-slate-900 border border-slate-800 text-[8px] text-amber-500 font-mono px-2 py-1 rounded hover:bg-slate-800 transition-all uppercase font-bold"
                          >
                            Ganti ID
                          </button>
                        </div>
                      </div>

                      {/* List container */}
                      <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-1.5 custom-scrollbar bg-[#05080e]">
                        <div className="text-[8.5px] font-bold font-mono text-indigo-400 uppercase tracking-widest pb-1 border-b border-indigo-950/30 flex items-center gap-1">
                          <Users size={10} />
                          <span>KONTUR SEKTOR TERDEKAT (MAX 5 KM)</span>
                        </div>

                        {nearbyContacts.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 font-mono text-[10px] flex flex-col items-center gap-2">
                            <WifiOff size={18} className="text-slate-600" />
                            <span>Tidak ada armada terdekat dalam radius transmisi</span>
                          </div>
                        ) : (
                          nearbyContacts.map(({ train: trainItem, distance, role: contactRole }) => {
                            const trTag = getTrainTypeTag(trainItem.type);
                            const roleTagColor = contactRole === 'PPKA'
                              ? 'border-amber-500 text-amber-400 bg-amber-950/30'
                              : contactRole === 'Teknisi'
                              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                              : trTag.color;
                            const displayName = trainItem.name;
                            const displayDriver = `${contactRole} ${trainItem.driverName || ''}`.trim();

                            return (
                              <div
                                key={trainItem.id}
                                className="bg-[#0a0f1e]/85 hover:bg-[#131b32] border border-indigo-950 hover:border-indigo-800 rounded-xl p-2.5 transition-all flex items-center justify-between gap-3 font-mono"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[8px] font-black border px-1 py-px rounded uppercase block ${roleTagColor}`}>
                                      {contactRole}
                                    </span>
                                    <span className="font-extrabold text-xs text-white leading-none block font-mono truncate">
                                      {displayName}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-slate-400 mt-1.5 font-mono leading-none">
                                    <div>ID: <strong className="text-indigo-400">{trainItem.id}</strong></div>
                                    <div className="truncate">Kru: <strong className="text-amber-400">
                                      {displayDriver}
                                    </strong></div>
                                    <div>Jalur: <strong className="text-indigo-400">{trainItem.currentTrackId || 'Lurus'}</strong></div>
                                    <div>M-Point: <strong className="text-zinc-300">KM {trainItem.kp.toFixed(2)}</strong></div>
                                  </div>
                                </div>

                                {/* Distance & Callback triggers */}
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className="text-[10px] text-emerald-400 font-black leading-none bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-950">
                                    {Math.round(distance)}m
                                  </span>
                                  <button
                                    onClick={() => initiateVoiceConnection(trainItem)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-2.5 py-1.5 rounded-lg text-[9px] font-mono cursor-pointer flex items-center gap-1 active:translate-y-0.5 shadow-md shadow-indigo-600/10"
                                  >
                                    <Phone size={10} />
                                    <span>PANGGIL</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bottom informative help bar footer */}
                  <div className="bg-[#050811] px-4 py-3 border-t border-indigo-950/70 text-[9px] text-slate-500 font-mono flex items-center gap-1.5">
                    <HelpCircle size={12} className="text-indigo-500 shrink-0" />
                    <span>
                      Radius dinas Komando dibatasi maks. 5000 meter untuk mereduksi overlapping frekuensi masinis.
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
