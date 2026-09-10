//! Run: cargo run -p qudag-crypto --release --example ml_kem_v2_bench
//! Local latency measurement; not a constant-time or security-strength test.
use qudag_crypto::MlKem768;
use std::{hint::black_box, time::Instant};

fn sample() -> [u128; 3] {
    let start = Instant::now();
    let (pk, sk) = black_box(MlKem768::keygen().unwrap());
    let keygen = start.elapsed().as_nanos();
    let start = Instant::now();
    let (ct, ss) = black_box(MlKem768::encapsulate(&pk).unwrap());
    let encapsulate = start.elapsed().as_nanos();
    let start = Instant::now();
    let recovered = black_box(MlKem768::decapsulate(&sk, &ct).unwrap());
    let decapsulate = start.elapsed().as_nanos();
    assert_eq!(ss, recovered);
    [keygen, encapsulate, decapsulate]
}

fn summary(name: &str, mut values: Vec<u128>) -> String {
    values.sort_unstable();
    let n = values.len();
    let percentile = |p: usize| values[(n * p).div_ceil(100) - 1];
    format!(
        "\"{name}\":{{\"mean_ns\":{},\"p50_ns\":{},\"p95_ns\":{},\"p99_ns\":{}}}",
        values.iter().sum::<u128>() / n as u128,
        percentile(50),
        percentile(95),
        percentile(99)
    )
}

fn main() {
    let rounds = 1000;
    let warmup = 100;
    for _ in 0..warmup {
        black_box(sample());
    }
    let mut values: [Vec<u128>; 3] = std::array::from_fn(|_| Vec::with_capacity(rounds));
    for _ in 0..rounds {
        for (times, time) in values.iter_mut().zip(sample()) {
            times.push(time);
        }
    }
    let [keygen, encapsulate, decapsulate] = values;
    println!("{{\"rounds\":{rounds},\"warmup\":{warmup},\"os\":\"{}\",\"arch\":\"{}\",\"available_parallelism\":{},\"backend\":\"RustCrypto ml-kem 0.3.2\",{},{},{}}}",
        std::env::consts::OS, std::env::consts::ARCH,
        std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        summary("keygen", keygen), summary("encapsulate", encapsulate), summary("decapsulate", decapsulate));
}
