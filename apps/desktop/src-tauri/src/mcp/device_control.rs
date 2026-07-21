//! Pure builders for the `adb shell` commands behind the device-control MCP
//! tools (tap/swipe/input_text/press_key). Kept separate from `tools.rs` so
//! the shell-quoting — the one security-critical piece here, since
//! `input_text` embeds arbitrary user-supplied text into a shell command
//! string sent to the device — is isolated and directly testable.

/// Quote `value` as a single POSIX shell argument: wrap in single quotes,
/// escaping any embedded single quote as `'\''`. This is what stands between
/// `input_text`'s free-text argument and shell-command injection on the
/// device — a text containing `'; reboot; '` must land as inert text typed
/// into the focused field, not as a second shell command.
pub fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

pub fn tap_command(x: u32, y: u32) -> String {
    format!("input tap {x} {y}")
}

pub fn swipe_command(x1: u32, y1: u32, x2: u32, y2: u32, duration_ms: u32) -> String {
    format!("input swipe {x1} {y1} {x2} {y2} {duration_ms}")
}

pub fn input_text_command(text: &str) -> String {
    format!("input text {}", shell_quote(text))
}

pub fn keyevent_command(keycode: u32) -> String {
    format!("input keyevent {keycode}")
}

/// Validate that `(x, y)` falls within a `width`×`height` screen.
///
/// `adb shell input tap`/`swipe` silently do nothing when given an
/// out-of-bounds coordinate — no error, no signal, the command just exits 0.
/// That's indistinguishable from "the coordinate was valid but nothing was
/// there to hit" unless we catch the out-of-bounds case ourselves first and
/// turn it into a loud, actionable error instead of a silent no-op.
pub fn validate_point(x: u32, y: u32, width: u32, height: u32) -> Result<(), String> {
    if x >= width || y >= height {
        return Err(format!(
            "Tap/swipe coordinate ({x}, {y}) is outside the {width}x{height} screen bounds. \
             Call get_screen_size again and double-check you didn't swap width/height or use a \
             stale size — an out-of-bounds tap is silently dropped by the device with no error."
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_quote_wraps_plain_text_in_single_quotes() {
        assert_eq!(shell_quote("hello world"), "'hello world'");
    }

    #[test]
    fn shell_quote_escapes_embedded_single_quotes() {
        assert_eq!(shell_quote("it's"), r"'it'\''s'");
    }

    #[test]
    fn shell_quote_neutralizes_command_injection_attempts() {
        let malicious = "'; reboot; echo '";
        let quoted = shell_quote(malicious);
        // The whole thing must be a single quoted literal — no unescaped `'`
        // boundary that would let a shell interpreter see `;` as a separator
        // outside of quotes.
        assert!(quoted.starts_with('\''));
        assert!(quoted.ends_with('\''));
        // Every quote character in the input became an escaped-quote sequence.
        assert_eq!(quoted.matches("'\\''").count(), malicious.matches('\'').count());
    }

    #[test]
    fn tap_command_places_coordinates_in_order() {
        assert_eq!(tap_command(100, 200), "input tap 100 200");
    }

    #[test]
    fn swipe_command_includes_duration() {
        assert_eq!(swipe_command(0, 0, 100, 100, 300), "input swipe 0 0 100 100 300");
    }

    #[test]
    fn input_text_command_quotes_the_text() {
        assert_eq!(input_text_command("hello world"), "input text 'hello world'");
    }

    #[test]
    fn keyevent_command_uses_the_numeric_code() {
        assert_eq!(keyevent_command(4), "input keyevent 4");
    }

    #[test]
    fn validate_point_accepts_in_bounds_coordinates() {
        assert!(validate_point(0, 0, 1080, 2400).is_ok());
        assert!(validate_point(1079, 2399, 1080, 2400).is_ok(), "max valid coordinate");
    }

    #[test]
    fn validate_point_rejects_coordinates_at_or_past_the_edge() {
        assert!(validate_point(1080, 0, 1080, 2400).is_err(), "x == width is out of bounds");
        assert!(validate_point(0, 2400, 1080, 2400).is_err(), "y == height is out of bounds");
        assert!(validate_point(5000, 5000, 1080, 2400).is_err());
    }

    #[test]
    fn validate_point_error_names_the_actual_bounds() {
        let error = validate_point(2000, 100, 1080, 2400).unwrap_err();
        assert!(error.contains("2000"));
        assert!(error.contains("1080x2400"));
    }
}
