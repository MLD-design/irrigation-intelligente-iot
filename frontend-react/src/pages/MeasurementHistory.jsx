import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getMeasurementHistory } from '../api/measurements';
import Pagination from '../components/Pagination';
import ErrorMessage from '../components/ErrorMessage';

const PAGE_SIZE = 100; // maximum autorisé par le contrat
const EMPTY = { deviceId: '', from: '', to: '' };

const formatDate = (ms) => new Date(ms).toLocaleString();

export default function MeasurementHistory() {
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(0);
  const [formError, setFormError] = useState(null);

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ['measurements', 'history', filters, page],
    queryFn: () =>
      getMeasurementHistory({
        deviceId: filters.deviceId.trim() || undefined,
        // datetime-local donne une heure locale : on convertit en ISO 8601 (UTC)
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to: filters.to ? new Date(filters.to).toISOString() : undefined,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  // Le graphique veut l'ordre chronologique croissant
  const chartData = useMemo(() => {
    if (!data) return [];
    return [...data.content]
      .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt))
      .map((m) => ({
        time: new Date(m.measuredAt).getTime(),
        soilMoisture: m.soilMoisture,
        temperature: m.temperature, // peut être undefined (champ optionnel)
      }));
  }, [data]);

  function handleSubmit(e) {
    e.preventDefault();
    if (form.from && form.to && new Date(form.from) > new Date(form.to)) {
      setFormError('La date de début doit être antérieure à la date de fin.');
      return;
    }
    setFormError(null);
    setFilters(form);
    setPage(0);
  }

  function handleReset() {
    setForm(EMPTY);
    setFilters(EMPTY);
    setFormError(null);
    setPage(0);
  }

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <h1>Historique des mesures</h1>

      <form className="filters" onSubmit={handleSubmit}>
        <label>
          Dispositif
          <input value={form.deviceId} onChange={change('deviceId')} placeholder="esp32-01" />
        </label>
        <label>
          Du
          <input type="datetime-local" value={form.from} onChange={change('from')} />
        </label>
        <label>
          Au
          <input type="datetime-local" value={form.to} onChange={change('to')} />
        </label>
        <button type="submit">Filtrer</button>
        <button type="button" onClick={handleReset}>Réinitialiser</button>
      </form>

      {formError && <p className="error">{formError}</p>}

      {isLoading && <p>Chargement...</p>}
      <ErrorMessage error={error} />

      {data && data.content.length === 0 && <p>Aucune mesure pour cette période.</p>}

      {data && data.content.length > 0 && (
        <>
          <div style={{ width: '100%', height: 340, opacity: isFetching ? 0.6 : 1 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleString([], {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })
                  }
                />
                <YAxis yAxisId="left" domain={[0, 100]} unit=" %" />
                <YAxis yAxisId="right" orientation="right" unit=" °C" />
                <Tooltip labelFormatter={formatDate} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="soilMoisture"
                  name="Humidité du sol (%)"
                  stroke="#2e7d32"
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="temperature"
                  name="Température (°C)"
                  stroke="#e65100"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <table>
            <thead>
              <tr>
                <th>Mesuré le</th>
                <th>Dispositif</th>
                <th>Humidité</th>
                <th>Température</th>
                <th>Reçu le</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.measuredAt).toLocaleString()}</td>
                  <td>{m.deviceId}</td>
                  <td>{m.soilMoisture} %</td>
                  <td>{m.temperature !== undefined ? `${m.temperature} °C` : '-'}</td>
                  <td>{new Date(m.receivedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={data.page}
            size={data.size}
            totalElements={data.totalElements}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}