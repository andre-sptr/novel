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

  useEffect(() => {
    const logged = localStorage.getItem('reader_logged') === 'true';
    const dark = localStorage.getItem('reader_dark') === 'true';
    setIsLoggedIn(logged);
    setDarkMode(dark);
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

  const fetchChapter = useCallback(async (targetUrl: string) => {
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
      }
    } catch {
      setError('Gagal memuat. Periksa koneksi internet.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        <div className="max-w-2xl mx-auto px-4 py-5 pb-24">

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

        {/* Sticky Bottom Navigation - Mobile Friendly */}
        {!loading && data && (
          <div className="nav-sticky safe-bottom bg-[--color-surface] border-t border-[--color-border] p-4">
            <div className="max-w-2xl mx-auto flex justify-between items-center gap-4">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn btn-ghost flex-1"
              >
                ↑ Atas
              </button>

              {data.nextUrl ? (
                <button onClick={handleNext} className="btn btn-primary flex-1">
                  Lanjut →
                </button>
              ) : (
                <span className="flex-1 text-center text-sm text-[--color-text-muted] italic">Akhir Chapter</span>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}