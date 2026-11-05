use axum::body::Bytes;
use base64::Engine;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};

/// A rule as the app sends it (snake_case fields from `mock_server_sync_rules`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockRuleRust {
    pub id: String,
    pub method: String,
    pub url_pattern: String,
    pub url_match_type: String,
    pub status_code: u16,
    #[serde(default)]
    pub content_type: String,
    pub response_headers: Vec<[String; 2]>,
    pub response_body: String,
    #[serde(default)]
    pub body_base64: bool,
    pub delay_ms: u64,
}

/// A rule ready to answer: its body decoded once and its regex compiled once per sync.
#[derive(Debug)]
pub struct CompiledRule {
    pub def: MockRuleRust,
    pub body: Bytes,
    regex: Option<Regex>,
    path_pattern: String,
}

/// The part of an absolute URL pattern after its origin, so a rule written for
/// `https://api.example.com/orders` also matches `/orders` sent to the local server.
fn path_part(pattern: &str) -> &str {
    let Some(scheme_end) = pattern.find("://") else {
        return pattern;
    };
    let rest = &pattern[scheme_end + 3..];
    match rest.find('/') {
        Some(slash) => &rest[slash..],
        None => "/",
    }
}

impl CompiledRule {
    pub fn compile(def: MockRuleRust) -> Self {
        let body = if def.body_base64 {
            base64::engine::general_purpose::STANDARD
                .decode(def.response_body.as_bytes())
                .map(Bytes::from)
                .unwrap_or_else(|_| Bytes::from(def.response_body.clone().into_bytes()))
        } else {
            Bytes::from(def.response_body.clone().into_bytes())
        };
        let regex = if def.url_match_type == "regex" {
            RegexBuilder::new(&def.url_pattern)
                .case_insensitive(true)
                .build()
                .ok()
        } else {
            None
        };
        let path_pattern = path_part(&def.url_pattern).to_string();
        Self {
            def,
            body,
            regex,
            path_pattern,
        }
    }

    /// Whether this rule answers a request. `path` is the path and query the server received,
    /// `absolute` the same request as a full URL with the Host header.
    pub fn matches(&self, method: &str, path: &str, absolute: &str) -> bool {
        let def = &self.def;
        if def.method != "ANY" && !def.method.eq_ignore_ascii_case(method) {
            return false;
        }
        if def.url_pattern.is_empty() {
            return true;
        }
        let pattern = def.url_pattern.as_str();
        let path_pattern = self.path_pattern.as_str();
        match def.url_match_type.as_str() {
            "exact" => absolute == pattern || path == path_pattern,
            "glob" => glob_match(pattern, absolute) || glob_match(path_pattern, path),
            "regex" => self
                .regex
                .as_ref()
                .is_some_and(|regex| regex.is_match(absolute) || regex.is_match(path)),
            _ => absolute.contains(pattern) || path.contains(path_pattern),
        }
    }
}

/// Case-insensitive wildcard match: `*` any run of characters, `?` one character.
pub fn glob_match(pattern: &str, text: &str) -> bool {
    let (pb, tb) = (pattern.as_bytes(), text.as_bytes());
    let (mut pi, mut ti) = (0usize, 0usize);
    let (mut star_pi, mut star_ti) = (usize::MAX, 0usize);

    while ti < tb.len() {
        if pi < pb.len()
            && (pb[pi] == b'?' || pb[pi].to_ascii_lowercase() == tb[ti].to_ascii_lowercase())
        {
            pi += 1;
            ti += 1;
        } else if pi < pb.len() && pb[pi] == b'*' {
            star_pi = pi;
            star_ti = ti;
            pi += 1;
        } else if star_pi != usize::MAX {
            pi = star_pi + 1;
            star_ti += 1;
            ti = star_ti;
        } else {
            return false;
        }
    }
    while pi < pb.len() && pb[pi] == b'*' {
        pi += 1;
    }
    pi == pb.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(pattern: &str, match_type: &str) -> MockRuleRust {
        MockRuleRust {
            id: "r".into(),
            method: "ANY".into(),
            url_pattern: pattern.into(),
            url_match_type: match_type.into(),
            status_code: 200,
            content_type: "application/json".into(),
            response_headers: vec![],
            response_body: "{}".into(),
            body_base64: false,
            delay_ms: 0,
        }
    }

    const ABSOLUTE: &str = "http://127.0.0.1:3001/api/orders?page=2";
    const PATH: &str = "/api/orders?page=2";

    #[test]
    fn an_absolute_pattern_from_mock_this_response_matches_the_local_path() {
        let exact = CompiledRule::compile(rule("https://shop.example/api/orders?page=2", "exact"));
        assert!(exact.matches("GET", PATH, ABSOLUTE));
        let contains = CompiledRule::compile(rule("https://shop.example/api/orders?", "contains"));
        assert!(contains.matches("GET", PATH, ABSOLUTE));
        let other = CompiledRule::compile(rule("https://shop.example/api/users", "exact"));
        assert!(!other.matches("GET", PATH, ABSOLUTE));
    }

    #[test]
    fn regex_is_a_real_case_insensitive_regex() {
        let regex = CompiledRule::compile(rule(r"/API/orders\?page=\d+$", "regex"));
        assert!(regex.matches("GET", PATH, ABSOLUTE));
        let broken = CompiledRule::compile(rule("(", "regex"));
        assert!(!broken.matches("GET", PATH, ABSOLUTE));
    }

    #[test]
    fn glob_and_method_filters_apply() {
        let glob = CompiledRule::compile(MockRuleRust {
            method: "POST".into(),
            ..rule("/api/*", "glob")
        });
        assert!(glob.matches("post", PATH, ABSOLUTE));
        assert!(!glob.matches("GET", PATH, ABSOLUTE));
    }

    #[test]
    fn an_empty_pattern_matches_every_address() {
        assert!(CompiledRule::compile(rule("", "exact")).matches("GET", "/x", "http://h/x"));
    }

    #[test]
    fn a_base64_body_is_decoded_once_and_text_stays_byte_for_byte() {
        let binary = CompiledRule::compile(MockRuleRust {
            response_body: "iVBORw==".into(),
            body_base64: true,
            ..rule("", "contains")
        });
        assert_eq!(binary.body.as_ref(), &[0x89, b'P', b'N', b'G']);
        let text = CompiledRule::compile(MockRuleRust {
            response_body: "{\"id\": 12345678901234567890, \"v\": 1.0}".into(),
            ..rule("", "contains")
        });
        assert_eq!(
            text.body.as_ref(),
            b"{\"id\": 12345678901234567890, \"v\": 1.0}"
        );
    }

    #[test]
    fn path_part_strips_scheme_and_host() {
        assert_eq!(path_part("https://h.example/a?b=1"), "/a?b=1");
        assert_eq!(path_part("https://h.example"), "/");
        assert_eq!(path_part("/plain"), "/plain");
    }
}
