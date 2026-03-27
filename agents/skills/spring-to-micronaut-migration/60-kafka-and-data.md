# Module 60: Kafka and Data

## Kafka

### Dependency Changes

| Remove | Add |
|--------|-----|
| `spring-cloud-stream-binder-kafka` | `com.nwboxed:kafka-utils:3.0.0` |
| `kafka-avro-serializer` | — (remove) |

State machine:

| Remove | Add |
|--------|-----|
| `mettle-statemachine-spring` | `mettle-statemachine-micronaut` |
| `mettle-statemachine-kafka-test-spring` | `mettle-statemachine-kafka-test-micronaut` |

### Kafka Producer: KafkaTemplate → @KafkaClient

```java
// Old Spring approach
@Service
@RequiredArgsConstructor
public class MyProducer {
    private final KafkaTemplate<String, MyEvent> kafkaTemplate;

    public void sendEvent(MyEvent event) {
        kafkaTemplate.send("my-topic", event.getId(), event);
    }
}

// New Micronaut approach
@KafkaClient
public interface MyProducer {
    @Topic("my-topic")
    void sendEvent(@KafkaKey String key, MyEvent event);
}

// Usage in service — inject the interface directly
@Singleton
@RequiredArgsConstructor
public class MyService {
    private final MyProducer producer;

    public void doSomething(MyEvent event) {
        producer.sendEvent(event.getId(), event);
    }
}
```

### Kafka Listener Annotations

Use Micronaut's `@KafkaListener` (same annotation name, different import — ensure it comes from Micronaut Kafka, not Spring).

### Kafka Configuration in application.yml

Move from Spring Cloud Stream format to Micronaut Kafka format:

```yaml
# Old (remove)
spring:
  cloud:
    stream:
      kafka:
        binder:
          brokers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}

# New (add)
kafka:
  bootstrap.servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
  consumers:
    default:
      group-id: my-service
      auto-offset-reset: earliest
  producers:
    default:
      acks: all
```

## Databases (JPA/Hibernate)

### Dependency Changes

| Remove | Add |
|--------|-----|
| `spring-boot-starter-data-jpa` | `io.micronaut.sql:micronaut-jdbc-hikari` |
| — | `io.micronaut.data:micronaut-data-hibernate-jpa` |

### Datasource Configuration

```yaml
# Old
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: ${DB_USER}
    password: ${DB_PASS}

# New
datasources:
  default:
    url: jdbc:postgresql://localhost:5432/mydb
    username: ${DB_USER}
    password: ${DB_PASS}
```

### Repository Annotations

- Keep `@Repository` but update the import:
  - `import io.micronaut.data.annotation.Repository;`
  - Repository interfaces should extend Micronaut's `JpaRepository`:
    ```java
    import io.micronaut.data.annotation.Repository;
    import io.micronaut.data.jpa.repository.JpaRepository;

    @Repository
    public interface UserRepository extends JpaRepository<User, UUID> { ... }
    ```
- Database driver dependencies remain unchanged

### Transaction Management

| Spring | Micronaut / Jakarta |
|--------|---------------------|
| `@Transactional` from `org.springframework.transaction` | `@Transactional` from `io.micronaut.transaction.annotation` or `jakarta.transaction` |

Ensure transaction management is configured (automatically provided by `micronaut-data-hibernate-jpa`).
