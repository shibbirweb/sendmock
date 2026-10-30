use super::{DeliverySample, DeliverySummary, FailureCodeCount, count_top_failure_codes};

const ENDPOINT_FAILURE_CODE_LIMIT: usize = 3;

/// An endpoint the metrics report on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MeteredEndpoint {
    pub endpoint_id: String,
    pub endpoint_name: String,
}

/// How one endpoint's deliveries went.
#[derive(Debug, Clone, PartialEq)]
pub struct EndpointHealth {
    pub endpoint: MeteredEndpoint,
    pub summary: DeliverySummary,
    pub top_failure_codes: Vec<FailureCodeCount>,
}

/// One entry per endpoint, in the order given, even for endpoints with no deliveries.
pub fn summarize_endpoint_health(
    metered_endpoints: Vec<MeteredEndpoint>,
    samples: &[&DeliverySample],
) -> Vec<EndpointHealth> {
    metered_endpoints
        .into_iter()
        .map(|endpoint| {
            let endpoint_samples: Vec<&DeliverySample> = samples
                .iter()
                .copied()
                .filter(|sample| sample.endpoint_id == endpoint.endpoint_id)
                .collect();
            EndpointHealth {
                summary: DeliverySummary::summarize(&endpoint_samples),
                top_failure_codes: count_top_failure_codes(
                    &endpoint_samples,
                    ENDPOINT_FAILURE_CODE_LIMIT,
                ),
                endpoint,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::delivery_sample::tests::sample_with_status;
    use super::*;

    fn metered_endpoint(endpoint_id: &str) -> MeteredEndpoint {
        MeteredEndpoint {
            endpoint_id: endpoint_id.to_owned(),
            endpoint_name: format!("Endpoint {endpoint_id}"),
        }
    }

    #[test]
    fn each_endpoint_counts_only_its_own_deliveries() {
        let mut other_endpoint_sample = sample_with_status("d2", "failed");
        other_endpoint_sample.endpoint_id = "endpoint-2".to_owned();
        let own_sample = sample_with_status("d1", "succeeded");

        let endpoint_health = summarize_endpoint_health(
            vec![
                metered_endpoint("endpoint-1"),
                metered_endpoint("endpoint-3"),
            ],
            &[&own_sample, &other_endpoint_sample],
        );

        assert_eq!(endpoint_health.len(), 2);
        assert_eq!(endpoint_health[0].summary.delivery_count, 1);
        assert_eq!(endpoint_health[0].summary.success_rate, Some(1.0));
        assert_eq!(endpoint_health[1].summary.delivery_count, 0);
        assert!(endpoint_health[1].top_failure_codes.is_empty());
    }
}
