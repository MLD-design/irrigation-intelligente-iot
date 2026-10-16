
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../api/settings';
import ErrorMessage from '../components/ErrorMessage';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [threshold, setThreshold] = useState(null);
  const [automatic, setAutomatic] = useState(null);
  const [validation, setValidation] = useState(null);

  const displayedThreshold =
    threshold ?? (data ? String(data.moistureThreshold) : '');

  const displayedAutomatic =
    automatic ?? (data ? data.automaticModeEnabled : false);

  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved);
      setThreshold(null);
      setAutomatic(null);
      queryClient.invalidateQueries({ queryKey: ['irrigation', 'status'] });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    const value = Number(displayedThreshold);

    if (
      displayedThreshold.trim() === '' ||
      Number.isNaN(value) ||
      value < 0 ||
      value > 100
    ) {
      setValidation('Le seuil doit être un nombre compris entre 0 et 100.');
      return;
    }

    setValidation(null);

    save.mutate({
      moistureThreshold: value,
      automaticModeEnabled: displayedAutomatic,
    });
  }

  const dirty =
    data &&
    (Number(displayedThreshold) !== data.moistureThreshold ||
      displayedAutomatic !== data.automaticModeEnabled);

  if (isLoading) return <p>Chargement...</p>;

  return (
    <div>
      <h1>Paramètres d'irrigation</h1>
      <ErrorMessage error={error} />

      {data && (
        <form className="settings" onSubmit={handleSubmit}>
          <label>
            Seuil d'humidité du sol (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={displayedThreshold}
              onChange={(e) => {
                setThreshold(e.target.value);
                save.reset();
              }}
            />
          </label>

          <small>
            L'irrigation automatique se déclenche sous ce seuil.
          </small>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={displayedAutomatic}
              onChange={(e) => {
                setAutomatic(e.target.checked);
                save.reset();
              }}
            />
            Activer le mode automatique
          </label>

          {validation && <p className="error">{validation}</p>}
          <ErrorMessage error={save.error} />

          {save.isSuccess && (
            <p className="success">Paramètres enregistrés.</p>
          )}

          <button type="submit" disabled={save.isPending || !dirty}>
            {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>

          <small>
            Dernière modification :{' '}
            {new Date(data.updatedAt).toLocaleString()}
          </small>
        </form>
      )}
    </div>
  );
}
