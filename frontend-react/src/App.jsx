import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MeasurementHistory from './pages/MeasurementHistory';
import IrrigationHistory from './pages/IrrigationHistory';
import Settings from './pages/Settings';
import Alerts from './pages/Alerts';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/mesures" element={<MeasurementHistory />} />
        <Route path="/irrigation" element={<IrrigationHistory />} />
        <Route path="/parametres" element={<Settings />} />
        <Route path="/alertes" element={<Alerts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}