use sendmock_store::PaymentTotalsRecord;

use super::app_stats::CurrencyAmount;
use crate::payments::PaymentStatus;

/// Paid at some point, even if refunded or disputed since.
const SUCCEEDED_STATUSES: [PaymentStatus; 4] = [
    PaymentStatus::Succeeded,
    PaymentStatus::PartiallyRefunded,
    PaymentStatus::Refunded,
    PaymentStatus::Disputed,
];
const UNSUCCESSFUL_FINISHED_STATUSES: [PaymentStatus; 2] =
    [PaymentStatus::Failed, PaymentStatus::Canceled];

/// The Overview's Payments tile (PY-09.5).
#[derive(Debug, Clone, PartialEq)]
pub struct PaymentStats {
    pub payment_count: u64,
    pub payments_today: u64,
    pub payment_success_rate: Option<f64>,
    pub payment_revenue: Vec<CurrencyAmount>,
}

fn count_in_statuses(payment_totals: &PaymentTotalsRecord, statuses: &[PaymentStatus]) -> u64 {
    payment_totals
        .count_by_status
        .iter()
        .filter(|(status, _)| {
            statuses
                .iter()
                .any(|counted_status| counted_status.as_str() == status)
        })
        .map(|(_, payment_count)| payment_count)
        .sum()
}

/// The success rate is succeeded among finished payments, as the mock's
/// `calculatePaymentStats` counts it; open and authorized payments are not finished yet.
pub fn build_payment_stats(payment_totals: PaymentTotalsRecord) -> PaymentStats {
    let succeeded_count = count_in_statuses(&payment_totals, &SUCCEEDED_STATUSES);
    let finished_count =
        succeeded_count + count_in_statuses(&payment_totals, &UNSUCCESSFUL_FINISHED_STATUSES);
    let payment_success_rate = if finished_count == 0 {
        None
    } else {
        Some(succeeded_count as f64 / finished_count as f64)
    };
    PaymentStats {
        payment_count: payment_totals.payment_count,
        payments_today: payment_totals.payments_since,
        payment_success_rate,
        payment_revenue: payment_totals
            .net_minor_by_currency
            .into_iter()
            .map(|(currency, amount_minor)| CurrencyAmount {
                currency,
                amount_minor,
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn totals_with_statuses(count_by_status: &[(&str, u64)]) -> PaymentTotalsRecord {
        PaymentTotalsRecord {
            payment_count: count_by_status.iter().map(|(_, count)| count).sum(),
            payments_since: 1,
            count_by_status: count_by_status
                .iter()
                .map(|(status, count)| ((*status).to_owned(), *count))
                .collect(),
            net_minor_by_currency: vec![("USD".to_owned(), 4_900), ("BDT".to_owned(), 1_200)],
        }
    }

    // AC: PY-09.5
    #[test]
    fn success_rate_counts_refunded_and_disputed_as_succeeded_and_skips_open_payments() {
        let payment_stats = build_payment_stats(totals_with_statuses(&[
            ("succeeded", 1),
            ("partially_refunded", 1),
            ("refunded", 1),
            ("disputed", 1),
            ("failed", 3),
            ("canceled", 1),
            ("requires_payment", 5),
            ("authorized", 2),
        ]));

        assert_eq!(payment_stats.payment_count, 15);
        assert_eq!(payment_stats.payments_today, 1);
        assert_eq!(payment_stats.payment_success_rate, Some(0.5));
        assert_eq!(
            payment_stats.payment_revenue,
            vec![
                CurrencyAmount {
                    currency: "USD".to_owned(),
                    amount_minor: 4_900,
                },
                CurrencyAmount {
                    currency: "BDT".to_owned(),
                    amount_minor: 1_200,
                },
            ]
        );
    }

    #[test]
    fn success_rate_is_none_before_any_payment_finishes() {
        let payment_stats = build_payment_stats(totals_with_statuses(&[("requires_payment", 2)]));

        assert_eq!(payment_stats.payment_success_rate, None);
    }
}
