import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiUpload } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import VRMStage from '../components/VRMStage.jsx';

const DEMO_MODE = String(import.meta.env.VITE_DEMO || '').toLowerCase() === 'true';
const SR_LANG = import.meta.env.VITE_SR_LANG || (typeof navigator !== 'undefined' ? navigator.language : 'en-IN') || 'en-IN';
const SKIP_HEALTH_CHECK = String(import.meta.env.VITE_SKIP_HEALTH_CHECK || '').toLowerCase() === 'true';
const STT_PROVIDER = String(import.meta.env.VITE_STT_PROVIDER || '').toLowerCase();
const PRIMARY_MODEL = {
  id: 'anime-vrm',
  label: import.meta.env.VITE_PRIMARY_MODEL_LABEL || 'Anime VRM',
  url: import.meta.env.VITE_VRM_MODEL_URL || '/models/anime.vrm'
};
const ALT_MODEL_URL = String(import.meta.env.VITE_ALT_MODEL_URL || '').trim();
const ALT_MODEL = {
  id: 'alt-model',
  label: import.meta.env.VITE_ALT_MODEL_LABEL || 'Second Model',
  url: ALT_MODEL_URL || '/models/alt-model.fbx'
};

async function modelExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

export default function Chat() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [models, setModels] = useState([PRIMARY_MODEL]);
  const [modelIndex, setModelIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [emotion, setEmotion] = useState('neutral');
  const [cameraMode, setCameraMode] = useState('full');
  const [muted, setMuted] = useState(false);
  const [useApiStt, setUseApiStt] = useState(false);
  const [status, setStatus] = useState('Tap MIC to speak');
  const [error, setError] = useState('');

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const lipSyncRafRef = useRef(0);
  const speechLipSyncRef = useRef(0);

  const speechRecognitionSupported =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const activeModel = models[modelIndex] || PRIMARY_MODEL;

  useEffect(() => {
    // Auth check removed to allow direct access
  }, [loading, user, navigate]);

  useEffect(() => {
    let active = true;

    async function resolveModels() {
      const nextModels = [PRIMARY_MODEL];
      if (ALT_MODEL.url && ALT_MODEL.url !== PRIMARY_MODEL.url) {
        const altReady = ALT_MODEL_URL ? true : await modelExists(ALT_MODEL.url);
        if (altReady) {
          nextModels.push(ALT_MODEL);
        }
      }

      if (!active) return;
      setModels(nextModels);
      setModelIndex((current) => Math.min(current, nextModels.length - 1));
    }

    resolveModels();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Initiate hidden camera stream for emotional tracking
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.warn('Camera access denied or unavailable', err));

    return () => {
      if (videoRef.current?.srcObject) {
         videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!hasGreeted && typeof window !== 'undefined') {
      const timer = setTimeout(() => {
        speakWithBrowserTTS("Hii Pavan!");
      }, 800);
      setHasGreeted(true);
      return () => clearTimeout(timer);
    }
  }, [hasGreeted]);

  useEffect(() => {
    if (SKIP_HEALTH_CHECK) {
      setUseApiStt(STT_PROVIDER === 'assemblyai');
      return;
    }

    let active = true;
    apiFetch('/health')
      .then((data) => {
        if (!active) return;
        setUseApiStt(String(data?.sttProvider || 'none').toLowerCase() !== 'none');
      })
      .catch(() => {
        if (!active) return;
        setUseApiStt(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
      stopSpeechSynthesis();
    };
  }, []);

  function stopLipSyncLoop() {
    if (lipSyncRafRef.current) {
      cancelAnimationFrame(lipSyncRafRef.current);
      lipSyncRafRef.current = 0;
    }
    if (speechLipSyncRef.current) {
      cancelAnimationFrame(speechLipSyncRef.current);
      speechLipSyncRef.current = 0;
    }
    setMouthOpen(0);
  }

  function stopAudioPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    stopLipSyncLoop();
  }

  function handleStop() {
    stopAudioPlayback();
    stopSpeechSynthesis();
    setIsSpeaking(false);
    setIsThinking(false);
    setEmotion('neutral');
    setStatus('Tap MIC to speak');
  }

  function handleModelSwitch() {
    if (models.length < 2) return;
    handleStop();
    setIsListening(false);
    setIsDancing(false);
    setModelIndex((current) => (current + 1) % models.length);
  }

  function stopSpeechSynthesis() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  async function speakWithAudioUrl(audioUrl) {
    stopAudioPlayback();
    stopSpeechSynthesis();

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    let ctx = audioContextRef.current;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      audioContextRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    analyserRef.current = analyser;

    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const bins = new Uint8Array(analyser.frequencyBinCount);

    const updateLipSync = () => {
      analyser.getByteTimeDomainData(bins);
      let sum = 0;
      for (let i = 0; i < bins.length; i += 1) {
        const centered = (bins[i] - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / bins.length);
      const open = Math.max(0, Math.min(1, (rms - 0.01) * 14));
      setMouthOpen(open);
      lipSyncRafRef.current = requestAnimationFrame(updateLipSync);
    };

    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
      lipSyncRafRef.current = requestAnimationFrame(updateLipSync);
    });

    stopAudioPlayback();
  }

  async function speakWithBrowserTTS(text) {
    stopAudioPlayback();
    stopSpeechSynthesis();

    if (!window.speechSynthesis) {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      return;
    }

    const utter = new SpeechSynthesisUtterance(text);
    
    // Auto-select the best native Hindi/Indian female voice
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Sometimes voices need a moment to load on some browsers
      await new Promise((r) => setTimeout(r, 100));
      voices = window.speechSynthesis.getVoices();
    }
    
    const preferredVoice = 
      voices.find(v => v.lang.includes('hi-IN') && (v.name.includes('Kalpana') || v.name.includes('Swara') || v.name.includes('Female') || v.name.includes('Google'))) ||
      voices.find(v => v.lang.includes('hi-IN')) ||
      voices.find(v => v.lang.includes('en-IN') && (v.name.includes('Female') || v.name.includes('Heera') || v.name.includes('Google'))) ||
      voices.find(v => v.lang.includes('en-IN'));

    if (preferredVoice) {
      utter.voice = preferredVoice;
    }

    utter.rate = 0.95; // Slightly slower for clearer Hindi
    utter.pitch = 1.2; // Slightly higher pitch for a more feminine voice

    let running = true;
    let start = performance.now();

    const fakeLipSync = () => {
      if (!running) return;
      const t = (performance.now() - start) / 1000;
      const open = 0.15 + Math.max(0, Math.sin(t * 16)) * 0.6;
      setMouthOpen(open);
      speechLipSyncRef.current = requestAnimationFrame(fakeLipSync);
    };

    await new Promise((resolve) => {
      utter.onstart = () => {
        start = performance.now(); // Audio actually starts playing now!
        speechLipSyncRef.current = requestAnimationFrame(fakeLipSync);
      };
      utter.onend = () => {
        running = false;
        resolve();
      };
      utter.onerror = () => {
        running = false;
        resolve();
      };
      window.speechSynthesis.speak(utter);
    });

    stopLipSyncLoop();
  }

  async function playAssistantReply(replyText, audioUrl, emotionOverride = 'happy') {
    if (muted) {
      setIsSpeaking(false);
      setEmotion('neutral');
      return;
    }

    setIsSpeaking(true);
    setEmotion(emotionOverride);
    setStatus('Speaking...');

    try {
      if (audioUrl) {
        await speakWithAudioUrl(audioUrl);
      } else {
        await speakWithBrowserTTS(replyText || 'Okay');
      }
    } finally {
      setIsSpeaking(false);
      setMouthOpen(0);
      setEmotion('neutral');
      setStatus('Tap MIC to speak');
    }
  }

  function captureCameraFrame() {
    if (!videoRef.current || !videoRef.current.videoWidth) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      // Get base64 string
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }

  async function sendVoiceTextToAssistant(text) {
    const content = String(text || '').trim();
    if (!content) {
      setStatus('No speech detected');
      setEmotion('neutral');
      return;
    }

    const webcamImage = captureCameraFrame();

    setError('');
    setIsThinking(true);
    setEmotion('thinking');
    setStatus('Thinking...');

    // INTERCEPT DANCE COMMAND
    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes('dance') || 
      lowerContent.includes('dence') || 
      lowerContent.includes('डांस') || 
      lowerContent.includes('naacho') || 
      lowerContent.includes('nacho') || 
      lowerContent.includes('naach') || 
      lowerContent.includes('नाच')
    ) {
      setIsThinking(false);
      setIsDancing(true);
      setEmotion('happy');
      
      if (!window.danceAudio) {
         window.danceAudio = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"); // Real music track
         window.danceAudio.volume = 0.5;
      }
      window.danceAudio.currentTime = 0;
      window.danceAudio.play().catch(()=>{});

      await playAssistantReply("Theek hai Pavan, main aapke hi liye special dance karti hoon! Music chalu!", null, 'happy');
      
      // Stop dancing after 15 seconds
      setTimeout(() => {
        setIsDancing(false);
        if (window.danceAudio) window.danceAudio.pause();
      }, 15000);
      return;
    }

    try {
      const data = await apiFetch('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({ content, image: webcamImage })
      });
      
      // Execute command if returned
      if (data.command?.action === 'YOUTUBE' && data.command.query) {
         let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(data.command.query)}`;
         if (data.command.query.startsWith('http')) {
           url = data.command.query;
         }
         window.open(url, '_blank');
      }

      await playAssistantReply(data.reply, data.audioUrl, data.command?.emotion || 'happy');
    } catch (err) {
      setError(err.message || 'Request failed');
      setStatus('Error. Try again');
      setEmotion('neutral');
    } finally {
      setIsThinking(false);
    }
  }

  function transcribeWithBrowserSR() {
    return new Promise((resolve, reject) => {
      if (!speechRecognitionSupported) {
        reject(new Error('Speech Recognition not supported in this browser.'));
        return;
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRec();
      recognition.lang = SR_LANG || 'hi-IN';
      // VERY IMPORTANT: continuous=false makes the browser natively detect silence and stop automatically!
      recognition.continuous = false; 
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      let finalTranscript = '';

      recognition.onresult = (event) => {
        finalTranscript = event.results[0][0].transcript;
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          reject(new Error('Mic permission blocked. Allow microphone access in the browser.'));
        } else if (event.error === 'audio-capture') {
          reject(new Error('No microphone found. Check sound input device.'));
        }
        // Ignore 'no-speech', onend will safely resolve with empty string
      };

      recognition.onend = () => {
        resolve(finalTranscript.trim());
      };

      try {
        recognition.start();
      } catch (err) {
        resolve("");
      }
    });
  }

  async function transcribeWithApi() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder not supported in this browser');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStatus('Listening...');

    const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks = [];

    const blob = await new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => reject(new Error('Recording failed'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 7000);
    });

    stream.getTracks().forEach((t) => t.stop());

    const form = new FormData();
    form.append('audio', blob, 'speech.webm');
    const data = await apiUpload('/api/voice/transcribe', form);
    return String(data.text || '').trim();
  }

  async function startVoiceInput() {
    if (isListening || isThinking || isSpeaking) return;

    setError('');
    setIsListening(true);
    setEmotion('listening');
    setStatus('Listening...');

    try {
      // Force native browser SpeechRecognition which guarantees Real-Time VAD (stops listening the moment you stop speaking)
      let transcript = await transcribeWithBrowserSR();

      if (!transcript) {
        setStatus('No speech detected (try again, speak closer to mic)');
        setEmotion('neutral');
        return;
      }

      setStatus(`Heard: ${transcript.slice(0, 60)}`);
      await sendVoiceTextToAssistant(transcript);
    } catch (err) {
      setError(err.message || 'Voice input failed');
      setStatus('Tap MIC to speak');
      setEmotion('neutral');
    } finally {
      setIsListening(false);
    }
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <VRMStage
        isSpeaking={isSpeaking}
        isDancing={isDancing}
        mouthOpen={mouthOpen}
        emotion={emotion}
        cameraMode={cameraMode}
        modelUrl={activeModel.url}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
        <div className="pointer-events-auto rounded-2xl bg-black/45 backdrop-blur-md border border-white/20 px-4 py-3 text-white flex items-center gap-3">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              isListening || isThinking || isSpeaking ? 'bg-slate-500/70' : 'bg-emerald-500/80 hover:bg-emerald-400/90'
            }`}
            onClick={startVoiceInput}
            disabled={isListening || isThinking || isSpeaking}
          >
            {isListening ? 'REC...' : 'MIC'}
          </button>

          {(isSpeaking || isThinking || isListening) && (
            <button
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-400 text-white"
              onClick={handleStop}
            >
              STOP 🛑
            </button>
          )}

          <button
            className={`rounded-xl px-3 py-2 text-xs ${cameraMode === 'full' ? 'bg-white/30' : 'bg-white/10'}`}
            onClick={() => setCameraMode('full')}
          >
            Full Body
          </button>

          <button
            className={`rounded-xl px-3 py-2 text-xs ${cameraMode === 'close' ? 'bg-white/30' : 'bg-white/10'}`}
            onClick={() => setCameraMode('close')}
          >
            Close-up
          </button>

          {models.length > 1 && (
            <button
              className="rounded-xl px-3 py-2 text-xs bg-white/10 hover:bg-white/20 max-w-[28vw] truncate"
              onClick={handleModelSwitch}
              title={`Current: ${activeModel.label}`}
            >
              Model: {activeModel.label}
            </button>
          )}

          <button
            className={`rounded-xl px-3 py-2 text-xs ${muted ? 'bg-red-400/70' : 'bg-white/10'}`}
            onClick={() => setMuted((prev) => !prev)}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>

          <span className="text-xs text-white/85 max-w-[40vw] truncate">{status}</span>
        </div>
      </div>

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-lg bg-red-600/90 text-white text-xs px-3 py-2">
          {error}
        </div>
      )}

      {/* Hidden visual observer for the AI */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden w-1 h-1 pointer-events-none opacity-0" />
    </div>
  );
}
