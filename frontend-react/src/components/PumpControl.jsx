import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getIrrigationStatus,
  createIrrigationCommand,
  getIrrigationCommand,
} from '../api/irrigation';

const COMMAND_TIMEOUT_MS = 30_000;

const PUMP_LABELS = { ON: 'En marche', OFF: 'Arrêtée', UNKNOWN: 'État inconnu' };
const MODE_LABELS = { MANUAL: 'Manuel', AUTOMATIC: 'Automatique' };

export default function PumpControl() {
  const queryClient = useQueryClient();
  const [commandId, setCommandId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  // 1. État de la pompe, rafraîchi toutes les 5 s
  const statusQuery = useQuery({
    queryKey: ['irrigation', 'status'],
    queryFn: getIrrigationStatus,
    refetchInterval: 5000,
  });

  // 2. Envoi de la commande (réponse 202 = acceptée, pas exécutée)
  const sendCommand = useMutation({
    mutationFn: (action) => createIrrigationCommand(action),
    onMutate: () => {
      setStartedAt(null);
      setTimedOut(false);
    },
    onSuccess: (cmd) => {
      setCommandId(cmd.commandId);
      setStartedAt(Date.now());
    },
  });

  // 3. Suivi de la commande : polling tant qu'elle est PENDING
  const commandQuery = useQuery({
    queryKey: ['irrigation', 'command', commandId],
    queryFn: () => getIrrigationCommand(commandId),
    enabled: !!commandId && !timedOut,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return !s || s === 'PENDING' ? 1500 : false;
    },
  });

  const command = commandQuery.data ?? sendCommand.data;
  const cmdStatus = command?.status;
  const waitingDevice = !!commandId && !timedOut && (!cmdStatus || cmdStatus === 'PENDING');
  const isBusy = sendCommand.isPending || waitingDevice;

  // 4. Timeout côté interface (ESP32 injoignable par exemple)
  useEffect(() => {
    if (!waitingDevice || !startedAt) return;
    const remaining = COMMAND_TIMEOUT_MS - (Date.now() - startedAt);
    const t = setTimeout(() => setTimedOut(true), Math.max(remaining, 0));
    return () => clearTimeout(t);
  }, [waitingDevice, startedAt]);

  // 5. Quand la commande est terminée, on recharge l'état de la pompe
  useEffect(() => {
    if (cmdStatus && cmdStatus !== 'PENDING') {
      queryClient.invalidateQueries({ queryKey: ['irrigation', 'status'] });
    }
  }, [cmdStatus, queryClient]);

  function renderFeedback() {
    if (sendCommand.error) {
      // ex. 409 : conflit avec une commande déjà en cours
      return <p style={{ color: 'crimson' }}>{sendCommand.error.message}</p>;
    }
    if (waitingDevice) return <p>Commande envoyée, en attente de confirmation de l'ESP32...</p>;
    if (timedOut) {
      return <p style={{ color: 'darkorange' }}>
        Pas de confirmation après 30 s. Vérifiez que l'ESP32 est en ligne.
      </p>;
    }
    if (cmdStatus === 'EXECUTED') return <p style={{ color: 'green' }}>Commande exécutée.</p>;
    if (cmdStatus === 'REJECTED') return <p style={{ color: 'crimson' }}>Commande refusée : {command.message}</p>;
    if (cmdStatus === 'FAILED') return <p style={{ color: 'crimson' }}>Échec de la commande : {command.message}</p>;
    if (cmdStatus === 'EXPIRED') return <p style={{ color: 'darkorange' }}>La commande a expiré sans être exécutée.</p>;
    return null;
  }

  if (statusQuery.isLoading) return <p>Chargement de l'état de la pompe...</p>;
  if (statusQuery.error) return <p>Erreur : {statusQuery.error.message}</p>;

   const { pumpState, mode, updatedAt } = statusQuery.data;
  const stateClass = { ON: 'on', OFF: 'off', UNKNOWN: 'unknown' }[pumpState];

  return (
    <section className="pump">
      <header className="card-head">
        <h2>Pompe</h2>
        <span className="tag info">{MODE_LABELS[mode]}</span>
      </header>

      <div className="pump-state">
        <span className={`orb ${stateClass}`} />
        <div>
          <div className={`digits pump-label ${stateClass}`}>{PUMP_LABELS[pumpState]}</div>
          <small>Mis à jour le {new Date(updatedAt).toLocaleString()}</small>
        </div>
      </div>

      <div className="pump-actions">
        <button className="btn-start" disabled={isBusy} onClick={() => sendCommand.mutate('START')}>
          ▶ Démarrer
        </button>
        <button className="btn-stop" disabled={isBusy} onClick={() => sendCommand.mutate('STOP')}>
          ■ Arrêter
        </button>
      </div>

      {renderFeedback()}
    </section>
  );
}