use std::cmp::Ordering as CmpOrdering;
use std::collections::{BinaryHeap, HashMap};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::thread::JoinHandle;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use parking_lot::{Mutex, RwLock};

use crate::commands::adb::{
    adb_cancel_list_packages_inner, adb_get_device_info_inner, adb_list_packages_inner,
    adb_list_reverse_inner, adb_list_webview_sockets_inner, adb_open_package_inner,
    adb_reboot_inner, adb_remove_reverse_inner, adb_reverse_inner, adb_root_inner,
    adb_shell_command_inner, adb_tcpip_inner, catch_adb_panic, AdbPackage, DeviceInfo,
    PackageListScope, ReverseRule, WebViewSocket,
};
use crate::commands::port_forward::{adb_discover_targets_inner, AdbDiscoveredTarget};
use crate::session::job_queue::SessionJobResult::{
    DeviceInfo as DeviceInfoResult, Packages, ReverseRules, ShellOutput, Targets, Unit,
    WebViewSockets,
};
use crate::session::job_queue::{
    SessionJobPriority, SessionJobQueue, SessionJobResult, SessionWorkerJob,
    SessionWorkerRequest, SESSION_QUEUE_CAPACITY,
};
use crate::session::types::{
    SessionCleanupState, SessionHealthSnapshot, SessionTargetSnapshot,
};

const SESSION_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const SESSION_WORKER_POLL_INTERVAL: Duration = Duration::from_millis(200);
const SESSION_SHUTDOWN_WAIT: Duration = Duration::from_millis(500);

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Debug)]
struct SessionHealthState {
    connected_at: u64,
    active_operation: RwLock<Option<String>>,
    last_terminal_failure: RwLock<Option<String>>,
    cleanup_state: RwLock<SessionCleanupState>,
}

impl SessionHealthState {
    fn new() -> Self {
        Self {
            connected_at: now_millis(),
            active_operation: RwLock::new(None),
            last_terminal_failure: RwLock::new(None),
            cleanup_state: RwLock::new(SessionCleanupState::Active),
        }
    }

    fn start_operation(&self, operation: &str) {
        *self.active_operation.write() = Some(operation.to_string());
    }

    fn finish_operation(&self, result: &Result<SessionJobResult, String>) {
        if let Err(error) = result {
            *self.last_terminal_failure.write() = Some(error.clone());
        }
        *self.active_operation.write() = None;
    }

    fn record_failure(&self, failure: String) {
        *self.last_terminal_failure.write() = Some(failure);
    }

    fn set_cleanup_state(&self, state: SessionCleanupState) {
        *self.cleanup_state.write() = state;
    }

    fn snapshot(&self, queue: &SessionJobQueue) -> SessionHealthSnapshot {
        SessionHealthSnapshot {
            queue_depth: queue.depth(),
            queue_capacity: SESSION_QUEUE_CAPACITY,
            active_operation: self.active_operation.read().clone(),
            last_terminal_failure: self.last_terminal_failure.read().clone(),
            connection_age_ms: now_millis().saturating_sub(self.connected_at),
            cleanup_state: self.cleanup_state.read().clone(),
        }
    }
}

fn to_target_snapshot(
    serial: &str,
    updated_at: u64,
    target: AdbDiscoveredTarget,
) -> SessionTargetSnapshot {
    SessionTargetSnapshot {
        serial: serial.to_string(),
        id: target.id,
        target_type: target.target_type,
        title: target.title,
        url: target.url,
        devtools_frontend_url: target.devtools_frontend_url,
        web_socket_debugger_url: target.web_socket_debugger_url,
        favicon_url: target.favicon_url,
        package_name: target.package_name,
        is_stale: false,
        last_updated_at: updated_at,
    }
}

#[derive(Debug)]
pub struct DeviceSession {
    serial: String,
    sender: mpsc::SyncSender<SessionWorkerRequest>,
    queue: Arc<SessionJobQueue>,
    health: Arc<SessionHealthState>,
    shutdown: Arc<AtomicBool>,
    worker: Mutex<Option<JoinHandle<()>>>,
    targets: RwLock<Vec<SessionTargetSnapshot>>,
    packages: RwLock<HashMap<PackageListScope, Vec<AdbPackage>>>,
}

impl DeviceSession {
    pub fn new(serial: String) -> Arc<Self> {
        let queue = Arc::new(SessionJobQueue::default());
        let health = Arc::new(SessionHealthState::new());
        let shutdown = Arc::new(AtomicBool::new(false));
        let (sender, receiver) =
            mpsc::sync_channel::<SessionWorkerRequest>(SESSION_QUEUE_CAPACITY);

        let session = Arc::new(Self {
            serial: serial.clone(),
            sender,
            queue: queue.clone(),
            health: health.clone(),
            shutdown: shutdown.clone(),
            worker: Mutex::new(None),
            targets: RwLock::new(Vec::new()),
            packages: RwLock::new(HashMap::new()),
        });

        let worker = thread::Builder::new()
            .name(format!("capubridge-device-session-{serial}"))
            .spawn(move || worker_loop(serial, queue, health, shutdown, receiver))
            .expect("failed to spawn device session worker");
        *session.worker.lock() = Some(worker);

        session
    }

    pub fn get_device_info(&self) -> Result<DeviceInfo, String> {
        match self.request(SessionWorkerJob::GetDeviceInfo)? {
            DeviceInfoResult(info) => Ok(info),
            _ => Err("session-invalid-response: device-info".to_string()),
        }
    }

    pub fn shell_command(&self, command: String) -> Result<String, String> {
        match self.request(SessionWorkerJob::ShellCommand { command })? {
            ShellOutput(output) => Ok(output),
            _ => Err("session-invalid-response: shell-command".to_string()),
        }
    }

    pub fn tcpip(&self, port: u16) -> Result<(), String> {
        match self.request(SessionWorkerJob::TcpIp { port })? {
            Unit => Ok(()),
            _ => Err("session-invalid-response: tcpip".to_string()),
        }
    }

    pub fn root(&self) -> Result<(), String> {
        match self.request(SessionWorkerJob::Root)? {
            Unit => Ok(()),
            _ => Err("session-invalid-response: root".to_string()),
        }
    }

    pub fn reboot(&self, mode: Option<String>) -> Result<(), String> {
        match self.request(SessionWorkerJob::Reboot { mode })? {
            Unit => Ok(()),
            _ => Err("session-invalid-response: reboot".to_string()),
        }
    }

    pub fn list_packages(
        &self,
        scope: Option<PackageListScope>,
    ) -> Result<Vec<AdbPackage>, String> {
        let scope = scope.unwrap_or(PackageListScope::All);
        if let Some(packages) = self.packages.read().get(&scope) {
            return Ok(packages.clone());
        }

        if scope == PackageListScope::ThirdParty {
            if let Some(packages) = self.packages.read().get(&PackageListScope::All) {
                return Ok(packages.iter().filter(|entry| !entry.system).cloned().collect());
            }
        }

        Ok(Vec::new())
    }

    pub fn refresh_packages(
        &self,
        scope: Option<PackageListScope>,
    ) -> Result<Vec<AdbPackage>, String> {
        let scope = scope.unwrap_or(PackageListScope::All);
        match self.request(SessionWorkerJob::RefreshPackages { scope })? {
            Packages(packages) => {
                self.write_packages(scope, packages.clone());
                Ok(packages)
            }
            _ => Err("session-invalid-response: refresh-packages".to_string()),
        }
    }

    pub fn cancel_packages(&self) -> Result<(), String> {
        if self.shutdown.load(Ordering::Acquire) {
            return Err(format!("Device session {} is shutting down", self.serial));
        }
        adb_cancel_list_packages_inner(&self.serial);
        Ok(())
    }

    pub fn open_package(&self, package_name: String) -> Result<String, String> {
        match self.request(SessionWorkerJob::OpenPackage { package_name })? {
            ShellOutput(output) => Ok(output),
            _ => Err("session-invalid-response: open-package".to_string()),
        }
    }

    pub fn reverse(&self, remote_port: u16, local_port: u16) -> Result<(), String> {
        match self.request(SessionWorkerJob::Reverse {
            remote_port,
            local_port,
        })? {
            Unit => Ok(()),
            _ => Err("session-invalid-response: reverse".to_string()),
        }
    }

    pub fn remove_reverse(&self, remote_port: u16) -> Result<(), String> {
        match self.request(SessionWorkerJob::RemoveReverse { remote_port })? {
            Unit => Ok(()),
            _ => Err("session-invalid-response: remove-reverse".to_string()),
        }
    }

    pub fn list_reverse(&self) -> Result<Vec<ReverseRule>, String> {
        match self.request(SessionWorkerJob::ListReverse)? {
            ReverseRules(rules) => Ok(rules),
            _ => Err("session-invalid-response: list-reverse".to_string()),
        }
    }

    pub fn list_webview_sockets(&self) -> Result<Vec<WebViewSocket>, String> {
        match self.request(SessionWorkerJob::ListWebViewSockets)? {
            WebViewSockets(sockets) => Ok(sockets),
            _ => Err("session-invalid-response: webview-sockets".to_string()),
        }
    }

    pub fn list_targets(&self) -> Vec<SessionTargetSnapshot> {
        self.targets.read().clone()
    }

    pub fn refresh_targets(&self) -> Result<Vec<SessionTargetSnapshot>, String> {
        match self.request(SessionWorkerJob::RefreshTargets)? {
            Targets(targets) => {
                *self.targets.write() = targets.clone();
                Ok(targets)
            }
            _ => Err("session-invalid-response: targets".to_string()),
        }
    }

    pub fn mark_targets_stale(&self) {
        let updated_at = now_millis();
        let mut targets = self.targets.write();
        for target in targets.iter_mut() {
            target.is_stale = true;
            target.last_updated_at = updated_at;
        }
    }

    pub fn mark_packages_stale(&self) {
        let updated_at = now_millis();
        let mut packages_by_scope = self.packages.write();
        for packages in packages_by_scope.values_mut() {
            for package in packages.iter_mut() {
                package.is_stale = true;
                package.last_updated_at = Some(updated_at);
            }
        }
    }

    pub fn health_snapshot(&self) -> SessionHealthSnapshot {
        self.health.snapshot(&self.queue)
    }

    fn write_packages(&self, scope: PackageListScope, packages: Vec<AdbPackage>) {
        let mut packages_by_scope = self.packages.write();
        packages_by_scope.insert(scope, packages.clone());
        if scope == PackageListScope::All {
            let third_party = packages
                .iter()
                .filter(|entry| !entry.system)
                .cloned()
                .collect::<Vec<_>>();
            packages_by_scope.insert(PackageListScope::ThirdParty, third_party);
        }
    }

    fn request(&self, job: SessionWorkerJob) -> Result<SessionJobResult, String> {
        if self.shutdown.load(Ordering::Acquire) {
            return Err(format!("Device session {} is shutting down", self.serial));
        }
        let cancel_packages_on_timeout = matches!(job, SessionWorkerJob::RefreshPackages { .. });
        let receiver = self.queue.enqueue(&self.sender, job);
        match receiver.recv_timeout(SESSION_REQUEST_TIMEOUT) {
            Ok(result) => result,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if cancel_packages_on_timeout {
                    adb_cancel_list_packages_inner(&self.serial);
                }
                let error = format!(
                    "Timed out waiting for session worker {} after {} seconds",
                    self.serial,
                    SESSION_REQUEST_TIMEOUT.as_secs()
                );
                self.health.record_failure(error.clone());
                Err(error)
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                let error = format!(
                    "Session worker {} disconnected before responding",
                    self.serial
                );
                self.health.record_failure(error.clone());
                Err(error)
            }
        }
    }

    pub fn shutdown(&self) {
        if self.shutdown.swap(true, Ordering::AcqRel) {
            return;
        }
        self.health
            .set_cleanup_state(SessionCleanupState::ShuttingDown);
        adb_cancel_list_packages_inner(&self.serial);
        self.queue.fail_all(&format!(
            "Device session {} stopped before responding",
            self.serial
        ));
    }
}

impl Drop for DeviceSession {
    fn drop(&mut self) {
        self.shutdown();
        let Some(worker) = self.worker.get_mut().take() else {
            return;
        };
        let started_at = std::time::Instant::now();
        while !worker.is_finished() && started_at.elapsed() < SESSION_SHUTDOWN_WAIT {
            thread::sleep(Duration::from_millis(10));
        }
        if worker.is_finished() {
            let _ = worker.join();
        } else {
            self.health
                .set_cleanup_state(SessionCleanupState::Detached);
        }
    }
}

#[derive(Debug)]
struct ScheduledSessionRequest {
    priority: SessionJobPriority,
    sequence: u64,
    request: SessionWorkerRequest,
}

impl PartialEq for ScheduledSessionRequest {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority && self.sequence == other.sequence
    }
}

impl Eq for ScheduledSessionRequest {}

impl PartialOrd for ScheduledSessionRequest {
    fn partial_cmp(&self, other: &Self) -> Option<CmpOrdering> {
        Some(self.cmp(other))
    }
}

impl Ord for ScheduledSessionRequest {
    fn cmp(&self, other: &Self) -> CmpOrdering {
        self.priority
            .cmp(&other.priority)
            .then_with(|| other.sequence.cmp(&self.sequence))
    }
}

#[derive(Debug, Default)]
struct PendingSessionJobs {
    jobs: BinaryHeap<ScheduledSessionRequest>,
    next_sequence: u64,
}

impl PendingSessionJobs {
    fn push(&mut self, request: SessionWorkerRequest) {
        let scheduled = ScheduledSessionRequest {
            priority: request.job.priority(),
            sequence: self.next_sequence,
            request,
        };
        self.next_sequence = self.next_sequence.wrapping_add(1);
        self.jobs.push(scheduled);
    }

    fn pop(&mut self) -> Option<SessionWorkerRequest> {
        self.jobs.pop().map(|scheduled| scheduled.request)
    }

    fn is_empty(&self) -> bool {
        self.jobs.is_empty()
    }
}

fn worker_loop(
    serial: String,
    queue: Arc<SessionJobQueue>,
    health: Arc<SessionHealthState>,
    shutdown: Arc<AtomicBool>,
    receiver: mpsc::Receiver<SessionWorkerRequest>,
) {
    let mut pending = PendingSessionJobs::default();
    while !shutdown.load(Ordering::Acquire) {
        if pending.is_empty() {
            match receiver.recv_timeout(SESSION_WORKER_POLL_INTERVAL) {
                Ok(request) => pending.push(request),
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        loop {
            match receiver.try_recv() {
                Ok(request) => pending.push(request),
                Err(mpsc::TryRecvError::Empty | mpsc::TryRecvError::Disconnected) => break,
            }
        }
        let Some(request) = pending.pop() else {
            continue;
        };
        queue.mark_started();
        let key = request.job.coalescing_key();
        health.start_operation(request.job.operation_name());
        let result = execute_job(&serial, &request.job);
        health.finish_operation(&result);

        if let Some(key) = key {
            queue.resolve_snapshot(&key, result);
        } else {
            SessionJobQueue::resolve_direct(request.response, result);
        }
    }
    queue.clear_pending();
    queue.fail_all(&format!("Device session {serial} worker stopped"));
    health.set_cleanup_state(SessionCleanupState::Stopped);
}

fn execute_job(serial: &str, job: &SessionWorkerJob) -> Result<SessionJobResult, String> {
    match job {
        SessionWorkerJob::GetDeviceInfo => catch_adb_panic("session_get_device_info", || {
            adb_get_device_info_inner(serial).map(DeviceInfoResult)
        }),
        SessionWorkerJob::ShellCommand { command } => {
            catch_adb_panic("session_shell_command", || {
                adb_shell_command_inner(serial, command).map(ShellOutput)
            })
        }
        SessionWorkerJob::TcpIp { port } => catch_adb_panic("session_tcpip", || {
            adb_tcpip_inner(serial, *port).map(|_| Unit)
        }),
        SessionWorkerJob::Root => {
            catch_adb_panic("session_root", || adb_root_inner(serial).map(|_| Unit))
        }
        SessionWorkerJob::Reboot { mode } => catch_adb_panic("session_reboot", || {
            adb_reboot_inner(serial, mode.as_deref()).map(|_| Unit)
        }),
        SessionWorkerJob::RefreshPackages { scope } => {
            catch_adb_panic("session_refresh_packages", || {
                adb_list_packages_inner(serial, Some(*scope)).map(Packages)
            })
        }
        SessionWorkerJob::OpenPackage { package_name } => {
            catch_adb_panic("session_open_package", || {
                adb_open_package_inner(serial, package_name).map(ShellOutput)
            })
        }
        SessionWorkerJob::Reverse {
            remote_port,
            local_port,
        } => catch_adb_panic("session_reverse", || {
            adb_reverse_inner(serial, *remote_port, *local_port).map(|_| Unit)
        }),
        SessionWorkerJob::RemoveReverse { remote_port } => {
            catch_adb_panic("session_remove_reverse", || {
                adb_remove_reverse_inner(serial, *remote_port).map(|_| Unit)
            })
        }
        SessionWorkerJob::ListReverse => catch_adb_panic("session_list_reverse", || {
            adb_list_reverse_inner(serial).map(ReverseRules)
        }),
        SessionWorkerJob::ListWebViewSockets => {
            catch_adb_panic("session_list_webview_sockets", || {
                adb_list_webview_sockets_inner(serial).map(WebViewSockets)
            })
        }
        SessionWorkerJob::RefreshTargets => catch_adb_panic("session_refresh_targets", || {
            let updated_at = now_millis();
            adb_discover_targets_inner(serial)
                .map(|targets| {
                    targets
                        .into_iter()
                        .map(|target| to_target_snapshot(serial, updated_at, target))
                        .collect::<Vec<_>>()
                })
                .map(Targets)
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(job: SessionWorkerJob) -> SessionWorkerRequest {
        SessionWorkerRequest {
            job,
            response: None,
        }
    }

    #[test]
    fn scheduler_runs_lifecycle_and_control_before_background() {
        let mut pending = PendingSessionJobs::default();
        pending.push(request(SessionWorkerJob::RefreshTargets));
        pending.push(request(SessionWorkerJob::ShellCommand {
            command: "echo ready".to_string(),
        }));
        pending.push(request(SessionWorkerJob::Reboot { mode: None }));
        let order = (0..3)
            .filter_map(|_| pending.pop())
            .map(|request| request.job.operation_name())
            .collect::<Vec<_>>();
        assert_eq!(order, vec!["reboot", "shellCommand", "refreshTargets"]);
    }

    #[test]
    fn scheduler_preserves_fifo_order_within_priority() {
        let mut pending = PendingSessionJobs::default();
        pending.push(request(SessionWorkerJob::ShellCommand {
            command: "first".to_string(),
        }));
        pending.push(request(SessionWorkerJob::OpenPackage {
            package_name: "second".to_string(),
        }));
        assert!(matches!(
            pending.pop().map(|request| request.job),
            Some(SessionWorkerJob::ShellCommand { command }) if command == "first"
        ));
    }

    #[test]
    fn health_snapshot_retains_last_terminal_failure() {
        let health = SessionHealthState::new();
        let queue = SessionJobQueue::default();
        health.start_operation("refreshTargets");
        health.finish_operation(&Err("target refresh failed".to_string()));
        let snapshot = health.snapshot(&queue);
        assert_eq!(
            (
                snapshot.active_operation,
                snapshot.last_terminal_failure,
                snapshot.queue_capacity,
            ),
            (
                None,
                Some("target refresh failed".to_string()),
                SESSION_QUEUE_CAPACITY,
            )
        );
    }
}
