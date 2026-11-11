use qudag_network::onion::{MLKEMOnionRouter, OnionError, OnionLayer};

#[test]
fn test_onion_layer_creation() {
    let layer = OnionLayer::new(
        vec![1, 2, 3], // next hop
        vec![4, 5, 6], // payload
        vec![7, 8, 9], // metadata
    );

    assert_eq!(layer.next_hop, vec![1, 2, 3]);
    assert_eq!(layer.payload, vec![4, 5, 6]);
    assert_eq!(layer.metadata, vec![7, 8, 9]);
}

#[test]
fn test_onion_layer_validation() {
    // Valid layer (layers must carry an ML-KEM ciphertext)
    let mut layer = OnionLayer::new(vec![1, 2, 3], vec![4, 5, 6], vec![7, 8, 9]);
    layer.kem_ciphertext = vec![0xAA; 32];
    assert!(layer.validate().is_ok());

    // Missing KEM ciphertext
    let layer = OnionLayer::new(vec![1, 2, 3], vec![4, 5, 6], vec![7, 8, 9]);
    assert!(matches!(
        layer.validate(),
        Err(OnionError::InvalidFormat(_))
    ));

    // Empty next hop marks the innermost (final destination) layer
    let mut layer = OnionLayer::new(vec![], vec![4, 5, 6], vec![7, 8, 9]);
    layer.kem_ciphertext = vec![0xAA; 32];
    assert!(layer.validate().is_ok());

    // Empty payload
    let mut layer = OnionLayer::new(vec![1, 2, 3], vec![], vec![7, 8, 9]);
    layer.kem_ciphertext = vec![0xAA; 32];
    assert!(matches!(
        layer.validate(),
        Err(OnionError::InvalidFormat(_))
    ));
}

#[tokio::test]
async fn test_onion_router_creation() {
    // The router generates its own ML-KEM keypair
    MLKEMOnionRouter::new()
        .await
        .expect("failed to create ML-KEM onion router");
}
