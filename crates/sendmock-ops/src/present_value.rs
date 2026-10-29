use serde::{Deserialize, Deserializer};

/// A present key, even when its value is `null`, so a patch can clear a nullable field.
pub(crate) fn read_present_value<'de, Value: Deserialize<'de>, Reader: Deserializer<'de>>(
    reader: Reader,
) -> Result<Option<Option<Value>>, Reader::Error> {
    Option::<Value>::deserialize(reader).map(Some)
}
