import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Categorization Endpoint
  app.post('/api/categorize', async (req, res) => {
    try {
      const { productName } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Sen profesyonel bir yapı market / nalbur asistanısın. 
Verilen ürün ismini aşağıdaki ana kategorilerden en uygun olanına yerleştir ve SADECE KATEGORİ ADINI (birebir listedeki gibi) döndür. Ekstra hiçbir açıklama yapma.

Kategoriler:
- Mobilya
- Bahçe, Dış Mekan ve Kamp
- Isıtma ve Soğutma
- Banyo
- Mutfak
- Dekorasyon ve Ev Gereçleri
- Aydınlatma ve Elektrik
- Ahşap ve İnşaat
- Hırdavat El Aletleri ve Oto
- Elektrikli El Aletleri
- Elektronik
- Anne, Bebek ve Çocuk

Ürün: ${productName}`,
      });
      
      const category = response.text?.trim() || 'Genel';
      res.json({ category });
    } catch (err: any) {
      console.error("AI Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/extract-url', async (req, res) => {
    try {
      const { url } = req.body;
      const fetchRes = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        } 
      });
      const html = await fetchRes.text();
      
      let name = '';
      let imageUrl = '';
      
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i) || 
                           html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["'][^>]*>/i);
      if (ogTitleMatch) name = ogTitleMatch[1];
      else {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch) name = titleMatch[1];
      }
      
      // Clean up common title suffixes
      name = name.replace(/\|.*$/g, '').replace(/-.*$/g, '').trim();
      
      const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i) || 
                           html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["'][^>]*>/i);
      if (ogImageMatch) imageUrl = ogImageMatch[1];
      
      res.json({ name, imageUrl });
    } catch (err: any) {
      console.error("Extract Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
