import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../api/settings';
import ErrorMessage from '../components/ErrorMessage';

export default function Settings() {
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [threshold, setThreshold] = useState('');
  const [automatic, setAutomatic] = useState(false);
  const [validation, setValidation] = useState(null);

  // Remplit le formulaire quand les paramètres sont chargés
  useEffect(() => {
    if (data) {
      setThreshold(String(data.moistureThreshold));
      setAutomatic(data.automaticModeEnabled);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved);
      // Le mode affiché sur le tableau de bord peut avoir changé
      queryClient.invalidateQueries({ queryKey: ['irrigation', 'status'] });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    const value = Number(threshold);

    if (threshold.trim() === '' || Number.isNaN(value) || value < 0 || value > 100) {
      setValidation('Le seuil doit être un nombre compris entre 0 et 100.');
      return;
    }
    setValidation(null);

    // Le contrat impose d'envoyer les DEUX champs à chaque PUT
    save.mutate({ moistureThreshold: value, automaticModeEnabled: automatic });
  }

  const dirty =
    data &&
    (Number(threshold) !== data.moistureThreshold || automatic !== data.automaticModeEnabled);

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
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value);
                save.reset();
              }}
            />
          </label>
          <small>L'irrigation automatique se déclenche sous ce seuil.</small>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => {
                setAutomatic(e.target.checked);
                save.reset();
              }}
            />
            Activer le mode automatique
          </label>

          {validation && <p className="error">{validation}</p>}
          {/* 400 ou 409 renvoyés par le backend */}
          <ErrorMessage error={save.error} />
          {save.isSuccess && <p className="success">Paramètres enregistrés.</p>}

          <button type="submit" disabled={save.isPending || !dirty}>
            {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>

          <small>Dernière modification : {new Date(data.updatedAt).toLocaleString()}</small>
        </form>
      )}
    </div>
  );
}