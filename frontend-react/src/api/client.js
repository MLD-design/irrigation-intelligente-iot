const BASE_URL = import.meta.env.VITE_API_URL;

export async function api(path, init) {
  const res = await fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    // Le contrat garantit un objet { status, error, message, timestamp, path }
    const error = await res.json().catch(() => ({
      status: res.status,
      error: res.statusText,
      message: 'Erreur de communication avec le serveur',
      path,
    }));
    throw error;
  }

  if (res.status === 204) return undefined;
  return res.json();
}