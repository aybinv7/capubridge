mod adb_host;
mod discovery;
mod mdns_services;
mod native_mdns;
mod pairing_machine;
mod pairing_session;
mod qr_payload;
mod wifi_address;

use crate::blocking::run_blocking;

pub use discovery::WirelessDiscovery;
pub use pairing_session::{
    wireless_pairing_cancel, wireless_pairing_start, wireless_pairing_with_code,
};
pub use wifi_address::adb_wifi_address;

/// Lists the adb services visible on the network (phones waiting to pair, paired phones ready
/// to connect), through the adb server's mDNS or the native browser when adb's is off.
#[tauri::command]
pub async fn wireless_discover() -> Result<WirelessDiscovery, String> {
    run_blocking(discovery::snapshot).await
}

/// Stops discovery when nothing needs it, shutting the native browser down if it runs.
#[tauri::command]
pub async fn wireless_discover_stop() -> Result<(), String> {
    run_blocking(discovery::stop).await
}
