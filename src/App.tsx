/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Languages, 
  Mic, 
  MicOff, 
  Upload, 
  History, 
  Trash2, 
  Copy, 
  Share2, 
  Download, 
  Search, 
  X, 
  Moon, 
  Sun,
  Loader2,
  FileText,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff,
  Package,
  ArrowRight,
  Settings,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translateText, transcribeMedia, synthesizeSpeech } from './services/geminiService';
import { localTranslate, AVAILABLE_PACKS } from './services/offlineService';
import { TranslationStatus, HistoryEntry, TranslationResult, LanguagePack } from './types';

export default function App() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Connectivity State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Translation State
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<TranslationStatus>(TranslationStatus.IDLE);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('translation_history');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPacksOpen, setIsPacksOpen] = useState(false);

  // Offline Packs State
  const [installedPacks, setInstalledPacks] = useState<string[]>([]);
  const [downloadingPack, setDownloadingPack] = useState<string | null>(null);

  // API Key State
  const [customApiKey, setCustomApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('custom_gemini_api_key') || '';
    }
    return '';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync History to LocalStorage
  useEffect(() => {
    localStorage.setItem('translation_history', JSON.stringify(history));
  }, [history]);

  // Sync API Key to LocalStorage
  useEffect(() => {
    localStorage.setItem('custom_gemini_api_key', customApiKey);
  }, [customApiKey]);

  // Sync Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTranslate = async () => {
    if (!input.trim()) return;
    
    // Explicitly check if we should use local if offline
    if (!isOnline) {
      performTranslation(() => localTranslate(input));
    } else {
      performTranslation(() => translateText(input, customApiKey));
    }
  };

  const performTranslation = async (action: () => Promise<TranslationResult>) => {
    setStatus(TranslationStatus.PROCESSING);
    setError(null);
    try {
      const res = await action();
      setResult(res);
      setStatus(TranslationStatus.SUCCESS);
      handleSpeak(res.translatedText);
      
      // Add to history
      const newEntry: HistoryEntry = {
        id: Math.random().toString(36).substring(7),
        originalText: res.originalText,
        translatedText: res.translatedText,
        sourceLanguage: res.sourceLanguage,
        timestamp: Date.now()
      };
      setHistory(prev => [newEntry, ...prev]);
    } catch (err: any) {
      setError(err?.message || "Something went wrong during translation.");
      setStatus(TranslationStatus.ERROR);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          performTranslation(() => transcribeMedia(base64data, 'audio/webm', customApiKey));
        };
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError("File size too large (max 20MB)");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      performTranslation(() => transcribeMedia(base64data, file.type, customApiKey));
    };
  };

  const downloadPack = (id: string) => {
    setDownloadingPack(id);
    // Simulate download
    setTimeout(() => {
      setInstalledPacks(prev => [...prev, id]);
      setDownloadingPack(null);
    }, 2000);
  };

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.translatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gujarati_transcript_${Date.now()}.txt`;
    a.click();
  };

  const handleShare = async () => {
    if (!result) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Gujarati Translation',
          text: result.translatedText,
        });
      } else {
        handleCopy(result.translatedText, 'share');
      }
    } catch (err) {
      console.error("Sharing failed", err);
    }
  };

  const handleSpeak = async (text: string) => {
    if (!text || isSpeaking) return;
    
    setIsSpeaking(true);
    try {
      const base64Audio = await synthesizeSpeech(text, customApiKey);
      
      // Decode base64 to binary
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Play 24kHz PCM audio
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Convert Int16 PCM to Float32 for Web Audio API
      const pcmData = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setIsSpeaking(false);
        audioCtx.close();
      };
      source.start();
    } catch (err) {
      console.error("Speech playback failed", err);
      setIsSpeaking(false);
      
      // Fallback to basic speech synthesis if AI TTS fails
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'gu-IN';
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Clear all translation history?")) {
      setHistory([]);
    }
  };

  const filteredHistory = history.filter(item => 
    item.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.translatedText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center p-4 md:p-8">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-100px] left-[-100px] w-80 h-80 bg-blue-400 dark:bg-blue-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 dark:opacity-40 animate-pulse" />
      <div className="absolute bottom-[-100px] right-[-100px] w-80 h-80 bg-purple-400 dark:bg-purple-900 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 dark:opacity-40 animate-pulse" />

      <div className="w-full h-full max-w-6xl glass-card relative z-10 flex overflow-hidden flex-col md:flex-row">
        {/* Mobile Header Overlay */}
        <div className="md:hidden flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg ring-1 ring-white/20">G</div>
             <h1 className="font-bold text-xl tracking-tighter">Gujarati <span className="text-indigo-600 dark:text-indigo-400 font-black">AI</span></h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white/20 rounded-full"><Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></button>
            <button onClick={() => setIsPacksOpen(!isPacksOpen)} className="p-2 bg-white/20 rounded-full"><Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></button>
            <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="p-2 bg-white/20 rounded-full"><History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-white/20 rounded-full">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          </div>
        </div>

        {/* Desktop Sidebar (History) */}
        <aside className="hidden md:flex w-80 sidebar-glass flex-col">
          <div className="p-6 border-b border-white/40 dark:border-white/5 flex items-center justify-between bg-white/20 dark:bg-black/10">
            <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              History
            </h2>
            <button 
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 hover:bg-white/40 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 bg-white/10 dark:bg-black/5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-1 ring-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setInput(item.originalText);
                    setResult({
                      originalText: item.originalText,
                      translatedText: item.translatedText,
                      sourceLanguage: item.sourceLanguage
                    });
                    setStatus(TranslationStatus.SUCCESS);
                  }}
                  className="p-4 bg-white/40 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/5 shadow-sm cursor-pointer hover:bg-white/80 dark:hover:bg-white/10 transition-all group"
                >
                  <div className="flex justify-between mb-1">
                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300 line-clamp-1 italic">{item.originalText}</p>
                  <p className="text-xs font-gujarati font-bold text-neutral-900 dark:text-neutral-100 mt-1 truncate">{item.translatedText}</p>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                <History className="w-8 h-8 mb-2" />
                <p className="text-xs">No records</p>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="p-6 border-t border-white/40 dark:border-white/5">
              <button 
                onClick={clearHistory}
                className="w-full py-3 bg-red-400/10 text-red-600 text-xs font-bold rounded-xl hover:bg-red-400/20 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear History
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-white/10 dark:bg-black/5 overflow-y-auto">
          <header className="hidden md:flex p-6 items-center justify-between border-b border-white/40 dark:border-white/5 bg-white/10 dark:bg-black/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg ring-1 ring-white/20">G</div>
              <h1 className="font-bold text-xl tracking-tighter">Gujarati <span className="text-indigo-600 dark:text-indigo-400 font-black">AI</span></h1>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isOnline ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'}`}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Online' : 'Offline Mode'}
              </div>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shadow-sm border border-white/80 dark:border-white/5 hover:scale-105 transition-all text-neutral-600 dark:text-neutral-300"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsPacksOpen(true)}
                className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shadow-sm border border-white/80 dark:border-white/5 hover:scale-105 transition-all text-neutral-600 dark:text-neutral-300"
              >
                <Package className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-10 h-10 rounded-full bg-white/60 dark:bg-white/10 flex items-center justify-center shadow-sm border border-white/80 dark:border-white/5 hover:scale-105 transition-all text-neutral-600 dark:text-neutral-300"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20">
                AI Studio Powered
              </div>
            </div>
          </header>

          <div className="flex-1 p-6 md:p-10 flex flex-col gap-8">
            {/* Input Grid */}
            <div className="grid lg:grid-cols-2 gap-8 flex-1">
              {/* Left Column: Input */}
              <div className="flex flex-col gap-4">
                <div className="flex-1 bg-white/60 dark:bg-black/40 rounded-[2rem] p-8 border border-white/80 dark:border-white/5 shadow-sm flex flex-col relative group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Input Text</span>
                    {input && (
                      <button onClick={() => setInput('')} className="p-1 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea 
                    className="flex-1 bg-transparent border-none resize-none focus:ring-0 text-xl font-medium placeholder:text-neutral-300 dark:placeholder:text-neutral-700 outline-none" 
                    placeholder="Type anything here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex-1 py-4 bg-white/80 dark:bg-white/5 rounded-2xl border border-white dark:border-white/5 flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:scale-[1.02] transition-all active:scale-95 ${isRecording ? 'text-red-500 ring-2 ring-red-500 animate-pulse' : ''}`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {isRecording ? 'Recording...' : 'Voice Record'}
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-4 bg-white/80 dark:bg-white/5 rounded-2xl border border-white dark:border-white/5 flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:scale-[1.02] transition-all active:scale-95"
                    >
                      <Upload className="w-4 h-4" /> Media Upload
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*,video/*" />
                  </div>
                </div>
                
                <button 
                  onClick={handleTranslate}
                  disabled={!input.trim() || status === TranslationStatus.PROCESSING}
                  className="h-16 md:h-20 bg-indigo-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {status === TranslationStatus.PROCESSING ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Languages className="w-6 h-6" />
                  )}
                  Translate to Gujarati
                </button>
              </div>

              {/* Right Column: Output */}
              <div className="flex flex-col bg-indigo-50/50 dark:bg-indigo-950/20 rounded-[2rem] p-8 border border-white/40 dark:border-white/5 shadow-inner relative min-h-[300px]">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Gujarati Output</span>
                  {status === TranslationStatus.SUCCESS && result && (
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleSpeak(result.translatedText)}
                        className={`p-2 hover:bg-white/60 dark:hover:bg-white/10 rounded-xl transition-all ${isSpeaking ? 'text-indigo-600 dark:text-indigo-400 animate-pulse' : 'text-neutral-500'}`}
                        title="Listen"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleCopy(result.translatedText, 'trans-res')} 
                        className="p-2 hover:bg-white/60 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-all flex items-center gap-1.5"
                      >
                        {copyFeedback === 'trans-res' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        <span className="text-[10px] uppercase font-black">{copyFeedback === 'trans-res' ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button onClick={handleShare} className="p-2 hover:bg-white/60 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-all">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-center">
                   <AnimatePresence mode="wait">
                    {status === TranslationStatus.IDLE && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center opacity-30">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-indigo-200" />
                        <p className="font-bold text-sm text-indigo-400">Waiting for input...</p>
                      </motion.div>
                    )}
                    
                    {status === TranslationStatus.PROCESSING && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        <p className="text-indigo-600 font-bold text-sm animate-pulse">Translating...</p>
                      </motion.div>
                    )}

                    {status === TranslationStatus.ERROR && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center px-6">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500 shadow-lg shadow-red-500/20" />
                        <p className="text-sm font-black uppercase tracking-widest text-red-600 mb-6 drop-shadow-sm">{error}</p>
                        {error?.includes("API KEY") && (
                          <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                          >
                            Configure API Key
                          </button>
                        )}
                      </motion.div>
                    )}

                    {status === TranslationStatus.SUCCESS && result && (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full"
                      >
                        <p className="text-3xl md:text-4xl font-gujarati font-black text-neutral-900 dark:text-neutral-50 leading-tight text-center whitespace-pre-wrap drop-shadow-sm">
                          {result.translatedText}
                        </p>
                      </motion.div>
                    )}
                   </AnimatePresence>
                </div>

                {/* Additional Metadata / Info */}
                {status === TranslationStatus.SUCCESS && result && (
                  <div className="mt-8 p-4 bg-white/40 dark:bg-white/5 rounded-[1.2rem] flex items-center justify-between border border-white/40 dark:border-white/5 ring-1 ring-black/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-lg ${result.isOffline ? 'bg-orange-500 shadow-orange-500/50' : 'bg-green-500 shadow-green-500/50'}`} />
                      <p className="text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-tighter">
                        {result.isOffline ? 'Offline Translation Engine' : 'AI Confidence High'} (Source: {result.sourceLanguage})
                      </p>
                    </div>
                    <button 
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 hover:opacity-70"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Mobile Footer / Search history toggle if not visible */}
            <div className="md:hidden mt-auto">
               <button 
                onClick={() => setIsHistoryOpen(true)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 bg-white/20 rounded-2xl flex items-center justify-center gap-2"
               >
                 <History className="w-4 h-4" /> View Translation History
               </button>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col p-8">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black flex items-center gap-2"><Settings className="w-5 h-5" /> Settings</h2>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
               </div>
               
               <div className="space-y-6">
                 <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-2">Gemini API Key</label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="password"
                        placeholder="Enter custom API key..."
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-neutral-400 leading-relaxed font-medium">
                      Leave empty to use the default AI Studio key. Custom keys are stored only in your browser.
                    </p>
                 </div>
                 
                 <div className="pt-4 flex flex-col gap-3">
                   <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                   >
                     Save Configuration
                   </button>
                   {customApiKey && (
                     <button 
                      onClick={() => setCustomApiKey('')}
                      className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold rounded-2xl active:scale-95 transition-all"
                     >
                       Reset to Default
                     </button>
                   )}
                 </div>
               </div>
             </motion.div>
          </div>
        )}

        {isPacksOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPacksOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <h2 className="text-2xl font-black flex items-center gap-3"><Package className="w-6 h-6 text-indigo-600" /> Offline Packs</h2>
                  <button onClick={() => setIsPacksOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
               </div>
               <div className="p-8 overflow-y-auto space-y-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center gap-3">
                    <WifiOff className="w-5 h-5 text-indigo-600" />
                    <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Disconnected? No problem. Downloaded packs allow translation without internet.</p>
                  </div>
                  
                  {AVAILABLE_PACKS.map(pack => (
                    <div key={pack.id} className="p-5 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700 flex items-center justify-between group">
                       <div>
                         <p className="font-black text-neutral-900 dark:text-neutral-50">{pack.name}</p>
                         <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{pack.size}</p>
                       </div>
                       
                       {installedPacks.includes(pack.id) ? (
                         <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest">
                            <CheckCircle2 className="w-4 h-4" /> Installed
                         </div>
                       ) : downloadingPack === pack.id ? (
                         <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest">
                            <Loader2 className="w-4 h-4 animate-spin" /> Downloading...
                         </div>
                       ) : (
                         <button 
                          onClick={() => downloadPack(pack.id)}
                          className="p-3 bg-white dark:bg-neutral-700 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-600 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                         >
                            <Download className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                  ))}
               </div>
               <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                  <button onClick={() => setIsPacksOpen(false)} className="px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold rounded-xl active:scale-95 transition-all">Done</button>
               </div>
             </motion.div>
          </div>
        )}

        {isHistoryOpen && (
          <div className="md:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }} className="fixed bottom-0 left-0 right-0 h-[80vh] bg-white dark:bg-neutral-900 z-[101] rounded-t-[3rem] shadow-2xl flex flex-col">
               <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto mt-4 mb-6" />
               <div className="px-8 flex items-center justify-between mb-6">
                 <h2 className="text-2xl font-black flex items-center gap-3"><History className="w-6 h-6 text-indigo-600" /> History</h2>
                 <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
               </div>
               <div className="px-8 flex-1 overflow-y-auto pb-10 flex flex-col gap-4">
                  {history.length > 0 ? history.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => {
                        setInput(item.originalText);
                        setResult({
                          originalText: item.originalText,
                          translatedText: item.translatedText,
                          sourceLanguage: item.sourceLanguage
                        });
                        setIsHistoryOpen(false);
                        setStatus(TranslationStatus.SUCCESS);
                      }}
                      className="p-6 bg-neutral-50 dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase">{new Date(item.timestamp).toLocaleDateString()}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSpeak(item.translatedText); }}
                            className="text-indigo-400 hover:text-indigo-600"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-neutral-500 mb-1 line-clamp-2 italic">{item.originalText}</p>
                      <p className="text-lg font-gujarati font-bold text-neutral-900 dark:text-neutral-50 line-clamp-3">{item.translatedText}</p>
                    </div>
                  )) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                       <History className="w-16 h-16 mb-4" />
                       <p className="font-bold uppercase tracking-widest">No past translations</p>
                    </div>
                  )}
               </div>
               {history.length > 0 && (
                 <div className="p-8 border-t border-neutral-100 dark:border-neutral-900 bg-white/50 dark:bg-neutral-900/50">
                    <button onClick={clearHistory} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2">Clear All History</button>
                 </div>
               )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-6 relative z-10 w-full text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.4em] text-neutral-400 dark:text-neutral-600">
           Gujarati AI <span className="opacity-40">•</span> Global Translation Layer
        </p>
      </footer>
    </div>
  );
}

