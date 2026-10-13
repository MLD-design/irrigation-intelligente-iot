import React, { useState, useEffect } from 'react';
import { 
  checkHealth, 
  getLatestMeasurement, 
  sendIrrigationCommand, 
  getIrrigationStatus, 
  getMeasurementsHistory 
} from '../services/irrigationService';

function Dashboard() {
  const [backendStatus, setBackendStatus] = useState('Vérification...');
  const [measurement, setMeasurement] = useState(null);
  const [irrigationStatus, setIrrigationStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const health = await checkHealth();
        setBackendStatus(health.status);

        const latest = await getLatestMeasurement();
        setMeasurement(latest);

        const status = await getIrrigationStatus();
        setIrrigationStatus(status);

        // Récupération de l'historique (page 0, taille 5 par exemple)[cite: 1]
        const historyData = await getMeasurementsHistory(0, 5);
        setHistory(historyData.content || historyData); // Adapte selon la structure de la pagination Spring
      } catch (error) {
        console.error("Erreur de communication avec l'API :", error);
        setBackendStatus('DOWN / ERREUR');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCommand = async (action) => {
    try {
      const result = await sendIrrigationCommand(action);
      alert(`Commande ${action} acceptée (ID: ${result.commandId})`);
    } catch (error) {
      alert("Erreur lors de l'envoi de la commande.");
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Chargement...</div>;

  return (
    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: 'auto' }}>
      <h1>🌱 Smart Irrigation Dashboard</h1>
      
      <div style={{ padding: '10px 15px', background: backendStatus === 'UP' ? '#e6fffa' : '#ffe6e6', borderRadius: '6px', marginBottom: '20px' }}>
        <strong>État du Backend :</strong> {backendStatus}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f0f4f8', borderRadius: '8px' }}>
          <h3>Humidité du Sol</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2b6cb0' }}>
            {measurement ? `${measurement.soilMoisture} %` : 'N/A'}
          </p>
          <small>Min: 0% | Max: 100%</small>
        </div>

        <div style={{ flex: 1, padding: '20px', background: '#f0f4f8', borderRadius: '8px' }}>
          <h3>Température</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#c53030' }}>
            {measurement?.temperature !== undefined ? `${measurement.temperature} °C` : 'N/A'}
          </p>
          <small>Plage: -40°C à 85°C</small>
        </div>
      </div>

      {/* Section Historique des mesures */}
      <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <h3>Historique des Mesures Récentes</h3>
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