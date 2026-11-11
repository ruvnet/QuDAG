use qudag_network::{P2PEvent, P2PNetworkConfig, P2PNode};
use std::time::Duration;

fn loopback_config() -> P2PNetworkConfig {
    P2PNetworkConfig {
        listen_addrs: vec!["/ip4/127.0.0.1/tcp/0".to_string()],
        enable_mdns: false,
        ..Default::default()
    }
}

#[tokio::test]
async fn test_node_connectivity() {
    let (mut node1, handle1) = P2PNode::new(loopback_config()).await.unwrap();
    let (mut node2, handle2) = P2PNode::new(loopback_config()).await.unwrap();
    node1.start().await.unwrap();
    node2.start().await.unwrap();

    // Handle requests are served while the node event loops are polled
    let client = async {
        let peer1 = handle1.local_peer_id().await;
        let peer2 = handle2.local_peer_id().await;

        // Wait for node1 to bind its listener
        let addr1 = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if let Some(addr) = handle1.listeners().await.into_iter().next() {
                    break addr;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .expect("node1 never started listening");

        // Connect node2 to node1
        handle2.dial(addr1).await.unwrap();

        // Wait for the connection event on node1
        tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                match handle1.next_event().await {
                    Some(P2PEvent::PeerConnected(peer)) if peer == peer2 => break,
                    Some(_) => continue,
                    None => panic!("node1 event channel closed"),
                }
            }
        })
        .await
        .expect("node1 never saw node2 connect");

        assert!(handle2.connected_peers().await.contains(&peer1));
    };

    tokio::select! {
        result = node1.run() => panic!("node1 stopped: {:?}", result.err().map(|e| e.to_string())),
        result = node2.run() => panic!("node2 stopped: {:?}", result.err().map(|e| e.to_string())),
        _ = client => {}
    }
}
