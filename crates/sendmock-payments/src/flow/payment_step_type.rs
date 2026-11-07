/// The steps SendMock can show on a checkout page and check, from a fixed catalogue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PaymentStepType {
    CardForm,
    AccountNumber,
    VoucherCode,
    Otp,
    Pin,
    SignedInAccount,
    QrCode,
    ReferenceCode,
    Confirm,
}

impl PaymentStepType {
    pub const ALL: [Self; 9] = [
        Self::CardForm,
        Self::AccountNumber,
        Self::VoucherCode,
        Self::Otp,
        Self::Pin,
        Self::SignedInAccount,
        Self::QrCode,
        Self::ReferenceCode,
        Self::Confirm,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::CardForm => "card_form",
            Self::AccountNumber => "account_number",
            Self::VoucherCode => "voucher_code",
            Self::Otp => "otp",
            Self::Pin => "pin",
            Self::SignedInAccount => "signed_in_account",
            Self::QrCode => "qr_code",
            Self::ReferenceCode => "reference_code",
            Self::Confirm => "confirm",
        }
    }

    pub fn parse(step_type_text: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|step_type| step_type.as_str() == step_type_text)
    }

    /// Decides the outcome from the method's test values; a flow has one at most.
    pub fn is_deciding(self) -> bool {
        matches!(
            self,
            Self::CardForm | Self::AccountNumber | Self::VoucherCode
        )
    }

    /// Shows an input, so it needs a field label.
    pub fn has_field(self) -> bool {
        matches!(
            self,
            Self::CardForm | Self::AccountNumber | Self::VoucherCode | Self::Otp | Self::Pin
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_step_type_reads_back_from_its_name() {
        for step_type in PaymentStepType::ALL {
            assert_eq!(PaymentStepType::parse(step_type.as_str()), Some(step_type));
        }
        assert_eq!(PaymentStepType::parse("fingerprint"), None);
    }
}
