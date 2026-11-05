mod rules;

use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderName, HeaderValue, Method, Request, StatusCode},
    response::Response,
    Router,
};
use parking_lot::RwLock;
use std::{net::SocketAddr, sync::Arc, time};
use tauri::{AppHandle, Emitter, Manager};
use tower_http::cors::{Any, CorsLayer};

use rules::CompiledRule;
pub use rules::MockRuleRust;

type RuleSet = Arc<Vec<CompiledRule>>;

#[derive(Clone)]
struct AxumState {
    rules: Arc<RwLock<RuleSet>>,
    app: AppHandle,
}

pub struct MockServerManager {
    rules: Arc<RwLock<RuleSet>>,
    shutdown_tx: parking_lot::Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    pub port: parking_lot::Mutex<u16>,
}

impl MockServerManager {
    pub fn new() -> Self {
        Self {
            rules: Arc::new(RwLock::new(Arc::new(vec![]))),
            shutdown_tx: parking_lot::Mutex::new(None),
            port: parking_lot::Mutex::new(3001),
        }
    }

    pub fn is_running(&self) -> bool {
        self.shutdown_tx.lock().is_some()
    }
}

fn now_ms() -> u64 {
    time::SystemTime::now()
        .duration_since(time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn emit_request(
    state: &AxumState,
    rule_id: Option<&str>,
    method: &str,
    url: &str,
    status: u16,
    delay_ms: u64,
) {
    let _ = state.app.emit(
        "mock-server-request",
        serde_json::json!({
            "ruleId": rule_id,
            "method": method,
            "url": url,
            "statusCode": status,
            "delayMs": delay_ms,
            "timestamp": now_ms(),
        }),
    );
}

fn answer(rule: &CompiledRule) -> Response<Body> {
    let status = StatusCode::from_u16(rule.def.status_code).unwrap_or(StatusCode::OK);
    let mut builder = Response::builder().status(status);
    let mut has_content_type = false;
    for [name, value] in &rule.def.response_headers {
        if let (Ok(name), Ok(value)) = (name.parse::<HeaderName>(), value.parse::<HeaderValue>()) {
            has_content_type |= name == header::CONTENT_TYPE;
            builder = builder.header(name, value);
        }
    }
    if !has_content_type && !rule.def.content_type.is_empty() {
        if let Ok(value) = rule.def.content_type.parse::<HeaderValue>() {
            builder = builder.header(header::CONTENT_TYPE, value);
        }
    }
    builder
        .body(Body::from(rule.body.clone()))
        .unwrap_or_else(|_| {
            let mut fallback = Response::new(Body::empty());
            *fallback.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
            fallback
        })
}

async fn handle_any(State(state): State<Arc<AxumState>>, req: Request<Body>) -> Response<Body> {
    let method = req.method().clone();
    if method == Method::OPTIONS {
        let mut preflight = Response::new(Body::empty());
        *preflight.status_mut() = StatusCode::NO_CONTENT;
        return preflight;
    }

    let path = req
        .uri()
        .path_and_query()
        .map(|value| value.as_str().to_string())
        .unwrap_or_else(|| "/".into());
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("127.0.0.1");
    let absolute = format!("http://{host}{path}");

    let rules: RuleSet = state.rules.read().clone();
    let Some(rule) = rules
        .iter()
        .find(|rule| rule.matches(method.as_str(), &path, &absolute))
    else {
        emit_request(&state, None, method.as_str(), &absolute, 404, 0);
        let body = serde_json::json!({"error": "No mock rule matched", "method": method.as_str(), "url": path});
        let mut missing = Response::new(Body::from(body.to_string()));
        *missing.status_mut() = StatusCode::NOT_FOUND;
        missing.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
        return missing;
    };

    if rule.def.delay_ms > 0 {
        tokio::time::sleep(tokio::time::Duration::from_millis(rule.def.delay_ms)).await;
    }
    emit_request(
        &state,
        Some(&rule.def.id),
        method.as_str(),
        &absolute,
        rule.def.status_code,
        rule.def.delay_ms,
    );
    answer(rule)
}

#[tauri::command]
pub async fn mock_server_start(app: AppHandle, port: u16) -> Result<(), String> {
    let manager = app.state::<MockServerManager>();

    if manager.is_running() {
        return Err("Mock server is already running".into());
    }

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    let state = Arc::new(AxumState {
        rules: manager.rules.clone(),
        app: app.clone(),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let router = Router::new()
        .fallback(axum::routing::any(handle_any))
        .with_state(state)
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| format!("Failed to bind port {port}: {e}"))?;

    *manager.port.lock() = port;
    *manager.shutdown_tx.lock() = Some(shutdown_tx);

    tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();
    });

    Ok(())
}

#[tauri::command]
pub async fn mock_server_stop(app: AppHandle) -> Result<(), String> {
    let manager = app.state::<MockServerManager>();
    if let Some(tx) = manager.shutdown_tx.lock().take() {
        let _ = tx.send(());
    }
    Ok(())
}

#[tauri::command]
pub async fn mock_server_sync_rules(
    app: AppHandle,
    rules: Vec<MockRuleRust>,
) -> Result<(), String> {
    let manager = app.state::<MockServerManager>();
    let compiled: Vec<CompiledRule> = rules.into_iter().map(CompiledRule::compile).collect();
    *manager.rules.write() = Arc::new(compiled);
    Ok(())
}

#[tauri::command]
pub async fn mock_server_status(app: AppHandle) -> serde_json::Value {
    let manager = app.state::<MockServerManager>();
    serde_json::json!({
        "running": manager.is_running(),
        "port": *manager.port.lock(),
    })
}
