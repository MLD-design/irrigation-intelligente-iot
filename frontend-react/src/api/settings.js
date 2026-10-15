import { api } from './client';

export const getSettings = () => api('/settings');

// PUT remplace TOUS les paramètres : toujours envoyer les deux champs
export const updateSettings = ({ moistureThreshold, automaticModeEnabled }) =>
  api('/settings', {
    method: 'PUT',
    body: JSON.stringify({ moistureThreshold, automaticModeEnabled }),
  });