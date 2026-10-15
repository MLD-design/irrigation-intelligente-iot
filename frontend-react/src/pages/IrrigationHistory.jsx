import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getIrrigationHistory } from '../api/irrigation';
import Pagination from '../components/Pagination';
import ErrorMessage from '../components/ErrorMessage';

const PAGE_SIZE = 20;

const ACTION_LABELS = { START: 'Démarrage', STOP: 'Arrêt' };
const SOURCE_LABELS = { MANUAL: 'Manuelle', AUTOMATIC: 'Automatique' };
const STATUS_LABELS = {
  PENDING: 'En attente',
  EXECUTED: 'Exécutée',
  REJECTED: 'Refusée',
  FAILED: 'Échec',
  EXPIRED: 'Expirée',
};
const STATUS_CLASS = {
  PENDING: 'tag warn',
  EXECUTED: 'tag ok',
  REJECTED: 'tag ko',
  FAILED: 'tag ko',
  EXPIRED: 'tag warn',
};

export default function IrrigationHistory() {
  const [page, setPage] = useState(0);

  const { data, error, isLoading } = useQuery({
    queryKey: ['irrigation', 'history', page],
    queryFn: () => getIrrigationHistory(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });

  return (
    <div>
      <h1>Historique d'irrigation</h1>

      {isLoading && <p>Chargement...</p>}
      <ErrorMessage error={error} />

      {data && data.content.length === 0 && <p>Aucune commande enregistrée.</p>}

      {data && data.content.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>Créée le</th>
                <th>Action</th>
                <th>Source</th>
                <th>Statut</th>
                <th>Terminée le</th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>{ACTION_LABELS[item.action]}</td>
                  <td>{SOURCE_LABELS[item.source]}</td>
                  <td>
                    <span className={STATUS_CLASS[item.status]}>{STATUS_LABELS[item.status]}</span>
                  </td>
                  <td>{item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}</td>
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