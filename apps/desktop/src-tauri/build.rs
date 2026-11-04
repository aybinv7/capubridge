const WINDOWS_MANIFEST: &str = "windows-app-manifest.xml";

fn targets_windows_msvc() -> bool {
    std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
}

/// Embeds the Common-Controls v6 manifest through the linker so every target gets it,
/// test executables included. Without it `cargo test` dies with STATUS_ENTRYPOINT_NOT_FOUND.
fn embed_windows_manifest() {
    let manifest = std::env::current_dir()
        .expect("build script needs a working directory")
        .join(WINDOWS_MANIFEST);
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    println!("cargo:rustc-link-arg=/WX");
}

fn main() {
    let mut attributes = tauri_build::Attributes::new();
    if targets_windows_msvc() {
        embed_windows_manifest();
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    }
    tauri_build::try_build(attributes).expect("tauri-build failed");
}
