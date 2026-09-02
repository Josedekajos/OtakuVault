import { useEffect, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import CharacterCard from "../components/CharacterCard.jsx";
import CharacterForm from "../components/CharacterForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "../services/api.js";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function loadCharacters() {
    setLoading(true);
    setError("");
    try {
      const data = await getCharacters();
      setCharacters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load your characters.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  async function handleSubmit(data) {
    setError("");
    try {
      if (editingCharacter) {
        await updateCharacter(editingCharacter.characterId, data);
        setSuccessMessage("Character updated.");
      } else {
        await createCharacter(data);
        setSuccessMessage("Character added.");
      }
      setEditingCharacter(null);
      setShowForm(false);
      await loadCharacters();
    } catch (err) {
      setError(err.message || "Something went wrong while saving.");
    }
  }

  function handleAddNew() {
    setEditingCharacter(null);
    setShowForm(true);
  }

  function handleEdit(character) {
    setEditingCharacter(character);
    setShowForm(true);
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingCharacter(null);
  }

  async function handleDelete(characterId) {
    const confirmed = window.confirm("Delete this character? This can't be undone.");
    if (!confirmed) return;

    setError("");
    try {
      await deleteCharacter(characterId);
      setSuccessMessage("Character deleted.");
      await loadCharacters();
    } catch (err) {
      setError(err.message || "Unable to delete character.");
    }
  }

  return (
    <div className="app">
      <Navbar userEmail={user?.email} onLogout={logout} onAddCharacter={handleAddNew} />

      <div className="container">
        {error && <div className="message error">{error}</div>}
        {successMessage && <div className="message success">{successMessage}</div>}

        {showForm && (
          <CharacterForm
            editingCharacter={editingCharacter}
            onSubmit={handleSubmit}
            onCancel={handleCancelForm}
          />
        )}

        {loading ? (
          <p className="loading-text">Loading your characters...</p>
        ) : characters.length === 0 ? (
          <div className="card empty-state-card">
            <p>Your vault is empty. Add your first character to get started!</p>
          </div>
        ) : (
          <div className="character-grid">
            {characters.map((character) => (
              <CharacterCard
                key={character.characterId}
                character={character}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
