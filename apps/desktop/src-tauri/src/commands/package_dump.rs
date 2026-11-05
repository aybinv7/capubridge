use crate::commands::package_times::earliest_real_time;

/// What `dumpsys package <pkg>` says about one app as seen by one Android user.
///
/// Package-level lines (version, SDK levels, installer, app id) are read from the first
/// `Package [...]` block only, so a hidden factory copy of an updated system app never
/// overrides the installed version. Per-user lines (`dataDir=`, `firstInstallTime=`) are read
/// from the `User <id>:` section of `user`.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct PackageDumpFacts {
    pub version_name: Option<String>,
    pub version_code: Option<String>,
    pub first_install_time: Option<String>,
    pub last_update_time: Option<String>,
    pub min_sdk_version: Option<u32>,
    pub target_sdk_version: Option<u32>,
    pub installer_package_name: Option<String>,
    pub data_dir: Option<String>,
    pub app_id: Option<u32>,
}

fn token_value(line: &str, key: &str) -> Option<String> {
    let start = line.find(key)? + key.len();
    let rest = &line[start..];
    let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
    let value = rest[..end].trim_matches(',').trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn user_header(trimmed: &str) -> Option<u32> {
    let rest = trimmed.strip_prefix("User ")?;
    let colon = rest.find(':')?;
    rest[..colon].trim().parse().ok()
}

fn indent_of(line: &str) -> usize {
    line.len() - line.trim_start().len()
}

fn first<T>(slot: &mut Option<T>, value: Option<T>) {
    if slot.is_none() {
        *slot = value;
    }
}

/// The private data folder of the app for `user`: Android prints user 0's path at the package
/// level on older versions, and other users keep the same layout under their own id.
pub(crate) fn data_dir_for_user(path: &str, package_name: &str, user: u32) -> String {
    if user == 0 {
        return path.to_string();
    }
    let user_dir = format!("/data/user/{user}/{package_name}");
    if path.starts_with("/data/user/0/") || path.starts_with("/data/data/") {
        user_dir
    } else {
        path.to_string()
    }
}

/// The app's shared-storage folder for `user` (`Android/data`, `Android/media`, `Android/obb`).
pub(crate) fn external_dir_for_user(kind: &str, package_name: &str, user: u32) -> String {
    if user == 0 {
        format!("/sdcard/Android/{kind}/{package_name}")
    } else {
        format!("/storage/emulated/{user}/Android/{kind}/{package_name}")
    }
}

/// Reads the facts of one app for `user` out of its `dumpsys package` output.
pub(crate) fn parse_package_dump(dump: &str, package_name: &str, user: u32) -> PackageDumpFacts {
    let mut facts = PackageDumpFacts::default();
    let mut packages_seen = 0usize;
    let mut section_user: Option<(u32, usize)> = None;
    let mut package_data_dir: Option<String> = None;
    let mut any_install_time: Option<String> = None;
    let mut user_install_time: Option<String> = None;

    for line in dump.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let indent = indent_of(line);
        if trimmed.starts_with("Package [") {
            packages_seen += 1;
            section_user = None;
            continue;
        }
        if packages_seen != 1 {
            continue;
        }
        if let Some(id) = user_header(trimmed) {
            section_user = Some((id, indent));
            continue;
        }
        if matches!(section_user, Some((_, header_indent)) if indent <= header_indent) {
            section_user = None;
        }

        if let Some(time) = trimmed.strip_prefix("firstInstallTime=") {
            any_install_time = earliest_real_time(any_install_time.take(), time);
            if matches!(section_user, Some((id, _)) if id == user) {
                user_install_time = earliest_real_time(user_install_time.take(), time);
            }
            continue;
        }
        if let Some(dir) = token_value(trimmed, "dataDir=") {
            match section_user {
                Some((id, _)) if id == user => facts.data_dir = Some(dir),
                Some(_) => {}
                None => first(&mut package_data_dir, Some(dir)),
            }
            continue;
        }
        if section_user.is_some() {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("versionName=") {
            first(&mut facts.version_name, Some(value.to_string()));
        } else if let Some(value) = trimmed.strip_prefix("lastUpdateTime=") {
            first(&mut facts.last_update_time, Some(value.to_string()));
        } else if let Some(value) = trimmed.strip_prefix("installerPackageName=") {
            first(&mut facts.installer_package_name, Some(value.to_string()));
        }
        first(&mut facts.version_code, token_value(trimmed, "versionCode="));
        first(
            &mut facts.min_sdk_version,
            token_value(trimmed, "minSdk=")
                .or_else(|| token_value(trimmed, "minSdkVersion="))
                .and_then(|value| value.parse().ok()),
        );
        first(
            &mut facts.target_sdk_version,
            token_value(trimmed, "targetSdk=")
                .or_else(|| token_value(trimmed, "targetSdkVersion="))
                .and_then(|value| value.parse().ok()),
        );
        if trimmed.starts_with("appId=") || trimmed.starts_with("userId=") {
            first(
                &mut facts.app_id,
                token_value(trimmed, "appId=")
                    .or_else(|| token_value(trimmed, "userId="))
                    .and_then(|value| value.parse().ok()),
            );
        }
    }

    facts.first_install_time = user_install_time.or(any_install_time);
    if facts.data_dir.is_none() {
        facts.data_dir = Some(data_dir_for_user(
            package_data_dir
                .as_deref()
                .unwrap_or(&format!("/data/data/{package_name}")),
            package_name,
            user,
        ));
    }
    facts
}

#[cfg(test)]
mod tests {
    use super::*;

    const ANDROID_16_TWO_USERS: &str = "\
Packages:
  Package [com.example.retail] (315461a):
    appId=10406
    versionCode=1 minSdk=24 targetSdk=36
    versionName=0.1.10
    lastUpdateTime=2026-10-06 01:39:15
    installerPackageName=null
    requested permissions:
      android.permission.CAMERA
    User 0: ceDataInode=445187 installed=true hidden=false stopped=false enabled=0
      installReason=0
      dataDir=/data/user/0/com.example.retail
      firstInstallTime=2026-10-06 01:39:15
      runtime permissions:
        android.permission.CAMERA: granted=true, flags=[ USER_SET]
    User 10: ceDataInode=0 installed=true hidden=false stopped=true enabled=0
      installReason=0
      dataDir=/data/user/10/com.example.retail
      firstInstallTime=2026-10-07 09:00:00
      runtime permissions:

Queries:
  queryable via interaction:
    User 0:
      com.example.retail
";

    const OLDER_ANDROID: &str = "\
Packages:
  Package [com.example.app] (abc):
    userId=10234
    versionCode=45 minSdk=23 targetSdk=34
    versionName=2.3.1
    dataDir=/data/user/0/com.example.app
    firstInstallTime=2024-01-02 10:00:00
    lastUpdateTime=2024-03-04 10:00:00
Hidden system packages:
  Package [com.example.app] (def):
    userId=10234
    versionCode=1 minSdk=23 targetSdk=30
    versionName=1.0-factory
";

    #[test]
    fn reads_the_current_users_section_only() {
        let owner = parse_package_dump(ANDROID_16_TWO_USERS, "com.example.retail", 0);
        assert_eq!(owner.data_dir.as_deref(), Some("/data/user/0/com.example.retail"));
        assert_eq!(owner.first_install_time.as_deref(), Some("2026-10-06 01:39:15"));

        let second = parse_package_dump(ANDROID_16_TWO_USERS, "com.example.retail", 10);
        assert_eq!(second.data_dir.as_deref(), Some("/data/user/10/com.example.retail"));
        assert_eq!(second.first_install_time.as_deref(), Some("2026-10-07 09:00:00"));
    }

    #[test]
    fn reads_package_level_facts_and_the_android_16_app_id() {
        let facts = parse_package_dump(ANDROID_16_TWO_USERS, "com.example.retail", 0);
        assert_eq!(facts.app_id, Some(10406));
        assert_eq!(facts.version_name.as_deref(), Some("0.1.10"));
        assert_eq!(facts.version_code.as_deref(), Some("1"));
        assert_eq!(facts.min_sdk_version, Some(24));
        assert_eq!(facts.target_sdk_version, Some(36));
    }

    #[test]
    fn hidden_factory_copy_never_overrides_the_installed_version() {
        let facts = parse_package_dump(OLDER_ANDROID, "com.example.app", 0);
        assert_eq!(facts.version_name.as_deref(), Some("2.3.1"));
        assert_eq!(facts.version_code.as_deref(), Some("45"));
        assert_eq!(facts.target_sdk_version, Some(34));
        assert_eq!(facts.app_id, Some(10234));
    }

    #[test]
    fn package_level_data_dir_moves_to_the_users_folder() {
        let facts = parse_package_dump(OLDER_ANDROID, "com.example.app", 10);
        assert_eq!(facts.data_dir.as_deref(), Some("/data/user/10/com.example.app"));
        let owner = parse_package_dump(OLDER_ANDROID, "com.example.app", 0);
        assert_eq!(owner.data_dir.as_deref(), Some("/data/user/0/com.example.app"));
    }

    #[test]
    fn missing_data_dir_falls_back_to_the_users_folder() {
        let facts = parse_package_dump("Packages:\n  Package [a.b] (1):\n    appId=10001\n", "a.b", 10);
        assert_eq!(facts.data_dir.as_deref(), Some("/data/user/10/a.b"));
    }

    #[test]
    fn external_folders_follow_the_user() {
        assert_eq!(external_dir_for_user("data", "a.b", 0), "/sdcard/Android/data/a.b");
        assert_eq!(
            external_dir_for_user("obb", "a.b", 10),
            "/storage/emulated/10/Android/obb/a.b"
        );
    }
}
