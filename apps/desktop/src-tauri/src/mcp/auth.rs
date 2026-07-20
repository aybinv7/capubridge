//! Localhost auth for the embedded MCP server.
//!
//! A fresh bearer token is generated per app launch. The token is published to
//! the discovery manifest (see [`super::discovery`]) so the user can paste it
//! into their MCP client config; every request to the server must present it.

use uuid::Uuid;

/// Generate a fresh 256-bit token rendered as 64 lowercase hex characters.
pub fn generate_token() -> String {
    let first = Uuid::new_v4().simple().to_string();
    let second = Uuid::new_v4().simple().to_string();
    format!("{first}{second}")
}

/// Extract the token from an `Authorization: Bearer <token>` header value.
pub fn parse_bearer(header: &str) -> Option<&str> {
    header.strip_prefix("Bearer ").map(str::trim)
}

/// Length-checked, constant-time-ish comparison of the presented token against
/// the expected one. Token length is fixed, so comparing lengths first leaks
/// nothing useful.
pub fn token_matches(expected: &str, presented: &str) -> bool {
    let expected = expected.as_bytes();
    let presented = presented.as_bytes();
    if expected.len() != presented.len() {
        return false;
    }
    let mut diff = 0u8;
    for (left, right) in expected.iter().zip(presented.iter()) {
        diff |= left ^ right;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_tokens_are_64_hex_chars_and_unique() {
        let first = generate_token();
        let second = generate_token();
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(first, second);
    }

    #[test]
    fn parse_bearer_extracts_token() {
        assert_eq!(parse_bearer("Bearer abc123"), Some("abc123"));
        assert_eq!(parse_bearer("Basic abc123"), None);
        assert_eq!(parse_bearer("abc123"), None);
    }

    #[test]
    fn token_matches_only_the_exact_token() {
        let token = generate_token();
        assert!(token_matches(&token, &token));
        assert!(!token_matches(&token, ""));
        assert!(!token_matches(&token, &format!("{token}x")));
        assert!(!token_matches(&token, &token.replace('a', "b")));
    }
}
