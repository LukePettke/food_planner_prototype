const API = '/api';

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export const preferences = {
  get: () => fetchApi('/preferences'),
  save: (body) => fetchApi('/preferences', { method: 'POST', body: JSON.stringify(body) }),
};

export const meals = {
  suggest: (weekStart) => fetchApi('/meals/suggest', { method: 'POST', body: JSON.stringify({ weekStart }) }),
  select: (planId, selections) => fetchApi('/meals/select', { method: 'POST', body: JSON.stringify({ planId, selections }) }),
  getPlan: (planId) => fetchApi(`/meals/plan/${planId}`),
  refreshImages: (planId) => fetchApi(`/meals/refresh-images/${planId}`, { method: 'POST', body: '{}' }),
};

export const calendar = {
  getAuthUrl: (redirectUri) =>
    fetchApi(`/calendar/auth-url${redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : ''}`),
  exchangeToken: (code, redirectUri) => fetchApi('/calendar/token', { method: 'POST', body: JSON.stringify({ code, redirectUri }) }),
  addEvents: (planId, weekStart) => fetchApi('/calendar/events', { method: 'POST', body: JSON.stringify({ planId, weekStart }) }),
};

export const grocery = {
  getApps: () => fetchApi('/grocery/apps'),
  export: (items) => fetchApi('/grocery/export', { method: 'POST', body: JSON.stringify({ items }) }),
};
