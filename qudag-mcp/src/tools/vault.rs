//! Vault tool implementation for MCP

use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use super::{get_optional_bool_arg, get_optional_u64_arg, get_required_string_arg, McpTool};
use crate::error::{Error, Result};

/// Vault tool for password management operations
pub struct VaultTool {
    name: String,
    description: String,
}

impl VaultTool {
    /// Create a new vault tool
    pub fn new() -> Self {
        Self {
            name: "vault".to_string(),
            description: "QuDAG password vault operations including create, read, update, delete entries and password generation.".to_string(),
        }
    }

    /// Initialize a new vault
    async fn init_vault(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "init_vault",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// Add a password entry
    async fn add_entry(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "add_entry",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// Get a password entry
    async fn get_entry(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "get_entry",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// List password entries
    async fn list_entries(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "list_entries",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// Remove a password entry
    async fn remove_entry(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "remove_entry",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// Update a password entry
    async fn update_entry(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "update_entry",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// Generate a password
    async fn generate_password_cmd(&self, args: &Value) -> Result<Value> {
        let length = get_optional_u64_arg(args, "length").unwrap_or(16);
        let symbols = get_optional_bool_arg(args, "symbols").unwrap_or(true);
        let numbers = get_optional_bool_arg(args, "numbers").unwrap_or(true);
        let count = get_optional_u64_arg(args, "count").unwrap_or(1);
        if !(8..=1024).contains(&length) || !(1..=100).contains(&count) {
            return Err(Error::invalid_request(
                "Password length must be 8..1024 and count 1..100",
            ));
        }
        let length = length as usize;

        let passwords: Vec<String> = (0..count)
            .map(|_| self.generate_password(length, symbols, numbers))
            .collect();

        Ok(json!({
            "success": true,
            "passwords": passwords,
            "count": count,
            "length": length,
            "includes_symbols": symbols,
            "includes_numbers": numbers
        }))
    }

    /// Get vault statistics
    async fn get_stats(&self, _args: &Value) -> Result<Value> {
        Err(Error::vault(
            "get_stats",
            "Persistent vault backend is not connected; operation unavailable",
        ))
    }

    /// Helper method to generate a password
    fn generate_password(&self, length: usize, symbols: bool, numbers: bool) -> String {
        use rand::{thread_rng, Rng};

        let mut charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".to_string();
        if numbers {
            charset.push_str("0123456789");
        }
        if symbols {
            charset.push_str("!@#$%^&*()-_=+[]{}|;:,.<>?");
        }

        let chars: Vec<char> = charset.chars().collect();
        let mut rng = thread_rng();

        (0..length)
            .map(|_| chars[rng.gen_range(0..chars.len())])
            .collect()
    }
}

#[async_trait]
impl McpTool for VaultTool {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        &self.description
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["init", "add", "get", "list", "remove", "update", "generate", "stats"],
                    "description": "The vault operation to perform"
                },
                "label": {
                    "type": "string",
                    "description": "Entry label for add, get, remove, update operations"
                },
                "username": {
                    "type": "string",
                    "description": "Username for add/update operations"
                },
                "password": {
                    "type": "string",
                    "description": "Password for add/update operations"
                },
                "path": {
                    "type": "string",
                    "description": "Vault path for init operation"
                },
                "generate": {
                    "type": "boolean",
                    "description": "Generate password for add/update operations"
                },
                "length": {
                    "type": "integer",
                    "minimum": 4,
                    "maximum": 128,
                    "description": "Password length for generation"
                },
                "symbols": {
                    "type": "boolean",
                    "description": "Include symbols in generated password"
                },
                "numbers": {
                    "type": "boolean",
                    "description": "Include numbers in generated password"
                },
                "count": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "description": "Number of passwords to generate"
                },
                "category": {
                    "type": "string",
                    "description": "Category filter for list operation"
                },
                "format": {
                    "type": "string",
                    "enum": ["json", "text", "tree"],
                    "description": "Output format for list operation"
                },
                "show_password": {
                    "type": "boolean",
                    "description": "Show password in plain text for get operation"
                },
                "force": {
                    "type": "boolean",
                    "description": "Force operation without confirmation"
                },
                "verbose": {
                    "type": "boolean",
                    "description": "Show verbose output for stats operation"
                }
            },
            "required": ["operation"]
        })
    }

    async fn execute(&self, arguments: Option<Value>) -> Result<Value> {
        let args = arguments.ok_or_else(|| Error::invalid_request("Missing arguments"))?;

        let operation = get_required_string_arg(&args, "operation")?;

        match operation.as_str() {
            "init" => self.init_vault(&args).await,
            "add" => self.add_entry(&args).await,
            "get" => self.get_entry(&args).await,
            "list" => self.list_entries(&args).await,
            "remove" => self.remove_entry(&args).await,
            "update" => self.update_entry(&args).await,
            "generate" => self.generate_password_cmd(&args).await,
            "stats" => self.get_stats(&args).await,
            _ => Err(Error::invalid_request(format!(
                "Unknown vault operation: {}",
                operation
            ))),
        }
    }

    fn validate_arguments(&self, arguments: Option<&Value>) -> Result<()> {
        let args = arguments.ok_or_else(|| Error::invalid_request("Missing arguments"))?;

        let operation = get_required_string_arg(args, "operation")?;

        match operation.as_str() {
            "init" => Ok(()),
            "add" => {
                get_required_string_arg(args, "label")?;
                get_required_string_arg(args, "username")?;
                Ok(())
            }
            "get" | "remove" | "update" => {
                get_required_string_arg(args, "label")?;
                Ok(())
            }
            "list" | "generate" | "stats" => Ok(()),
            _ => Err(Error::invalid_request(format!(
                "Unknown vault operation: {}",
                operation
            ))),
        }
    }

    fn metadata(&self) -> HashMap<String, Value> {
        let mut metadata = HashMap::new();
        metadata.insert("category".to_string(), json!("security"));
        metadata.insert("tags".to_string(), json!(["password", "vault", "security"]));
        metadata.insert("version".to_string(), json!("1.0.0"));
        metadata
    }
}

#[cfg(test)]
mod v2_security_tests {
    use super::*;
    #[tokio::test]
    async fn disconnected_storage_never_reports_success() {
        let tool = VaultTool::new();
        for operation in ["init", "add", "get", "list", "remove", "update", "stats"] {
            assert!(tool
                .execute(Some(json!({"operation": operation})))
                .await
                .is_err());
        }
    }
    #[tokio::test]
    async fn generation_is_bounded() {
        let tool = VaultTool::new();
        for args in [
            json!({"operation":"generate","length":u64::MAX}),
            json!({"operation":"generate","count":u64::MAX}),
            json!({"operation":"generate","length":0}),
        ] {
            assert!(tool.execute(Some(args)).await.is_err());
        }
        let result = tool
            .execute(Some(json!({"operation":"generate","length":32,"count":2})))
            .await
            .unwrap();
        assert_eq!(result["passwords"].as_array().unwrap().len(), 2);
        assert!(result["passwords"]
            .as_array()
            .unwrap()
            .iter()
            .all(|v| v.as_str().unwrap().len() == 32));
    }
}
