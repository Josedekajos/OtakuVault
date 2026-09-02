import { useState, useEffect } from "react";
import { uploadImage } from "../services/api.js";

export default function CharacterForm({ editingCharacter, onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingCharacter) {
      setName(editingCharacter.name || "");
      setDescription(editingCharacter.description || "");
    } else {
      setName("");
      setDescription("");
    }
    setFile(null);
    setError("");
  }, [editingCharacter]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Character name is required.");
      return;
    }
    setError("");

    const data = { name: name.trim(), description: description.trim() };

    if (file) {
      try {
        setUploading(true);
        data.imageKey = await uploadImage(file);
      } catch (err) {
        setUploading(false);
        setError(err.message || "Image upload failed.");
        return;
      }
      setUploading(false);
    }

    // Errors from the actual create/update call are handled and
    // displayed by Dashboard, one level up.
    onSubmit(data);
  }

  return (
    <form className="card character-form" onSubmit={handleSubmit}>
      <h2>{editingCharacter ? "Edit Character" : "Add Character"}</h2>

      {error && <div className="message error">{error}</div>}

      <label>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Naruto Uzumaki"
        />
      </label>

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A young ninja from the Hidden Leaf Village."
          rows={3}
        />
      </label>

      <label>
        Image
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
      </label>
      {editingCharacter?.imageUrl && !file && (
        <p className="auth-subtext">Current image will be kept unless you choose a new one.</p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? "Uploading image..." : editingCharacter ? "Save Changes" : "Add Character"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
