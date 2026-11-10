//! Pages on This PC run in WebView2 webviews of their own browser environment: a separate user
//! data folder whose browser process alone opens a DevTools port. Capubridge's own windows never
//! open one. They can call every backend command, so a port on them would hand any local program
//! the phones and files; a port on the previews only reaches the page being inspected.

use std::net::{Ipv4Addr, SocketAddrV4, TcpListener};
use std::path::PathBuf;
use std::sync::OnceLock;

use tauri::{LogicalPosition, LogicalSize, Manager, WebviewUrl};

const PREVIEW_DATA_FOLDER: &str = "local-preview-webview2";
const WRY_DEFAULT_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";

static DEBUG_PORT: OnceLock<u16> = OnceLock::new();

/// The DevTools port of the preview environment, chosen once per run. Every preview shares one
/// environment, and WebView2 requires one set of browser arguments per user data folder.
pub(crate) fn preview_debug_port() -> Result<u16, String> {
    if let Some(port) = DEBUG_PORT.get() {
        return Ok(*port);
    }
    let port = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|error| format!("Could not reserve a DevTools port for local pages: {error}"))?;
    Ok(*DEBUG_PORT.get_or_init(|| port))
}

/// The port only once a preview opened it: before that, nothing listens on it.
pub(crate) fn opened_debug_port() -> Option<u16> {
    DEBUG_PORT.get().copied()
}

/// Loopback only, and no `--remote-allow-origins`: no web page may connect, only local programs
/// such as Capubridge's own CDP proxy, which sends no Origin header.
pub(crate) fn preview_browser_args(port: u16) -> String {
    format!(
        "{WRY_DEFAULT_ARGS} --remote-debugging-address=127.0.0.1 --remote-debugging-port={port}"
    )
}

fn preview_data_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(PREVIEW_DATA_FOLDER))
        .map_err(|error| format!("Could not find the folder for local pages: {error}"))
}

/// Creates the preview webview `label` showing `url`, parked at 1×1 in the main window until the
/// Screen column places it.
pub(crate) fn create_preview(
    app: &tauri::AppHandle,
    label: &str,
    url: tauri::Url,
) -> Result<(), String> {
    if app.get_webview(label).is_some() {
        return Ok(());
    }
    let window = app
        .get_window("main")
        .ok_or_else(|| "The main window is not open".to_string())?;
    let builder = tauri::webview::WebviewBuilder::new(label, WebviewUrl::External(url))
        .data_directory(preview_data_directory(app)?)
        .disable_drag_drop_handler()
        .focused(false);
    #[cfg(target_os = "windows")]
    let builder = builder.additional_browser_args(&preview_browser_args(preview_debug_port()?));
    window
        .add_child(
            builder,
            LogicalPosition::new(0.0, 0.0),
            LogicalSize::new(1.0, 1.0),
        )
        .map(|_| ())
        .map_err(|error| format!("Could not open the local page: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_port_is_loopback_only_and_refuses_web_origins() {
        let args = preview_browser_args(51234);
        assert!(args.contains("--remote-debugging-address=127.0.0.1"));
        assert!(args.contains("--remote-debugging-port=51234"));
        assert!(!args.contains("remote-allow-origins"));
        assert!(args.starts_with(WRY_DEFAULT_ARGS));
    }

    #[test]
    fn the_port_is_chosen_once_per_run() {
        let first = preview_debug_port().expect("port");
        assert_ne!(first, 0);
        assert_eq!(preview_debug_port().expect("port"), first);
        assert_eq!(opened_debug_port(), Some(first));
    }
}
