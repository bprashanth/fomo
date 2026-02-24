import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const AUTH_CONFIG_URL = 'https://fomomon.s3.ap-south-1.amazonaws.com/auth_config.json';
const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || '';

// Module-level singletons
let _pool = null;
let _cognitoUser = null;

export async function initCognito() {
  if (_pool) return;
  let config;
  try {
    const response = await fetch(AUTH_CONFIG_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    config = await response.json();
  } catch (err) {
    throw { type: 'configFetchFailed', original: err };
  }
  _pool = new CognitoUserPool({
    UserPoolId: config.userPoolId,
    ClientId: config.clientId,
  });
}

export function login(username, password) {
  return new Promise((resolve, reject) => {
    if (!_pool) {
      return reject({ type: 'configFetchFailed', original: new Error('Cognito not initialized') });
    }

    const normalizedUsername = username.toLowerCase();
    const authDetails = new AuthenticationDetails({ Username: normalizedUsername, Password: password });
    const cognitoUser = new CognitoUser({ Username: normalizedUsername, Pool: _pool });

    // The pool's app client is configured for USER_PASSWORD_AUTH (direct
    // username+password). The SDK default is USER_SRP_AUTH (challenge-response),
    // which the client doesn't have enabled — causing the 400 Bad Request.
    cognitoUser.setAuthenticationFlowType('USER_PASSWORD_AUTH');

    cognitoUser.authenticateUser(authDetails, {
      onSuccess(session) {
        _cognitoUser = cognitoUser;
        resolve({ idToken: session.getIdToken().getJwtToken(), cognitoUser });
      },
      onFailure(err) {
        if (err.code === 'NotAuthorizedException' || err.code === 'UserNotFoundException') {
          reject({ type: 'invalidCredentials', original: err });
        } else if (err.message && err.message.toLowerCase().includes('network')) {
          reject({ type: 'networkError', original: err });
        } else {
          reject({ type: 'unknown', original: err });
        }
      },
    });
  });
}

export function getSession() {
  return new Promise((resolve, reject) => {
    if (!_cognitoUser && _pool) {
      _cognitoUser = _pool.getCurrentUser();
    }
    if (!_cognitoUser) {
      return reject(new Error('No current user'));
    }
    _cognitoUser.getSession((err, session) => {
      if (err) return reject(err);
      if (!session.isValid()) return reject(new Error('Session expired'));
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const doFetch = async (token) =>
    fetch(fullUrl, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getSession();
  let response = await doFetch(token);

  if (response.status === 401) {
    token = await getSession();
    response = await doFetch(token);
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
  }

  return response;
}

export function logout() {
  if (_cognitoUser) {
    _cognitoUser.signOut();
    _cognitoUser = null;
  }
  _pool = null;
}
