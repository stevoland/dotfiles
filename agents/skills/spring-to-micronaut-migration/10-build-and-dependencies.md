# Module 10: Build and Dependencies

## General Rule

Only define variables in `gradle.properties` if they are used **multiple times** across the build file.
Single-use versions should be hardcoded directly in `build.gradle`.

## Build Configuration (build.gradle)

### Plugin Changes

| Remove | Add |
|--------|-----|
| `id 'org.springframework.boot'` | `id 'io.micronaut.minimal.application' version '4.6.2'` (or higher — this is the plugin version, NOT the Micronaut framework version) |
| `id 'io.spring.dependency-management'` | — |
| — | `id 'com.gradleup.shadow' version '8.3.9'` (or higher) |

### Application and Shadow Jar

```groovy
application {
    mainClass.set("com.example.Application")
}

shadowJar {
    mergeServiceFiles()
}
```

### Gradle Properties (gradle.properties)

Add:
```properties
micronautVersion=4.10.8
```
(Check for a newer version if released after Feb 2026.)

Add any other Micronaut-specific plugin versions used more than once.

## Dependency Mapping

### Core Starters

| Spring | Micronaut |
|--------|-----------|
| `spring-boot-starter-web` | `io.micronaut:micronaut-http-server-netty` |
| `spring-boot-starter-security` | `io.micronaut.security:micronaut-security` |
| `spring-boot-starter-actuator` | `io.micronaut:micronaut-management` + `io.micronaut.micrometer:micronaut-micrometer-registry-prometheus` |
| `spring-cloud-stream` | `com.nwboxed:kafka-utils:3.0.0` |
| `spring-boot-starter-data-jpa` | `io.micronaut.sql:micronaut-jdbc-hikari` + `io.micronaut.data:micronaut-data-hibernate-jpa` |
| `spring-boot-starter-logging` | Remove; use `uk.co.mettle.common:ssv-common-logging:2.7.5` |
| `spring-boot-devtools` | Remove entirely |

### Always Add

```groovy
implementation("io.micronaut:micronaut-jackson-databind")        // JSON support
implementation("uk.co.mettle.common:ssv-common-logging:2.7.5")  // standardised logging
runtimeOnly("org.yaml:snakeyaml")                                // YAML config files
```

### Annotation Processors

Always add (in this order — Lombok MUST come first):

```groovy
annotationProcessor("org.projectlombok:lombok:${lombokVersion}")
annotationProcessor("io.micronaut.validation:micronaut-validation-processor")
annotationProcessor("io.micronaut.security:micronaut-security")       // if using security
annotationProcessor("io.micronaut.openapi:micronaut-openapi")          // if using OpenAPI
```

Same ordering applies for `testAnnotationProcessor`.

### Security Dependencies

```groovy
implementation("io.micronaut.security:micronaut-security")
implementation("io.micronaut.security:micronaut-security-jwt")         // if using JWT
implementation("com.nwboxed:micronaut-mettle-security:2.3.27")        // or higher
testImplementation("com.nwboxed:micronaut-test-utils:2.4.0")          // or higher
```

Remove all `spring-security-*` dependencies (including `spring-security-core`).
Remove `com.eeveebank:auth-jwt` completely (see module 40 for replacements).

### HTTP Client (replacing Feign)

```groovy
implementation("io.micronaut:micronaut-http-client")
```

Remove: `spring-cloud-starter-openfeign`, `feign-okhttp`, and any Feign config.

### OpenAPI/Swagger

```groovy
annotationProcessor("io.micronaut.openapi:micronaut-openapi")
implementation("io.swagger.core.v3:swagger-annotations")
```

Remove `springdoc-*` dependencies.

### Testing Dependencies

Replace `spring-boot-starter-test` with:

```groovy
testImplementation("io.micronaut.test:micronaut-test-junit5")
testImplementation("org.junit.jupiter:junit-jupiter-api")
testImplementation("org.junit.jupiter:junit-jupiter-params")
testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
testImplementation("org.mockito:mockito-core:5.15.2")               // explicit version
testImplementation("org.assertj:assertj-core")
testImplementation("com.nwboxed:micronaut-mockmvc:1.2.0")           // or latest
testImplementation("io.micronaut:micronaut-http-client")
testImplementation("org.awaitility:awaitility:4.2.2")
```

### Pact (if applicable)

Update from `au.com.dius.pact.provider:junit5spring` to `au.com.dius.pact.provider:junit5`.

### Liquibase (if applicable)

```groovy
implementation("io.micronaut.liquibase:micronaut-liquibase")
```

### Test Task in build.gradle

```groovy
test {
    systemProperty 'MICRONAUT_ENVIRONMENTS', 'test'
    useJUnitPlatform()
}
```

### Organise Sections

Group dependencies logically: annotation processors, implementation, runtime, test.
