mod commands;

// On Windows, suppress RunDLL error dialogs caused by third-party DLL injection
// tools (e.g. monitoring/hooking software) that fail to initialize inside
// console child processes like adb.exe. Calling SetErrorMode at startup
// propagates the flag to all child processes spawned by this process.
#[cfg(target_os = "windows")]
fn suppress_error_dialogs() {
    extern "system" {
        fn SetErrorMode(u_mode: u32) -> u32;
    }
    const SEM_FAILCRITICALERRORS: u32 = 0x0001;
    const SEM_NOGPFAULTERRORBOX: u32 = 0x0002;
    const SEM_NOOPENFILEERRORBOX: u32 = 0x8000;
    unsafe {
        SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
    }
}

use commands::adb::{
    adb_cancel_list_packages,
    adb_connect_device, adb_disconnect_device, adb_get_app_icon, adb_get_device_info,
    adb_get_package_details, adb_list_devices, adb_list_packages, adb_list_webview_sockets,
    adb_open_package, adb_pair_device, adb_reboot, adb_restart_server, adb_root,
    adb_shell_command, adb_tcpip,
    adb_reverse, adb_remove_reverse, adb_list_reverse,
};
use commands::files::{adb_delete_file, adb_list_dir, adb_open_file, adb_pull_file};
use commands::cdp_proxy::{cdp_start_proxy, cdp_stop_proxy};
use commands::chrome::{chrome_fetch_targets, chrome_find, chrome_is_running, chrome_kill_all, chrome_launch, chrome_verify_port};
use commands::mirror::{
    adb_mirror_get_screen_size, adb_mirror_keyevent, adb_mirror_launch_scrcpy,
    adb_mirror_scrcpy_start, adb_mirror_scrcpy_stop, adb_mirror_screenshot,
    adb_mirror_start_recording, adb_mirror_stop_recording, adb_mirror_touch_event,
    adb_mirror_stop_scrcpy, adb_mirror_swipe, adb_mirror_tap,
};
use commands::perf::{adb_perf_start, adb_perf_stop};
use commands::port_forward::{adb_fetch_json_targets, adb_forward_cdp, adb_remove_forward};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    suppress_error_dialogs();

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
            adb_list_packages,
            adb_cancel_list_packages,
            adb_get_package_details,
            adb_open_package,
            adb_get_app_icon,
            adb_list_webview_sockets,
            adb_reverse,
            adb_remove_reverse,
            adb_list_reverse,
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
            adb_mirror_scrcpy_start,
            adb_mirror_scrcpy_stop,
            adb_mirror_launch_scrcpy,
            adb_mirror_stop_scrcpy,
            adb_mirror_screenshot,
            adb_mirror_get_screen_size,
            adb_mirror_keyevent,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
