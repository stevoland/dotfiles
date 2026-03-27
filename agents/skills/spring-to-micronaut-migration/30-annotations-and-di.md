# Module 30: Annotations and Dependency Injection

## Core Framework Annotations

| Spring | Micronaut / Jakarta |
|--------|---------------------|
| `@SpringBootApplication` | Remove — use `Micronaut.run()` in main class instead |
| `@Configuration` | `@Factory` |
| `@Component` | `@Singleton` |
| `@Service` | `@Singleton` |
| `@Repository` | `@Singleton` (or keep `@Repository` with updated import — see module 60) |
| `@Autowired` | `@Inject` (from `jakarta.inject`) |
| `@Value("${prop}")` | `@Property(name = "prop")` (from `io.micronaut.context.annotation`) |
| `@Bean` | `@Singleton` (inside a `@Factory` class) |
| `@Qualifier("foo")` | `@Named("foo")` (from `jakarta.inject`) |
| `@Profile("foo")` | `@Requires(env = "foo")` |
| `@Profile("!foo")` | `@Requires(notEnv = "foo")` |

## Controller / REST Annotations

| Spring | Micronaut |
|--------|-----------|
| `@RestController` | `@Controller` (from `io.micronaut.http.annotation`) |
| `@RequestMapping("/path")` at class | `@Controller("/path")` |
| `@GetMapping` | `@Get` |
| `@PostMapping` | `@Post` |
| `@PutMapping` | `@Put` |
| `@DeleteMapping` | `@Delete` |
| `@PathVariable` | `@PathVariable` (use Micronaut import) |
| `@RequestParam` | `@QueryValue` |
| `@RequestBody` | `@Body` (or implicit as method parameter) |
| `ResponseEntity<T>` | `HttpResponse<T>` (from `io.micronaut.http`) |

## Validation Annotations

- Import from `jakarta.validation.constraints` (same package, just verify imports are not `javax.*`)
- Ensure `micronaut-validation` is in `build.gradle` and `micronaut-validation-processor` is in annotation processors

## Dependency Injection Rules

- **Constructor injection** is the default in Micronaut; `@Inject` on the constructor is optional.
- **Field injection** requires explicit `@Inject`.
- Remove `@Autowired` from constructors — it is not needed.
- Micronaut does **compile-time** DI, so clean builds may be necessary after annotation changes:
  ```bash
  ./gradlew clean build
  ```

## Lombok and Micronaut Processors — Ordering Rule

Lombok annotation processors **MUST** come before Micronaut processors. If Micronaut processors
run first, Lombok-generated code won't be available and the build will fail with cryptic errors.

Correct order in `build.gradle`:

```groovy
annotationProcessor("org.projectlombok:lombok:${lombokVersion}")
annotationProcessor("io.micronaut.validation:micronaut-validation-processor")
annotationProcessor("io.micronaut.security:micronaut-security")
annotationProcessor("io.micronaut.openapi:micronaut-openapi")
```

Same applies for `testAnnotationProcessor`.
