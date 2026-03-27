# Module 80: Misc, Pitfalls, and Infrastructure

## Application Main Class

```java
// Old
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// New
import io.micronaut.runtime.Micronaut;

public class Application {
    public static void main(String[] args) {
        Micronaut.run(Application.class, args);
    }
}
```

## Logging

- Remove `spring-boot-starter-logging`
- Remove `logback.xml` (Mettle's common logging library provides its own)
- Remove any `ch.qos.logback:logback-classic` or `logback-core` dependencies
- Use `uk.co.mettle.common:ssv-common-logging:2.7.5` for standardised logging

## Health Checks and Readiness

- Add `@Readiness` annotation to the main application class if needed
- Configure management endpoints in `application.yml` under `endpoints:` (see module 20)
- Endpoints: `/health/liveness`, `/health/readiness`, `/prometheus`

## Metrics / Observability

- Replace Spring's `micrometer-registry-prometheus` with Micronaut's version:
  `io.micronaut.micrometer:micronaut-micrometer-registry-prometheus`
- Update registry beans to use `@Singleton` and Micronaut lifecycle
- Keep OpenTelemetry dependencies if used
- Update DataDog configuration to use `@Factory` and `@Singleton`

## Common Pitfalls

### Lombok Annotation Processor Order (CRITICAL)

Lombok MUST come before Micronaut processors in both `annotationProcessor` and `testAnnotationProcessor`:

```groovy
// Correct order
annotationProcessor("org.projectlombok:lombok:${lombokVersion}")
annotationProcessor("io.micronaut.validation:micronaut-validation-processor")
annotationProcessor("io.micronaut.security:micronaut-security")
annotationProcessor("io.micronaut.openapi:micronaut-openapi")
```

If Micronaut processors run first, Lombok-generated code won't be available, causing cryptic compilation errors.

### Clean Builds

Micronaut does compile-time DI. After annotation changes, always run:
```bash
./gradlew clean build
```

### Field Injection

Field injection requires explicit `@Inject` in Micronaut. Constructor injection is preferred and does not require the annotation.

### SpotBugs

SpotBugs may need temporary disabling during migration to unblock the build.

### @ExecuteOn Blocking

Controllers making blocking calls (DB, HTTP, File I/O) MUST use `@ExecuteOn(TaskExecutors.BLOCKING)` to avoid blocking Netty's event loop.

## Dockerfile Updates

- Update `JAVA_MAIN_CLASS` environment variable if the main class name changed
- No other Docker changes are typically needed for a standard migration

## CI / Workflow Updates

- Review GitHub Actions configuration for any Spring Boot-specific commands
- Update deployment scripts if the main class name changed
