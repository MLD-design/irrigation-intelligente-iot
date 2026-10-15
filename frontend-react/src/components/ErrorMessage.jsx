export default function ErrorMessage({ error }) {
  if (!error) return null;

  // TypeError = le fetch n'a pas abouti (backend éteint, CORS, réseau)
  const message =
    error instanceof TypeError
      ? 'Impossible de joindre le serveur.'
      : error.message || 'Une erreur est survenue.';

  return <p className="error">{message}</p>;
}