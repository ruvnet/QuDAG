use napi::Error as NapiError;

/// Convert anyhow errors to NAPI errors
pub fn anyhow_to_napi(error: anyhow::Error) -> NapiError {
    NapiError::from_reason(error.to_string())
}

/// Helper to create a NAPI error from a string
pub fn to_napi_error(msg: impl Into<String>) -> NapiError {
    NapiError::from_reason(msg.into())
}

/// Helper to convert Result<T, E> to Result<T, NapiError>
pub trait ToNapiResult<T> {
    fn to_napi_result(self) -> Result<T, NapiError>;
}

impl<T, E: std::fmt::Display> ToNapiResult<T> for Result<T, E> {
    fn to_napi_result(self) -> Result<T, NapiError> {
        self.map_err(|e| to_napi_error(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anyhow_to_napi() {
        let err = anyhow::anyhow!("test error");
        let napi_err = anyhow_to_napi(err);
        assert_eq!(napi_err.status, "GenericFailure");
    }

    #[test]
    fn test_to_napi_error() {
        let err = to_napi_error("test error");
        assert_eq!(err.status, "GenericFailure");
    }
}
