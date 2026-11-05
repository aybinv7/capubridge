use std::time::{Duration, Instant};

/// How long to wait before probing again on a device where no probe returned a value.
pub(super) const REPROBE_AFTER: Duration = Duration::from_secs(60);

/// CPU temperature probes in discovery order: `(source name, shell command)`.
pub(super) const PROBES: [(&str, &str); 5] = [
    (
        "thermal_zone_cpu",
        "for z in /sys/class/thermal/thermal_zone*/type; do t=$(cat \"$z\" 2>/dev/null | tr 'A-Z' 'a-z'); case \"$t\" in *cpu*|*soc*|*ap*|*tsens*|*little*|*big*) cat \"${z%/type}/temp\" 2>/dev/null; break;; esac; done",
    ),
    ("thermal_zone0", "cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null"),
    (
        "thermal_zone_any",
        "for z in /sys/class/thermal/thermal_zone*/temp; do cat \"$z\" 2>/dev/null && break; done",
    ),
    (
        "dumpsys_thermalservice",
        "dumpsys thermalservice 2>/dev/null | grep -m 1 -E 'cpu|soc|temperature' | grep -Eo '[0-9]+(\\.[0-9]+)?'",
    ),
    (
        "dumpsys_hardware_properties",
        "dumpsys hardware_properties 2>/dev/null | grep -m 1 -E 'CPU temperatures|cpu' | grep -Eo '[0-9]+(\\.[0-9]+)?'",
    ),
];

/// What the next tick should do about CPU temperature.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ProbePlan {
    /// Try every probe in order and keep the first that yields a value.
    Discover,
    /// Run only the probe that worked before, folded into the sampling shell.
    Known(usize),
    /// No probe worked recently; report no temperature this tick.
    Skip,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProbeState {
    Undiscovered,
    Found(usize),
    Missing { since: Instant },
}

/// Per-session memory of which temperature probe works on the device.
#[derive(Debug)]
pub(super) struct TempProbeCache {
    state: ProbeState,
}

impl Default for TempProbeCache {
    fn default() -> Self {
        Self {
            state: ProbeState::Undiscovered,
        }
    }
}

impl TempProbeCache {
    pub fn plan(&self, now: Instant) -> ProbePlan {
        match self.state {
            ProbeState::Undiscovered => ProbePlan::Discover,
            ProbeState::Found(index) => ProbePlan::Known(index),
            ProbeState::Missing { since }
                if now.saturating_duration_since(since) >= REPROBE_AFTER =>
            {
                ProbePlan::Discover
            }
            ProbeState::Missing { .. } => ProbePlan::Skip,
        }
    }

    /// Records the outcome of a tick run with `plan`. A known probe that stops
    /// answering triggers a fresh discovery on the next tick; a discovery that
    /// finds nothing parks probing for [`REPROBE_AFTER`].
    pub fn record(&mut self, plan: ProbePlan, working_probe: Option<usize>, now: Instant) {
        self.state = match (plan, working_probe) {
            (ProbePlan::Skip, _) => self.state,
            (_, Some(index)) => ProbeState::Found(index),
            (ProbePlan::Known(_), None) => ProbeState::Undiscovered,
            (ProbePlan::Discover, None) => ProbeState::Missing { since: now },
        };
    }
}

fn parse_numeric_tokens(text: &str) -> Vec<f32> {
    text.split(|c: char| c.is_whitespace() || matches!(c, ':' | ',' | ';' | '/'))
        .filter_map(|token| {
            let clean = token
                .trim()
                .trim_end_matches('%')
                .trim_matches(|c: char| !(c.is_ascii_digit() || c == '.'));
            if clean.is_empty() {
                return None;
            }
            clean.parse::<f32>().ok()
        })
        .collect()
}

fn normalize_temp_value(raw: f32) -> Option<f32> {
    if !raw.is_finite() || raw <= 0.0 {
        return None;
    }
    let mut value = raw;
    if value > 1000.0 {
        value /= 1000.0;
    } else if value > 200.0 {
        value /= 10.0;
    }
    (0.0..150.0).contains(&value).then_some(value)
}

/// Extracts the first plausible temperature in degrees Celsius from probe output.
pub(super) fn parse_probe_output(raw: &str) -> Option<f32> {
    parse_numeric_tokens(raw)
        .into_iter()
        .find_map(normalize_temp_value)
}

pub(super) fn probe_source(index: usize) -> Option<&'static str> {
    PROBES.get(index).map(|(source, _)| *source)
}

pub(super) fn probe_command(index: usize) -> Option<&'static str> {
    PROBES.get(index).map(|(_, command)| *command)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_tick_discovers_then_reuses_the_working_probe() {
        let now = Instant::now();
        let mut cache = TempProbeCache::default();
        assert_eq!(cache.plan(now), ProbePlan::Discover);
        cache.record(ProbePlan::Discover, Some(2), now);
        assert_eq!(
            cache.plan(now + Duration::from_secs(1)),
            ProbePlan::Known(2)
        );
        cache.record(ProbePlan::Known(2), Some(2), now + Duration::from_secs(1));
        assert_eq!(
            cache.plan(now + Duration::from_secs(2)),
            ProbePlan::Known(2)
        );
    }

    #[test]
    fn failed_discovery_parks_probing_for_the_reprobe_window() {
        let now = Instant::now();
        let mut cache = TempProbeCache::default();
        cache.record(ProbePlan::Discover, None, now);
        assert_eq!(cache.plan(now + Duration::from_secs(1)), ProbePlan::Skip);
        cache.record(ProbePlan::Skip, None, now + Duration::from_secs(1));
        assert_eq!(cache.plan(now + Duration::from_secs(59)), ProbePlan::Skip);
        assert_eq!(cache.plan(now + REPROBE_AFTER), ProbePlan::Discover);
    }

    #[test]
    fn a_known_probe_that_stops_answering_is_rediscovered() {
        let now = Instant::now();
        let mut cache = TempProbeCache::default();
        cache.record(ProbePlan::Discover, Some(0), now);
        cache.record(ProbePlan::Known(0), None, now);
        assert_eq!(cache.plan(now), ProbePlan::Discover);
    }

    #[test]
    fn probe_output_is_normalised_to_celsius() {
        assert_eq!(parse_probe_output("41000\n"), Some(41.0));
        assert_eq!(parse_probe_output("385"), Some(38.5));
        assert_eq!(
            parse_probe_output("Temperature{mValue=36.6, mType=0}"),
            Some(36.6)
        );
        assert_eq!(parse_probe_output(""), None);
        assert_eq!(parse_probe_output("0\n999999"), None);
    }

    #[test]
    fn probe_lookup_by_index() {
        assert_eq!(probe_source(0), Some("thermal_zone_cpu"));
        assert!(probe_command(4).is_some());
        assert_eq!(probe_source(PROBES.len()), None);
    }
}
