export default function CharacterCard({ character, onEdit, onDelete }) {
  return (
    <div className="character-card">
      <div className="character-image-wrap">
        {character.imageUrl ? (
          <img
            src={character.imageUrl}
            alt={character.name}
            className="character-image"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <div className="character-image-placeholder">No Image</div>
        )}
      </div>

      <div className="character-info">
        <h3>{character.name}</h3>
        <p>{character.description}</p>
      </div>

      <div className="character-actions">
        <button className="btn btn-small" onClick={() => onEdit(character)}>
          Edit
        </button>
        <button
          className="btn btn-small btn-danger"
          onClick={() => onDelete(character.characterId)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
