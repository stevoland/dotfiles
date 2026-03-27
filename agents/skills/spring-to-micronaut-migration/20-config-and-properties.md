# Module 20: Configuration and Properties

## application.yml — Root Key

- Rename root key from `spring:` to `micronaut:`
- Remove root key `management:` entirely (management endpoints are configured under `endpoints:` in Micronaut)
- Replace `${spring.profiles.active}` interpolation with `${micronaut.environments}`

## Jackson Serialisation

```yaml
# Spring
spring:
  jackson:
    default-property-inclusion: non_null

# Micronaut
jackson:
  serialization-inclusion: non_null
```

## Metrics and Prometheus

Add under `micronaut:`:

```yaml
micronaut:
  metrics:
    enabled: true
    export:
      prometheus:
        enabled: true
        step: PT1M
        descriptions: true

endpoints:
  prometheus:
    sensitive: false
  health:
    enabled: true
    sensitive: false
    details-visible: ANONYMOUS
```

> **Note:** If you have serialisation issues with `TaskId`, remove `details-visible: ANONYMOUS`.

## Security

Add under `micronaut:`:

```yaml
micronaut:
  security:
    enabled: true
    authentication: bearer
    basic-auth.enabled: false
    token:
      name-key: user_name
      jwt:
        enabled: true
        signatures.secret.validation.secret: "${JWT_SIGNING_KEY:pleaseChangeThisSecretForANewOne}"
        claims-validators.subject-not-null: false
```

**Public endpoints**: Do NOT add routes to the `security` section (other than api-docs).
Use `@Secured(SecurityRule.IS_ANONYMOUS)` on controllers/methods instead.

## OpenAPI/Swagger

Add under `micronaut:`:

```yaml
micronaut:
  security:
    intercept-url-map:
      - pattern: /api-docs/**
        access:
          - isAnonymous()
  router:
    static-resources:
      swagger:
        paths: classpath:META-INF/swagger
        mapping: /api-docs/**
```

> **Note for PSD2 services:** `openbanking-api-models-micronaut` provides its own `/v3/api-docs` endpoint — the OpenAPI YAML block above is not needed for PSD2 services. See module 90.

## Datasource (if JPA used)

```yaml
# Spring
spring:
  datasource:
    url: jdbc:...
    username: ...
    password: ...

# Micronaut
datasources:
  default:
    url: jdbc:...
    username: ...
    password: ...
```

## Kafka

Move Kafka configuration from Spring Cloud Stream format to Micronaut Kafka format:

```yaml
# Spring Cloud Stream (remove)
spring:
  cloud:
    stream:
      kafka:
        binder:
          brokers: ...

# Micronaut Kafka (add)
kafka:
  bootstrap.servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
  consumers:
    default:
      ...
  producers:
    default:
      ...
```

## Test Configuration (application-test.yml or application-test.yaml)

- Change root key from `spring:` to `micronaut:`
- Add random port:

```yaml
micronaut:
  server:
    port: -1
```

- Set `MICRONAUT_ENVIRONMENTS` system property in `build.gradle` test task (see module 10).

## Pact Test Configuration (application-pact.yml, if present)

Update to use Micronaut keys — same rules as above.
