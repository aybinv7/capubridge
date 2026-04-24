mod adb_runtime;
mod commands;
mod session;

use commands::adb::{
    adb_cancel_list_packages, adb_connect_device, adb_disconnect_device, adb_get_app_icon,
    adb_get_device_info, adb_get_package_details, adb_list_devices, adb_list_packages,
    adb_list_reverse, adb_list_webview_sockets, adb_open_package, adb_pair_device, adb_reboot,
    adb_remove_reverse, adb_restart_server, adb_reverse, adb_root, adb_shell_command,
    adb_start_server, adb_tcpip, start_logcat, stop_logcat,
};
use commands::cdp_proxy::{cdp_start_proxy, cdp_stop_proxy};
use commands::chrome::{
    chrome_activate_target, chrome_fetch_targets, chrome_find, chrome_is_running, chrome_kill_all,
    chrome_launch, chrome_open_devtools_url, chrome_open_target, chrome_verify_port,
};
use commands::files::{adb_delete_file, adb_list_dir, adb_open_file, adb_pull_file};
use commands::mirror::{
    adb_mirror_get_clipboard, adb_mirror_get_screen_size, adb_mirror_inject_keycode,
    adb_mirror_inject_text, adb_mirror_keyevent, adb_mirror_launch_scrcpy,
    adb_mirror_scrcpy_start, adb_mirror_scrcpy_stop, adb_mirror_screenshot,
    adb_mirror_scroll_event, adb_mirror_set_clipboard, adb_mirror_start_recording,
    adb_mirror_stop_recording, adb_mirror_stop_scrcpy, adb_mirror_swipe, adb_mirror_tap,
    adb_mirror_touch_event,
};
use commands::perf::{adb_perf_start, adb_perf_stop};
use commands::port_forward::{adb_fetch_json_targets, adb_forward_cdp, adb_remove_forward};
use commands::sqlite::{
    sqlite_close_database, sqlite_execute_query, sqlite_list_databases, sqlite_open_database,
    sqlite_refresh_database, sqlite_scan_all_databases, sqlite_table_columns,
    sqlite_table_foreign_keys, sqlite_table_indexes, sqlite_table_rows,
};
use session::{
    cache_store::SessionCacheStore,
    session_attach_console_target, session_detach_console_target, session_start_logcat_lease,
    session_start_mirror_lease, session_start_perf_lease, session_stop_logcat_lease,
    session_stop_mirror_lease, session_stop_perf_lease,
    session_cancel_list_packages, session_get_device_info, session_get_registry_state,
    session_list_devices, session_list_packages, session_list_reverse,
    session_list_targets, session_list_webview_sockets, session_open_package,
    session_reboot, session_refresh_devices, session_refresh_packages, session_refresh_targets,
    session_remove_reverse, session_reverse, session_root, session_set_active_device,
    session_shell_command, session_tcpip, start_device_tracker, SessionRegistryState,
};

/// Suppress Windows error dialogs (RunDLL, GPF, critical-error) for this
/// process and every child process it spawns. Must be called before any
/// `Command::new(...)` so that adb / Chrome / scrcpy never trigger popups.
#[cfg(target_os = "windows")]
fn suppress_error_dialogs() {
    extern "system" {
        fn SetErrorMode(mode: u32) -> u32;
    }
    const SEM_FAILCRITICALERRORS: u32 = 0x0001;
    const SEM_NOGPFAULTERRORBOX: u32 = 0x0002;
    const SEM_NOOPENFILEERRORBOX: u32 = 0x8000;
    unsafe {
        SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    suppress_error_dialogs();

    let session_registry = SessionRegistryState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(session_registry.clone())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .level_for("adb_client", log::LevelFilter::Off)
                        .build(),
                )?;
            }

            if let Ok(cache_store) = SessionCacheStore::new(app.handle()) {
                if let Err(error) = session_registry
                    .registry()
                    .configure_cache_store(cache_store)
                {
                    log::warn!("[session-cache] Failed to restore cache: {error}");
                }
            }

            match adb_runtime::ensure_adb_runtime(&app.handle()) {
                Ok(status) => log::info!("[adb_runtime] startup status={status}"),
                Err(error) => log::warn!("[adb_runtime] startup failed: {error}"),
            }

            start_device_tracker(app.handle().clone(), session_registry.registry());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session_list_devices,
            session_get_registry_state,
            session_refresh_devices,
            session_set_active_device,
            session_get_device_info,
            session_shell_command,
            session_tcpip,
            session_reboot,
            session_root,
            session_list_packages,
            session_refresh_packages,
            session_cancel_list_packages,
            session_open_package,
            session_reverse,
            session_remove_reverse,
            session_list_reverse,
            session_list_webview_sockets,
            session_list_targets,
            session_refresh_targets,
            session_start_logcat_lease,
            session_stop_logcat_lease,
            session_start_perf_lease,
            session_stop_perf_lease,
            session_start_mirror_lease,
            session_stop_mirror_lease,
            session_attach_console_target,
            session_detach_console_target,
            adb_start_server,
            adb_list_devices,
            adb_get_device_info,
            adb_shell_command,
            adb_connect_device,
            adb_disconnect_device,
            adb_pair_device,
            adb_tcpip,
            adb_reboot,
            adb_root,
            adb_restart_server,
            adb_list_packages,
            adb_cancel_list_packages,
            adb_get_package_details,
            adb_open_package,
            adb_get_app_icon,
            adb_list_webview_sockets,
            adb_reverse,
            adb_remove_reverse,
            adb_list_reverse,
            start_logcat,
            stop_logcat,
            adb_forward_cdp,
            adb_remove_forward,
            adb_fetch_json_targets,
            cdp_start_proxy,
            cdp_stop_proxy,
            chrome_find,
            chrome_is_running,
            chrome_kill_all,
            chrome_launch,
            chrome_verify_port,
            chrome_fetch_targets,
            chrome_open_devtools_url,
            chrome_open_target,
            chrome_activate_target,
            adb_mirror_scrcpy_start,
            adb_mirror_scrcpy_stop,
            adb_mirror_launch_scrcpy,
            adb_mirror_stop_scrcpy,
            adb_mirror_screenshot,
            adb_mirror_get_screen_size,
            adb_mirror_keyevent,
            adb_mirror_inject_keycode,
            adb_mirror_inject_text,
            adb_mirror_scroll_event,
            adb_mirror_set_clipboard,
            adb_mirror_get_clipboard,
            adb_mirror_touch_event,
            adb_mirror_tap,
            adb_mirror_swipe,
            adb_mirror_start_recording,
            adb_mirror_stop_recording,
            adb_perf_start,
            adb_perf_stop,
            adb_list_dir,
            adb_pull_file,
            adb_open_file,
            adb_delete_file,
            sqlite_list_databases,
            sqlite_scan_all_databases,
            sqlite_open_database,
            sqlite_refresh_database,
            sqlite_close_database,
            sqlite_table_columns,
            sqlite_table_indexes,
            sqlite_table_foreign_keys,
            sqlite_table_rows,
            sqlite_execute_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
