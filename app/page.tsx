'use client';

import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Sun, Moon, LogOut, ArrowUp, ArrowLeft, ArrowRight,
  BookOpen, Search, Type, Loader2, Sparkles, BookMarked,
} from 'lucide-react';

interface ChapterData {
  title: string;
  content: string;
  nextUrl: string | null;
  currentUrl: string;
}

const VALID_USER = 'andre';
const VALID_PASS = 'andre123';

/* ── animation variants ── */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.3 } },
};

const stagger: Variants = {
  show: { transition: { staggerChildren: 0.07 } },
};

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [url, setUrl] = useState('');
  const [data, setData] = useState<ChapterData | null>(null);
  const [nextChapterData, setNextChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [textSize, setTextSize] = useState<number>(18);

  /* ── restore persisted state ── */
  useEffect(() => {
    const logged = localStorage.getItem('reader_logged') === 'true';
    const dark = localStorage.getItem('reader_dark') === 'true';
    const lastUrl = localStorage.getItem('last_read_url');
    const savedHist = localStorage.getItem('reader_history');
    const savedSize = localStorage.getItem('reader_text_size');

    setIsLoggedIn(logged);
    setDarkMode(dark);
    if (lastUrl) setUrl(lastUrl);
    if (savedHist) setHistory(JSON.parse(savedHist));
    if (savedSize) setTextSize(Number(savedSize));
    if (dark) document.documentElement.classList.add('dark');
  }, []);

  /* ── sync text-size CSS vars ── */
  useEffect(() => {
    document.documentElement.style.setProperty('--text-size', `${textSize}px`);
    document.documentElement.style.setProperty('--text-size-sm', `${textSize + 2}px`);
  }, [textSize]);

  /* ── scroll progress ── */
  useEffect(() => {
    if (!data) return;
    const onScroll = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docH > 0 ? Math.min(100, (window.scrollY / docH) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [data]);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('reader_dark', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === VALID_USER && password === VALID_PASS) {
      setIsLoggedIn(true);
      localStorage.setItem('reader_logged', 'true');
      setLoginError('');
    } else {
      setLoginError('Username atau password salah.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('reader_logged');
    setData(null);
  };

  const fetchChapter = useCallback(async (targetUrl: string, addToHistory = true, isPrefetch = false) => {
    if (!isPrefetch) { setLoading(true); setError(null); }
    try {
      const res = await fetch(`/api/read?url=${encodeURIComponent(targetUrl)}`);
      const json = await res.json();

      if (json.error) {
        if (!isPrefetch) setError(json.error);
        return;
      }

      if (isPrefetch) {
        setNextChapterData(json);
      } else {
        setData(json);
        setProgress(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setUrl(targetUrl);
        localStorage.setItem('last_read_url', targetUrl);

        if (addToHistory && data?.currentUrl) {
          const newHist = [...history, data.currentUrl];
          setHistory(newHist);
          localStorage.setItem('reader_history', JSON.stringify(newHist));
        }
      }
    } catch {
      if (!isPrefetch) setError('Gagal memuat. Periksa koneksi internet.');
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  }, [data, history]);

  /* ── prefetch next chapter ── */
  useEffect(() => {
    if (data?.nextUrl && data.nextUrl !== nextChapterData?.currentUrl) {
      setNextChapterData(null);
      fetchChapter(data.nextUrl, false, true);
    }
  }, [data?.nextUrl, fetchChapter, nextChapterData?.currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) fetchChapter(url.trim());
  };

  const handleNext = () => {
    if (!data?.nextUrl) return;
    if (nextChapterData && nextChapterData.currentUrl === data.nextUrl) {
      const prevUrl = data.currentUrl;
      setData(nextChapterData);
      setProgress(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setUrl(nextChapterData.currentUrl);
      localStorage.setItem('last_read_url', nextChapterData.currentUrl);
      const newHist = [...history, prevUrl];
      setHistory(newHist);
      localStorage.setItem('reader_history', JSON.stringify(newHist));
      setNextChapterData(null);
    } else {
      fetchChapter(data.nextUrl);
    }
  };

  const handlePrevious = () => {
    if (!history.length) return;
    const newHist = [...history];
    const prevUrl = newHist.pop();
    setHistory(newHist);
    localStorage.setItem('reader_history', JSON.stringify(newHist));
    if (prevUrl) fetchChapter(prevUrl, false);
  };

  const toggleTextSize = () => {
    const next = textSize === 16 ? 18 : textSize === 18 ? 22 : 16;
    setTextSize(next);
    localStorage.setItem('reader_text_size', String(next));
  };

  /* ════════════════════════════════════════
     LOGIN SCREEN
  ════════════════════════════════════════ */
  if (!isLoggedIn) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-5 safe-top safe-bottom relative overflow-hidden">

        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
          <div className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124,92,252,0.05) 0%, transparent 60%)' }} />
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="w-full max-w-sm"
        >
          {/* Logo mark */}
          <motion.div variants={fadeUp} className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #a78bfa 100%)', boxShadow: 'var(--shadow-accent)' }}>
                <BookOpen size={30} color="#fff" />
              </div>
              {/* Ping dot */}
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[var(--color-bg)] animate-glow" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
              Private Reader
            </h1>
          </motion.div>

          {/* Card */}
          <motion.div variants={fadeUp} className="card glass p-7">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  placeholder="Masukkan username"
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="off"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <AnimatePresence>
                {loginError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-center font-medium"
                    style={{ color: '#f87171' }}
                  >
                    {loginError}
                  </motion.p>
                )}
              </AnimatePresence>

              <button id="login-submit" type="submit" className="btn btn-primary w-full mt-1">
                Masuk
              </button>
            </form>
          </motion.div>

          <motion.p variants={fadeUp} className="text-center text-xs mt-5" style={{ color: 'var(--color-text-muted)' }}>
            Akun pribadi · Akses terbatas
          </motion.p>
        </motion.div>
      </main>
    );
  }

  /* ════════════════════════════════════════
     MAIN READER
  ════════════════════════════════════════ */
  return (
    <>
      {/* Reading progress bar */}
      {data && <div className="progress-bar" style={{ width: `${progress}%` }} />}

      <main className="min-h-dvh safe-top relative">
        <div className="max-w-3xl mx-auto px-4 py-6 pb-36">

          {/* ── Header ── */}
          <motion.header
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="card glass p-4 mb-6 relative z-10"
          >
            <div className="flex flex-col gap-3">
              {/* Top row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--color-accent-muted)' }}>
                    <BookMarked size={16} style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--color-accent)' }}>
                    Reader
                  </span>
                  {data && (
                    <span className="badge badge-accent hidden sm:inline-flex">
                      {Math.round(progress)}%
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    id="toggle-dark"
                    onClick={toggleDark}
                    className="btn btn-ghost w-10 h-10 p-0 rounded-xl"
                    aria-label="Toggle tema"
                  >
                    {darkMode ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                  <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="btn btn-ghost w-10 h-10 p-0 rounded-xl"
                    aria-label="Keluar"
                  >
                    <LogOut size={17} />
                  </button>
                </div>
              </div>

              {/* Search form */}
              <form onSubmit={handleSubmit} className="relative flex items-center p-1 mt-1 bg-[var(--color-surface-solid)] border border-[var(--color-border)] rounded-2xl shadow-sm transition-all focus-within:border-[var(--color-accent)] focus-within:ring-4 focus-within:ring-[var(--color-accent-muted)] hover:border-[var(--color-border-focus)]">
                <div className="absolute left-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <Search size={18} />
                </div>
                <input
                  id="chapter-url-input"
                  type="url"
                  placeholder="Paste URL chapter novel..."
                  className="flex-1 bg-transparent border-none outline-none pl-10 pr-4 py-2.5 text-[15px] w-full text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                <button
                  id="fetch-btn"
                  type="submit"
                  className="h-10 px-5 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] text-white text-sm font-bold rounded-xl flex items-center justify-center shadow-[var(--shadow-accent)] hover:shadow-lg hover:-translate-y-[1px] transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  disabled={loading || !url.trim()}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Baca'}
                </button>
              </form>
            </div>
          </motion.header>

          {/* ── Error ── */}
          <AnimatePresence>
            {error && (
              <motion.div
                variants={fadeUp} initial="hidden" animate="show" exit="exit"
                className="card p-4 mb-5"
                style={{ borderLeft: '3px solid #f87171', background: 'rgba(248,113,113,0.05)' }}
              >
                <p className="text-sm font-medium" style={{ color: '#f87171' }}>{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Loading skeleton ── */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="card glass p-8"
              >
                <div className="flex flex-col items-center gap-3 mb-8">
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Mengekstrak konten…
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="skeleton h-7 w-3/4 mb-6" />
                  {[100, 100, 90, 100, 82].map((w, i) => (
                    <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Article ── */}
          <AnimatePresence mode="wait">
            {!loading && data && (
              <motion.article
                key={data.currentUrl}
                variants={fadeUp} initial="hidden" animate="show" exit="exit"
                className="card glass p-6 sm:p-10"
              >
                {/* Chapter title */}
                <h1 className="text-xl sm:text-2xl font-bold mb-6 pb-5 leading-snug"
                  style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {data.title}
                </h1>

                <div
                  className="article-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content) }}
                />
              </motion.article>
            )}
          </AnimatePresence>

          {/* ── Empty state ── */}
          {!loading && !data && !error && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card glass p-12 text-center mt-8"
            >
              <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6"
                style={{ background: 'var(--color-accent-muted)', boxShadow: 'var(--shadow-glow)' }}>
                <BookOpen size={38} style={{ color: 'var(--color-accent)' }} />
              </div>
              <h2 className="text-lg font-bold mb-2">Siap Membaca</h2>
            </motion.div>
          )}

        </div>

        {/* ── Floating Action Bar ── */}
        <AnimatePresence>
          {!loading && data && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed bottom-5 inset-x-0 z-50 pointer-events-none px-4 safe-bottom"
            >
              <div className="max-w-[340px] mx-auto flex items-center gap-1.5 p-1.5 pointer-events-auto"
                style={{
                  borderRadius: 22,
                  background: 'var(--color-surface-raised)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-lg)',
                }}>

                {/* Scroll top */}
                <button
                  id="scroll-top-btn"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="fab-btn"
                  aria-label="Kembali ke atas"
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>

                {/* Text size */}
                <button
                  id="text-size-btn"
                  onClick={toggleTextSize}
                  className="fab-btn"
                  aria-label="Ukuran teks"
                >
                  <Type size={17} strokeWidth={2.5} />
                </button>

                {/* Prev */}
                {history.length > 0 && (
                  <button
                    id="prev-btn"
                    onClick={handlePrevious}
                    className="fab-btn flex-1 w-auto gap-1.5 px-3 font-semibold text-xs"
                    aria-label="Chapter sebelumnya"
                  >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    Prev
                  </button>
                )}

                {/* Next */}
                {data.nextUrl ? (
                  <button
                    id="next-btn"
                    onClick={handleNext}
                    className="fab-btn fab-btn-primary"
                    aria-label="Chapter berikutnya"
                  >
                    Next
                    {nextChapterData
                      ? <ArrowRight size={16} strokeWidth={2.5} />
                      : <Loader2 size={14} className="animate-spin opacity-70" />
                    }
                  </button>
                ) : (
                  <div className="flex-1 h-[46px] flex items-center justify-center rounded-[14px] text-xs font-semibold"
                    style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                    ✦ Tamat
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}