//! Local in-memory admission only: not distributed consensus throughput.
use qudag_dag::{DAGConsensus, Vertex, VertexId};
use std::{collections::HashSet, time::Instant};
fn main() {
    let n = 10_000;
    let mut dag = DAGConsensus::new();
    let mut times = Vec::with_capacity(n);
    let total = Instant::now();
    for i in 0..n {
        let id = VertexId::from_bytes(format!("v{i:08}").into_bytes());
        let parents = if i == 0 {
            HashSet::new()
        } else {
            [VertexId::from_bytes(format!("v{:08}", i - 1).into_bytes())]
                .into_iter()
                .collect()
        };
        let vertex = Vertex::new(id, vec![0; 256], parents);
        let start = Instant::now();
        dag.add_vertex(vertex).unwrap();
        times.push(start.elapsed().as_nanos());
    }
    let elapsed = total.elapsed().as_nanos();
    let order_start = Instant::now();
    let order = dag.get_total_order().unwrap();
    let order_ns = order_start.elapsed().as_nanos();
    assert_eq!(order.len(), n);
    for (i, id) in order.iter().enumerate() {
        assert_eq!(id, &format!("v{i:08}"));
    }
    assert_eq!(dag.get_tips(), vec![format!("v{:08}", n - 1)]);
    times.sort_unstable();
    println!("{{\"vertices\":{n},\"payload_bytes\":256,\"total_ns\":{elapsed},\"admission_p50_ns\":{},\"admission_p95_ns\":{},\"admission_p99_ns\":{},\"topological_order_ns\":{order_ns},\"distributed_consensus\":false}}", times[n/2], times[n*95/100], times[n*99/100]);
}
