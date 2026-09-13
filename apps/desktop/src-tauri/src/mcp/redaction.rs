use serde_json::{Map, Value};

const REDACTED: &str = "[REDACTED]";

pub fn redact_value(value: &mut Value) {
    match value {
        Value::Array(values) => values.iter_mut().for_each(redact_value),
        Value::Object(values) => redact_object(values),
        Value::String(text) => *text = redact_text(text),
        _ => {}
    }
}

pub fn redact_text(text: &str) -> String {
    if let Ok(mut value) = serde_json::from_str::<Value>(text) {
        redact_value(&mut value);
        return serde_json::to_string(&value).unwrap_or_else(|_| REDACTED.to_string());
    }

    redact_query_values(&redact_assignment_values(text))
}

fn redact_object(values: &mut Map<String, Value>) {
    for (key, value) in values.iter_mut() {
        let normalized = normalize_key(key);
        if is_sensitive_key(&normalized) {
            *value = Value::String(REDACTED.to_string());
            continue;
        }
        if normalized.ends_with("headers") {
            redact_headers(value);
            continue;
        }
        redact_value(value);
    }
}

fn redact_headers(value: &mut Value) {
    let Value::Object(headers) = value else {
        redact_value(value);
        return;
    };
    for (header, header_value) in headers {
        if is_sensitive_key(&normalize_key(header)) {
            *header_value = Value::String(REDACTED.to_string());
        } else {
            redact_value(header_value);
        }
    }
}

fn normalize_key(key: &str) -> String {
    key.bytes()
        .filter(u8::is_ascii_alphanumeric)
        .map(char::from)
        .flat_map(char::to_lowercase)
        .collect()
}

fn is_sensitive_key(key: &str) -> bool {
    matches!(
        key,
        "authorization"
            | "proxyauthorization"
            | "cookie"
            | "setcookie"
            | "password"
            | "passwd"
            | "secret"
            | "clientsecret"
            | "apikey"
            | "xapikey"
            | "xauthtoken"
            | "xcsrftoken"
            | "token"
            | "accesstoken"
            | "refreshtoken"
            | "idtoken"
    ) || key.ends_with("token")
        || key.ends_with("secret")
        || key.ends_with("password")
}

fn redact_assignment_values(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut output = String::with_capacity(text.len());
    let mut cursor = 0;
    while cursor < bytes.len() {
        let Some((key_start, key_end)) = next_key(bytes, cursor) else {
            output.push_str(&text[cursor..]);
            break;
        };
        output.push_str(&text[cursor..key_start]);
        output.push_str(&text[key_start..key_end]);
        let mut separator = key_end;
        while separator < bytes.len() && bytes[separator].is_ascii_whitespace() {
            separator += 1;
        }
        if separator == bytes.len() || !matches!(bytes[separator], b':' | b'=') {
            cursor = key_end;
            continue;
        }
        output.push_str(&text[key_end..=separator]);
        let mut value_start = separator + 1;
        while value_start < bytes.len() && bytes[value_start].is_ascii_whitespace() {
            value_start += 1;
        }
        output.push_str(&text[separator + 1..value_start]);
        let value_end = value_end(bytes, value_start);
        output.push_str(REDACTED);
        cursor = value_end;
    }
    output
}

fn next_key(bytes: &[u8], cursor: usize) -> Option<(usize, usize)> {
    let mut start = cursor;
    while start < bytes.len() {
        if bytes[start].is_ascii_alphanumeric() || bytes[start] == b'_' || bytes[start] == b'-' {
            let mut end = start + 1;
            while end < bytes.len()
                && (bytes[end].is_ascii_alphanumeric() || bytes[end] == b'_' || bytes[end] == b'-')
            {
                end += 1;
            }
            if is_sensitive_key(&normalize_key(std::str::from_utf8(&bytes[start..end]).ok()?)) {
                return Some((start, end));
            }
            start = end;
        } else {
            start += 1;
        }
    }
    None
}

fn value_end(bytes: &[u8], start: usize) -> usize {
    if start >= bytes.len() {
        return start;
    }
    let quote = bytes[start];
    if matches!(quote, b'\'' | b'"') {
        let mut end = start + 1;
        while end < bytes.len() {
            if bytes[end] == quote && bytes.get(end.saturating_sub(1)) != Some(&b'\\') {
                return end + 1;
            }
            end += 1;
        }
        return end;
    }
    let mut end = start;
    while end < bytes.len() && !matches!(bytes[end], b'&' | b',' | b';' | b'}' | b']' | b' ' | b'\n' | b'\r') {
        end += 1;
    }
    end
}

fn redact_query_values(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut output = String::with_capacity(text.len());
    let mut cursor = 0;
    while cursor < bytes.len() {
        let Some(relative) = text[cursor..].find(['?', '&']) else {
            output.push_str(&text[cursor..]);
            break;
        };
        let marker = cursor + relative;
        output.push_str(&text[cursor..=marker]);
        let key_start = marker + 1;
        let key_end = text[key_start..]
            .find(['=', '&', '#', ' ', '"', '\''])
            .map(|end| key_start + end)
            .unwrap_or(bytes.len());
        if key_end < bytes.len()
            && bytes[key_end] == b'='
            && is_sensitive_key(&normalize_key(&text[key_start..key_end]))
        {
            output.push_str(&text[key_start..=key_end]);
            let value_start = key_end + 1;
            let value_end = text[value_start..]
                .find(['&', '#', ' ', '"', '\''])
                .map(|end| value_start + end)
                .unwrap_or(bytes.len());
            output.push_str(REDACTED);
            cursor = value_end;
        } else {
            cursor = key_start;
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_nested_json_credentials() {
        let mut value = serde_json::json!({
            "bridge": { "accessToken": "fixture-secret", "profile": "safe" },
            "requestHeaders": { "Authorization": "Bearer fixture-secret" }
        });
        redact_value(&mut value);
        assert!(!value.to_string().contains("fixture-secret"));
        assert_eq!(value.pointer("/bridge/profile"), Some(&Value::String("safe".to_string())));
    }

    #[test]
    fn redacts_plain_console_and_url_credentials() {
        let value = redact_text("bridge token=fixture-secret https://test/?access_token=fixture-secret&mode=debug");
        assert!(!value.contains("fixture-secret"));
        assert!(value.contains("mode=debug"));
    }
}
