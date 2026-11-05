use std::time::{Duration, Instant};

use super::parse::BatteryMetric;

/// How long a parsed `dumpsys battery` reading is reused before it is read again.
pub(super) const BATTERY_REFRESH: Duration = Duration::from_secs(10);

pub(super) fn parse_battery(text: &str) -> BatteryMetric {
    let mut level = None;
    let mut temperature = None;
    let mut status = None;
    let mut plugged = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("level: ") {
            level = val.trim().parse::<u32>().ok().filter(|v| *v <= 100);
        } else if let Some(val) = trimmed.strip_prefix("temperature: ") {
            temperature = val.trim().parse::<f32>().ok().map(|raw| raw / 10.0);
        } else if let Some(val) = trimmed.strip_prefix("status: ") {
            status = val.trim().parse::<u32>().ok();
        } else if let Some(val) = trimmed.strip_prefix("plugged: ") {
            plugged = val.trim().parse::<u32>().ok();
        }
    }
    let charging = match (status, plugged) {
        (Some(2), _) => Some(true),
        (Some(3 | 4), _) => Some(false),
        (_, Some(p)) => Some(p != 0),
        _ => None,
    };
    BatteryMetric {
        level,
        temperature,
        charging,
    }
}

/// Keeps the last battery reading so `dumpsys battery` runs once per
/// [`BATTERY_REFRESH`] instead of on every perf tick.
#[derive(Debug, Default)]
pub(super) struct BatteryCache {
    last: BatteryMetric,
    read_at: Option<Instant>,
}

impl BatteryCache {
    /// True when no reading exists yet or the last one is older than the refresh window.
    pub fn is_due(&self, now: Instant) -> bool {
        self.read_at.map_or(true, |read_at| {
            now.saturating_duration_since(read_at) >= BATTERY_REFRESH
        })
    }

    /// Stores a fresh reading when one was taken this tick and returns the reading to emit.
    pub fn resolve(&mut self, fresh: Option<BatteryMetric>, now: Instant) -> BatteryMetric {
        if let Some(reading) = fresh {
            self.last = reading;
            self.read_at = Some(now);
        }
        self.last.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn charging_comes_from_status_or_plug() {
        let charging =
            parse_battery("  level: 57\n  status: 2\n  plugged: 2\n  temperature: 301\n");
        assert_eq!(charging.level, Some(57));
        assert_eq!(charging.charging, Some(true));
        assert_eq!(charging.temperature, Some(30.1));

        let full = parse_battery("  level: 100\n  status: 5\n  plugged: 1\n");
        assert_eq!(full.charging, Some(true));

        let unplugged = parse_battery("  level: 40\n  status: 3\n  plugged: 0\n");
        assert_eq!(unplugged.charging, Some(false));
    }

    #[test]
    fn missing_fields_stay_unknown() {
        let empty = parse_battery("Current Battery Service state:\n");
        assert_eq!(empty.level, None);
        assert_eq!(empty.charging, None);
        assert_eq!(empty.temperature, None);
    }

    #[test]
    fn battery_is_read_first_then_every_refresh_window() {
        let start = Instant::now();
        let mut cache = BatteryCache::default();
        assert!(cache.is_due(start));

        let reading = parse_battery("  level: 80\n  status: 2\n");
        assert_eq!(cache.resolve(Some(reading.clone()), start), reading);

        assert!(!cache.is_due(start + Duration::from_secs(1)));
        assert!(!cache.is_due(start + Duration::from_millis(9_999)));
        assert_eq!(cache.resolve(None, start + Duration::from_secs(5)), reading);

        assert!(cache.is_due(start + BATTERY_REFRESH));
        let next = parse_battery("  level: 79\n  status: 2\n");
        cache.resolve(Some(next.clone()), start + BATTERY_REFRESH);
        assert!(!cache.is_due(start + BATTERY_REFRESH + Duration::from_secs(3)));
        assert_eq!(cache.resolve(None, start + Duration::from_secs(13)), next);
    }
}
