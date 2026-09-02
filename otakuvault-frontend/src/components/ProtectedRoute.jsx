// ------------------------------------------------------------
// Renders `children` only when authenticated, `fallback`
// otherwise. All the real protection happens on the backend
// (the Cognito Authorizer on every route) - this is purely a
// UI convenience so signed-out visitors see the auth pages
// instead of a Dashboard that would just fail its API calls.
// ------------------------------------------------------------
export default function ProtectedRoute({ isAuthenticated, children, fallback }) {
  return isAuthenticated ? children : fallback;
}
