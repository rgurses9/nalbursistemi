import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });

  try {
    // First try fetching HTML directly with browser-like headers
    let name = '';
    let imageUrl = '';

    try {
      const fetchRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
      });

      const html = await fetchRes.text();

      // og:title
      const ogTitleMatch =
        html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitleMatch) name = ogTitleMatch[1];

      // fallback to <title>
      if (!name) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) name = titleMatch[1];
      }

      // og:image
      const ogImageMatch =
        html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImageMatch) imageUrl = ogImageMatch[1];

      // JSON-LD fallback for name and image
      if (!name || !imageUrl) {
        const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatch) {
          for (const block of jsonLdMatch) {
            try {
              const inner = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
              const data = JSON.parse(inner);
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                if (!name && item.name) name = item.name;
                if (!imageUrl && item.image) {
                  imageUrl = Array.isArray(item.image) ? item.image[0] : item.image;
                }
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (fetchErr) {
      console.warn('Direct fetch failed, falling back to Gemini:', fetchErr);
    }

    // Clean up title suffixes
    if (name) {
      name = name
        .replace(/\s*\|\s*.*/g, '')
        .replace(/\s*-\s*(Koçtaş|koctas|Amazon|Trendyol|HepsiBurada|n11|GittiGidiyor).*/gi, '')
        .trim();
    }

    // If we couldn't get data via direct fetch, use Gemini as fallback
    if (!name) {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Bu ürün sayfasının URL'sinden ürün adını ve görsel URL'sini çıkar: ${url}
        
Sadece aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"name": "ürün adı burada", "imageUrl": "https://gorsel-url-burada.jpg"}

Eğer bulamazsan boş string döndür: {"name": "", "imageUrl": ""}`,
      });

      try {
        const text = response.text?.trim() || '{}';
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed.name) name = parsed.name;
        if (parsed.imageUrl) imageUrl = parsed.imageUrl;
      } catch { /* ignore parse error */ }
    }

    return res.json({ name, imageUrl });
  } catch (err: any) {
    console.error('Extract URL error:', err);
    return res.status(500).json({ error: err.message });
  }
}
