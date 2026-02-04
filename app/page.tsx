'use client';

import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'isomorphic-dompurify';

interface ChapterData {
  title: string;
  content: string;
  nextUrl: string | null;
  currentUrl: string;
}

const VALID_USER = 'andre';
const VALID_PASS = 'andre123';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [url, setUrl] = useState('');
  const [data, setData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    // Restore previous state
    const logged = localStorage.getItem('reader_logged') === 'true';
    const dark = localStorage.getItem('reader_dark') === 'true';
    const lastUrl = localStorage.getItem('last_read_url');
    const savedHistory = localStorage.getItem('reader_history');

    setIsLoggedIn(logged);
    setDarkMode(dark);
    if (lastUrl) setUrl(lastUrl);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (dark) document.documentElement.classList.add('dark');
  }, []);

  const toggleDark = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem('reader_dark', String(newVal));
    document.documentElement.classList.toggle('dark', newVal);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === VALID_USER && password === VALID_PASS) {
      setIsLoggedIn(true);
      localStorage.setItem('reader_logged', 'true');
      setLoginError('');
    } else {
      setLoginError('Username atau password salah');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('reader_logged');
    setData(null);
  };

  useEffect(() => {
    if (!data) return;

    const handleScroll = () => {
      const winH = window.innerHeight;
      const docH = document.documentElement.scrollHeight - winH;
      const scrolled = window.scrollY;
      setProgress(docH > 0 ? Math.min(100, (scrolled / docH) * 100) : 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [data]);

  const fetchChapter = useCallback(async (targetUrl: string, addToHistory = true) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/read?url=${encodeURIComponent(targetUrl)}`);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setProgress(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Save current state
        setUrl(targetUrl);
        localStorage.setItem('last_read_url', targetUrl);

        // Update history
        if (addToHistory && data?.currentUrl) {
          const newHistory = [...history, data.currentUrl];
          setHistory(newHistory);
          localStorage.setItem('reader_history', JSON.stringify(newHistory));
        }
      }
    } catch {
      setError('Gagal memuat. Periksa koneksi internet.');
    } finally {
      setLoading(false);
    }
  }, [data, history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) fetchChapter(url.trim());
  };

  const handleNext = () => {
    if (data?.nextUrl) {
      setData(null);
      setUrl(data.nextUrl);
      fetchChapter(data.nextUrl);
    }
  };

  const handlePrevious = () => {
    if (history.length > 0) {
      const newHistory = [...history];
      const previousUrl = newHistory.pop();
      setHistory(newHistory);
      localStorage.setItem('reader_history', JSON.stringify(newHistory));

      if (previousUrl) {
        setData(null);
        setUrl(previousUrl);
        fetchChapter(previousUrl, false);
      }
    }
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-5 safe-top safe-bottom">
        <div className="card p-6 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">📚</div>
            <h1 className="text-2xl font-bold">Private Reader</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
            />
            <input
              type="password"
              placeholder="Password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && (
              <p className="text-red-500 text-sm text-center">{loginError}</p>
            )}
            <button type="submit" className="btn btn-primary w-full">
              Masuk
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Main Reader
  return (
    <>
      {data && <div className="progress-bar" style={{ width: `${progress}%` }} />}

      <main className="min-h-screen safe-top">
        <div className="max-w-2xl mx-auto px-4 py-5 pb-32">

          {/* Header */}
          <header className="card p-4 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={toggleDark} className="btn btn-ghost" aria-label="Toggle tema">
                {darkMode ? '☀️' : '🌙'}
              </button>
              <span className="text-sm font-medium text-[--color-text-secondary] flex-1">Private Reader</span>
              <button onClick={handleLogout} className="btn btn-ghost text-sm">
                Keluar
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="url"
                placeholder="Paste URL chapter..."
                className="input-field flex-1"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button type="submit" className="btn btn-primary px-5" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Baca'}
              </button>
            </form>
          </header>

          {/* Error */}
          {error && (
            <div className="card p-4 mb-5 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-5 h-5 border-2 border-[--color-accent] border-t-transparent rounded-full animate-spin" />
                <span className="text-[--color-text-secondary] text-sm">Memuat & menerjemahkan...</span>
              </div>
              <div className="space-y-3">
                <div className="skeleton h-7 w-4/5" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-full" />
              </div>
            </div>
          )}

          {/* Content */}
          {!loading && data && (
            <article className="fade-in">
              <div className="card p-5 sm:p-8">
                <h1 className="text-lg sm:text-xl font-bold mb-6 pb-4 border-b border-[--color-border] leading-snug">
                  {data.title}
                </h1>

                <div
                  className="article-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content) }}
                />
              </div>
            </article>
          )}

          {/* Empty State */}
          {!loading && !data && !error && (
            <div className="card p-10 text-center">
              <div className="text-5xl mb-4">📖</div>
              <h2 className="text-lg font-semibold mb-2">Mulai Membaca</h2>
              <p className="text-[--color-text-secondary] text-sm">
                Paste URL dari website novel untuk membaca dengan tampilan bersih.
              </p>
            </div>
          )}

        </div>

        {/* Floating Action Bar */}
        {!loading && data && (
          <div className="fixed bottom-4 inset-x-0 z-50 pointer-events-none px-4 safe-bottom">
            <div className="max-w-md mx-auto flex items-center justify-between gap-2 p-1.5 rounded-full bg-[--color-surface] backdrop-blur-xl shadow-xl border border-[--color-border] pointer-events-auto transition-all duration-300 animate-slide-up ring-1 ring-black/5 dark:ring-white/10">

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[--color-bg] text-[--color-text] hover:bg-[--color-surface] active:scale-95 transition-all shadow-sm border border-[--color-border]"
                aria-label="Kembali ke Atas"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
              </button>

              {history.length > 0 && (
                <button
                  onClick={handlePrevious}
                  className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-full bg-[--color-bg] text-[--color-text] hover:bg-[--color-surface] active:scale-95 transition-all shadow-sm border border-[--color-border] group"
                  aria-label="Chapter Sebelumnya"
                >
                  <div className="bg-[--color-accent]/10 rounded-full p-0.5 group-hover:-translate-x-1 transition-transform">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                  </div>
                  <span className="text-xs font-medium">Prev</span>
                </button>
              )}

              {data.nextUrl ? (
                <button
                  onClick={handleNext}
                  className="flex-1 h-10 flex items-center justify-center gap-2 rounded-full bg-[--color-accent] light:text-black dark:text-white font-semibold text-sm hover:bg-[--color-accent-hover] active:scale-95 transition-all shadow-md group pr-1 pl-3"
                >
                  <span>Lanjut Chapter</span>
                  <div className="bg-black/10 dark:bg-white/20 rounded-full p-0.5 group-hover:translate-x-1 transition-transform">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                  </div>
                </button>
              ) : (
                <span className="flex-1 text-center h-10 flex items-center justify-center text-sm font-medium text-[--color-text-muted] italic">
                  Sampai Jumpa
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}