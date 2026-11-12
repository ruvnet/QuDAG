use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use futures::future::join_all;
use qudag_network::{message::MessageQueue, MessagePriority, NetworkMessage};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::time::Duration;

const MSG_SIZES: [usize; 3] = [64, 1024, 65536]; // 64B, 1KB, 64KB
const BATCH_SIZES: [usize; 3] = [32, 128, 512];

/// How long each throughput run pushes messages through the queue.
const THROUGHPUT_WINDOW: Duration = Duration::from_millis(50);

fn test_message(size: usize) -> NetworkMessage {
    NetworkMessage {
        id: "bench".into(),
        source: vec![1],
        destination: vec![2],
        payload: vec![0u8; size],
        priority: MessagePriority::Normal,
        ttl: Duration::from_secs(60),
    }
}

async fn bench_message_throughput(msg_size: usize, batch_size: usize, duration: Duration) -> f64 {
    // The notification receiver is unused: the consumer polls `dequeue`. Dropping
    // it keeps `enqueue` from waiting on a full notification channel.
    let (queue, _) = MessageQueue::new();
    let queue = Arc::new(queue);
    let start = std::time::Instant::now();
    let msg_count = Arc::new(AtomicU64::new(0));
    let msg = test_message(msg_size);

    let send_queue = queue.clone();
    let msg_count_clone = msg_count.clone();
    let send_task = tokio::spawn(async move {
        while start.elapsed() < duration {
            // Send message batch
            for _ in 0..batch_size {
                if send_queue.enqueue(msg.clone()).await.is_ok() {
                    msg_count_clone.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
    });

    let recv_task = tokio::spawn(async move {
        while start.elapsed() < duration {
            if queue.dequeue().await.is_none() {
                tokio::task::yield_now().await;
            }
        }
    });

    // Wait for tasks to complete
    for result in join_all(vec![send_task, recv_task]).await {
        result.unwrap();
    }

    let count = msg_count.load(Ordering::Relaxed);
    let elapsed = start.elapsed().as_secs_f64();
    count as f64 / elapsed
}

fn bench_queue_performance(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("message_queue");
    group.measurement_time(Duration::from_secs(10));

    for &msg_size in MSG_SIZES.iter() {
        for &batch_size in BATCH_SIZES.iter() {
            group.bench_with_input(
                BenchmarkId::new(format!("throughput_{}b", msg_size), batch_size),
                &batch_size,
                |b, &batch_size| {
                    b.to_async(&rt).iter(|| async {
                        black_box(
                            bench_message_throughput(msg_size, batch_size, THROUGHPUT_WINDOW).await,
                        )
                    })
                },
            );
        }
    }

    group.finish();
}

fn bench_latency(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("message_latency");

    for &msg_size in MSG_SIZES.iter() {
        group.bench_with_input(
            BenchmarkId::new("latency", msg_size),
            &msg_size,
            |b, &msg_size| {
                let (queue, _) = MessageQueue::new();
                let msg = test_message(msg_size);

                // Time a message from enqueue until it is dequeued again; draining it
                // keeps the queue from growing across iterations.
                b.to_async(&rt).iter(|| async {
                    let start = std::time::Instant::now();
                    queue.enqueue(msg.clone()).await.unwrap();
                    black_box(queue.dequeue().await.unwrap());
                    black_box(start.elapsed())
                })
            },
        );
    }

    group.finish();
}

fn bench_batch_processing(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("batch_processing");

    for &batch_size in BATCH_SIZES.iter() {
        group.bench_with_input(
            BenchmarkId::new("batch", batch_size),
            &batch_size,
            |b, &batch_size| {
                let (queue, mut rx) = MessageQueue::new();
                let msg = test_message(1024); // 1KB messages

                b.iter(|| {
                    rt.block_on(async {
                        // Send batch
                        for _ in 0..batch_size {
                            queue.enqueue(msg.clone()).await.unwrap();
                        }

                        // Receive batch: wait for each notification, then take the message
                        for _ in 0..batch_size {
                            rx.recv().await.unwrap();
                            black_box(queue.dequeue().await.unwrap());
                        }
                    })
                })
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_queue_performance,
    bench_latency,
    bench_batch_processing
);
criterion_main!(benches);
