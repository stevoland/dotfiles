# Module 70: Testing and Pact

## Test Class Annotations

| Spring | Micronaut |
|--------|-----------|
| `@SpringBootTest` | `@MicronautTest` |
| `@WebMvcTest` | `@MicronautTest` (add properties for slicing if needed) |
| `@MockBean` (Spring) | `@MockBean` (Micronaut, factory-method style — see below) |
| `@AutoConfigureMockMvc` | Remove — not needed with `micronaut-mockmvc` |
| `@Autowired` | `@Inject` (from `jakarta.inject`) |
| `@ActiveProfiles("test")` | `@MicronautTest(environments = {"test"})` |

## MockMvc Testing

Add `com.nwboxed:micronaut-mockmvc:1.2.0` (or latest) to test dependencies.

Keep existing MockMvc imports from `org.springframework.test.web.servlet` — the library provides them.

Update injection:

```java
// Old
@Autowired MockMvc mockMvc;

// New
@Inject MockMvc mockMvc;
```

Test methods work without modification **except**:

### Query Parameters in MockMvc

`MutableHttpRequest` does NOT support the `.param()` method:

```java
// Does not work
mvc.perform(delete("/users/" + id).param("permanentlyDelete", "true"))

// Correct — put params in URL
mvc.perform(delete("/users/" + id + "?permanentlyDelete=true"))
```

For multiple query parameters: `?param1=value1&param2=value2`

### AssertJ with HttpStatus Enums

AssertJ's `assertThat()` is ambiguous with `HttpStatus` enums (they implement both `CharSequence` and `Comparable`):

```java
// May cause: "reference to assertThat is ambiguous"
assertThat(response.getStatus()).isEqualTo(HttpStatus.OK);

// Fix: compare status codes
assertThat(response.getStatus().getCode()).isEqualTo(HttpStatus.OK.getCode());
```

## Basic Application Tests

Every service should have these tests defined. Add `ApplicationTests.java` if it doesn't exist:

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@MicronautTest
class ApplicationTests {

    @Inject
    @Client("/")
    private HttpClient client;

    @Test
    void contextLoads() {
    }

    @Test
    void getLiveness() {
        assertOk("/health/liveness");
    }

    @Test
    void getReadiness() {
        assertOk("/health/readiness");
    }

    @Test
    void getMetrics() {
        assertOk("/prometheus");
    }

    @Test
    void getApiDocs() {
        assertOk("/api-docs/<replace-with-application-name>-v1.yml");
    }

    void assertOk(String url) {
        await().atMost(15, SECONDS).ignoreExceptions()
                .untilAsserted(() -> {
                    var response = client.toBlocking().exchange(HttpRequest.GET(url), String.class);
                    assertThat(response.getStatus().getCode()).isEqualTo(HttpStatus.OK.getCode());
                    if (url.startsWith("/health")) {
                        assertThat(new ObjectMapper().readValue(
                            response.getBody().orElse("{}"), Map.class
                        ).get("status").toString()).isEqualTo("UP");
                    }
                });
    }
}
```

Requires in `build.gradle`:

```groovy
testImplementation("io.micronaut:micronaut-http-client")  // if not already in implementation
testImplementation("org.awaitility:awaitility:4.2.2")
```

## Pact Tests

### Dependency Update

Replace `au.com.dius.pact.provider:junit5spring` with `au.com.dius.pact.provider:junit5`.

### Test Class Changes

```java
// Old (Spring Boot)
@SpringBootTest
@ActiveProfiles(profiles = {"test", "pact"})
class ContractTest {
    @LocalServerPort
    private int localServerPort;

    @MockitoBean
    MyService myService;

    @BeforeEach
    void setUp(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", localServerPort, "/"));
    }
}

// New (Micronaut)
@MicronautTest(environments = {"test", "pact"})
class ContractTest {
    @Inject
    private EmbeddedServer embeddedServer;

    @Inject
    MyService myService;

    @MockBean(MyService.class)
    MyService myServiceMock() {
        return mock(MyService.class);
    }

    @BeforeEach
    void setUp(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", embeddedServer.getPort(), "/"));
    }
}
```

### Common Pact Test Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused to http://localhost:80` | Port not injected correctly | Use `EmbeddedServer` and call `getPort()` |
| `No bean of type X found` | MockBean not created | Add factory method with `@MockBean` |
| `NullPointerException` in mock setup | Mock not injected | Add `@Inject` field for the mocked service |
| Tests run but all fail verification | Mock responses not configured | Add `@State` methods with `when()` mock setup |

## Mock Setup

- Replace Spring's `@MockBean` with Micronaut's `@MockBean` factory-method style (shown above)
- Use constructor injection for easier test setup
- `@Inject` is required for field injection in tests
