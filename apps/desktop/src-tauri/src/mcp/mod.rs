//! Embedded Model Context Protocol (MCP) server.
//!
//! Exposes CapuBridge's session/device capabilities to MCP clients over a
//! localhost Streamable-HTTP endpoint, calling the same `SessionRegistry`
//! methods the Tauri commands use. Off by default; toggled from Settings via
//! [`commands::mcp_set_enabled`].

pub mod auth;
pub mod capture;
pub mod cdp;
pub mod commands;
pub mod config;
pub mod discovery;
pub mod server;
pub mod tools;
pub mod types;

use parking_lot::Mutex;

use server::RunningServer;

/// Tauri-managed state holding the running server, if any.
#[derive(Default)]
pub struct McpServerState {
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    running: Option<RunningServer>,
}

impl McpServerState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_running(&self) -> bool {
        self.inner.lock().running.is_some()
    }

    pub fn port(&self) -> Option<u16> {
        self.inner
            .lock()
            .running
            .as_ref()
            .map(|running| running.port)
    }

    pub fn set_running(&self, running: RunningServer) {
        self.inner.lock().running = Some(running);
    }

    /// Take the running server out so the caller can `.shutdown().await` it
    /// without holding the lock across the await.
    pub fn take_running(&self) -> Option<RunningServer> {
        self.inner.lock().running.take()
    }
}
