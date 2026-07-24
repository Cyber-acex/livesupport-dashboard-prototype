const loginErrorMessages = {
  invalid: 'Invalid email or password. Please try again.',
  invalid_credentials: 'Invalid email or password. Please try again.',
  branch_required: 'Please select a branch before signing in.',
  branch_mismatch: 'You are not assigned to the selected branch.',
  google_access_denied: 'Google login was cancelled.',
  google_no_code: 'Failed to get authorization code from Google.',
  google_token_failed: 'Failed to exchange code for token.',
  google_userinfo_failed: 'Failed to fetch your Google profile information.',
  google_db_error: 'Database error during login.',
  google_create_failed: 'Failed to create your account.',
  google_exception: 'An error occurred during Google authentication.'
};

export function getLoginErrorMessage(error) {
  if (!error) return '';
  if (error.startsWith('google_')) {
    return loginErrorMessages[error] || 'Google authentication failed. Please try again.';
  }
  return loginErrorMessages[error] || 'Unable to sign in right now. Please try again.';
}

export function getLoginErrorMessageFromQuery(search) {
  if (!search) return '';
  const params = new URLSearchParams(search.startsWith('?') ? search.substring(1) : search);
  return getLoginErrorMessage(params.get('error'));
}
