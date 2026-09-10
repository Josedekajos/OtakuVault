import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";

import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import {
  AWS_REGION,
  USER_POOL_ID,
  USER_POOL_CLIENT_ID,
  OAUTH_DOMAIN,
  OAUTH_REDIRECT_URL,
} from "./config.js";

import "./index.css";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: USER_POOL_ID,
      userPoolClientId: USER_POOL_CLIENT_ID,
      userPoolRegion: AWS_REGION,

      loginWith: {
        oauth: {
          domain: OAUTH_DOMAIN,
          scopes: ["openid","email","profile","aws.cognito.signin.user.admin"],
          redirectSignIn: [OAUTH_REDIRECT_URL],
          redirectSignOut: [OAUTH_REDIRECT_URL],
          responseType: "code",
        },
      },
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