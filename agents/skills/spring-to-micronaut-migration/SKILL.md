---
name: spring-to-micronaut-migration
description: Migrate a Spring Boot service to Micronaut 4. Use when asked to perform or assist with a Spring Boot to Micronaut 4 migration — covering dependencies, annotations, DI, security, controllers, Kafka, testing, and PSD2 variants.
verify: "./gradlew clean build 2>&1"
---

# Skill: Spring Boot → Micronaut 4 Migration

## Overview

This skill guides you through migrating a Spring Boot service to Micronaut 4.
All instruction modules are co-located in this directory. Read this file first,
then load relevant modules in the order listed below.

## How to Use This Skill

1. **Read all of `00-rules-and-success-criteria.md` before touching any code.**
   It contains non-negotiables, build commands, and the definition of done.

2. **Detect the service type** — check whether the service name starts with `psd2-`:
   - Standard service → follow modules 10–80 only.
   - PSD2 service → follow modules 10–80 AND module 90.

3. **Load modules in order.** Each module is self-contained but builds on prior ones.

4. **Use the appropriate checklist** to track progress and report back.
   - Standard: `checklists/standard-service-checklist.md`
   - PSD2: `checklists/psd2-service-checklist.md`

## Module Index

| File | Contents |
|------|----------|
| `00-rules-and-success-criteria.md` | Non-negotiables, build commands, done definition |
| `10-build-and-dependencies.md` | build.gradle, gradle.properties, all dependency mappings |
| `20-config-and-properties.md` | application.yml migration, metrics, security YAML, OpenAPI YAML |
| `30-annotations-and-di.md` | All annotation mappings, DI rules |
| `40-security-jwt-and-auth.md` | Security config, JWT, auth-jwt removal, JwtUtils, JwtClaimsGenerator |
| `50-controllers-http-clients-exceptions.md` | Controllers, Feign→declarative client, exception handlers, OpenAPI docs |
| `60-kafka-and-data.md` | Kafka config, KafkaTemplate→@KafkaClient, JPA/datasource, transactions |
| `70-testing-and-pact.md` | Test annotations, MockMvc, basic tests, Pact migration, mock setup |
| `80-misc-and-pitfalls.md` | Main class, logging, health, metrics, Lombok ordering, Dockerfile/CI |
| `90-psd2-overrides.md` | PSD2 deps, security config, TPP tokens, OB models, V3/V4 controllers, consumer pacts, test JWTs |
| `checklists/standard-service-checklist.md` | Ordered task list for standard services |
| `checklists/psd2-service-checklist.md` | Ordered task list for PSD2 services |

