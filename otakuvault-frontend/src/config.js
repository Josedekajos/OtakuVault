 // ============================================================
// OTAKUVault FRONTEND CONFIGURATION
// ============================================================

// ============================================================
// AWS
// ============================================================

// AWS region where the OtakuVault services are deployed.
export const AWS_REGION = "us-east-1";

// ============================================================
// API GATEWAY
// ============================================================

// Base URL of the deployed API Gateway.
// No trailing slash.
export const API_BASE_URL =
  "https://7oud5ixtw1.execute-api.us-east-1.amazonaws.com/prod";

// ============================================================
// AMAZON COGNITO
// ============================================================

// Cognito User Pool ID.
export const USER_POOL_ID = "us-east-1_MVgowkYxL";

// Cognito App Client ID.
// This is a public client, so there is no client secret.
export const USER_POOL_CLIENT_ID = "cg8deueidrcl72n5rvip8or2c";

// Cognito Managed Login domain.
export const OAUTH_DOMAIN =
  "otakuvault-jose.auth.us-east-1.amazoncognito.com";

// ============================================================
// OAUTH REDIRECT CONFIGURATION
// ============================================================

// Redirect URL after successful login.
// Use localhost during local development.
// For the deployed Amplify app, change this to:
// https://main.d22fmpyspft1bj.amplifyapp.com/
export const OAUTH_REDIRECT_URL = "http://localhost:5173/";