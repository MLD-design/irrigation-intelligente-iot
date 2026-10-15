import { api } from './client';

export const getAlerts = ({ acknowledged, severity, page = 0, size = 20 } = {}) => {
  const q = new URLSearchParams();
  if (acknowledged !== undefined) q.set('acknowledged', String(acknowledged));
  if (severity) q.set('severity', severity);
  q.set('page', String(page));
  q.set('size', String(size));
  return api(`/alerts?${q}`);
};

// PATCH sans corps, renvoie l'alerte mise à jour
export const acknowledgeAlert = (alertId) =>
  api(`/alerts/${alertId}/acknowledgement`, { method: 'PATCH' });