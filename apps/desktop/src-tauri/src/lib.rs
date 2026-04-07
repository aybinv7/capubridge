mod commands;

use commands::adb::{
    adb_connect_device, adb_disconnect_device, adb_get_device_info, adb_list_devices,
    adb_list_webview_sockets, adb_pair_device, adb_reboot, adb_restart_server, adb_root,
    adb_shell_command, adb_tcpip,
};
use commands::cdp_proxy::{cdp_start_proxy, cdp_stop_proxy};
use commands::chrome::{chrome_fetch_targets, chrome_find, chrome_is_running, chrome_kill_all, chrome_launch, chrome_verify_port};
use commands::port_forward::{adb_fetch_json_targets, adb_forward_cdp, adb_remove_forward};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
            adb_list_webview_sockets,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
