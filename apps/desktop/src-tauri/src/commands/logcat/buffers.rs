/// Logcat buffers a capture may ask for with `-b`.
const KNOWN_BUFFERS: [&str; 10] = [
    "main", "system", "crash", "events", "radio", "kernel", "security", "stats", "default", "all",
];

/// Validates a buffer selection and joins it for `-b`. An empty list means the
/// device default (`main,system,crash`). Unknown names are refused rather than
/// passed to the device shell.
pub(crate) fn normalize_buffers(buffers: &[String]) -> Result<Option<String>, String> {
    let mut names: Vec<&str> = Vec::new();
    for buffer in buffers {
        let name = buffer.trim();
        if name.is_empty() {
            continue;
        }
        if !KNOWN_BUFFERS.contains(&name) {
            return Err(format!("Unknown logcat buffer: {name}"));
        }
        if !names.contains(&name) {
            names.push(name);
        }
    }
    Ok((!names.is_empty()).then(|| names.join(",")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list(names: &[&str]) -> Vec<String> {
        names.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn joins_known_buffers_once_in_order() {
        assert_eq!(
            normalize_buffers(&list(&["main", " events ", "main"])),
            Ok(Some("main,events".to_string()))
        );
    }

    #[test]
    fn an_empty_selection_means_the_default() {
        assert_eq!(normalize_buffers(&list(&[])), Ok(None));
        assert_eq!(normalize_buffers(&list(&[" "])), Ok(None));
    }

    #[test]
    fn refuses_anything_that_is_not_a_buffer_name() {
        assert!(normalize_buffers(&list(&["main; reboot"])).is_err());
        assert!(normalize_buffers(&list(&["../x"])).is_err());
    }
}
