import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AWS_REGION, USER_POOL_ID, USER_POOL_CLIENT_ID } from "./config.js";
import "./index.css";

// Amplify must be configured before any component renders, since
// AuthProvider checks for an existing session immediately on load.
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: USER_POOL_ID,
      userPoolClientId: USER_POOL_CLIENT_ID,
      region: AWS_REGION,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
