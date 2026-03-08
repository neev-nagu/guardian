const BASE = '/api';

function getToken() {
  return localStorage.getItem('papaya_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('papaya_token');
      localStorage.removeItem('papaya_user');
      window.dispatchEvent(new Event('papaya:logout'));
    }
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  googleAuth: (credential) => request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  getMe: () => request('/auth/me'),

  // Documents
  uploadDocument(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('document', file);
    return fetch(`${BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async r => {
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Upload failed'); }
      return r.json();
    });
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
  getTeracRespondTask: (opportunityId) => fetch(`/api/terac/respond/${opportunityId}`).then(r => r.json()),
  submitTeracResponse: (opportunityId, data) => fetch(`/api/terac/respond/${opportunityId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),

  // Insights
  getHeatmap: (params) => request(`/insights/heatmap${params ? `?${new URLSearchParams(params)}` : ''}`),
  getTimeline: () => request('/insights/timeline'),
  getForecast: (months) => request(`/insights/forecast?months=${months || 6}`),
  getDigitalTwinBase: () => request('/insights/digital-twin/base'),

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
