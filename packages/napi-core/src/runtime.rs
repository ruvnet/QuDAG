use once_cell::sync::Lazy;
use tokio::runtime::Runtime;

/// Shared tokio runtime for all async operations
///
/// This provides a single, multi-threaded tokio runtime that is shared across
/// all N-API async operations. This avoids the overhead of creating a runtime
/// for each async call.
static TOKIO_RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .thread_name("qudag-napi-worker")
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime")
});

/// Spawn an async task on the shared runtime
///
/// This is used for async operations that need to run on the tokio runtime.
pub fn spawn<F>(future: F) -> tokio::task::JoinHandle<F::Output>
where
    F: std::future::Future + Send + 'static,
    F::Output: Send + 'static,
{
    TOKIO_RUNTIME.spawn(future)
}

/// Spawn a blocking task on the shared runtime
///
/// This is used for CPU-intensive operations that would block the async runtime.
pub fn spawn_blocking<F, R>(f: F) -> tokio::task::JoinHandle<R>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    TOKIO_RUNTIME.spawn_blocking(f)
}

/// Enter the runtime context (for sync code that calls async)
///
/// This is rarely needed but useful for certain edge cases.
pub fn enter<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    let _guard = TOKIO_RUNTIME.enter();
    f()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spawn_async() {
        let handle = spawn(async { 42 });
        let result = futures::executor::block_on(handle).unwrap();
        assert_eq!(result, 42);
    }

    #[test]
    fn test_spawn_blocking() {
        let handle = spawn_blocking(|| 42);
        let result = futures::executor::block_on(handle).unwrap();
        assert_eq!(result, 42);
    }
}
