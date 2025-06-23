//! Test helpers for protocol tests

use qudag_network::peer::PeerId;
use rand::Rng;

pub trait PeerIdTestExt {
    fn random() -> Self;
}

impl PeerIdTestExt for PeerId {
    fn random() -> Self {
        let mut rng = rand::thread_rng();
        let bytes: [u8; 32] = rng.gen();
        PeerId::from_bytes(&bytes).expect("Valid peer id")
    }
}
