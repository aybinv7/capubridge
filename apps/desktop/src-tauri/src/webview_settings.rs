use tauri::{Runtime, Webview};

/// Turns off WebView2's built-in browser shortcuts (Ctrl+J downloads, Ctrl+F find, Ctrl+P print,
/// F5 reload…) so the app's own key bindings receive them and browser UI never appears.
#[cfg(windows)]
pub fn disable_browser_shortcuts<R: Runtime>(webview: &Webview<R>) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;

    let result = webview.with_webview(|platform| unsafe {
        let Ok(core) = platform.controller().CoreWebView2() else {
            log::warn!("[webview] CoreWebView2 unavailable; browser shortcuts stay on");
            return;
        };
        let Ok(settings) = core.Settings() else {
            log::warn!("[webview] WebView2 settings unavailable; browser shortcuts stay on");
            return;
        };
        match settings.cast::<ICoreWebView2Settings3>() {
            Ok(settings) => {
                if let Err(error) = settings.SetAreBrowserAcceleratorKeysEnabled(false) {
                    log::warn!("[webview] Could not turn off browser shortcuts: {error}");
                }
            }
            Err(error) => {
                log::warn!("[webview] WebView2 runtime too old for shortcut control: {error}")
            }
        }
    });
    if let Err(error) = result {
        log::warn!("[webview] Could not reach the webview: {error}");
    }
}

/// Other platforms have no browser shortcuts to turn off.
#[cfg(not(windows))]
pub fn disable_browser_shortcuts<R: Runtime>(_webview: &Webview<R>) {}
