import { api } from './client';

export const getIrrigationStatus = () => api('/irrigation/status');

export const createIrrigationCommand = (action, source = 'MANUAL') =>
  api('/irrigation/commands', {
    method: 'POST',
    body: JSON.stringify({ action, source }),
  });

export const getIrrigationCommand = (commandId) =>
  api(`/irrigation/commands/${commandId}`);

export const getIrrigationHistory = (page = 0, size = 20) =>
  api(`/irrigation/history?page=${page}&size=${size}`);