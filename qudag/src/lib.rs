//! QuDAG - Darknet Infrastructure for Agent Swarms
//!
//! An ultra-fast, secure quantum-resistant distributed communication platform
//! built on Directed Acyclic Graph (DAG) architecture, designed for autonomous
//! agent coordination and secure inter-agent transactions.
//!
//! ## Core Features
//! - **Agent Swarm Infrastructure**: Dark addressing (.dark domains) for anonymous agent communication
//! - **Quantum-Resistant Security**: ML-DSA-87, ML-KEM-768, and HQC cryptography
//! - **Ultra-Fast DAG Consensus**: QR-Avalanche algorithm with sub-second finality
//! - **rUv Token Economy**: Dynamic fee model supporting agent-to-agent value exchange
//! - **Onion Routing**: Multi-layer encryption for anonymous agent coordination
//! - **Vault Integration**: Secure key storage for autonomous agent identities
//! - **Business Plan Payouts**: Automated reward distribution for agent contributions

pub use qudag_crypto as crypto;
pub use qudag_dag as dag;
pub use qudag_exchange_core as exchange;
pub use qudag_network as network;
pub use qudag_protocol as protocol;

pub mod prelude {
    pub use crate::crypto::{HashFunction, KeyPair, MlKem768, PublicKey, SecretKey};
    
    #[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
    pub use crate::crypto::{Fingerprint, FingerprintError, MlDsaKeyPair, MlDsaPublicKey};
    
    // Re-export compatibility types on ARM64
    #[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
    pub use crate::protocol::crypto_compat::{MlDsaKeyPair, MlDsaPublicKey};

    pub use crate::dag::{Consensus, Dag, Node, QRAvalanche, Vertex, VertexId};

    pub use crate::exchange::{
        rUv, AccountId, BusinessPlanConfig, ExchangeConfig, ExchangeConfigBuilder, FeeRouter,
        PayoutConfig, Transaction,
    };

    pub use crate::network::{peer::Peer, NetworkManager};

    pub use crate::protocol::{Message, NodeConfig, ProtocolConfig};
}
