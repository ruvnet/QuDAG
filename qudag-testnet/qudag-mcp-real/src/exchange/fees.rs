use super::ExchangeConfig;
use serde::{Deserialize, Serialize};

// Fee constants
pub const MIN_FEE: u64 = 1; // Minimum 1 rUv token fee
pub const MAX_FEE_PERCENTAGE: f64 = 0.05; // Maximum 5% fee
pub const VOLUME_DISCOUNT_THRESHOLD: u64 = 1_000_000; // 1M tokens for volume discount
pub const VOLUME_DISCOUNT: f64 = 0.75; // 25% discount for high volume

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeStructure {
    pub base_rate: f64,
    pub verified_rate: f64,
    pub volume_rate: f64,
    pub minimum_fee: u64,
    pub maximum_percentage: f64,
}

impl Default for FeeStructure {
    fn default() -> Self {
        Self {
            base_rate: 0.01, // 1%
            verified_rate: 0.005, // 0.5%
            volume_rate: 0.0075, // 0.75%
            minimum_fee: MIN_FEE,
            maximum_percentage: MAX_FEE_PERCENTAGE,
        }
    }
}

pub fn calculate_fee(amount: u64, is_verified: bool, config: &ExchangeConfig) -> u64 {
    let base_percentage = if is_verified {
        config.base_fee_percentage * config.verified_agent_discount
    } else {
        config.base_fee_percentage
    };
    
    // Apply volume discount for large transactions
    let final_percentage = if amount >= VOLUME_DISCOUNT_THRESHOLD {
        base_percentage * VOLUME_DISCOUNT
    } else {
        base_percentage
    };
    
    // Calculate fee with bounds
    let raw_fee = (amount as f64 * final_percentage) as u64;
    let max_fee = (amount as f64 * MAX_FEE_PERCENTAGE) as u64;
    
    raw_fee.max(MIN_FEE).min(max_fee)
}

pub fn calculate_dynamic_fee(
    amount: u64,
    network_congestion: f64,
    is_verified: bool,
    config: &ExchangeConfig,
) -> u64 {
    // Base fee calculation
    let base_fee = calculate_fee(amount, is_verified, config);
    
    // Apply network congestion multiplier (1.0 to 2.0)
    let congestion_multiplier = 1.0 + network_congestion.min(1.0);
    let dynamic_fee = (base_fee as f64 * congestion_multiplier) as u64;
    
    // Ensure minimum fee
    dynamic_fee.max(MIN_FEE)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeEstimate {
    pub amount: u64,
    pub base_fee: u64,
    pub discounted_fee: Option<u64>,
    pub effective_rate: f64,
    pub savings: u64,
}

pub fn estimate_fee(
    amount: u64,
    is_verified: bool,
    config: &ExchangeConfig,
) -> FeeEstimate {
    let base_fee = calculate_fee(amount, false, config);
    let actual_fee = calculate_fee(amount, is_verified, config);
    
    FeeEstimate {
        amount,
        base_fee,
        discounted_fee: if is_verified { Some(actual_fee) } else { None },
        effective_rate: actual_fee as f64 / amount as f64,
        savings: base_fee - actual_fee,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeExample {
    pub description: String,
    pub amount: u64,
    pub standard_fee: u64,
    pub verified_fee: u64,
    pub savings_percentage: f64,
}

pub fn get_fee_examples(config: &ExchangeConfig) -> Vec<FeeExample> {
    let amounts = vec![
        (100, "Small transaction"),
        (1_000, "Medium transaction"),
        (10_000, "Large transaction"),
        (100_000, "Very large transaction"),
        (1_000_000, "Volume transaction"),
    ];
    
    amounts.into_iter().map(|(amount, desc)| {
        let standard = calculate_fee(amount, false, config);
        let verified = calculate_fee(amount, true, config);
        let savings_pct = ((standard - verified) as f64 / standard as f64) * 100.0;
        
        FeeExample {
            description: desc.to_string(),
            amount,
            standard_fee: standard,
            verified_fee: verified,
            savings_percentage: savings_pct,
        }
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_fee_calculation() {
        let config = ExchangeConfig::default();
        
        // Test standard fee (1%)
        let fee = calculate_fee(1000, false, &config);
        assert_eq!(fee, 10);
        
        // Test verified fee (0.5%)
        let verified_fee = calculate_fee(1000, true, &config);
        assert_eq!(verified_fee, 5);
    }
    
    #[test]
    fn test_minimum_fee() {
        let config = ExchangeConfig::default();
        
        // Even tiny amounts should have minimum fee
        let fee = calculate_fee(10, false, &config);
        assert_eq!(fee, MIN_FEE);
    }
    
    #[test]
    fn test_volume_discount() {
        let config = ExchangeConfig::default();
        
        // Large volume should get discount
        let fee = calculate_fee(VOLUME_DISCOUNT_THRESHOLD, false, &config);
        let expected = (VOLUME_DISCOUNT_THRESHOLD as f64 * 0.01 * VOLUME_DISCOUNT) as u64;
        assert_eq!(fee, expected);
    }
    
    #[test]
    fn test_dynamic_fee() {
        let config = ExchangeConfig::default();
        
        // Test with 50% congestion
        let fee = calculate_dynamic_fee(1000, 0.5, false, &config);
        assert_eq!(fee, 15); // 10 * 1.5
        
        // Test with max congestion
        let max_fee = calculate_dynamic_fee(1000, 1.0, false, &config);
        assert_eq!(max_fee, 20); // 10 * 2.0
    }
}