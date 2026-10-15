import { api } from './client';

export const getLatestMeasurement = (deviceId) =>
  api(`/measurements/latest${deviceId ? `?deviceId=${deviceId}` : ''}`);

export const getMeasurementHistory = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  return api(`/measurements/history?${q}`);
};