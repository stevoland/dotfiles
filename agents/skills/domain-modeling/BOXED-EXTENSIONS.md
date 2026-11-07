# Boxed Domain Modeling Extensions

These rules extend [`SKILL.md`](./SKILL.md) and [`GLOSSARY-FORMAT.md`](./GLOSSARY-FORMAT.md) for `eeveebank` repositories.

## 1. Open Knowledge Format frontmatter

Prepend Open Knowledge Format 0.2 YAML frontmatter to every `GLOSSARY.md` above the Markdown structure from [`GLOSSARY-FORMAT.md`](./GLOSSARY-FORMAT.md). Derive `{repo-name}` from the repository directory name or `git remote get-url origin`.

```markdown
---
type: Domain Glossary
title: {Context Name} Glossary
description: Authoritative ubiquitous language for the {Context Name} bounded context.
tags:
  - glossary
  - domain-model
  - {domain-tag}
resource: https://github.com/eeveebank/{repo-name}
generated: false
verified: true
---

# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**{Term}**: {One or two sentence definition of what the concept is in this context.}
_Synonyms_: {Synonym 1}, {Synonym 2}
_Avoid_: {Neighbouring Context Term}
```

## 2. Synonyms versus `_Avoid_`

This rule overrides "Be opinionated" in [`GLOSSARY-FORMAT.md`](./GLOSSARY-FORMAT.md) for names that already appear in the repository.

- **`_Synonyms_`**: other names the service's code, schemas, events, or documentation already use for exactly the same concept. Do not tell readers to avoid a name that the code, published schemas, or events still use.
- **`_Avoid_`**: misleading names only, such as terms for a different or neighbouring concept, or names used ambiguously across contexts.

List names only, comma-separated. Keep definitions describing only the concept itself; do not explain why a term is a synonym or should be avoided. If a confusing term is its own concept in this context, give it its own entry.

Pick one canonical term as the entry heading, but treat interchangeable names already used in the service as synonyms, not avoided terms. For example, if Kafka events call an Accounting Integration a "connection", write `_Synonyms_: Connection`.

## 3. `seed` mode (`/domain-modeling seed`)

Run this workflow when invoked with `/domain-modeling seed` or when asked to bootstrap a `GLOSSARY.md` for an existing repository.

1. **Mine repository sources.** Inspect `openwiki/domain/*.md`, `docs/adr/*.md`, `README.md`, Avro schemas in `*.avsc`, REST controllers, Kafka command and event names, and core domain aggregates.
2. **Keep only domain concepts.** Exclude framework types, infrastructure plumbing, database tables, and generic technical suffixes such as `Request`, `Response`, `Handler`, `Service`, `Entity`, and `Dto`.
3. **Surface synonym collisions.** Identify places where documentation, schemas, and code use different names for one concept, such as `Pot` versus `SubAccount` or `Payee` versus `Beneficiary`. Record names used interchangeably within the service as `_Synonyms_`; reserve `_Avoid_` for misleading names (see section 2).
4. **Present a shortlist for approval.** Propose 10 to 15 candidate terms with one or two sentence definitions, `_Synonyms_`, and `_Avoid_` aliases. Stop and wait for the engineer to approve, edit, or cut terms before writing `GLOSSARY.md`.

**Completion criterion:** `GLOSSARY.md` is written on disk with valid Open Knowledge Format frontmatter and contains only the terms approved by the engineer.
