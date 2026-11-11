mod adb_runtime;
pub mod automation;
mod blocking;
mod commands;
mod error;
mod mcp;
mod session;
mod webview_settings;

use automation::store::{AutomationStore, AutomationStoreState};
use commands::adb::{
    adb_cancel_list_packages, adb_connect_device, adb_disconnect_device, adb_get_app_icon,
    adb_get_device_info, adb_get_package_details, adb_list_devices, adb_list_packages,
    adb_list_reverse, adb_list_webview_sockets, adb_open_package, adb_pair_device, adb_reboot,
    adb_remove_reverse, adb_restart_server, adb_reverse, adb_root, adb_shell_command,
    adb_start_server, adb_tcpip,
};
use commands::automation::{
    automation_event_append, automation_events_read, automation_task_upsert, automation_tasks_list,
    jev_decide, recording_read_attachment, recording_session_attach,
};
use commands::cdp_proxy::{cdp_start_proxy, cdp_stop_proxy};
use commands::debuggable::adb_list_debuggable_packages;
use commands::chrome::{
    chrome_activate_target, chrome_fetch_targets, chrome_find, chrome_is_running, chrome_kill_all,
    chrome_launch, chrome_open_devtools_url, chrome_open_target, chrome_verify_port,
};
use commands::emulator::{emulator_launch_avd, emulator_list_avds, emulator_stop_avd};
use commands::file_bytes::adb_read_file_bytes;
use commands::host_file_stream::{
    host_file_stream_append, host_file_stream_begin, host_file_stream_discard,
    host_file_stream_finish, read_local_file_bytes,
};
use commands::files::{
    adb_delete_file, adb_list_dir, adb_open_file, adb_open_file_picker, adb_pull_file,
    adb_read_file, read_local_file_base64, save_base64_file, show_in_folder,
};
use commands::local_webview::{
    local_devtools_create, local_devtools_port, local_device_name, local_webview_create,
    local_webview_fetch_cdp_target,
    local_webview_inject_scrollbar_hide, local_webview_navigate, local_webview_open_devtools,
    local_webview_set_bounds,
};
use commands::mirror::{
    adb_mirror_get_clipboard, adb_mirror_get_screen_size, adb_mirror_inject_keycode,
    adb_mirror_inject_text, adb_mirror_keyevent, adb_mirror_launch_scrcpy, adb_mirror_scrcpy_start,
    adb_mirror_scrcpy_stop, adb_mirror_screenshot, adb_mirror_scroll_event,
    adb_mirror_set_clipboard, adb_mirror_set_stream_size, adb_mirror_start_recording, adb_mirror_stop_recording,
    adb_mirror_stop_scrcpy, adb_mirror_swipe, adb_mirror_tap, adb_mirror_touch_event,
};
use commands::mock_server::{
    mock_server_start, mock_server_status, mock_server_stop, mock_server_sync_rules,
    MockServerManager,
};
use commands::opfs_pull::{opfs_cancel_save, opfs_pull_sqlite, opfs_save_file, opfs_stat_file};
use commands::perf::{adb_perf_start, adb_perf_stop};
use commands::port_forward::{adb_fetch_json_targets, adb_forward_cdp, adb_remove_forward};
use commands::reasoning::{
    reasoning_provider_complete, reasoning_provider_delete_credential,
    reasoning_provider_get_credential_status, reasoning_provider_set_credential,
};
use commands::recording::{
    recording_cleanup_orphans, recording_delete_session, recording_list_sessions,
    recording_read_session, recording_session_append, recording_session_start,
    recording_session_stop,
};
use commands::recording_db::{
    recording_database_change_summaries, recording_database_change_summary,
    recording_database_changed_rows, recording_database_changes_for_keys,
    recording_database_snapshot_begin, recording_database_snapshot_finish,
    recording_database_snapshot_page, recording_database_sources, recording_database_table_rows,
};
use commands::recording_export::{recording_export_preview, recording_export_session};
use commands::wireless::{
    adb_disconnect_serial, adb_wifi_address, wireless_discover, wireless_discover_stop, wireless_pairing_cancel,
    wireless_pairing_start, wireless_pairing_with_code,
};
use commands::sqlite::{
    sqlite_close_database, sqlite_execute_query, sqlite_execute_write, sqlite_export_bytes,
    sqlite_list_databases, sqlite_open_database, sqlite_overwrite_local_bytes,
    sqlite_refresh_database, sqlite_save_local_bytes, sqlite_scan_all_databases,
    sqlite_stat_database, sqlite_table_columns, sqlite_table_foreign_keys, sqlite_table_indexes,
    sqlite_table_rows,
};
use commands::sqlite_changeset::sqlite_apply_changeset;
use commands::sqlite_dump::{sqlite_export_dump, sqlite_import_dump};
use commands::sqlite_facts::sqlite_database_facts;
use commands::sqlite_opened::{
    sqlite_close_opened_file, sqlite_open_local_file, sqlite_save_opened_file,
    sqlite_save_opened_file_as,
};
use commands::target_probe::cdp_probe_target;
use commands::updater::{updater_check, updater_install, PendingUpdate};
use mcp::commands::{
    mcp_create_principal, mcp_get_status, mcp_list_principals, mcp_regenerate_token,
    mcp_revoke_principal, mcp_set_allow_mutations, mcp_set_enabled, mcp_set_port,
};
use mcp::McpServerState;
use session::{
    cache_store::SessionCacheStore, session_attach_console_target, session_cancel_list_packages,
    session_detach_console_target, session_forget_device, session_get_device_info,
    session_get_registry_state, session_list_devices, session_list_packages, session_list_reverse,
    session_list_targets, session_list_webview_sockets, session_open_package, session_reboot,
    session_refresh_devices, session_refresh_packages, session_refresh_targets,
    session_remove_reverse, session_reverse, session_root, session_set_active_device,
    session_shell_command, session_start_logcat_lease, session_start_mirror_lease,
    session_start_perf_lease, session_stop_logcat_lease, session_stop_mirror_lease,
    session_stop_perf_lease, session_tcpip, start_device_tracker, SessionRegistryState,
};
use tauri::Manager;

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

/// Name of the developer environment file loaded at startup. Only the
/// gitignored `.env.local` is read: a plain `.env` is tracked by git here, so
/// loading it would invite a real API key into a committable file.
const LOCAL_ENV_FILE: &str = ".env.local";

/// Loads `.env.local`, searching the working directory and its parents, so
/// values like `CAPUBRIDGE_JEV_ENDPOINT` and `CAPUBRIDGE_JEV_API_KEY` can live
/// beside the app instead of being exported in every shell. A variable already
/// present in the process environment is never overwritten, so a shell export
/// still wins. A missing file is the normal case and stays quiet; anything else
/// is surfaced, because a silently ignored malformed file looks exactly like a
/// key that was never configured.
fn load_local_env() {
    match dotenvy::from_filename(LOCAL_ENV_FILE) {
        Ok(path) => log::info!("loaded environment from {}", path.display()),
        Err(error) if error.not_found() => {}
        Err(error) => log::warn!("could not read {LOCAL_ENV_FILE}: {error}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_local_env();

    #[cfg(target_os = "windows")]
    suppress_error_dialogs();

    let session_registry = SessionRegistryState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(session_registry.clone())
        .manage(MockServerManager::new())
        .manage(McpServerState::new())
        .manage(mcp::bridge::FrontendBridge::new())
        .manage(PendingUpdate::default())
        .plugin(tauri_plugin_shell::init())
        .on_page_load(|webview, _payload| webview_settings::disable_browser_shortcuts(webview))
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

            match AutomationStore::new(app.handle()) {
                Ok(store) => {
                    app.manage(AutomationStoreState(store));
                }
                Err(error) => log::warn!("[automation-store] Failed to initialize: {error}"),
            }

            match adb_runtime::ensure_adb_runtime(&app.handle()) {
                Ok(status) => log::info!("[adb_runtime] startup status={status}"),
                Err(error) => log::warn!("[adb_runtime] startup failed: {error}"),
            }

            start_device_tracker(app.handle().clone(), session_registry.registry());

            // Auto-start the MCP server if the user left it enabled; otherwise
            // clear any stale discovery manifest from a previous run.
            {
                let app_handle = app.handle().clone();
                let registry = session_registry.registry();
                tauri::async_runtime::spawn(async move {
                    let cfg = match mcp::config::load(&app_handle) {
                        Ok(cfg) => cfg,
                        Err(error) => {
                            log::warn!("[mcp] failed to load config: {error}");
                            return;
                        }
                    };
                    if cfg.enabled && cfg.has_token() {
                        let sessions_dir = match commands::recording::sessions_dir(&app_handle) {
                            Ok(dir) => dir,
                            Err(error) => {
                                log::warn!("[mcp] failed to resolve sessions dir: {error}");
                                return;
                            }
                        };
                        match mcp::server::start(
                            registry,
                            cfg.port,
                            sessions_dir,
                            Some(app_handle.clone()),
                            cfg.allow_mutations,
                            match mcp::auth::PrincipalRegistry::load(
                                &app_handle,
                                Some(&cfg.token),
                                cfg.allow_mutations,
                            ) {
                                Ok(principals) => principals,
                                Err(error) => {
                                    log::warn!("[mcp] failed to load principals: {error}");
                                    return;
                                }
                            },
                        )
                        .await
                        {
                            Ok(running) => {
                                let port = running.port;
                                app_handle.state::<McpServerState>().set_running(running);
                                if let Err(error) =
                                    mcp::discovery::write_manifest(&app_handle, port)
                                {
                                    log::warn!("[mcp] manifest write failed: {error}");
                                }
                                log::info!("[mcp] auto-started on launch (port {port})");
                            }
                            Err(error) => log::warn!("[mcp] auto-start failed: {error}"),
                        }
                    } else if let Err(error) = mcp::discovery::remove_manifest(&app_handle) {
                        log::warn!("[mcp] failed to clear stale discovery manifest: {error}");
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            session_list_devices,
            session_get_registry_state,
            session_refresh_devices,
            session_set_active_device,
            session_forget_device,
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
            adb_wifi_address,
            adb_disconnect_serial,
            wireless_discover,
            wireless_discover_stop,
            wireless_pairing_start,
            wireless_pairing_with_code,
            wireless_pairing_cancel,
            adb_reboot,
            adb_root,
            adb_restart_server,
            adb_list_packages,
            adb_cancel_list_packages,
            adb_get_package_details,
            adb_open_package,
            adb_get_app_icon,
            adb_list_webview_sockets,
            adb_list_debuggable_packages,
            adb_reverse,
            adb_remove_reverse,
            adb_list_reverse,
            adb_forward_cdp,
            adb_remove_forward,
            adb_fetch_json_targets,
            cdp_start_proxy,
            cdp_stop_proxy,
            cdp_probe_target,
            chrome_find,
            chrome_is_running,
            chrome_kill_all,
            chrome_launch,
            chrome_verify_port,
            chrome_fetch_targets,
            chrome_open_devtools_url,
            chrome_open_target,
            chrome_activate_target,
            emulator_list_avds,
            emulator_launch_avd,
            emulator_stop_avd,
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
            adb_mirror_set_stream_size,
            adb_mirror_tap,
            adb_mirror_swipe,
            adb_mirror_start_recording,
            adb_mirror_stop_recording,
            adb_perf_start,
            adb_perf_stop,
            adb_list_dir,
            adb_pull_file,
            adb_read_file,
            adb_read_file_bytes,
            adb_open_file,
            adb_open_file_picker,
            adb_delete_file,
            show_in_folder,
            save_base64_file,
            read_local_file_base64,
            read_local_file_bytes,
            host_file_stream_begin,
            host_file_stream_append,
            host_file_stream_finish,
            host_file_stream_discard,
            sqlite_list_databases,
            sqlite_scan_all_databases,
            sqlite_stat_database,
            sqlite_open_database,
            sqlite_refresh_database,
            sqlite_close_database,
            sqlite_save_local_bytes,
            sqlite_overwrite_local_bytes,
            opfs_pull_sqlite,
            opfs_save_file,
            opfs_cancel_save,
            opfs_stat_file,
            sqlite_table_columns,
            sqlite_table_indexes,
            sqlite_table_foreign_keys,
            sqlite_table_rows,
            sqlite_database_facts,
            sqlite_execute_query,
            sqlite_execute_write,
            sqlite_export_bytes,
            sqlite_export_dump,
            sqlite_import_dump,
            sqlite_apply_changeset,
            sqlite_open_local_file,
            sqlite_save_opened_file,
            sqlite_save_opened_file_as,
            sqlite_close_opened_file,
            mock_server_start,
            mock_server_stop,
            mock_server_sync_rules,
            mock_server_status,
            recording_session_start,
            recording_session_append,
            recording_session_attach,
            recording_session_stop,
            recording_list_sessions,
            recording_delete_session,
            recording_read_session,
            recording_read_attachment,
            recording_cleanup_orphans,
            recording_export_preview,
            recording_export_session,
            recording_database_snapshot_begin,
            recording_database_snapshot_page,
            recording_database_snapshot_finish,
            recording_database_sources,
            recording_database_table_rows,
            recording_database_changed_rows,
            recording_database_change_summaries,
            recording_database_change_summary,
            recording_database_changes_for_keys,
            local_device_name,
            local_webview_open_devtools,
            local_webview_fetch_cdp_target,
            local_webview_create,
            local_devtools_create,
            local_devtools_port,
            local_webview_inject_scrollbar_hide,
            local_webview_navigate,
            local_webview_set_bounds,
            updater_check,
            updater_install,
            mcp_get_status,
            mcp_set_enabled,
            mcp_set_port,
            mcp_set_allow_mutations,
            mcp_regenerate_token,
            mcp_list_principals,
            mcp_create_principal,
            mcp_revoke_principal,
            mcp::bridge::mcp_bridge_respond,
            jev_decide,
            reasoning_provider_set_credential,
            reasoning_provider_get_credential_status,
            reasoning_provider_delete_credential,
            reasoning_provider_complete,
            automation_task_upsert,
            automation_event_append,
            automation_events_read,
            automation_tasks_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
