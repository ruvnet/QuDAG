use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use sysinfo::{System, SystemExt, ProcessExt, CpuExt, DiskExt, NetworkExt};
use std::collections::VecDeque;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub timestamp: DateTime<Utc>,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    pub dag: DagMetrics,
    pub crypto: CryptoMetrics,
    pub exchange: ExchangeMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuMetrics {
    pub usage_percent: f32,
    pub core_count: usize,
    pub frequency_mhz: u64,
    pub load_average: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMetrics {
    pub total_mb: u64,
    pub used_mb: u64,
    pub free_mb: u64,
    pub usage_percent: f32,
    pub swap_total_mb: u64,
    pub swap_used_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskMetrics {
    pub total_gb: u64,
    pub used_gb: u64,
    pub free_gb: u64,
    pub usage_percent: f32,
    pub read_bytes_per_sec: u64,
    pub write_bytes_per_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkMetrics {
    pub interfaces: Vec<NetworkInterface>,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
    pub rx_bytes_per_sec: u64,
    pub tx_bytes_per_sec: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub rx_packets: u64,
    pub tx_packets: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagMetrics {
    pub total_blocks: u64,
    pub tips_count: usize,
    pub consensus_rounds: u64,
    pub finalized_blocks: u64,
    pub pending_transactions: usize,
    pub blocks_per_second: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoMetrics {
    pub total_keys_generated: u64,
    pub signatures_created: u64,
    pub signatures_verified: u64,
    pub encryptions: u64,
    pub decryptions: u64,
    pub average_sign_time_ms: f64,
    pub average_verify_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeMetrics {
    pub total_accounts: usize,
    pub verified_accounts: usize,
    pub total_transactions: u64,
    pub total_volume: u64,
    pub total_fees_collected: u64,
    pub average_transaction_size: u64,
    pub transactions_per_second: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub overall: HealthLevel,
    pub components: Vec<ComponentHealth>,
    pub uptime_seconds: u64,
    pub last_check: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthLevel {
    Healthy,
    Degraded,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentHealth {
    pub name: String,
    pub status: HealthLevel,
    pub message: String,
    pub metrics: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub component: String,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsReport {
    pub timestamp: DateTime<Utc>,
    pub system: SystemDiagnostics,
    pub performance: PerformanceDiagnostics,
    pub security: SecurityDiagnostics,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemDiagnostics {
    pub os_info: String,
    pub kernel_version: String,
    pub process_count: usize,
    pub thread_count: usize,
    pub open_files: usize,
    pub network_connections: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceDiagnostics {
    pub bottlenecks: Vec<String>,
    pub slow_operations: Vec<SlowOperation>,
    pub resource_warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlowOperation {
    pub name: String,
    pub average_time_ms: f64,
    pub max_time_ms: f64,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityDiagnostics {
    pub vulnerabilities: Vec<String>,
    pub failed_auth_attempts: u64,
    pub suspicious_activities: Vec<String>,
    pub last_security_scan: DateTime<Utc>,
}

// Global system monitor
struct SystemMonitor {
    system: Arc<RwLock<System>>,
    metrics_history: Arc<RwLock<VecDeque<SystemMetrics>>>,
    logs: Arc<RwLock<VecDeque<LogEntry>>>,
    start_time: DateTime<Utc>,
}

impl SystemMonitor {
    fn new() -> Self {
        Self {
            system: Arc::new(RwLock::new(System::new_all())),
            metrics_history: Arc::new(RwLock::new(VecDeque::with_capacity(1000))),
            logs: Arc::new(RwLock::new(VecDeque::with_capacity(10000))),
            start_time: Utc::now(),
        }
    }
    
    async fn collect_metrics(&self) -> SystemMetrics {
        let mut sys = self.system.write().await;
        sys.refresh_all();
        
        // CPU metrics
        let cpu = CpuMetrics {
            usage_percent: sys.global_cpu_info().cpu_usage(),
            core_count: sys.cpus().len(),
            frequency_mhz: sys.cpus().first().map(|c| c.frequency()).unwrap_or(0),
            load_average: sys.load_average().into(),
        };
        
        // Memory metrics
        let memory = MemoryMetrics {
            total_mb: sys.total_memory() / 1024 / 1024,
            used_mb: sys.used_memory() / 1024 / 1024,
            free_mb: sys.available_memory() / 1024 / 1024,
            usage_percent: (sys.used_memory() as f32 / sys.total_memory() as f32) * 100.0,
            swap_total_mb: sys.total_swap() / 1024 / 1024,
            swap_used_mb: sys.used_swap() / 1024 / 1024,
        };
        
        // Disk metrics (simplified)
        let disks = sys.disks();
        let total_space: u64 = disks.iter().map(|d| d.total_space()).sum();
        let available_space: u64 = disks.iter().map(|d| d.available_space()).sum();
        let used_space = total_space - available_space;
        
        let disk = DiskMetrics {
            total_gb: total_space / 1024 / 1024 / 1024,
            used_gb: used_space / 1024 / 1024 / 1024,
            free_gb: available_space / 1024 / 1024 / 1024,
            usage_percent: (used_space as f32 / total_space as f32) * 100.0,
            read_bytes_per_sec: 0, // Would need historical data
            write_bytes_per_sec: 0,
        };
        
        // Network metrics
        let networks = sys.networks();
        let interfaces: Vec<NetworkInterface> = networks.iter().map(|(name, data)| {
            NetworkInterface {
                name: name.clone(),
                rx_bytes: data.received(),
                tx_bytes: data.transmitted(),
                rx_packets: data.packets_received(),
                tx_packets: data.packets_transmitted(),
            }
        }).collect();
        
        let total_rx: u64 = interfaces.iter().map(|i| i.rx_bytes).sum();
        let total_tx: u64 = interfaces.iter().map(|i| i.tx_bytes).sum();
        
        let network = NetworkMetrics {
            interfaces,
            total_rx_bytes: total_rx,
            total_tx_bytes: total_tx,
            rx_bytes_per_sec: 0, // Would need historical data
            tx_bytes_per_sec: 0,
        };
        
        // Get real metrics from QuDAG components
        let dag = self.get_dag_metrics().await;
        let crypto = self.get_crypto_metrics().await;
        let exchange = self.get_exchange_metrics().await;
        
        SystemMetrics {
            timestamp: Utc::now(),
            cpu,
            memory,
            disk,
            network,
            dag,
            crypto,
            exchange,
        }
    }
    
    async fn get_dag_metrics(&self) -> DagMetrics {
        // Get real metrics from DAG manager
        if let Ok(dag_manager) = crate::dag::DAG_MANAGER.try_lock() {
            DagMetrics {
                total_blocks: dag_manager.get_block_count() as u64,
                tips_count: dag_manager.get_tips().len(),
                consensus_rounds: dag_manager.get_consensus_rounds(),
                finalized_blocks: dag_manager.get_finalized_count() as u64,
                pending_transactions: dag_manager.get_pending_transactions().len(),
                blocks_per_second: dag_manager.get_blocks_per_second(),
            }
        } else {
            // Return default if can't acquire lock
            DagMetrics {
                total_blocks: 0,
                tips_count: 0,
                consensus_rounds: 0,
                finalized_blocks: 0,
                pending_transactions: 0,
                blocks_per_second: 0.0,
            }
        }
    }
    
    async fn get_crypto_metrics(&self) -> CryptoMetrics {
        // Get real metrics from crypto manager
        if let Ok(crypto_manager) = crate::crypto::CRYPTO_MANAGER.try_lock() {
            crypto_manager.get_metrics()
        } else {
            CryptoMetrics {
                total_keys_generated: 0,
                signatures_created: 0,
                signatures_verified: 0,
                encryptions: 0,
                decryptions: 0,
                average_sign_time_ms: 0.0,
                average_verify_time_ms: 0.0,
            }
        }
    }
    
    async fn get_exchange_metrics(&self) -> ExchangeMetrics {
        let exchange_metrics = crate::exchange::EXCHANGE.get_system_metrics().await;
        
        ExchangeMetrics {
            total_accounts: exchange_metrics.total_accounts,
            verified_accounts: exchange_metrics.verified_accounts,
            total_transactions: exchange_metrics.total_volume, // Simplified
            total_volume: exchange_metrics.total_volume,
            total_fees_collected: exchange_metrics.total_fees,
            average_transaction_size: 0, // Would need calculation
            transactions_per_second: 0.0, // Would need historical data
        }
    }
    
    async fn get_health(&self) -> HealthStatus {
        let metrics = self.collect_metrics().await;
        let uptime = (Utc::now() - self.start_time).num_seconds() as u64;
        
        let mut components = vec![];
        
        // Check CPU health
        let cpu_status = if metrics.cpu.usage_percent < 80.0 {
            HealthLevel::Healthy
        } else if metrics.cpu.usage_percent < 95.0 {
            HealthLevel::Degraded
        } else {
            HealthLevel::Critical
        };
        
        components.push(ComponentHealth {
            name: "CPU".to_string(),
            status: cpu_status,
            message: format!("CPU usage: {:.1}%", metrics.cpu.usage_percent),
            metrics: serde_json::json!({ "usage": metrics.cpu.usage_percent }),
        });
        
        // Check memory health
        let mem_status = if metrics.memory.usage_percent < 80.0 {
            HealthLevel::Healthy
        } else if metrics.memory.usage_percent < 95.0 {
            HealthLevel::Degraded
        } else {
            HealthLevel::Critical
        };
        
        components.push(ComponentHealth {
            name: "Memory".to_string(),
            status: mem_status,
            message: format!("Memory usage: {:.1}%", metrics.memory.usage_percent),
            metrics: serde_json::json!({ "usage": metrics.memory.usage_percent }),
        });
        
        // Check DAG health
        let dag_status = if metrics.dag.pending_transactions < 1000 {
            HealthLevel::Healthy
        } else if metrics.dag.pending_transactions < 5000 {
            HealthLevel::Degraded
        } else {
            HealthLevel::Critical
        };
        
        components.push(ComponentHealth {
            name: "DAG".to_string(),
            status: dag_status,
            message: format!("Pending transactions: {}", metrics.dag.pending_transactions),
            metrics: serde_json::json!({ 
                "pending": metrics.dag.pending_transactions,
                "blocks": metrics.dag.total_blocks 
            }),
        });
        
        // Determine overall health
        let overall = if components.iter().any(|c| matches!(c.status, HealthLevel::Critical)) {
            HealthLevel::Critical
        } else if components.iter().any(|c| matches!(c.status, HealthLevel::Degraded)) {
            HealthLevel::Degraded
        } else {
            HealthLevel::Healthy
        };
        
        HealthStatus {
            overall,
            components,
            uptime_seconds: uptime,
            last_check: Utc::now(),
        }
    }
    
    pub async fn log(&self, level: &str, component: &str, message: &str, data: Option<serde_json::Value>) {
        let entry = LogEntry {
            timestamp: Utc::now(),
            level: level.to_string(),
            component: component.to_string(),
            message: message.to_string(),
            data,
        };
        
        let mut logs = self.logs.write().await;
        logs.push_back(entry);
        
        // Keep only last 10000 entries
        if logs.len() > 10000 {
            logs.pop_front();
        }
    }
    
    pub async fn get_recent_logs(&self, limit: usize) -> Vec<LogEntry> {
        let logs = self.logs.read().await;
        logs.iter().rev().take(limit).cloned().collect()
    }
}

// Global system monitor instance
lazy_static::lazy_static! {
    static ref SYSTEM_MONITOR: SystemMonitor = SystemMonitor::new();
}

// Public API functions
pub async fn get_system_metrics() -> SystemMetrics {
    SYSTEM_MONITOR.collect_metrics().await
}

pub async fn get_health_status() -> HealthStatus {
    SYSTEM_MONITOR.get_health().await
}

pub async fn get_recent_logs(limit: usize) -> Vec<LogEntry> {
    SYSTEM_MONITOR.get_recent_logs(limit).await
}

pub async fn log(level: &str, component: &str, message: &str, data: Option<serde_json::Value>) {
    SYSTEM_MONITOR.log(level, component, message, data).await
}

pub async fn run_diagnostics() -> DiagnosticsReport {
    let sys = System::new_all();
    
    let system_diag = SystemDiagnostics {
        os_info: format!("{} {}", sys.name().unwrap_or_default(), sys.os_version().unwrap_or_default()),
        kernel_version: sys.kernel_version().unwrap_or_default(),
        process_count: sys.processes().len(),
        thread_count: sys.processes().values().map(|p| p.tasks.len()).sum(),
        open_files: 0, // Would need platform-specific implementation
        network_connections: sys.networks().len(),
    };
    
    let performance_diag = PerformanceDiagnostics {
        bottlenecks: vec![],
        slow_operations: vec![],
        resource_warnings: vec![],
    };
    
    let security_diag = SecurityDiagnostics {
        vulnerabilities: vec![],
        failed_auth_attempts: 0,
        suspicious_activities: vec![],
        last_security_scan: Utc::now(),
    };
    
    DiagnosticsReport {
        timestamp: Utc::now(),
        system: system_diag,
        performance: performance_diag,
        security: security_diag,
        recommendations: vec![],
    }
}

// Background monitoring task
pub async fn start_monitoring() {
    tokio::spawn(async {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
        
        loop {
            interval.tick().await;
            
            // Collect metrics
            let metrics = SYSTEM_MONITOR.collect_metrics().await;
            
            // Store in history
            let mut history = SYSTEM_MONITOR.metrics_history.write().await;
            history.push_back(metrics);
            
            // Keep only last 1000 entries
            if history.len() > 1000 {
                history.pop_front();
            }
        }
    });
}