## [Unreleased]

### Changed

- **BREAKING**: Database credentials are no longer hard-coded. The API now reads `DATABASE_URL` from environment variables using `dotenv`. Make sure to create/adjust `.env`.
