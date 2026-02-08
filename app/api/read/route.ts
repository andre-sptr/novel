import { NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';
import { translate } from 'google-translate-api-x';

const SCRAPER_API_KEY = '4e54033b64dc75d1c757e8aaba8ce6ed'; 

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000;

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

async function fetchWithScraperApi(targetUrl: string): Promise<string> {
    if (!SCRAPER_API_KEY || SCRAPER_API_KEY.includes('MASUKKAN')) {
        throw new Error('API Key ScraperAPI belum diisi.');
    }

    console.log(`[ScraperAPI] Mengambil: ${targetUrl}`);

    const proxyUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true`;

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`ScraperAPI Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const cachedResult = getCachedData(targetUrl);
    if (cachedResult) return NextResponse.json(cachedResult);

    try {
        const html = await fetchWithScraperApi(targetUrl);
        
        const dom = new JSDOM(html, { url: targetUrl });
        const doc = dom.window.document;

        let contentElement = doc.querySelector('#chr-content, .chr-content, #chapter-content');
        
        if (!contentElement) {
            const divs = doc.querySelectorAll('div');
            let maxP = 0;
            divs.forEach(div => {
                const pCount = div.querySelectorAll('p').length;
                if (pCount > maxP) { maxP = pCount; contentElement = div; }
            });
        }

        if (!contentElement) throw new Error('Konten tidak ditemukan.');

        contentElement.querySelectorAll('script, style, .ads, .google-auto-placed').forEach(e => e.remove());

        const title = doc.querySelector('.chr-title, .chapter-title, h1')?.textContent || 'Tanpa Judul';
        const contentHtml = contentElement.innerHTML;
        const nextUrl = findNextUrl(doc);

        const contentDom = new JSDOM(contentHtml);
        const contentDoc = contentDom.window.document;

        let chapterTitle = title;
        const allElements = contentDoc.querySelectorAll('p, h1, h2, h3, h4');
        for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            if (text.match(/^(chapter|bab|ch\.?)\s*\d+/i) || text.match(/第\d+章/)) {
                chapterTitle = text;
                el.remove();
                break;
            }
        }

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

        const [translatedTitle] = await Promise.all([
            translateText(chapterTitle),
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
        console.error(error);
        return NextResponse.json(
            { error: error.message || 'Gagal memuat' },
            { status: 500 }
        );
    }
}

function findNextUrl(doc: Document): string | null {
    const selectors = ['#next_chap', '.btn-next', '.next_page', 'a[rel="next"]', '.next-chap', '.nextchap', 'a.next'];
    for (const sel of selectors) {
        const el = doc.querySelector(sel) as HTMLAnchorElement;
        if (el?.href) return el.href;
    }
    const links = doc.querySelectorAll('a');
    for (const link of links) {
        const text = link.textContent?.toLowerCase().trim() || '';
        if ((text.includes('next') || text.includes('lanjut')) && !text.includes('comment')) {
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
    } catch { return text; }
}

async function translateParagraphs(texts: string[], elements: HTMLParagraphElement[]): Promise<void> {
    if (!texts.length) return;
    const CHUNK_SIZE = 40;
    const chunks: { texts: string[]; startIdx: number }[] = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
        chunks.push({ texts: texts.slice(i, i + CHUNK_SIZE), startIdx: i });
    }
    for (let i = 0; i < chunks.length; i += 2) {
        const batch = chunks.slice(i, i + 2);
        await Promise.all(batch.map(async ({ texts: chunkTexts, startIdx }) => {
            try {
                const result = await translate(chunkTexts, { to: 'id', autoCorrect: true });
                const results = Array.isArray(result) ? result : [result];
                results.forEach((res: any, idx: number) => {
                    if (elements[startIdx + idx]) elements[startIdx + idx].textContent = res.text;
                });
            } catch (err) {}
        }));
    }
}