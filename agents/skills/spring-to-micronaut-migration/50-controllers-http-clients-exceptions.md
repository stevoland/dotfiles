# Module 50: Controllers, HTTP Clients, and Exception Handling

## Controller Class Updates

1. Change `@RestController` → `@Controller` (import `io.micronaut.http.annotation.Controller`)
2. Move `@RequestMapping` path to the `@Controller` annotation: `@Controller("/path")`
3. Update return types: `ResponseEntity<T>` → `HttpResponse<T>` (import `io.micronaut.http.HttpResponse`)
4. Update HTTP method annotations (see module 30)
5. Remove `@Autowired` from constructors — not needed in Micronaut
6. Add `@ExecuteOn(TaskExecutors.BLOCKING)` if the controller makes blocking calls (DB, HTTP, File I/O) to prevent blocking Netty's event loop

```java
import io.micronaut.scheduling.TaskExecutors;
import io.micronaut.scheduling.annotation.ExecuteOn;

@Controller("/users")
@ExecuteOn(TaskExecutors.BLOCKING)
public class UserController { ... }
```

## Response Handling

| Spring | Micronaut |
|--------|-----------|
| `ResponseEntity.ok(body)` | `HttpResponse.ok(body)` |
| `ResponseEntity.status(code).body(body)` | `HttpResponse.status(code).body(body)` |
| `org.springframework.http.MediaType` | `io.micronaut.http.MediaType` |

## Replacing Feign Clients

1. Remove Feign dependencies from `build.gradle` (`spring-cloud-starter-openfeign`, `feign-okhttp`, etc.)
2. Add `io.micronaut:micronaut-http-client`
3. Remove Feign configuration classes and custom loggers
4. Convert Feign interface to Micronaut declarative client:

```java
// Old Feign
@FeignClient(name = "user-service", url = "${user.service.url}")
public interface UserClient {
    @RequestLine("GET /users/{id}")
    UserDto getUser(@Param("id") String id);
}

// New Micronaut
@Client("${user.service.url}")
public interface UserClient {
    @Get("/users/{id}")
    UserDto getUser(@PathVariable String id);
}
```

Annotation mapping for Feign → Micronaut:

| Feign | Micronaut |
|-------|-----------|
| `@FeignClient` | `@Client("${service.url.property}")` |
| `@RequestLine("GET /path")` | `@Get("/path")` |
| `@RequestLine("POST /path")` | `@Post("/path")` |
| `@Param("name")` for path vars | `@PathVariable` |
| `@Param("header")` for headers | `@Header("Header-Name")` |
| `@HeaderMap` | Individual `@Header` parameters |
| Request body | `@Body` parameter |

Define service URLs in `application.yml` and reference with `@Client`.

## Test Helpers — Simulating Downstream Errors

Update any test utility that throws `FeignException` subtypes:

```java
// Old
public static FeignException feignGone() {
    return new FeignException.Gone("", Request.create(...), null, null);
}

// New
public static HttpClientResponseException feignGone() {
    return new HttpClientResponseException("Gone", HttpResponse.status(HttpStatus.GONE));
}
```

## Exception Handling

### Consolidating repeated @ExceptionHandler methods

If the same exception handler is duplicated across multiple controllers, create a single centralised handler:

```java
import io.micronaut.context.annotation.Requires;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.Produces;
import io.micronaut.http.server.exceptions.ExceptionHandler;
import jakarta.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import java.util.Map;

@Slf4j
@Singleton
@Produces
@Requires(classes = {ExceptionHandler.class})
public class GlobalExceptionHandler implements ExceptionHandler<RuntimeException, HttpResponse<?>> {

    @Override
    public HttpResponse<?> handle(HttpRequest request, RuntimeException exception) {
        if (exception instanceof PersonDoesNotExistException) {
            log.warn("PersonDoesNotExistException: {}", exception.getMessage());
            return HttpResponse.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of(
                            "title", "PersonDoesNotExist",
                            "detail", exception.getMessage()
                    ));
        }

        // Let other exceptions propagate to default Micronaut error handlers
        log.error("Unhandled exception", exception);
        throw exception;
    }
}
```

### Response Format (RFC 7807 compatible)

```json
{
  "title": "PersonDoesNotExist",
  "detail": "Person with id 12345 does not exist"
}
```

### Zalando Problem Library (alternative)

For more sophisticated error handling:

```groovy
implementation("io.micronaut.problem:micronaut-problem-json")
```

```java
public class PersonDoesNotExistException extends AbstractThrowableProblem {
    public PersonDoesNotExistException(String message) {
        super(
            URI.create("https://example.com/problems/person-not-found"),
            "Person Does Not Exist",
            Status.BAD_REQUEST,
            message
        );
    }
}
```

### Common Error Handling Libraries

- `io.micronaut.problem:micronaut-problem-json` — RFC 7807 problem details
- `uk.co.mettle.common:micronaut-common-http-error-handler:1.4.15` (or higher) — Mettle's common error handling

> **PSD2 services**: Do NOT use these. Use `psd2-exception-handling-micronaut` instead (see module 90).

## API Documentation (OpenAPI/Swagger)

- Keep using `io.swagger.v3.oas.annotations` — these are compatible with Micronaut
- Move `@OpenAPIDefinition` to a `SwaggerConfiguration` `@Factory` class (or a dedicated interface if no such class exists)
- Add `annotationProcessor("io.micronaut.openapi:micronaut-openapi")` (see module 10)
- Add `implementation("io.swagger.core.v3:swagger-annotations")`
- Remove `springdoc-*` dependencies
- Configure static resource serving in `application.yml` (see module 20)
