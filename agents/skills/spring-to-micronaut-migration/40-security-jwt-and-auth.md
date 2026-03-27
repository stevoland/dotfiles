# Module 40: Security, JWT, and Authentication

## Security Configuration

- Remove Spring Security configuration classes (e.g. beans with `SecurityFilterChain`)
- Remove `@EnableWebSecurity` and related annotations
- Remove Spring's JWT decoder beans
- Configure JWT in `application.yml` under `micronaut.security.token.jwt` (see module 20)
- **Public endpoints**: Use `@Secured(SecurityRule.IS_ANONYMOUS)` on the controller or method
- **Authenticated endpoints**: Use `@Secured(SecurityRule.IS_AUTHENTICATED)` on the controller
- Do NOT add routes to the `security` section in `application.yml` (except api-docs)

## Custom Security Rules

Replace Spring's method security annotations with `@Secured` or implement `SecurityRule`:

```java
// Custom security rule (if needed)
@Singleton
public class HasManageBusinessSecurityRule implements SecurityRule {
    // implement SecurityRule interface
}
```

## Authentication in Controllers

Inject `Authentication` as a method parameter — Micronaut injects the current authenticated user automatically:

```java
import io.micronaut.security.authentication.Authentication;

@Get("/endpoint")
public HttpResponse<String> endpoint(Authentication authentication) {
    String username = authentication.getName();
    // ...
}
```

## Removing auth-jwt Dependency

**Remove `com.eeveebank:auth-jwt` completely.** This library was designed for Spring Security and is incompatible with Micronaut.

Replace with:
- **Production code**: `com.nwboxed:micronaut-mettle-security` (version `2.3.27` or higher)
- **Test code**: `com.nwboxed:micronaut-test-utils` (version `2.4.0` or higher) — test scope only

Also add if needed for `ClaimAction` or `OpsPermission` classes:
```groovy
implementation("com.eeveebank:mettle-permissions:1.3.17")  // or higher
```

## Extracting JWT Claims in Production Code

Replace `AuthenticationClaimExtractor` (from `auth-jwt`) with `JwtUtils` (from `micronaut-mettle-security`):

```java
// Old (Spring + auth-jwt)
@Singleton
@RequiredArgsConstructor
public class MyService {
    private final AuthenticationClaimExtractor claimExtractor;

    public void doSomething(Authentication auth) {
        List<String> permissions = claimExtractor.extractOpenBankingPermissions(auth);
        List<OpsPermission> opsPermissions = claimExtractor.extractInternalPermissions(auth);
    }
}

// New (Micronaut)
@Singleton
public class MyService {
    public void doSomething(Authentication auth) {
        List<String> permissions = JwtUtils.getOpenBankingPermissionsFromJwt(auth);
        List<OpsPermission> opsPermissions = JwtUtils.getInternalPermissions(auth);
    }
}
```

`JwtUtils` is in package `uk.co.mettle.micronaut.common.jwt.util`. Available static methods:

| Method | Purpose |
|--------|---------|
| `getOpenBankingPermissionsFromJwt(Authentication)` | Extract Open Banking permissions |
| `getClaimActionsForResource(Authentication, String resourceId)` | Get claim actions for a resource |
| `getResourcesForClaimAction(Authentication, ClaimAction)` | Get resources with specific claim action |
| `getInternalPermissions(Authentication)` | Extract internal/ops permissions |
| `getMettlePsd2Permissions(Authentication)` | Get PSD2 metadata |
| `userHasClaimActionForResource(Authentication, String, ClaimAction)` | Check specific permission |

## Generating JWT Tokens in Tests

Replace `JwtTokenGenerator` from `auth-jwt` with Micronaut's built-in generator and `JwtClaimsGenerator`:

```java
import io.micronaut.security.token.jwt.generator.JwtTokenGenerator;
import uk.co.mettle.micronaut.test.JwtClaimsGenerator;

@Inject
JwtTokenGenerator jwtTokenGenerator;  // Micronaut's built-in generator

@BeforeEach
void setUp() {
    // TPP token
    String jwt = jwtTokenGenerator.generateToken(
        JwtClaimsGenerator.buildTppAccessToken("accounts")
    ).orElseThrow();

    // User token with claims
    String userJwt = jwtTokenGenerator.generateToken(
        JwtClaimsGenerator.createToken(userId, username, accountId)
    ).orElseThrow();

    // Token with custom claims
    String customJwt = jwtTokenGenerator.generateToken(
        JwtClaimsGenerator.createWithAdditionalClaims(userId, username,
            Map.of("mettle_psd2", Map.of("permissions", List.of("ReadAccountsDetail"))))
    ).orElseThrow();
}
```

Key points:
- Import `JwtTokenGenerator` from `io.micronaut.security.token.jwt.generator` (NOT auth-jwt)
- Import `JwtClaimsGenerator` from `uk.co.mettle.micronaut.test` (from `micronaut-test-utils`)
- `generateToken()` returns `Optional<String>` — always use `.orElseThrow()`

`JwtClaimsGenerator` available methods:

| Method | Purpose |
|--------|---------|
| `buildTppAccessToken(String... scopes)` | Create TPP access token claims |
| `createToken(String userId, String username, String accountId)` | User token with account claims |
| `createToken(String userId, String username, String accountId, String businessId)` | With business claims |
| `createWithInternalPermissions(String userId, String username, List<OpsPermission>)` | With ops permissions |
| `createWithAdditionalClaims(String userId, String username, Map<String, Object>)` | Custom claims |

## Test Signing Key Configuration (application-test.yml)

```yaml
jwtSigningKey: abc123abc123abc123abc123abc123abc123abc123

micronaut:
  security:
    token:
      jwt:
        generator:
          enabled: true
        signatures:
          secret:
            generator:
              secret: ${jwtSigningKey}
              base64: false
              jws-algorithm: HS256
```
