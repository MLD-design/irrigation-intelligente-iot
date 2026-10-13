import React, { useState, useEffect, useCallback } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  checkHealth, 
  getLatestMeasurement, 
  sendIrrigationCommand, 
  getIrrigationStatus, 
  getMeasurementsHistory,
  getSettingsThresholds,
  updateSettingsThresholds,
  getAlerts,
  getDeviceStatus
} from '../services/irrigationService';

// Enregistrement des composants Chart.js nécessaires
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
);

function Dashboard() {
  const [backendStatus, setBackendStatus] = useState('Vérification...');
  const [measurement, setMeasurement] = useState(null);
  const [irrigationStatus, setIrrigationStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [thresholds, setThresholds] = useState({ minSoilMoisture: 30, maxSoilMoisture: 80 });
  const [alerts, setAlerts] = useState([]);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      const health = await checkHealth().catch(() => ({ status: 'DOWN' }));
      setBackendStatus(health.status || 'UP');

      const latest = await getLatestMeasurement().catch(() => null);
      setMeasurement(latest);

      const status = await getIrrigationStatus().catch(() => null);
      setIrrigationStatus(status);

      // Récupération d'un historique un peu plus large pour alimenter le graphique (ex: 10 points)
      const historyData = await getMeasurementsHistory(0, 10).catch(() => []);
      setHistory(historyData.content || historyData);

      const thresholdsData = await getSettingsThresholds().catch(() => null);
      if (thresholdsData) setThresholds(thresholdsData);

      const alertsData = await getAlerts().catch(() => []);
      setAlerts(alertsData);

      const devStatus = await getDeviceStatus().catch(() => null);
      setDeviceStatus(devStatus);

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Erreur de communication avec l'API :", error);
      setBackendStatus('DOWN / ERREUR');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => {
      fetchData(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCommand = async (action) => {
    try {
      const result = await sendIrrigationCommand(action);
      alert(`Commande ${action} acceptée (ID: ${result.commandId || 'N/A'})`);
      fetchData(false);
    } catch (error) {
      alert("Erreur lors de l'envoi de la commande.");
    }
  };

  const handleThresholdsSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateSettingsThresholds(thresholds);
      alert("Seuils de configuration mis à jour avec succès !");
      fetchData(false);
    } catch (error) {
      alert("Erreur lors de la mise à jour des seuils.");
    }
  };

  const getMoistureColor = () => {
    if (!measurement) return '#2b6cb0';
    if (measurement.soilMoisture < thresholds.minSoilMoisture) return '#d69e2e';
    if (measurement.soilMoisture > thresholds.maxSoilMoisture) return '#3182ce';
    return '#38a169';
  };

  // Préparation des données pour le graphique Chart.js
  // On inverse l'historique s'il est du plus récent au plus ancien pour l'afficher chronologiquement de gauche à droite
  const sortedHistory = [...history].reverse();
  const chartData = {
    labels: sortedHistory.map(item => item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'N/A'),
    datasets: [
      {
        label: 'Humidité du sol (%)',
        data: sortedHistory.map(item => item.soilMoisture),
        borderColor: '#3182ce',
        backgroundColor: 'rgba(49, 130, 206, 0.5)',
        tension: 0.3,
      },
      {
        label: 'Température (°C)',
        data: sortedHistory.map(item => item.temperature),
        borderColor: '#c53030',
        backgroundColor: 'rgba(197, 48, 48, 0.5)',
        tension: 0.3,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    scales: {
      y: { beginAtZero: true, max: 100 }
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement du tableau de bord...</div>;

  return (
    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>🌱 Smart Irrigation Dashboard</h1>
        <div style={{ fontSize: '13px', color: '#666', textAlign: 'right' }}>
          Dernière synchro : <strong>{lastUpdated || 'Jamais'}</strong>
          <button 
            onClick={() => fetchData(false)} 
            style={{ marginLeft: '10px', padding: '4px 8px', cursor: 'pointer', background: '#edf2f7', border: '1px solid #cbd5e0', borderRadius: '4px' }}>
            🔄 Actualiser
          </button>
        </div>
      </div>
      
      {/* Barre d'état globale */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '10px 15px', background: backendStatus === 'UP' ? '#e6fffa' : '#ffe6e6', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <strong>Backend :</strong> {backendStatus}
        </div>
        <div style={{ flex: 1, padding: '10px 15px', background: deviceStatus?.online ? '#e6fffa' : '#fffaf0', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <strong>Appareil ESP32 :</strong> {deviceStatus?.online ? '🟢 En Ligne' : '🟠 Hors Ligne / Inconnu'}
        </div>
      </div>

      {/* Section Alertes et Anomalies */}
      <div style={{ padding: '20px', background: alerts.length > 0 ? '#fff5f5' : '#f0fff4', borderRadius: '8px', border: `1px solid ${alerts.length > 0 ? '#feb2b2' : '#9ae6b4'}`, marginBottom: '20px' }}>
        <h3>🚨 Alertes et Anomalies Système</h3>
        {alerts.length === 0 ? (
          <p style={{ color: '#276749', margin: '5px 0 0 0' }}>Aucune alerte active. Tout fonctionne normalement.</p>
        ) : (
          <ul style={{ margin: '10px 0 0 20px', color: '#9b2c2c' }}>
            {alerts.map((alertItem, index) => (
              <li key={index}>
                <strong>{alertItem.type || 'Alerte'} :</strong> {alertItem.message} <small>({alertItem.timestamp})</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mesures en temps réel */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f0f4f8', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3>Humidité du Sol</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: getMoistureColor(), margin: '10px 0 5px 0' }}>
            {measurement ? `${measurement.soilMoisture} %` : 'N/A'}
          </p>
          <small>Seuils cibles : Min {thresholds.minSoilMoisture}% | Max {thresholds.maxSoilMoisture}%</small>
        </div>

        <div style={{ flex: 1, padding: '20px', background: '#f0f4f8', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3>Température</h3>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#c53030', margin: '10px 0 5px 0' }}>
            {measurement?.temperature !== undefined ? `${measurement.temperature} °C` : 'N/A'}
          </p>
          <small>Plage standard capteur</small>
        </div>
      </div>

      {/* Section Graphique d'évolution */}
      <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <h3>📈 Évolution Temporelle (Humidité & Température)</h3>
        {history.length === 0 ? (
          <p>Pas assez de données pour afficher le graphique.</p>
        ) : (
          <div style={{ marginTop: '15px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </div>

      {/* Configuration des Seuils */}
      <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <h3>Configuration des Seuils d'Arrosage</h3>
        <form onSubmit={handleThresholdsSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>Humidité Min (%) :</label>
            <input 
              type="number" 
              value={thresholds.minSoilMoisture} 
              onChange={(e) => setThresholds({ ...thresholds, minSoilMoisture: Number(e.target.value) })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', width: '100px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>Humidité Max (%) :</label>
            <input 
              type="number" 
              value={thresholds.maxSoilMoisture} 
              onChange={(e) => setThresholds({ ...thresholds, maxSoilMoisture: Number(e.target.value) })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0', width: '100px' }}
            />
          </div>
          <button 
            type="submit"
            style={{ padding: '10px 20px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-end' }}>
            Enregistrer
          </button>
        </form>
      </div>

      {/* Historique des mesures (Tableau) */}
      <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <h3>Historique Récent (Tableau)</h3>
        {history.length === 0 ? (
          <p>Aucune donnée d'historique disponible pour le moment.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Date / Heure</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Humidité (%)</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #cbd5e0' }}>Température (°C)</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={index}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #edf2f7' }}>{item.timestamp || 'N/A'}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #edf2f7' }}>{item.soilMoisture}</td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #edf2f7' }}>{item.temperature}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Contrôle Manuel */}
      <div style={{ padding: '20px', background: '#fffaf0', borderRadius: '8px', border: '1px solid #feebc8' }}>
        <h3>Contrôle Manuel de la Pompe</h3>
        <p>Mode actuel : <strong>{irrigationStatus?.mode || 'N/A'}</strong> | État pompe : <strong>{irrigationStatus?.pumpState || 'N/A'}</strong></p>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button 
            onClick={() => handleCommand('START')}
            style={{ padding: '10px 20px', background: '#38a169', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Démarrer l'arrosage (START)
          </button>
          <button 
            onClick={() => handleCommand('STOP')}
            style={{ padding: '10px 20px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Arrêter l'arrosage (STOP)
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;