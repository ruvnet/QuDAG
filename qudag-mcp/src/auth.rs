//! Authentication and authorization for QuDAG MCP.

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::SystemTime;

/// Authentication manager
#[derive(Debug, Clone)]
pub struct AuthManager {
    /// Authentication configuration
    config: AuthConfig,
    /// Active sessions
    sessions: HashMap<String, AuthSession>,
    api_keys: Vec<([u8; 32], String, Vec<Permission>)>,
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Whether authentication is required
    pub required: bool,
    /// Supported authentication methods
    pub methods: Vec<AuthMethod>,
    /// Session timeout in seconds
    pub session_timeout: u64,
    /// Maximum concurrent sessions
    pub max_sessions: usize,
}

/// Authentication method
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AuthMethod {
    /// API key authentication
    #[serde(rename = "api_key")]
    ApiKey,
    /// OAuth2 authentication
    #[serde(rename = "oauth2")]
    OAuth2,
    /// Vault token authentication
    #[serde(rename = "vault_token")]
    VaultToken,
    /// No authentication
    #[serde(rename = "none")]
    None,
}

/// Authentication session
#[derive(Debug, Clone)]
pub struct AuthSession {
    /// Session ID
    pub id: String,
    /// User ID
    pub user_id: String,
    /// Authentication method used
    pub method: AuthMethod,
    /// Session creation time
    pub created_at: SystemTime,
    /// Session last activity
    pub last_activity: SystemTime,
    /// Session permissions
    pub permissions: Vec<Permission>,
}

/// Permission type
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Permission {
    /// Read DAG data
    DagRead,
    /// Write DAG data
    DagWrite,
    /// Read vault data
    VaultRead,
    /// Write vault data
    VaultWrite,
    /// Network operations
    NetworkAccess,
    /// Crypto operations
    CryptoAccess,
    /// Admin operations
    Admin,
}

/// Authentication request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthRequest {
    /// Authentication method
    pub method: AuthMethod,
    /// Credentials
    pub credentials: HashMap<String, String>,
    /// Client information
    pub client_info: Option<crate::types::ClientInfo>,
}

/// Authentication response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    /// Whether authentication was successful
    pub success: bool,
    /// Session token (if successful)
    pub session_token: Option<String>,
    /// Error message (if failed)
    pub error: Option<String>,
    /// User permissions
    pub permissions: Option<Vec<String>>,
}

impl AuthManager {
    /// Create new authentication manager
    pub fn new(config: AuthConfig) -> Self {
        Self {
            config,
            sessions: HashMap::new(),
            api_keys: Vec::new(),
        }
    }

    /// Authenticate a request
    pub async fn authenticate(&mut self, request: AuthRequest) -> Result<AuthResponse> {
        if !self.config.required {
            // Explicit local configuration only; the caller cannot disable authentication.
            return Ok(AuthResponse {
                success: true,
                session_token: None,
                error: None,
                permissions: Some(vec!["read".to_string(), "write".to_string()]),
            });
        }

        if request.method == AuthMethod::None || !self.config.methods.contains(&request.method) {
            return Err(Error::auth("Authentication method is not permitted"));
        }

        match request.method {
            AuthMethod::ApiKey => self.authenticate_api_key(&request.credentials).await,
            AuthMethod::OAuth2 => self.authenticate_oauth2(&request.credentials).await,
            AuthMethod::VaultToken => self.authenticate_vault_token(&request.credentials).await,
            AuthMethod::None => Ok(AuthResponse {
                success: true,
                session_token: None,
                error: None,
                permissions: Some(vec!["read".to_string()]),
            }),
        }
    }

    /// Validate a session token
    pub async fn validate_session(&mut self, token: &str) -> Result<Option<&AuthSession>> {
        if let Some(session) = self.sessions.get(token) {
            // Check if session is expired
            let now = SystemTime::now();
            let age = now.duration_since(session.created_at)?;

            if age.as_secs() >= self.config.session_timeout {
                // Session expired, remove it
                self.sessions.remove(token);
                return Ok(None);
            }

            // Update last activity
            if let Some(session) = self.sessions.get_mut(token) {
                session.last_activity = now;
            }

            Ok(self.sessions.get(token))
        } else {
            Ok(None)
        }
    }

    /// Check if user has permission
    pub fn has_permission(&self, session_token: &str, permission: Permission) -> bool {
        if let Some(session) = self.sessions.get(session_token) {
            session
                .created_at
                .elapsed()
                .map(|age| age.as_secs() < self.config.session_timeout)
                .unwrap_or(false)
                && session.permissions.contains(&permission)
        } else {
            false
        }
    }

    /// Create a new session
    fn create_session(
        &mut self,
        user_id: String,
        method: AuthMethod,
        permissions: Vec<Permission>,
    ) -> Result<String> {
        self.cleanup_expired_sessions();
        // Check max sessions
        if self.sessions.len() >= self.config.max_sessions {
            return Err(Error::auth("Maximum concurrent sessions reached"));
        }

        let session_id = uuid::Uuid::new_v4().to_string();
        let now = SystemTime::now();

        let session = AuthSession {
            id: session_id.clone(),
            user_id,
            method,
            created_at: now,
            last_activity: now,
            permissions,
        };

        self.sessions.insert(session_id.clone(), session);
        Ok(session_id)
    }

    /// Register an operator-provisioned API credential and its explicit permissions.
    /// Keys must contain at least 32 bytes of independently generated entropy.
    pub fn register_api_key(
        &mut self,
        key: &str,
        user_id: String,
        permissions: Vec<Permission>,
    ) -> Result<()> {
        if key.len() < 32 || user_id.is_empty() || permissions.is_empty() {
            return Err(Error::auth("Invalid API credential configuration"));
        }
        self.api_keys.push((
            *blake3::hash(key.as_bytes()).as_bytes(),
            user_id,
            permissions,
        ));
        Ok(())
    }

    async fn authenticate_api_key(
        &mut self,
        credentials: &HashMap<String, String>,
    ) -> Result<AuthResponse> {
        let key = credentials
            .get("api_key")
            .ok_or_else(|| Error::auth("API key not provided"))?;
        let digest = blake3::hash(key.as_bytes());
        let entry = self
            .api_keys
            .iter()
            .find(|(expected, _, _)| {
                constant_time_eq::constant_time_eq(expected, digest.as_bytes())
            })
            .cloned()
            .ok_or_else(|| Error::auth("Invalid API key"))?;
        let permissions = entry.2.iter().map(ToString::to_string).collect();
        let token = self.create_session(entry.1, AuthMethod::ApiKey, entry.2)?;
        Ok(AuthResponse {
            success: true,
            session_token: Some(token),
            error: None,
            permissions: Some(permissions),
        })
    }

    async fn authenticate_oauth2(
        &mut self,
        _credentials: &HashMap<String, String>,
    ) -> Result<AuthResponse> {
        Err(Error::auth(
            "OAuth2 requires a configured token verifier; unavailable",
        ))
    }

    async fn authenticate_vault_token(
        &mut self,
        _credentials: &HashMap<String, String>,
    ) -> Result<AuthResponse> {
        Err(Error::auth(
            "Vault authentication requires a configured token verifier; unavailable",
        ))
    }

    /// Clean up expired sessions
    pub fn cleanup_expired_sessions(&mut self) {
        let now = SystemTime::now();
        let timeout = std::time::Duration::from_secs(self.config.session_timeout);

        self.sessions.retain(|_, session| {
            now.duration_since(session.created_at)
                .map(|age| age < timeout)
                .unwrap_or(false)
        });
    }
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            required: true,
            methods: vec![AuthMethod::ApiKey],
            session_timeout: 3600, // 1 hour
            max_sessions: 100,
        }
    }
}

impl std::fmt::Display for Permission {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Permission::DagRead => write!(f, "dag_read"),
            Permission::DagWrite => write!(f, "dag_write"),
            Permission::VaultRead => write!(f, "vault_read"),
            Permission::VaultWrite => write!(f, "vault_write"),
            Permission::NetworkAccess => write!(f, "network_access"),
            Permission::CryptoAccess => write!(f, "crypto_access"),
            Permission::Admin => write!(f, "admin"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_auth_disabled() {
        let config = AuthConfig {
            required: false,
            ..Default::default()
        };
        let mut auth = AuthManager::new(config);

        let request = AuthRequest {
            method: AuthMethod::None,
            credentials: HashMap::new(),
            client_info: None,
        };

        let response = auth.authenticate(request).await.unwrap();
        assert!(response.success);
    }

    #[tokio::test]
    async fn test_api_key_auth() {
        let config = AuthConfig {
            required: true,
            methods: vec![AuthMethod::ApiKey],
            ..Default::default()
        };
        let mut auth = AuthManager::new(config);

        auth.register_api_key(
            "test_key_123_012345678901234567890123",
            "test-user".into(),
            vec![Permission::DagRead],
        )
        .unwrap();

        let mut credentials = HashMap::new();
        credentials.insert(
            "api_key".to_string(),
            "test_key_123_012345678901234567890123".to_string(),
        );

        let request = AuthRequest {
            method: AuthMethod::ApiKey,
            credentials,
            client_info: None,
        };

        let response = auth.authenticate(request).await.unwrap();
        assert!(response.success);
        assert!(response.session_token.is_some());
    }

    #[tokio::test]
    async fn test_session_validation() {
        let config = AuthConfig {
            required: true,
            methods: vec![AuthMethod::ApiKey],
            session_timeout: 60, // 1 minute
            ..Default::default()
        };
        let mut auth = AuthManager::new(config);

        auth.register_api_key(
            "test_key_123_012345678901234567890123",
            "test-user".into(),
            vec![Permission::DagRead],
        )
        .unwrap();

        let mut credentials = HashMap::new();
        credentials.insert(
            "api_key".to_string(),
            "test_key_123_012345678901234567890123".to_string(),
        );

        let request = AuthRequest {
            method: AuthMethod::ApiKey,
            credentials,
            client_info: None,
        };

        let response = auth.authenticate(request).await.unwrap();
        let token = response.session_token.unwrap();

        // Validate the session
        let session = auth.validate_session(&token).await.unwrap();
        assert!(session.is_some());

        // Validate with invalid token
        let invalid_session = auth.validate_session("invalid_token").await.unwrap();
        assert!(invalid_session.is_none());
    }
}

#[cfg(test)]
mod security_regressions {
    use super::*;
    #[tokio::test]
    async fn required_auth_rejects_none_and_unprovisioned_credentials() {
        for method in [
            AuthMethod::None,
            AuthMethod::ApiKey,
            AuthMethod::OAuth2,
            AuthMethod::VaultToken,
        ] {
            let mut auth = AuthManager::new(AuthConfig {
                required: true,
                methods: vec![method.clone()],
                ..Default::default()
            });
            let credentials = [
                ("api_key", "attacker"),
                ("access_token", "attacker"),
                ("vault_token", "attacker"),
            ]
            .into_iter()
            .map(|(k, v)| (k.into(), v.into()))
            .collect();
            assert!(auth
                .authenticate(AuthRequest {
                    method,
                    credentials,
                    client_info: None
                })
                .await
                .is_err());
            assert!(auth.sessions.is_empty());
        }
    }
    #[test]
    fn expired_session_cannot_authorize_and_capacity_is_reclaimed() {
        let mut auth = AuthManager::new(AuthConfig {
            session_timeout: 0,
            max_sessions: 1,
            ..Default::default()
        });
        let token = auth
            .create_session("user".into(), AuthMethod::ApiKey, vec![Permission::Admin])
            .unwrap();
        assert!(!auth.has_permission(&token, Permission::Admin));
        assert!(auth
            .create_session("next".into(), AuthMethod::ApiKey, vec![Permission::DagRead])
            .is_ok());
    }
}
