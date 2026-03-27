# Module 90: PSD2 Services (psd2-* prefix only)

Services in the `psd2-*` family have additional requirements beyond a standard Micronaut
migration. **This entire module can be ignored for services without the `psd2-` prefix.**

## Dependencies

Add these to `build.gradle` in place of their Spring equivalents:

### PSD2 Exception Handling (version 3.1.0 or higher)

```groovy
implementation("com.eeveebank:psd2-exception-handling-micronaut")
testImplementation("com.eeveebank:psd2-exception-handling-micronaut-test")
```

### TPP Token Replacement (version 4.2.0 or higher)

```groovy
implementation("com.eeveebank:psd2-token-replacement-micronaut")
testImplementation("com.eeveebank:psd2-token-replacement-micronaut-test")
```

### Open Banking API Models (version 1.3.1 or higher)

```groovy
implementation("uk.co.mettle:openbanking-api-models-micronaut")
```

## Security Configuration

PSD2 services use TPP (Third Party Provider) JWT tokens, not internal Mettle tokens.

```yaml
micronaut:
  security:
    enabled: true
    authentication: bearer
    basic-auth.enabled: false
    reject-not-found: false   # REQUIRED: must be false so unmatched routes return 404/405 not 403
    token:
      name-key: client_id     # TPP tokens use client_id as the subject, not user_name
      jwt:
        enabled: true
        signatures:
          secret:
            validation:
              secret: "${tppJwtSigningKey:pleaseChangeThisSecretForANewOne}"
              base64: false
        claims-validators.subject-not-null: false
```

## TPP Token Replacement

PSD2 services receive TPP tokens on inbound requests and must swap them for internal Mettle tokens before calling downstream services.
`TokenReplacementFilter` from `psd2-token-replacement-micronaut` handles this automatically.

Configure in `application.yml`:

```yaml
application:
  consent:
    scope: accounts             # Required scope on the TPP token
  token-replacement:
    exclude-patterns:           # Paths that bypass token replacement (optional)
      - /health/**
      - /prometheus
```

The filter activates only when `application.consent.scope` is present. It:
1. Validates the TPP token has the required scope
2. Calls the auth service to swap the TPP token for an internal Mettle token
3. Replaces the `Authentication` on the request with claims from the swapped token

Use `@TokenReplacementScopeOverride("custom-scope")` on individual controller methods to require a different scope.

### Auth Client Pact Test

`psd2-token-replacement-micronaut-test` provides `AbstractAuthClientTest`, which owns the Pact definition for the auth token swap contract. A test extending it MUST be present:

```java
public class AuthClientTest extends AbstractAuthClientTest {
    @Override
    @Pact(consumer = "my-service")
    public V4Pact exchangeObToken(PactDslWithProvider provider) throws Exception {
        return createPact(provider);
    }
}
```

## Exception Handling

PSD2 services must return errors in Open Banking format.
Use `psd2-exception-handling-micronaut` — do NOT use standard Micronaut error handlers or `micronaut-problem-json`.

The library provides:
- `CustomExceptionHandler` — handles `CustomException` subclasses, returns OB-formatted 4xx
- `GeneralExceptionHandler` — catches all other `Exception`, returns a 500 OB error response
- `NotFoundExceptionHandler` — returns OB-formatted 404 for unmatched routes
- `NotAllowedExceptionHandler` — returns OB-formatted 405 for wrong-method requests (annotated `@Replaces(io.micronaut.http.server.exceptions.NotAllowedExceptionHandler)`)

Throw `CustomException` subclasses for business errors:

```java
public class ConsentNotFoundException extends CustomException {
    public ConsentNotFoundException(String consentId) {
        super(HttpStatus.NOT_FOUND, "UK.OBIE.Resource.NotFound",
              "Consent " + consentId + " not found");
    }
}
```

## Open Banking API Models

`uk.co.mettle:openbanking-api-models-micronaut` provides strongly-typed Java classes for every Open Banking request/response (Account Info, Payment Initiation, VRP, Confirmation of Funds, Event Notifications — v3.1 and v4.0).

### Important: Base Path is Not Inherited from Interface

The Micronaut generator does not put a base path on generated interfaces — declare it on the implementing controller:

```java
// Generated interface (no base path)
public interface BalancesApi {
    @Get("/accounts/{AccountId}/balances")
    HttpResponse<OBReadBalance1> getAccountsAccountIdBalances(...);
}

// Implementing controller — add the base path
@Controller(ErrorCodeSelector.V4_API_PATH_PREFIX + "aisp")
public class BalancesController implements BalancesApi { ... }
```

### Model API Differences from Spring Version

| Aspect | Spring (`openbanking-api-models`) | Micronaut (`openbanking-api-models-micronaut`) |
|--------|-----------------------------------|-----------------------------------------------|
| Optional fields | `getXxx()` returns `Optional<T>` | `getXxx()` returns `T` (nullable); `getXxxOptional()` returns `Optional<T>` |
| Construction | `.builder()...build()` | `new Foo().bar(value).baz(value)` (fluent lowercase methods) |
| Setters | `setXxx()` is chainable | `setXxx()` returns `void`; use `xxx()` (lowercase) to chain |
| Date/time | `OffsetDateTime` | `Instant` |
| Annotations | Spring Web | Micronaut HTTP + Jakarta EE + `@Introspected` |

### OpenAPI/Swagger (PSD2)

`openbanking-api-models-micronaut` provides a controller with a `/v3/api-docs` endpoint.
Do NOT add the `application.yml` OpenAPI/Swagger block from module 20 to PSD2 services.

## PSD2 Controller Patterns

### Annotations Required on Every PSD2 Controller

```java
@Controller("...")
@Secured(SecurityRule.IS_AUTHENTICATED)
@ExecuteOn(TaskExecutors.BLOCKING)
```

Every handler method must have `@Psd2FailureApiResponses` (meta-annotation from `psd2-exception-handling-micronaut` — adds standard OB error `@ApiResponses` entries):

```java
@Psd2FailureApiResponses
@Get("/{accountId}/direct-debits")
public OBReadDirectDebit1 getDirectDebits(...) { ... }
```

### Getting the Authentication Object in PSD2 Controllers

You cannot change method signatures (they come from generated interfaces), so inject `SecurityService`:

```java
import io.micronaut.security.utils.SecurityService;

// In controller
private final SecurityService securityService;

// In method
Authentication auth = securityService.getAuthentication().orElseThrow();
```

### V3 Controller Structure

V3 controllers do NOT implement a generated interface.
- Write OpenAPI docs (`@Operation`, `@ApiResponse`, `@Tag`) manually on each method
- Return types are bare response objects (NOT `HttpResponse<T>`)
- Use `@AllArgsConstructor` (Lombok)
- Permission constants are plain `String` constants:

```java
public class ReadPermissions {
    public static final String READ_DIRECT_DEBITS_PERMISSION = "ReadDirectDebits";
    public static final String READ_BALANCES_PERMISSION = "ReadBalances";
}
```

### V4 Controller Structure

V4 controllers implement a generated interface (e.g. `DirectDebitsApi`, `BalancesApi`).
- The interface carries `@Get`/`@Post` route annotations; the controller only needs `@Controller(...)` with the V4 base path
- Do NOT duplicate `@Operation`/`@Tag` on the implementation (comes from the interface)
- Return types are `HttpResponse<T>`
- Use `@RequiredArgsConstructor` (Lombok)
- Add `@OpenBankingV4Errors` (class-level marker from `psd2-exception-handling-core`) to every V4 controller
- Controller path uses `ErrorCodeSelector.V4_API_PATH_PREFIX` constant (value: `"/apis/open-banking/v4.0/"`)
- Permissions use generated enum `OBReadConsent1DataPermissionsInner`:

```java
import static uk.co.mettle.openbanking.model.accountinfo.v4.OBReadConsent1DataPermissionsInner.READ_DIRECT_DEBITS;
```

Example V4 controller:

```java
@Controller(ErrorCodeSelector.V4_API_PATH_PREFIX + "aisp")
@OpenBankingV4Errors
@Secured(SecurityRule.IS_AUTHENTICATED)
@ExecuteOn(TaskExecutors.BLOCKING)
@RequiredArgsConstructor
public class DirectDebitsControllerV4 implements DirectDebitsApi {

    private final PaymentsClient paymentsClient;
    private final SecurityService securityService;

    @Override
    @Psd2FailureApiResponses
    public HttpResponse<OBReadDirectDebit2> getAccountsAccountIdDirectDebits(String accountId) {
        Authentication auth = securityService.getAuthentication().orElseThrow();
        // check required permissions
        DirectDebitsResponse response = paymentsClient.getDirectDebits(jwtService.getJwtToken(auth), accountId);
        return HttpResponse.ok(directDebitMapper.intoResponse(response, accountId));
    }
}
```

## Consumer Pact Tests

If the service has consumer Pact tests that construct Feign clients manually, they may conflict with provider Pact test setup.
Move consumer tests to a separate Micronaut environment:

- Add `@MicronautTest(environments = {"pact-consumer"})` to consumer Pact test classes
- Add `application-pact-consumer.yml` with service URLs pointing at the Pact mock server port (e.g. `http://localhost:8080`)
- Inject the `@Client`-annotated interface directly rather than constructing it manually
- Prefix JWT headers with `"Bearer "` — Micronaut's `@Header` does not add the prefix automatically
- Use `@BeforeEach` (instance method) instead of `@BeforeAll` (static) for JWT setup — `@Inject` fields are not available in static context

## Test JWT Tokens (PSD2)

PSD2 tests use TPP tokens (signed with `tppJwtSigningKey`). Configure both signing keys in `application-test.yml`:

```yaml
jwtSigningKey: abc123abc123abc123abc123abc123abc123abc123
tppJwtSigningKey: abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123

micronaut:
  security:
    token:
      jwt:
        generator:
          enabled: true
        signatures:
          secret:
            generator:
              secret: ${tppJwtSigningKey}
              base64: false
              jws-algorithm: HS256
```

Use `JwtClaimsGenerator.buildTppAccessToken("accounts")` (from `micronaut-test-utils`) to build TPP token claims, then sign with `JwtTokenGenerator`.
