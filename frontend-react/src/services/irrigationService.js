// src/services/irrigationService.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8081',
  headers: { 'Content-Type': 'application/json' },
});

// 1. Vérification de la santé du backend
export const checkHealth = async () => {
  const response = await api.get('/api/v1/health');
  return response.data; // { status: "UP", timestamp: "..." }
};

// 2. Récupérer la dernière mesure
export const getLatestMeasurement = async (deviceId = '') => {
  const response = await api.get('/api/v1/measurements/latest', {
    params: deviceId ? { deviceId } : {}
  });
  return response.data;
};

// 3. Envoyer une commande d'irrigation (START / STOP)
export const sendIrrigationCommand = async (action) => {
  const response = await api.post('/api/v1/irrigation/commands', {
    action: action, // "START" ou "STOP"
    source: "MANUAL"
  });
  return response.data; // Renvoie un statut 202 avec l'objet IrrigationCommand
};

// 4. Consulter l'état global de la pompe
export const getIrrigationStatus = async () => {
  const response = await api.get('/api/v1/irrigation/status');
  return response.data;
};

// 5. Récupérer l'historique des mesures (avec pagination optionnelle)
export const getMeasurementsHistory = async (page = 0, size = 10) => {
  const response = await api.get('/api/v1/measurements/history', {
    params: { page, size }
  });
  return response.data; // Renvoie la liste paginée des mesures
};

// Récupérer les seuils actuels
export const getSettingsThresholds = async () => {
  const response = await api.get('/api/v1/settings/thresholds');
  return response.data;
};

// Mettre à jour les seuils
export const updateSettingsThresholds = async (thresholds) => {
  const response = await api.put('/api/v1/settings/thresholds', thresholds);
  return response.data;
};


// Récupérer les alertes et anomalies système
export const getAlerts = async () => {
  const response = await api.get('/api/v1/alerts');
  return response.data;
};

// Récupérer le statut de l'appareil IoT (ESP32)
export const getDeviceStatus = async () => {
  const response = await api.get('/api/v1/device/status');
  return response.data;
};