import { GoogleGenAI } from '@google/genai';

let ai;
function getAI() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

export async function geminiGenerate(prompt, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await getAI().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return response.text;
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries - 1) {
        const waitMatch = err.message?.match(/retry in ([\d.]+)s/i);
        const wait = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) * 1000 : (attempt + 1) * 15000;
        console.log(`[Gemini] Rate limited, waiting ${wait / 1000}s before retry ${attempt + 2}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}
