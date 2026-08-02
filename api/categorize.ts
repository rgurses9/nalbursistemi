import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { productName } = req.body;
  if (!productName) return res.status(400).json({ error: 'productName is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });

  try {
    const ai = new GoogleGenAI({ apiKey });
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
    return res.json({ category });
  } catch (err: any) {
    console.error('Categorize error:', err);
    return res.status(500).json({ error: err.message });
  }
}
