use std::collections::HashMap;
use std::time::Instant;

use super::battery::{parse_battery, BatteryCache};
use super::parse::{
    cpu_metrics, net_bps, parse_meminfo, parse_net_dev, parse_proc_stat, CpuTick, NetBytes,
    PerfMetrics, SampleSections,
};
use super::temperature::{probe_source, ProbePlan, TempProbeCache};

/// What one tick asks the device for, decided before the shell runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct TickRequest {
    pub temp: ProbePlan,
    pub battery: bool,
}

/// Raw device output of one tick. `temp` carries the reading and the index of
/// the probe that produced it.
#[derive(Debug, Default)]
pub(super) struct TickSample {
    pub sections: SampleSections,
    pub temp: Option<(f32, usize)>,
}

struct Baseline {
    cpu: HashMap<String, CpuTick>,
    net: NetBytes,
    at: Instant,
}

/// Turns successive tick samples into [`PerfMetrics`], keeping the CPU/network
/// baseline, the battery reading and the temperature probe choice between ticks.
#[derive(Default)]
pub(super) struct PerfSampler {
    baseline: Option<Baseline>,
    temp_probe: TempProbeCache,
    battery: BatteryCache,
}

impl PerfSampler {
    pub fn request(&self, now: Instant) -> TickRequest {
        TickRequest {
            temp: self.temp_probe.plan(now),
            battery: self.battery.is_due(now),
        }
    }

    /// Folds one sample into the running state. The first sample only sets the
    /// CPU and network baseline and yields no metrics.
    pub fn ingest(
        &mut self,
        request: TickRequest,
        sample: TickSample,
        now: Instant,
        timestamp: u64,
    ) -> Option<PerfMetrics> {
        let TickSample { sections, temp } = sample;
        self.temp_probe
            .record(request.temp, temp.map(|(_, index)| index), now);
        let fresh_battery = request
            .battery
            .then(|| sections.battery.as_deref().map(parse_battery))
            .flatten();
        let battery = self.battery.resolve(fresh_battery, now);

        let cpu = parse_proc_stat(sections.stat.as_deref().unwrap_or_default());
        let net = parse_net_dev(sections.net_dev.as_deref().unwrap_or_default());
        let memory = parse_meminfo(sections.meminfo.as_deref().unwrap_or_default());

        let previous = self.baseline.replace(Baseline { cpu, net, at: now })?;
        let current = self.baseline.as_ref()?;

        let (cpu_cores, cpu_total) = cpu_metrics(&previous.cpu, &current.cpu);
        let elapsed = now.saturating_duration_since(previous.at).as_secs_f64();
        let network = net_bps(&previous.net, &current.net, elapsed);

        Some(PerfMetrics {
            cpu_cores,
            cpu_total,
            memory,
            network,
            battery,
            cpu_temp: temp.map(|(value, _)| value),
            cpu_temp_source: temp
                .and_then(|(_, index)| probe_source(index))
                .map(str::to_string),
            timestamp,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn sample(
        stat: &str,
        net_rx: u64,
        battery: Option<&str>,
        temp: Option<(f32, usize)>,
    ) -> TickSample {
        TickSample {
            sections: SampleSections {
                stat: Some(stat.to_string()),
                meminfo: Some("MemTotal: 1000 kB\nMemAvailable: 250 kB\n".to_string()),
                net_dev: Some(format!("wlan0: {net_rx} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n")),
                temp: None,
                battery: battery.map(str::to_string),
            },
            temp,
        }
    }

    #[test]
    fn first_sample_is_baseline_then_metrics_flow() {
        let start = Instant::now();
        let mut sampler = PerfSampler::default();

        let first = sampler.request(start);
        assert_eq!(
            first,
            TickRequest {
                temp: ProbePlan::Discover,
                battery: true
            }
        );
        let none = sampler.ingest(
            first,
            sample(
                "cpu 10 0 10 80 0 0 0\n",
                1_000,
                Some("  level: 90\n"),
                Some((40.0, 1)),
            ),
            start,
            1,
        );
        assert!(none.is_none());

        let next_at = start + Duration::from_secs(1);
        let second = sampler.request(next_at);
        assert_eq!(
            second,
            TickRequest {
                temp: ProbePlan::Known(1),
                battery: false
            }
        );
        let metrics = sampler
            .ingest(
                second,
                sample("cpu 20 0 20 160 0 0 0\n", 3_000, None, Some((41.0, 1))),
                next_at,
                2,
            )
            .expect("second sample yields metrics");
        assert_eq!(metrics.battery.level, Some(90));
        assert!((metrics.cpu_total - 20.0).abs() < 0.01);
        assert_eq!(metrics.network.rx_bps, 2_000.0);
        assert_eq!(metrics.memory.used_kb, 750);
        assert_eq!(metrics.cpu_temp, Some(41.0));
        assert_eq!(metrics.cpu_temp_source.as_deref(), Some("thermal_zone0"));
        assert_eq!(metrics.timestamp, 2);
    }

    #[test]
    fn battery_is_ignored_when_not_requested() {
        let start = Instant::now();
        let mut sampler = PerfSampler::default();
        let request = TickRequest {
            temp: ProbePlan::Skip,
            battery: false,
        };
        sampler.ingest(
            request,
            sample("cpu 1 0 1 8 0 0 0\n", 0, Some("  level: 5\n"), None),
            start,
            0,
        );
        let metrics = sampler
            .ingest(
                request,
                sample("cpu 2 0 2 16 0 0 0\n", 0, None, None),
                start + Duration::from_secs(1),
                1,
            )
            .expect("metrics");
        assert_eq!(metrics.battery.level, None);
        assert_eq!(metrics.cpu_temp, None);
        assert_eq!(metrics.cpu_temp_source, None);
    }
}
