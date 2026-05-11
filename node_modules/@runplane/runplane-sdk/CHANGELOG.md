# Changelog

All notable changes to `@runplane/runplane-sdk` will be documented in this file.

## [1.2.0] - 2026-04-14

### Gateway-First Architecture Alignment

This release aligns the SDK with Runplane's Gateway-first architecture. No breaking changes. All existing integrations remain compatible.

### Changed

- **Primary endpoint**: SDK now uses `/api/v1/guard` instead of `/api/decide`
- **Approval polling**: Now uses `approvalId` returned in the Guard response
- **Approval endpoint**: Polls `/api/v1/approvals/{approvalId}` instead of legacy endpoint
- **Error messages**: Clearer messages for approval timeouts and denials
  - Timeout errors now include the actual timeout duration
  - Denied errors now include the approver name when available
- **Documentation**: README updated to reflect Gateway-first architecture

### Added

- `approvalId` field in `DecideResponse` type
- Explicit validation for missing `approvalId` on `REQUIRE_APPROVAL` decisions
- Better error context in `ShieldError` messages

### Compatibility

**No breaking changes to public API.**

- `guard()` method signature unchanged
- `decide()` method signature unchanged
- `ShieldError` codes unchanged
- Configuration options unchanged

Existing code using `guard()` continues to work without modification.

### Migration

No code changes required. The SDK automatically uses the new Gateway endpoints.

If you were calling `/api/decide` directly (bypassing the SDK), update your integration to use `/api/v1/guard`. See [Migration Guide](https://runplane.ai/docs/migration).

### Deprecation

- `/api/decide` is deprecated but remains functional for backward compatibility
- Direct usage of legacy endpoints is discouraged

---

## [1.0.3] - 2026-03-01

### Fixed

- Approval polling edge case handling
- Type export improvements

## [1.0.2] - 2026-02-15

### Fixed

- Network timeout handling improvements

## [1.0.1] - 2026-02-01

### Fixed

- TypeScript type definitions

## [1.0.0] - 2026-01-15

### Added

- Initial release
- `Shield` class with `guard()` and `decide()` methods
- Approval polling with exponential backoff
- Fail-open and fail-closed modes
- `ShieldError` for typed error handling
