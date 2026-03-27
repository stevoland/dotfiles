# Checklist: PSD2 Service Migration

Use this checklist to track progress and verify completion. Report each item as done (✅) or blocked (❌) with a note.

PSD2 services must complete ALL items in sections 0–9 (standard migration) AND sections 10–16 (PSD2-specific).

## 0. Pre-Migration

- [ ] Read `00-rules-and-success-criteria.md` in full
- [ ] Confirmed: this IS a `psd2-*` service
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
- [ ] Update Pact dependency to `junit5` variant
- [ ] Set `systemProperty 'MICRONAUT_ENVIRONMENTS', 'test'` in test task

## 2. Configuration (module 20 — partial)

- [ ] Rename root key `spring:` → `micronaut:` in `application.yml`
- [ ] Remove `management:` root key
- [ ] Migrate Jackson serialisation config
- [ ] Add metrics/Prometheus config block
- [ ] Update `application-test.yml` (Micronaut root key, random port)
- [ ] Update Kafka config to Micronaut format (if applicable)
- [ ] Update datasource config (if applicable)
- [ ] **PSD2:** Do NOT add the standard OpenAPI YAML block (module 20) — use openbanking-api-models-micronaut endpoint instead

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

## 5. Controllers, HTTP Clients, Exceptions (module 50)

- [ ] Replace `@RestController` → `@Controller`
- [ ] Update HTTP method annotations
- [ ] Add `@ExecuteOn(TaskExecutors.BLOCKING)` to blocking controllers
- [ ] Replace Feign clients with Micronaut `@Client` declarative clients
- [ ] Remove Feign dependencies and config classes
- [ ] Update test helpers throwing `FeignException`

## 6. Kafka and Data (module 60) — skip if not used

- [ ] Replace Kafka/statemachine deps
- [ ] Replace `KafkaTemplate` with `@KafkaClient`
- [ ] Update JPA deps, repository imports, `@Transactional` import

## 7. Testing (module 70)

- [ ] Replace `@SpringBootTest` → `@MicronautTest`
- [ ] Replace `@AutoConfigureMockMvc` → remove
- [ ] Replace `@Autowired` → `@Inject`
- [ ] Replace Spring `@MockBean` with Micronaut factory-method `@MockBean`
- [ ] Fix MockMvc `.param()` calls to use URL query strings
- [ ] Fix AssertJ `assertThat(HttpStatus)` ambiguity

## 8. Misc (module 80)

- [ ] Update main class: remove `@SpringBootApplication`, use `Micronaut.run()`
- [ ] Remove `logback.xml` and logback dependencies
- [ ] Update `JAVA_MAIN_CLASS` in Dockerfile if changed
- [ ] Review CI config

## 10. PSD2 Dependencies (module 90)

- [ ] Add `psd2-exception-handling-micronaut` and `-test` (version ≥ 3.1.0)
- [ ] Add `psd2-token-replacement-micronaut` and `-test` (version ≥ 4.2.0)
- [ ] Add `openbanking-api-models-micronaut` (version ≥ 1.3.1)
- [ ] Remove Spring equivalents of the above

## 11. PSD2 Security Configuration (module 90)

- [ ] Set `reject-not-found: false`
- [ ] Set `name-key: client_id` (TPP tokens use `client_id` as subject)
- [ ] Set `tppJwtSigningKey` as the JWT validation secret
- [ ] Configure TPP token replacement: `application.consent.scope` and exclude patterns

## 12. PSD2 Exception Handling (module 90)

- [ ] Remove standard Micronaut error handlers / `micronaut-problem-json`
- [ ] Confirm `psd2-exception-handling-micronaut` handlers are active
- [ ] Update custom exceptions to extend `CustomException`

## 13. Open Banking API Models (module 90)

- [ ] Update model construction from builder pattern to fluent lowercase setters
- [ ] Update `Optional` accessors: use `getXxxOptional()` where `Optional<T>` was returned
- [ ] Update `OffsetDateTime` → `Instant`
- [ ] Add base path to V4 controller class (not inherited from interface)

## 14. PSD2 Controller Patterns (module 90)

- [ ] All PSD2 controllers have `@Controller`, `@Secured(IS_AUTHENTICATED)`, `@ExecuteOn(BLOCKING)`
- [ ] All handler methods have `@Psd2FailureApiResponses`
- [ ] Authentication obtained via `SecurityService.getAuthentication().orElseThrow()`
- [ ] V3 controllers: bare return types, manual `@Operation`/`@ApiResponse`, `@AllArgsConstructor`
- [ ] V4 controllers: `HttpResponse<T>` return types, `@OpenBankingV4Errors`, `@RequiredArgsConstructor`, enum permissions

## 15. Auth Client Pact Test (module 90)

- [ ] `AuthClientTest` extends `AbstractAuthClientTest` and provides `exchangeObToken()`

## 16. Consumer Pact Tests (module 90, if applicable)

- [ ] Consumer Pact tests moved to `pact-consumer` environment
- [ ] `application-pact-consumer.yml` added with mock server URL
- [ ] `@BeforeEach` used (not `@BeforeAll`) for JWT setup
- [ ] JWT headers prefixed with `"Bearer "` manually

## 17. PSD2 Test Configuration (module 90)

- [ ] `application-test.yml` has both `jwtSigningKey` and `tppJwtSigningKey`
- [ ] JWT generator configured to use `tppJwtSigningKey`
- [ ] TPP test tokens built with `JwtClaimsGenerator.buildTppAccessToken("accounts")`

## 18. Verification

- [ ] `./gradlew clean build` passes with zero test failures
- [ ] Pact tests pass: `./gradlew clean build -x test verifyPacts ...`
- [ ] No tests deleted or semantically altered
