//! Network simulation tests for DAG consensus
//!
//! NOTE: These tests are currently disabled as they require APIs that have been
//! redesigned. The tests need to be rewritten to use the current DAGConsensus API.
//!
//! TODO: Rewrite these tests using the current API:
//! - DAGConsensus::new() / with_config()
//! - Vertex::new() with VertexId
//! - add_vertex(), get_confidence(), get_tips()
//!
//! The original tests simulated:
//! - Network consensus with latency and packet loss
//! - Consensus with node failures
//! - Network partition scenarios

// Tests disabled until API migration is complete
