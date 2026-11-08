use qrcodegen::{QrCode, QrCodeEcc};
use serde::Serialize;
use std::fmt;

const SERVICE_PREFIX: &str = "studio-";
const SERVICE_TOKEN_LEN: usize = 10;
const PASSWORD_LEN: usize = 12;
const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/// The largest multiple of the alphabet size that fits in a byte; bytes at or above it are
/// rejected so every character is equally likely.
const UNBIASED_LIMIT: u8 = (256 / ALPHABET.len() * ALPHABET.len()) as u8;

/// The service name and password of one QR pairing session. The password exists only in
/// memory for that session: it is never serialized, logged or persisted, and `Debug` hides it.
pub(crate) struct PairingSecret {
    service_name: String,
    password: String,
}

impl PairingSecret {
    /// Draws a fresh `studio-<random>` name and a random password from the OS CSPRNG.
    pub(crate) fn generate() -> Result<Self, String> {
        Ok(Self {
            service_name: format!("{SERVICE_PREFIX}{}", random_token(SERVICE_TOKEN_LEN)?),
            password: random_token(PASSWORD_LEN)?,
        })
    }

    pub(crate) fn service_name(&self) -> &str {
        &self.service_name
    }

    pub(crate) fn password(&self) -> &str {
        &self.password
    }

    /// The Wi-Fi style payload Android's "Pair device with QR code" scanner reads.
    pub(crate) fn qr_payload(&self) -> String {
        format!(
            "WIFI:T:ADB;S:{};P:{};;",
            escape_wifi_field(&self.service_name),
            escape_wifi_field(&self.password)
        )
    }
}

impl fmt::Debug for PairingSecret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("PairingSecret")
            .field("service_name", &self.service_name)
            .field("password", &"<redacted>")
            .finish()
    }
}

fn random_token(len: usize) -> Result<String, String> {
    let mut token = String::with_capacity(len);
    let mut buffer = [0u8; 32];
    while token.len() < len {
        getrandom::fill(&mut buffer).map_err(|e| format!("Secure random source failed: {e}"))?;
        for byte in buffer {
            if token.len() == len {
                break;
            }
            if byte < UNBIASED_LIMIT {
                token.push(ALPHABET[usize::from(byte) % ALPHABET.len()] as char);
            }
        }
    }
    Ok(token)
}

/// Escapes the characters the `WIFI:` QR format reserves (`\ ; , : "`).
pub(crate) fn escape_wifi_field(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        if matches!(ch, '\\' | ';' | ',' | ':' | '"') {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

/// A QR code as one SVG path over a `size` × `size` module grid, without the quiet zone.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrMatrix {
    pub size: u32,
    pub path: String,
}

/// Encodes the payload locally (no network) and draws each row's dark runs as rectangles.
pub(crate) fn encode_qr(payload: &str) -> Result<QrMatrix, String> {
    let code = QrCode::encode_text(payload, QrCodeEcc::Medium)
        .map_err(|_| "The pairing code is too long for a QR code".to_string())?;
    let size = code.size();
    let mut path = String::new();
    for y in 0..size {
        let mut x = 0;
        while x < size {
            if !code.get_module(x, y) {
                x += 1;
                continue;
            }
            let start = x;
            while x < size && code.get_module(x, y) {
                x += 1;
            }
            path.push_str(&format!("M{start} {y}h{}v1h-{}z", x - start, x - start));
        }
    }
    Ok(QrMatrix {
        size: u32::try_from(size).map_err(|e| e.to_string())?,
        path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secret(name: &str, password: &str) -> PairingSecret {
        PairingSecret {
            service_name: name.to_string(),
            password: password.to_string(),
        }
    }

    #[test]
    fn payload_matches_the_android_studio_format() {
        assert_eq!(
            secret("studio-AbC123xyZ0", "p4ssW0rd1234").qr_payload(),
            "WIFI:T:ADB;S:studio-AbC123xyZ0;P:p4ssW0rd1234;;"
        );
    }

    #[test]
    fn reserved_characters_are_escaped() {
        assert_eq!(escape_wifi_field(r#"a;b,c:d\e"f"#), r#"a\;b\,c\:d\\e\"f"#);
        assert_eq!(
            secret("studio-x", "a;b").qr_payload(),
            "WIFI:T:ADB;S:studio-x;P:a\\;b;;"
        );
    }

    #[test]
    fn generated_secrets_are_alphanumeric_and_fresh() {
        let first = PairingSecret::generate().unwrap_or_else(|e| panic!("{e}"));
        let second = PairingSecret::generate().unwrap_or_else(|e| panic!("{e}"));
        assert!(first.service_name().starts_with(SERVICE_PREFIX));
        assert_eq!(
            first.service_name().len(),
            SERVICE_PREFIX.len() + SERVICE_TOKEN_LEN
        );
        assert_eq!(first.password().len(), PASSWORD_LEN);
        assert!(first.password().bytes().all(|b| b.is_ascii_alphanumeric()));
        assert_ne!(first.password(), second.password());
        assert_ne!(first.service_name(), second.service_name());
    }

    #[test]
    fn debug_output_hides_the_password() {
        let debug = format!("{:?}", secret("studio-x", "topsecret123"));
        assert!(debug.contains("studio-x"));
        assert!(!debug.contains("topsecret123"));
    }

    #[test]
    fn qr_matrix_is_a_square_path() {
        let matrix = encode_qr("WIFI:T:ADB;S:studio-AbC123xyZ0;P:p4ssW0rd1234;;")
            .unwrap_or_else(|e| panic!("{e}"));
        assert!(matrix.size >= 21);
        assert_eq!((matrix.size - 17) % 4, 0);
        assert!(matrix.path.starts_with("M0 0h7v1h-7z"));
    }
}
