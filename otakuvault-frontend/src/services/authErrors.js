// ------------------------------------------------------------
// Amplify/Cognito errors come back with a `.name` like
// "NotAuthorizedException" rather than a message meant for a
// user to read. This maps the common ones to plain English;
// anything not listed here falls back to error.message.
// ------------------------------------------------------------

const MESSAGES = {
  UserNotFoundException: "No account found with that email.",
  NotAuthorizedException: "Incorrect email or password.",
  UserNotConfirmedException: "Please verify your email before logging in.",
  UsernameExistsException: "An account with that email already exists.",
  CodeMismatchException: "That verification code is incorrect.",
  ExpiredCodeException: "That code has expired. Request a new one.",
  LimitExceededException: "Too many attempts. Please wait a moment and try again.",
  InvalidPasswordException: "Password does not meet the requirements (8+ characters, upper, lower, and a number).",
  InvalidParameterException: "Please check the information you entered.",
  TooManyRequestsException: "Too many requests. Please wait a moment and try again.",
};

export function friendlyAuthError(error) {
  const name = error?.name;
  return (name && MESSAGES[name]) || error?.message || "Something went wrong. Please try again.";
}
