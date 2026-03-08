import { geminiGenerate } from './geminiClient.js';

export async function parseDocumentText(rawText) {
  const prompt = `You are a financial document parser. Extract structured data from this OCR text.

Return ONLY valid JSON in this exact format:
{
  "vendor": "string or null",
  "document_type": "receipt | invoice | bank_statement | subscription | other",
  "date": "YYYY-MM-DD or null",
  "total": number or null,
  "subtotal": number or null,
  "tax": number or null,
  "currency": "USD",
  "line_items": [
    {
      "description": "string",
      "amount": number,
      "date": "YYYY-MM-DD or null",
      "category": "subscription | one-time | fee | tax | service | product | other",
      "vendor": "string or null"
    }
  ]
}

Critical accuracy rules:
- Read all numbers precisely — distinguish 1 from 4, and 3 from 8
- Extract subtotal (pre-tax amount) separately from total (post-tax)
- Extract tax amount as its own field
- Verify: subtotal + tax should equal total
- If you cannot extract a field, use null. Always return at least one line item if any charges are visible.

OCR Text:
${rawText}`;

  const text = (await geminiGenerate(prompt)).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(text);
}
