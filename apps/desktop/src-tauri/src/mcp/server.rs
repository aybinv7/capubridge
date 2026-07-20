//! Embedded Streamable-HTTP MCP server on localhost.
//!
//! Binds an ephemeral `127.0.0.1` port, mounts the rmcp `StreamableHttpService`
//! at `/mcp`, and wraps it in a bearer-token auth layer. rmcp's own config
//! rejects non-loopback `Host` headers (DNS-rebinding protection); the auth
//! layer additionally requires the per-launch token.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::{header::AUTHORIZATION, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

use super::auth;
use super::tools::CapuBridgeTools;
use crate::session::registry::SessionRegistry;

/// A running MCP server: its bound port, the bearer token clients must present,
/// and the handles needed to shut it down.
pub struct RunningServer {
    pub port: u16,
    pub token: String,
    cancel: CancellationToken,
    handle: JoinHandle<()>,
}

impl RunningServer {
    /// Gracefully stop the server: cancel active sessions, then join the task.
    pub async fn shutdown(self) {
        self.cancel.cancel();
        let _ = self.handle.await;
    }
}

/// Bearer-token gate. Requests without a valid `Authorization: Bearer <token>`
/// header get a 401 before reaching the MCP service.
async fn require_bearer(State(token): State<Arc<str>>, request: Request, next: Next) -> Response {
    let authorized = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(auth::parse_bearer)
        .map(|presented| auth::token_matches(&token, presented))
        .unwrap_or(false);

    if authorized {
        next.run(request).await
    } else {
        (StatusCode::UNAUTHORIZED, "unauthorized").into_response()
    }
}

/// Start the MCP server bound to an ephemeral localhost port.
pub async fn start(registry: Arc<SessionRegistry>) -> Result<RunningServer, String> {
    let token = auth::generate_token();

    // Default config already restricts Host to loopback; keep stateful mode for
    // client reconnection support.
    let config = StreamableHttpServerConfig::default().with_stateful_mode(true);
    let cancel = config.cancellation_token.clone();

    let factory_registry = registry.clone();
    let service = StreamableHttpService::new(
        move || Ok(CapuBridgeTools::new(factory_registry.clone())),
        Arc::new(LocalSessionManager::default()),
        config,
    );

    let token_state: Arc<str> = Arc::from(token.as_str());
    let router = axum::Router::new().nest_service("/mcp", service).layer(
        axum::middleware::from_fn_with_state(token_state, require_bearer),
    );

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(|error| format!("Failed to bind MCP port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Failed to read MCP local address: {error}"))?
        .port();

    let shutdown = cancel.clone();
    let handle = tokio::spawn(async move {
        let server = axum::serve(listener, router)
            .with_graceful_shutdown(async move { shutdown.cancelled().await });
        if let Err(error) = server.await {
            log::error!("[mcp] server error: {error}");
        }
    });

    log::info!("[mcp] listening on http://127.0.0.1:{port}/mcp");
    Ok(RunningServer {
        port,
        token,
        cancel,
        handle,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::registry::SessionRegistry;

    #[tokio::test]
    async fn server_binds_and_enforces_bearer_token() {
        let running = start(Arc::new(SessionRegistry::new()))
            .await
            .expect("server should start");
        let url = format!("http://127.0.0.1:{}/mcp", running.port);
        let client = reqwest::Client::new();

        let no_token = client.get(&url).send().await.expect("request sends");
        assert_eq!(
            no_token.status(),
            reqwest::StatusCode::UNAUTHORIZED,
            "missing token must be rejected"
        );

        let wrong_token = client
            .get(&url)
            .bearer_auth("not-the-token")
            .send()
            .await
            .expect("request sends");
        assert_eq!(
            wrong_token.status(),
            reqwest::StatusCode::UNAUTHORIZED,
            "wrong token must be rejected"
        );

        // Correct token clears the auth gate and reaches the MCP service, so the
        // response is anything other than 401.
        let authed = client
            .get(&url)
            .bearer_auth(&running.token)
            .send()
            .await
            .expect("request sends");
        assert_ne!(
            authed.status(),
            reqwest::StatusCode::UNAUTHORIZED,
            "valid token must reach the MCP service"
        );

        running.shutdown().await;
    }
}
