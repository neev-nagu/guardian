import { geminiGenerate } from './geminiClient.js';

export async function generateNegotiation({ flag, lineItem, document, messageType = 'email', tone = 'firm' }) {
  const toneGuide = {
    polite: 'Be courteous and diplomatic, but clear about the issue.',
    firm: 'Be professional and assertive. State facts clearly and request resolution firmly.',
    aggressive: 'Be direct and cite consumer protection rights. Mention escalation if not resolved.'
  };

  const typeGuide = {
    email: 'Format as a professional email with subject line, greeting, body, and sign-off.',
    letter: 'Format as a formal dispute letter with date, addresses, and signature block.',
    phone_script: 'Format as a phone call script with talking points and key phrases to use.'
  };

  const prompt = `You are a consumer advocacy AI that writes dispute and negotiation messages.

Generate a ${messageType} to dispute this charge:

Issue: ${flag.description}
Flag type: ${flag.flag_type}
Estimated overcharge: $${flag.estimated_savings}
Vendor: ${document.vendor || 'Unknown'}
Original charge details: ${JSON.stringify(lineItem)}

Tone: ${tone} — ${toneGuide[tone]}
Format: ${typeGuide[messageType]}

Important rules:
- Reference the specific charge amount and date
- Explain WHY this is incorrect or unfair
- State the desired resolution clearly (refund, credit, price correction)
- Mention consumer protection rights where relevant
- Keep it concise but thorough
- Do NOT include placeholder brackets like [Your Name] — write it as if from "Guardian AI on behalf of the account holder"

Return ONLY the message text, no JSON wrapper.`;

  return (await geminiGenerate(prompt)).trim();
}
