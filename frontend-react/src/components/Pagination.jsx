// Rappel du contrat : page commence à 0
export default function Pagination({ page, size, totalElements, onChange }) {
  const totalPages = Math.max(1, Math.ceil(totalElements / size));

  return (
    <div className="pagination">
      <button disabled={page === 0} onClick={() => onChange(page - 1)}>
        Précédent
      </button>
      <span>
        Page {page + 1} / {totalPages} ({totalElements} éléments)
      </span>
      <button disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
        Suivant
      </button>
    </div>
  );
}