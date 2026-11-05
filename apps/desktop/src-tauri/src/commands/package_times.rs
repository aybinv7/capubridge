/// `dumpsys package` prints one `firstInstallTime=` per user, and users the app was never
/// installed for carry the epoch. Keeps the earliest real time seen so far.
pub(crate) fn earliest_real_time(current: Option<String>, candidate: &str) -> Option<String> {
    let candidate = candidate.trim();
    if candidate.is_empty() || candidate.starts_with("1970-01-01") {
        return current;
    }
    match current {
        Some(existing) if existing.as_str() <= candidate => Some(existing),
        _ => Some(candidate.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::earliest_real_time;

    #[test]
    fn epoch_entries_of_other_users_are_ignored() {
        let first = earliest_real_time(None, "2026-03-07 01:41:39");
        let second = earliest_real_time(first, "1970-01-01 00:00:00");
        assert_eq!(second.as_deref(), Some("2026-03-07 01:41:39"));
    }

    #[test]
    fn the_earliest_real_install_wins() {
        let first = earliest_real_time(None, "2026-05-01 10:00:00");
        let second = earliest_real_time(first, "2026-03-07 01:41:39");
        assert_eq!(second.as_deref(), Some("2026-03-07 01:41:39"));
        assert_eq!(earliest_real_time(None, "1970-01-01 00:00:00"), None);
    }
}
