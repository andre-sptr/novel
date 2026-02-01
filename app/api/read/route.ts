import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { translate } from 'google-translate-api-x';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function getCachedData(key: string) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}

function setCacheData(key: string, data: any) {
    if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, { data, timestamp: Date.now() });
}

// Try fetch first, fallback to Puppeteer if needed
async function fetchHtml(targetUrl: string): Promise<string> {
    // Try simple fetch first (faster)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const html = await response.text();
            // Check if we got actual content (not just an error page)
            if (html.length > 500 && !html.includes('cf-browser-verification')) {
                return html;
            }
        }
    } catch (e) {
        console.log('Fetch failed, trying Puppeteer...');
    }

    // Fallback to Puppeteer for JS-rendered pages
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait a bit for JS to render
        await new Promise(resolve => setTimeout(resolve, 2000));

        const html = await page.content();
        await browser.close();
        return html;
    } catch (e) {
        if (browser) await browser.close();
        throw e;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    try {
        new URL(targetUrl);
    } catch {
        return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 });
    }

    // Check cache first
    const cachedResult = getCachedData(targetUrl);
    if (cachedResult) {
        return NextResponse.json(cachedResult);
    }

    try {
        const html = await fetchHtml(targetUrl);

        const dom = new JSDOM(html, { url: targetUrl });
        const doc = dom.window.document;
        const reader = new Readability(doc);
        const article = reader.parse();

        if (!article || !article.content) {
            throw new Error('Gagal memproses konten halaman');
        }

        // Find next chapter URL
        const nextUrl = findNextUrl(doc);

        // Parse content
        const contentDom = new JSDOM(article.content);
        const contentDoc = contentDom.window.document;

        // Extract real chapter title from first paragraph that contains "Chapter" pattern
        let chapterTitle = '';
        const allElements = contentDoc.querySelectorAll('p, h1, h2, h3, h4');
        for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            // Check if this looks like a chapter title
            if (text.match(/^(chapter|bab|ch\.?)\s*\d+/i) || text.match(/第\d+章/)) {
                chapterTitle = text;
                el.remove(); // Remove from content to avoid duplication
                break;
            }
        }

        // Collect paragraphs for translation
        const paragraphs = contentDoc.querySelectorAll('p');
        const textsToTranslate: string[] = [];
        const pElements: HTMLParagraphElement[] = [];

        paragraphs.forEach((p) => {
            const text = p.textContent?.trim();
            if (text && text.length > 0) {
                textsToTranslate.push(text);
                pElements.push(p as HTMLParagraphElement);
            }
        });

        // Parallel translation - title and content
        const [translatedTitle] = await Promise.all([
            translateText(chapterTitle || 'Tanpa Judul'),
            translateParagraphs(textsToTranslate, pElements)
        ]);

        const result = {
            title: translatedTitle,
            content: contentDoc.body.innerHTML,
            nextUrl: nextUrl,
            currentUrl: targetUrl,
            isTranslated: true
        };

        setCacheData(targetUrl, result);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: error.message || 'Gagal memuat atau menerjemahkan' },
            { status: 500 }
        );
    }
}

function findNextUrl(doc: Document): string | null {
    const selectors = [
        '#next_chap', '.btn-next', '.next_page', 'a[rel="next"]',
        '.next-chap', '.nextchap', 'a.next', '.nav-next a'
    ];

    for (const sel of selectors) {
        const el = doc.querySelector(sel) as HTMLAnchorElement;
        if (el?.href) return el.href;
    }

    const links = doc.querySelectorAll('a');
    const nextKw = ['next', 'lanjut', 'berikutnya', '>>', 'selanjutnya', '下一章'];
    const excludeKw = ['comment', 'daftar', 'list', 'prev', 'back'];

    for (const link of links) {
        const text = link.textContent?.toLowerCase().trim() || '';
        if (nextKw.some(k => text.includes(k)) && !excludeKw.some(k => text.includes(k))) {
            return link.href;
        }
    }
    return null;
}

async function translateText(text: string): Promise<string> {
    if (!text?.trim()) return text;
    try {
        const result = await translate(text, { to: 'id' });
        return result.text;
    } catch {
        return text;
    }
}

async function translateParagraphs(texts: string[], elements: HTMLParagraphElement[]): Promise<void> {
    if (!texts.length) return;

    const CHUNK_SIZE = 40;
    const chunks: { texts: string[]; startIdx: number }[] = [];

    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        chunks.push({ texts: texts.slice(i, i + CHUNK_SIZE), startIdx: i });
    }

    // Process 2 chunks at a time
    for (let i = 0; i < chunks.length; i += 2) {
        const batch = chunks.slice(i, i + 2);
        await Promise.all(batch.map(async ({ texts: chunkTexts, startIdx }) => {
            try {
                const result = await translate(chunkTexts, { to: 'id', autoCorrect: true });
                const results = Array.isArray(result) ? result : [result];
                results.forEach((res: any, idx: number) => {
                    if (elements[startIdx + idx]) {
                        elements[startIdx + idx].textContent = res.text;
                    }
                });
            } catch (err) {
                console.error('Translation chunk error');
            }
        }));
    }
}