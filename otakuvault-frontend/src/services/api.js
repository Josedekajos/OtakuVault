import { fetchAuthSession } from "aws-amplify/auth";
import { API_BASE_URL } from "../config.js";

// ------------------------------------------------------------
// This file is the ONLY place that talks to API Gateway.
//
// IMPORTANT: we attach the Cognito ID token, not the access
// token. The access token doesn't carry the email/name claims
// the Lambda uses (see Stage 3's get_authenticated_user), but
// the ID token does - that's what API Gateway's Cognito
// Authorizer expects here.
// ------------------------------------------------------------

async function getAuthHeader() {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();

  if (!idToken) {
    throw new Error("You're not signed in. Please log in again.");
  }

  return { Authorization: `Bearer ${idToken}` };
}

async function request(path, options = {}) {
  if (!API_BASE_URL || API_BASE_URL === "PASTE_YOUR_API_GATEWAY_URL_HERE") {
    throw new Error("API Gateway URL is not configured yet. Open src/config.js.");
  }

  const authHeader = await getAuthHeader();

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      ...options,
    });
  } catch (networkError) {
    throw new Error(
      "Network error: could not reach the API. Check your connection, the API URL, and CORS settings."
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    if (response.status === 401) {
      message = "Your session has expired. Please log in again.";
    } else if (response.status === 403) {
      message = "You don't have access to that character.";
    } else if (response.status === 404) {
      message = "Character not found.";
    } else if (response.status >= 500) {
      message = "The server had a problem. Please try again shortly.";
    }

    try {
      const errorBody = await response.json();
      if (errorBody?.error) message = errorBody.error;
    } catch (_) {
      // response wasn't JSON, keep the default message
    }

    throw new Error(message);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// GET /characters -> only the signed-in user's own characters
export function getCharacters() {
  return request("/characters", { method: "GET" });
}

// GET /characters/{id}
export function getCharacter(characterId) {
  return request(`/characters/${encodeURIComponent(characterId)}`, { method: "GET" });
}

// POST /characters, body: { name, description, imageKey? }
export function createCharacter(data) {
  return request("/characters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// PUT /characters/{id}, body: { name?, description?, imageKey? }
export function updateCharacter(characterId, data) {
  return request(`/characters/${encodeURIComponent(characterId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// DELETE /characters/{id}
export function deleteCharacter(characterId) {
  return request(`/characters/${encodeURIComponent(characterId)}`, {
    method: "DELETE",
  });
}

// ------------------------------------------------------------
// Image upload: ask Lambda for a pre-signed PUT URL, then upload
// the raw file bytes straight to S3. Returns the imageKey to
// attach to the character when calling create/update above.
// ------------------------------------------------------------
export async function uploadImage(file) {
  const { uploadUrl, imageKey } = await request("/upload", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Image upload to S3 failed.");
  }

  return imageKey;
}
