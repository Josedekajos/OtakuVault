// ============================================================
// OTakuVault FRONTEND CONFIGURATION
// ============================================================

// AWS region where the OtakuVault backend is deployed.
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