# Checklist: Standard Service Migration

Use this checklist to track progress and verify completion. Report each item as done (✅) or blocked (❌) with a note.

## 0. Pre-Migration

- [ ] Read `00-rules-and-success-criteria.md` in full
- [ ] Confirmed: this is NOT a `psd2-*` service (if it is, switch to `psd2-service-checklist.md`)
- [ ] Run `./gradlew clean build` on the original Spring code to confirm it starts green

## 1. Build and Dependencies (module 10)

- [ ] Replace Spring Boot plugin with `io.micronaut.minimal.application`
- [ ] Remove `io.spring.dependency-management` plugin
- [ ] Add `com.gradleup.shadow` plugin
- [ ] Add `application { mainClass }` and `shadowJar { mergeServiceFiles() }` blocks
- [ ] Add `micronautVersion` to `gradle.properties`
- [ ] Replace Spring starter dependencies with Micronaut equivalents
- [ ] Remove `spring-boot-devtools`
- [ ] Remove `spring-boot-starter-logging`; add `ssv-common-logging`
- [ ] Add `micronaut-jackson-databind`, `snakeyaml`
- [ ] Add annotation processors in correct order (Lombok first)
- [ ] Replace `spring-boot-starter-test` with Micronaut test dependencies
- [ ] Add `micronaut-mockmvc`, `awaitility`
- [ ] Update Pact dependency to `junit5` variant (if applicable)
- [ ] Set `systemProperty 'MICRONAUT_ENVIRONMENTS', 'test'` in test task

## 2. Configuration (module 20)

- [ ] Rename root key `spring:` → `micronaut:` in `application.yml`
- [ ] Remove `management:` root key
- [ ] Migrate Jackson serialisation config
- [ ] Add metrics/Prometheus config block
- [ ] Add security config block
- [ ] Add OpenAPI/Swagger config block
- [ ] Update `application-test.yml` (Micronaut root key, random port)
- [ ] Update Kafka config from Spring Cloud Stream format to Micronaut Kafka format (if applicable)
- [ ] Update datasource config (`spring.datasource` → `datasources.default`) (if applicable)

## 3. Annotations and DI (module 30)

- [ ] Replace `@Configuration` → `@Factory`
- [ ] Replace `@Component`/`@Service`/`@Repository` → `@Singleton`
- [ ] Replace `@Autowired` → `@Inject` (or remove from constructors)
- [ ] Replace `@Value` → `@Property`
- [ ] Replace `@Bean` → `@Singleton` inside `@Factory`
- [ ] Replace `@Profile` → `@Requires`
- [ ] Remove `@SpringBootApplication` from main class

## 4. Security, JWT, Auth (module 40)

- [ ] Remove Spring Security configuration classes
- [ ] Remove `@EnableWebSecurity`
- [ ] Remove Spring's JWT decoder beans
- [ ] Remove `com.eeveebank:auth-jwt` dependency
- [ ] Add `micronaut-mettle-security`
- [ ] Add `micronaut-test-utils` (test scope)
- [ ] Replace `AuthenticationClaimExtractor` → `JwtUtils` in production code
- [ ] Replace `JwtTokenGenerator` from auth-jwt → Micronaut's `JwtTokenGenerator` + `JwtClaimsGenerator` in tests
- [ ] Add JWT signing key config to `application-test.yml`
- [ ] Add `@Secured` annotations to controllers

## 5. Controllers, HTTP Clients, Exceptions (module 50)

- [ ] Replace `@RestController` → `@Controller`
- [ ] Move `@RequestMapping` path to `@Controller(path)`
- [ ] Replace `ResponseEntity<T>` → `HttpResponse<T>`
- [ ] Update HTTP method annotations (`@GetMapping` → `@Get`, etc.)
- [ ] Add `@ExecuteOn(TaskExecutors.BLOCKING)` to blocking controllers
- [ ] Replace Feign clients with Micronaut `@Client` declarative clients
- [ ] Remove Feign dependencies and config classes
- [ ] Update test helpers that throw `FeignException` to throw `HttpClientResponseException`
- [ ] Consolidate `@ExceptionHandler` methods into global exception handler (if applicable)
- [ ] Update OpenAPI: move `@OpenAPIDefinition`, add annotation processor, remove springdoc

## 6. Kafka and Data (module 60) — skip if not used

- [ ] Replace `spring-cloud-stream` with `kafka-utils`
- [ ] Replace `KafkaTemplate` with `@KafkaClient` interface
- [ ] Update `@KafkaListener` import to Micronaut version
- [ ] Replace statemachine Spring deps with Micronaut deps (if applicable)
- [ ] Update JPA dependencies
- [ ] Update repository imports (`JpaRepository` from Micronaut Data)
- [ ] Update `@Transactional` import

## 7. Testing (module 70)

- [ ] Replace `@SpringBootTest` → `@MicronautTest`
- [ ] Replace `@AutoConfigureMockMvc` → remove
- [ ] Replace `@Autowired` → `@Inject` in tests
- [ ] Replace `@MockBean` (Spring) with Micronaut `@MockBean` factory-method style
- [ ] Fix MockMvc `.param()` calls to use URL query strings
- [ ] Fix AssertJ `assertThat(HttpStatus)` ambiguity (compare `.getCode()`)
- [ ] Add `ApplicationTests` with liveness/readiness/metrics/api-docs tests (if missing)
- [ ] Update Pact test class: `EmbeddedServer`, `@MockBean` factory, `@MicronautTest(environments = {...})`

## 8. Misc (module 80)

- [ ] Update main class: remove `@SpringBootApplication`, use `Micronaut.run()`
- [ ] Remove `logback.xml` (if using ssv-common-logging)
- [ ] Remove logback dependency
- [ ] Update DataDog/OpenTelemetry config to use `@Factory`/`@Singleton` (if applicable)
- [ ] Update `JAVA_MAIN_CLASS` in Dockerfile (if main class name changed)
- [ ] Review CI config for Spring Boot-specific commands

## 9. Verification

- [ ] `./gradlew clean build` passes with zero test failures
- [ ] Pact tests pass: `./gradlew clean build -x test verifyPacts ...` (if applicable)
- [ ] No tests deleted or semantically altered
