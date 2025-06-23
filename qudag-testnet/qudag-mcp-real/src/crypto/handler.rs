// src/crypto/handler.rs
// MCP tool handler for crypto operations

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use super::{CryptoState, Algorithm};

/// Handle crypto-related MCP tool calls
pub async fn handle_crypto_tool(
    state: &CryptoState,
    tool_name: &str,
    args: Value,
) -> Result<Value> {
    match tool_name {
        "qudag_key_generate" => handle_key_generate(state, args).await,
        "qudag_sign" => handle_sign(state, args).await,
        "qudag_verify" => handle_verify(state, args).await,
        "qudag_encrypt" => handle_encrypt(state, args).await,
        "qudag_decrypt" => handle_decrypt(state, args).await,
        "qudag_fingerprint_create" => handle_fingerprint_create(state, args).await,
        "qudag_fingerprint_verify" => handle_fingerprint_verify(state, args).await,
        "qudag_key_list" => handle_key_list(state, args).await,
        "qudag_key_export" => handle_key_export(state, args).await,
        "qudag_key_import" => handle_key_import(state, args).await,
        "qudag_vault_create" => handle_vault_create(state, args).await,
        "qudag_vault_unlock" => handle_vault_unlock(state, args).await,
        "qudag_vault_list" => handle_vault_list(state, args).await,
        _ => Err(anyhow!("Unknown crypto tool: {}", tool_name)),
    }
}

#[derive(Deserialize)]
struct KeyGenerateArgs {
    algorithm: String,
}

async fn handle_key_generate(state: &CryptoState, args: Value) -> Result<Value> {
    let params: KeyGenerateArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let keypair = ops.generate_keys(&params.algorithm).await?;
    
    Ok(json!({
        "success": true,
        "key_id": keypair.id,
        "algorithm": params.algorithm,
        "public_key": base64::encode(&keypair.public_key),
        "fingerprint": keypair.metadata.fingerprint,
        "created_at": keypair.created_at,
    }))
}

#[derive(Deserialize)]
struct SignArgs {
    message: String,
    key_id: String,
}

async fn handle_sign(state: &CryptoState, args: Value) -> Result<Value> {
    let params: SignArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let data = params.message.as_bytes();
    let signature = ops.sign_data(data, &params.key_id).await?;
    
    Ok(json!({
        "success": true,
        "signature": signature.signature,
        "algorithm": signature.algorithm,
        "key_id": signature.key_id,
        "timestamp": signature.timestamp,
    }))
}

#[derive(Deserialize)]
struct VerifyArgs {
    signature: String,
    message: String,
    public_key: String,
}

async fn handle_verify(state: &CryptoState, args: Value) -> Result<Value> {
    let params: VerifyArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let data = params.message.as_bytes();
    let public_key = base64::decode(&params.public_key)?;
    
    let valid = ops.verify_signature(&params.signature, data, &public_key).await?;
    
    Ok(json!({
        "success": true,
        "valid": valid,
        "algorithm": "ml-dsa-65",
    }))
}

#[derive(Deserialize)]
struct EncryptArgs {
    data: String,
    recipient: String,
}

async fn handle_encrypt(state: &CryptoState, args: Value) -> Result<Value> {
    let params: EncryptArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let data = params.data.as_bytes();
    let recipient_key = base64::decode(&params.recipient)?;
    
    let result = ops.encrypt_data(data, &recipient_key).await?;
    
    Ok(json!({
        "success": true,
        "ciphertext": result.ciphertext,
        "encapsulated_key": result.encapsulated_key,
        "algorithm": result.algorithm,
        "recipient": result.recipient,
    }))
}

#[derive(Deserialize)]
struct DecryptArgs {
    ciphertext: String,
    encapsulated_key: String,
    key_id: String,
}

async fn handle_decrypt(state: &CryptoState, args: Value) -> Result<Value> {
    let params: DecryptArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let plaintext = ops.decrypt_data(
        &params.ciphertext,
        &params.encapsulated_key,
        &params.key_id
    ).await?;
    
    Ok(json!({
        "success": true,
        "plaintext": String::from_utf8(plaintext)?,
    }))
}

#[derive(Deserialize)]
struct FingerprintCreateArgs {
    data: String,
}

async fn handle_fingerprint_create(state: &CryptoState, args: Value) -> Result<Value> {
    let params: FingerprintCreateArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let data = params.data.as_bytes();
    let fingerprint = ops.create_fingerprint(data).await?;
    
    Ok(json!({
        "success": true,
        "fingerprint": fingerprint,
        "algorithm": "quantum-fingerprint",
    }))
}

#[derive(Deserialize)]
struct FingerprintVerifyArgs {
    fingerprint: String,
    data: String,
}

async fn handle_fingerprint_verify(state: &CryptoState, args: Value) -> Result<Value> {
    let params: FingerprintVerifyArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let data = params.data.as_bytes();
    let valid = ops.verify_fingerprint(&params.fingerprint, data).await?;
    
    Ok(json!({
        "success": true,
        "valid": valid,
    }))
}

async fn handle_key_list(state: &CryptoState, _args: Value) -> Result<Value> {
    let ops = state.operations();
    let keys = ops.list_keys().await?;
    
    Ok(json!({
        "success": true,
        "keys": keys,
    }))
}

#[derive(Deserialize)]
struct KeyExportArgs {
    key_id: String,
    format: Option<String>,
}

async fn handle_key_export(state: &CryptoState, args: Value) -> Result<Value> {
    let params: KeyExportArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let format = params.format.as_deref().unwrap_or("base64");
    let exported = ops.export_key(&params.key_id, format).await?;
    
    Ok(json!({
        "success": true,
        "key_id": params.key_id,
        "format": format,
        "data": exported,
    }))
}

#[derive(Deserialize)]
struct KeyImportArgs {
    key_data: String,
    algorithm: String,
}

async fn handle_key_import(state: &CryptoState, args: Value) -> Result<Value> {
    let params: KeyImportArgs = serde_json::from_value(args)?;
    let ops = state.operations();
    
    let key_id = ops.import_key(&params.key_data, &params.algorithm).await?;
    
    Ok(json!({
        "success": true,
        "key_id": key_id,
        "algorithm": params.algorithm,
    }))
}

#[derive(Deserialize)]
struct VaultCreateArgs {
    name: String,
}

async fn handle_vault_create(state: &CryptoState, args: Value) -> Result<Value> {
    let params: VaultCreateArgs = serde_json::from_value(args)?;
    let mut vault = state.vault.lock().unwrap();
    
    let vault_id = vault.create_vault(&params.name).await?;
    
    Ok(json!({
        "success": true,
        "vault_id": vault_id,
        "name": params.name,
    }))
}

#[derive(Deserialize)]
struct VaultUnlockArgs {
    name: String,
    password: Option<String>,
}

async fn handle_vault_unlock(state: &CryptoState, args: Value) -> Result<Value> {
    let params: VaultUnlockArgs = serde_json::from_value(args)?;
    let mut vault = state.vault.lock().unwrap();
    
    let password = params.password.unwrap_or_else(|| {
        std::env::var("QUDAG_VAULT_PASSWORD")
            .unwrap_or_else(|_| "qudag-testnet-default-password".to_string())
    });
    
    vault.unlock_vault(&params.name, &password).await?;
    
    Ok(json!({
        "success": true,
        "name": params.name,
        "status": "unlocked",
    }))
}

async fn handle_vault_list(state: &CryptoState, _args: Value) -> Result<Value> {
    let vault = state.vault.lock().unwrap();
    let entries = vault.list_entries().await?;
    
    Ok(json!({
        "success": true,
        "entries": entries,
    }))
}

use base64::{Engine as _, engine::general_purpose::STANDARD as base64};