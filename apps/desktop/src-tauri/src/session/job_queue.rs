use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;

use parking_lot::Mutex;

use crate::commands::adb::{AdbPackage, DeviceInfo, PackageListScope, ReverseRule, WebViewSocket};
use crate::session::types::SessionTargetSnapshot;

pub const SESSION_QUEUE_CAPACITY: usize = 64;

#[derive(Debug, Clone)]
pub enum SessionJobResult {
    DeviceInfo(DeviceInfo),
    ShellOutput(String),
    Packages(Vec<AdbPackage>),
    ReverseRules(Vec<ReverseRule>),
    WebViewSockets(Vec<WebViewSocket>),
    Targets(Vec<SessionTargetSnapshot>),
    Unit,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SessionJobKey {
    DeviceInfo,
    Packages(PackageListScope),
    ReverseRules,
    WebViewSockets,
    Targets,
}

#[derive(Debug)]
pub enum SessionWorkerJob {
    GetDeviceInfo,
    ShellCommand { command: String },
    TcpIp { port: u16 },
    Root,
    Reboot { mode: Option<String> },
    RefreshPackages { scope: PackageListScope },
    OpenPackage { package_name: String },
    Reverse { remote_port: u16, local_port: u16 },
    RemoveReverse { remote_port: u16 },
    ListReverse,
    ListWebViewSockets,
    RefreshTargets,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SessionJobPriority {
    Background,
    Snapshot,
    Control,
    Lifecycle,
}

impl SessionWorkerJob {
    pub fn coalescing_key(&self) -> Option<SessionJobKey> {
        match self {
            Self::GetDeviceInfo => Some(SessionJobKey::DeviceInfo),
            Self::RefreshPackages { scope } => Some(SessionJobKey::Packages(*scope)),
            Self::ListReverse => Some(SessionJobKey::ReverseRules),
            Self::ListWebViewSockets => Some(SessionJobKey::WebViewSockets),
            Self::RefreshTargets => Some(SessionJobKey::Targets),
            Self::ShellCommand { .. }
            | Self::TcpIp { .. }
            | Self::Root
            | Self::Reboot { .. }
            | Self::OpenPackage { .. }
            | Self::Reverse { .. }
            | Self::RemoveReverse { .. } => None,
        }
    }

    pub fn priority(&self) -> SessionJobPriority {
        match self {
            Self::Root | Self::Reboot { .. } | Self::TcpIp { .. } => {
                SessionJobPriority::Lifecycle
            }
            Self::ShellCommand { .. }
            | Self::OpenPackage { .. }
            | Self::Reverse { .. }
            | Self::RemoveReverse { .. } => SessionJobPriority::Control,
            Self::GetDeviceInfo | Self::ListReverse | Self::ListWebViewSockets => {
                SessionJobPriority::Snapshot
            }
            Self::RefreshPackages { .. } | Self::RefreshTargets => SessionJobPriority::Background,
        }
    }

    pub fn operation_name(&self) -> &'static str {
        match self {
            Self::GetDeviceInfo => "getDeviceInfo",
            Self::ShellCommand { .. } => "shellCommand",
            Self::TcpIp { .. } => "tcpIp",
            Self::Root => "root",
            Self::Reboot { .. } => "reboot",
            Self::RefreshPackages { .. } => "refreshPackages",
            Self::OpenPackage { .. } => "openPackage",
            Self::Reverse { .. } => "reverse",
            Self::RemoveReverse { .. } => "removeReverse",
            Self::ListReverse => "listReverse",
            Self::ListWebViewSockets => "listWebViewSockets",
            Self::RefreshTargets => "refreshTargets",
        }
    }
}

type SessionResponse = Result<SessionJobResult, String>;
type SessionResponseSender = mpsc::Sender<SessionResponse>;

#[derive(Debug)]
pub struct SessionWorkerRequest {
    pub job: SessionWorkerJob,
    pub response: Option<SessionResponseSender>,
}

#[derive(Debug, Default)]
struct SessionJobQueueInner {
    snapshot_waiters: HashMap<SessionJobKey, Vec<SessionResponseSender>>,
}

#[derive(Debug, Default)]
pub struct SessionJobQueue {
    inner: Mutex<SessionJobQueueInner>,
    queued_jobs: AtomicUsize,
}

impl SessionJobQueue {
    pub fn enqueue(
        &self,
        sender: &mpsc::SyncSender<SessionWorkerRequest>,
        job: SessionWorkerJob,
    ) -> mpsc::Receiver<SessionResponse> {
        let (response_tx, response_rx) = mpsc::channel();
        let maybe_key = job.coalescing_key();

        if let Some(key) = maybe_key.clone() {
            let mut inner = self.inner.lock();
            if let Some(waiters) = inner.snapshot_waiters.get_mut(&key) {
                waiters.push(response_tx);
                return response_rx;
            }

            inner
                .snapshot_waiters
                .insert(key, vec![response_tx.clone()]);
        }

        let request = SessionWorkerRequest {
            job,
            response: maybe_key.is_none().then_some(response_tx.clone()),
        };

        self.queued_jobs.fetch_add(1, Ordering::AcqRel);
        if let Err(error) = sender.try_send(request) {
            self.queued_jobs.fetch_sub(1, Ordering::AcqRel);
            let message = match error {
                mpsc::TrySendError::Full(_) => {
                    format!("Session queue is full at {SESSION_QUEUE_CAPACITY} jobs")
                }
                mpsc::TrySendError::Disconnected(_) => {
                    "Session worker is disconnected".to_string()
                }
            };
            if let Some(key) = maybe_key {
                let waiters = self
                    .inner
                    .lock()
                    .snapshot_waiters
                    .remove(&key)
                    .unwrap_or_default();
                for waiter in waiters {
                    let _ = waiter.send(Err(message.clone()));
                }
            } else {
                let _ = response_tx.send(Err(message));
            }
        }

        response_rx
    }

    pub fn resolve_snapshot(&self, key: &SessionJobKey, result: SessionResponse) {
        let waiters = {
            let mut inner = self.inner.lock();
            inner.snapshot_waiters.remove(key).unwrap_or_default()
        };

        for waiter in waiters {
            let _ = waiter.send(result.clone());
        }
    }

    pub fn resolve_direct(response: Option<SessionResponseSender>, result: SessionResponse) {
        if let Some(sender) = response {
            let _ = sender.send(result);
        }
    }

    pub fn fail_all(&self, message: &str) {
        let waiters = {
            let mut inner = self.inner.lock();
            std::mem::take(&mut inner.snapshot_waiters)
        };

        for waiter in waiters.into_values().flatten() {
            let _ = waiter.send(Err(message.to_string()));
        }
    }

    pub fn mark_started(&self) {
        self.queued_jobs.fetch_sub(1, Ordering::AcqRel);
    }

    pub fn clear_pending(&self) {
        self.queued_jobs.store(0, Ordering::Release);
    }

    pub fn depth(&self) -> usize {
        self.queued_jobs.load(Ordering::Acquire)
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_priority_outranks_background_priority() {
        assert!(SessionWorkerJob::Root.priority() > SessionWorkerJob::RefreshTargets.priority());
    }

    #[test]
    fn bounded_queue_rejects_work_when_capacity_is_reached() {
        let queue = SessionJobQueue::default();
        let (sender, _receiver) = mpsc::sync_channel(1);
        let _first = queue.enqueue(
            &sender,
            SessionWorkerJob::ShellCommand {
                command: "first".to_string(),
            },
        );
        let second = queue.enqueue(
            &sender,
            SessionWorkerJob::ShellCommand {
                command: "second".to_string(),
            },
        );
        assert!(matches!(second.recv(), Ok(Err(message)) if message.contains("queue is full")));
    }
}
