# Release Checklist: @runplane/runplane-sdk v1.2.0

## Pre-Release

- [ ] Version bump in package.json (1.1.3 -> 1.2.0)
- [ ] README.md updated with Gateway-first positioning
- [ ] CHANGELOG.md entry added for v1.2.0
- [ ] Package description updated
- [ ] Keywords updated to include "execution-control", "gateway"

## Testing

- [ ] `npm run build` succeeds
- [ ] `npm run test` passes
- [ ] Manual test: `guard()` with ALLOW decision
- [ ] Manual test: `guard()` with BLOCK decision
- [ ] Manual test: `guard()` with REQUIRE_APPROVAL decision
- [ ] Manual test: Approval timeout behavior
- [ ] Verify SDK calls `/api/v1/guard` (not `/api/decide`)
- [ ] Verify approval polling uses `approvalId`

## Publish

```bash
cd packages/runplane-sdk
npm run build
npm publish --access public
```

## Post-Publish

- [ ] Verify package page: https://www.npmjs.com/package/@runplane/runplane-sdk
- [ ] Verify README renders correctly on npm
- [ ] Verify version shows as 1.2.0
- [ ] Create GitHub release with CHANGELOG content
- [ ] Update documentation site if needed

## Rollback (if needed)

```bash
npm deprecate @runplane/runplane-sdk@1.2.0 "Critical issue found, please use 1.1.3"
```

---

## Release Summary

**Version**: 1.2.0 (MINOR)

**Rationale for MINOR version**:

| Criteria | Status |
|----------|--------|
| Public method signatures changed? | NO |
| Existing code must change? | NO |
| Response fields removed? | NO |
| Response fields changed incompatibly? | NO |
| New fields added? | YES (`approvalId` - additive) |
| Internal endpoint changed? | YES (transparent to users) |

Per semver: additive, backward-compatible changes = MINOR release.

**Compatibility**: Fully backward compatible. Existing `guard()` calls work without modification.
