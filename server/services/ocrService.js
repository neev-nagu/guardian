import { geminiGenerate } from './geminiClient.js';
import { readFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

let ai;
function getAI() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

/**
 * Extract text from an invoice image using Gemini Vision.
 * Gemini is significantly more accurate than tesseract for financial documents —
 * it correctly reads digits like 1/4 and 3/8 that OCR engines commonly confuse.
 */
export async function extractText(imagePath) {
  try {
    const imageBytes = readFileSync(imagePath);
    const base64Image = imageBytes.toString('base64');

    // Detect MIME type from extension
    const ext = imagePath.split('.').pop().toLowerCase();
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    const mimeType = mimeMap[ext] || 'image/png';

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: { mimeType, data: base64Image }
            },
            {
              text: `Extract ALL text from this financial document image exactly as it appears.
Preserve:
- All numbers, amounts, dates exactly (pay close attention to digits — do not confuse 1/4 or 3/8)
- Line breaks and structure
- Headers, labels, item descriptions
- Subtotals, taxes, totals
- Vendor names, invoice IDs, dates, payment terms

Return ONLY the raw extracted text with no commentary or formatting.`
            }
          ]
        }
      ]
    });

    const text = response.text?.trim() || '';
    console.log(`[OCR] Gemini Vision extracted ${text.split(/\s+/).length} words`);
    return { text, confidence: 95 };
  } catch (err) {
    console.error('[OCR] Gemini Vision failed:', err.message);
    throw err;
  }
}
