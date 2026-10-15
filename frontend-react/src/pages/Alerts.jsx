import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getAlerts, acknowledgeAlert } from '../api/alerts';
import Pagination from '../components/Pagination';
import ErrorMessage from '../components/ErrorMessage';

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  LOW_MOISTURE: 'Humidité faible',
  HIGH_TEMPERATURE: 'Température élevée',
  SENSOR_FAILURE: 'Panne de capteur',
  DEVICE_OFFLINE: 'Dispositif hors ligne',
  PUMP_FAILURE: 'Panne de pompe',
};

const SEVERITY_LABELS = { INFO: 'Info', WARNING: 'Avertissement', CRITICAL: 'Critique' };
const SEVERITY_CLASS = { INFO: 'tag info', WARNING: 'tag warn', CRITICAL: 'tag ko' };

export default function Alerts() {
  const queryClient = useQueryClient();
  const [ackFilter, setAckFilter] = useState('false'); // 'all' | 'false' | 'true'
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(0);

  const { data, error, isLoading } = useQuery({
    queryKey: ['alerts', 'list', ackFilter, severity, page],
    queryFn: () =>
      getAlerts({
        acknowledged: ackFilter === 'all' ? undefined : ackFilter === 'true',
        severity: severity || undefined,
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const acknowledge = useMutation({
    mutationFn: acknowledgeAlert,
    // Invalide la liste ET le badge de la barre de navigation (préfixe 'alerts')
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  return (
    <div>
      <h1>Alertes</h1>

      <div className="filters">
        <label>
          Statut
          <select
            value={ackFilter}
            onChange={(e) => { setAckFilter(e.target.value); setPage(0); }}
          >
            <option value="false">Non traitées</option>
            <option value="true">Traitées</option>
            <option value="all">Toutes</option>
          </select>
        </label>
        <label>
          Gravité
          <select
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(0); }}
          >
            <option value="">Toutes</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Avertissement</option>
            <option value="CRITICAL">Critique</option>
          </select>
        </label>
      </div>

      {isLoading && <p>Chargement...</p>}
      <ErrorMessage error={error} />
      <ErrorMessage error={acknowledge.error} />

      {data && data.content.length === 0 && <p>Aucune alerte.</p>}

      {data && data.content.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Gravité</th>
                <th>Message</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((alert) => (
                <tr key={alert.id}>
                  <td>{new Date(alert.createdAt).toLocaleString()}</td>
                  <td>{TYPE_LABELS[alert.type] ?? alert.type}</td>
                  <td>
                    <span className={SEVERITY_CLASS[alert.severity]}>
                      {SEVERITY_LABELS[alert.severity]}
                    </span>
                  </td>
                  <td>{alert.message}</td>
                  <td>
                    {alert.acknowledged ? (
                      <small>
                        Traitée
                        {alert.acknowledgedAt &&
                          ` le ${new Date(alert.acknowledgedAt).toLocaleString()}`}
                      </small>
                    ) : (
                      <button
                        disabled={acknowledge.isPending}
                        onClick={() => acknowledge.mutate(alert.id)}
                      >
                        Marquer comme traitée
                      </button>
                    )}
                  </td>
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