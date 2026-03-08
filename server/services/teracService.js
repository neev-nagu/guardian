const TERAC_BASE = 'https://terac.com/api/external/v1';

function teracHeaders() {
  return {
    'x-api-key': process.env.TERAC_API_KEY,
    'Content-Type': 'application/json',
  };
}

export async function createQuote({ taskDescription, panelDescription, timelineHours, submissionCount }) {
  const res = await fetch(`${TERAC_BASE}/quote`, {
    method: 'POST',
    headers: teracHeaders(),
    body: JSON.stringify({ taskDescription, panelDescription, timelineHours, submissionCount }),
  });
  if (!res.ok) throw new Error(`Terac quote failed: ${res.status}`);
  return res.json();
}

export async function launchOpportunity(quoteId, name) {
  const res = await fetch(`${TERAC_BASE}/opportunities`, {
    method: 'POST',
    headers: teracHeaders(),
    body: JSON.stringify({ quoteId, name }),
  });
  if (!res.ok) throw new Error(`Terac launch failed: ${res.status}`);
  return res.json();
}

export async function getOpportunityStatus(opportunityId) {
  const res = await fetch(`${TERAC_BASE}/opportunities/${opportunityId}`, {
    headers: teracHeaders(),
  });
  if (!res.ok) throw new Error(`Terac status failed: ${res.status}`);
  return res.json();
}

export async function getSubmissions(opportunityId) {
  const res = await fetch(`${TERAC_BASE}/opportunities/${opportunityId}/submissions`, {
    headers: teracHeaders(),
  });
  if (!res.ok) throw new Error(`Terac submissions failed: ${res.status}`);
  return res.json();
}
