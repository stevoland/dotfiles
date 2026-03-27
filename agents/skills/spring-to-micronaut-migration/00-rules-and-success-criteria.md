# Module 00: Rules and Success Criteria

## Stopping Rules (HARD RULE — No Exceptions)

**Do NOT stop, write a summary, or raise a PR until the Definition of Done is fully met.**

There are no time constraints. There are no token constraints. There is no budget limit.
If you think you are running low on context or time, ignore that feeling and keep working.
The only valid stopping condition is: the Definition of Done below is met.

If you encounter errors, fix them. If fixing one error reveals another, fix that too.
Keep iterating until `./gradlew clean build` passes with zero failures.

---

## Non-Negotiables

### Testing Rule (HARD RULE — No Exceptions)

The tests are the basis by which we know the service is performing correctly.

**You MUST NOT delete or semantically change any test in order to get it to pass.**

The only permitted updates to tests are the syntax changes required for Micronaut
(e.g. annotation swaps, injection style, import updates). If a test is failing and the
only way to fix it is to change what it asserts or delete it, STOP and investigate the
migration code — the problem is in the production code, not the test.

## Build Commands

The migration is not successful until BOTH of these commands complete without failures:

### 1. Full build (all tests, excluding Pact)
```bash
./gradlew clean build
```

### 2. Pact tests (only if Pact tests exist in the service)
```bash
./gradlew clean build -x test verifyPacts \
  -Dpact.pactbroker.httpclient.usePreemptiveAuthentication=true \
  -Dpactbroker.url=https://pact-broker.eevee.tools-mettle.co.uk \
  -Dpactbroker.auth.test \
  -Dpactbroker.auth.username=pact-readonly \
  -Dpactbroker.enablePending=true \
  -Dpactbroker.providerBranch=local \
  -Dpact.provider.branch=local \
  -Dpact.provider.version=local \
  -Dpact.verifier.publishResults=false
```

### Debugging test output

To see test output while debugging, add this to the Groovy test task in `build.gradle`:

```groovy
test {
    testLogging {
        showStandardStreams = true
    }
}
```

## Definition of Done

A migration is complete when:
1. `./gradlew clean build` passes with zero failures.
2. Pact tests pass (if applicable).
3. No tests have been deleted or semantically altered.
4. The service starts up and the basic health/metrics/api-docs endpoints respond (see `70-testing-and-pact.md` for `ApplicationTests`).

## Checklist Files

After completing the migration use the checklist to confirm every step was done:
- Standard service: `checklists/standard-service-checklist.md`
- PSD2 service: `checklists/psd2-service-checklist.md`
