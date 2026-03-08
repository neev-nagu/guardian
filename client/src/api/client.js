const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Documents
  uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);
    return fetch(`${BASE}/documents/upload`, { method: 'POST', body: formData }).then(r => r.json());
  },
  getDocuments: () => request('/documents'),
  getDocument: (id) => request(`/documents/${id}`),
  getDocumentStatus: (id) => request(`/documents/${id}/status`),

  // Analysis
  triggerAnalysis: (docId) => request(`/analysis/${docId}`, { method: 'POST' }),
  getFlags: (docId) => request(`/analysis/${docId}/flags`),
  getSummaryStats: () => request('/analysis/summary/stats'),
  updateFlag: (flagId, data) => request(`/analysis/flags/${flagId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Negotiation
  generateNegotiation: (data) => request('/negotiation/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getNegotiations: (flagId) => request(`/negotiation/${flagId}`),

  // Terac
  createTeracOpportunity: (data) => request('/negotiation/terac/opportunity', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getTeracStatus: (opportunityId) => request(`/negotiation/terac/opportunity/${opportunityId}/status`),
  getTeracSubmissions: (opportunityId) => request(`/negotiation/terac/opportunity/${opportunityId}/submissions`),
  getTeracOpportunities: (documentId) => request(`/negotiation/terac/document/${documentId}`),

  // Dashboard
  getSavings: () => request('/dashboard/savings'),

  // ML & Rule checks
  getMLPrediction: (docId) => request(`/analysis/${docId}/ml`),
  getRuleChecks: (docId) => request(`/analysis/${docId}/rules`),

  // Financial Statements
  getFinancialStatements: (year, month) => {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    return request(`/financial/statements?${params}`);
  },
};
