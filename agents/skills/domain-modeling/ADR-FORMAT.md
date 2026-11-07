# ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily: only when the first ADR is needed.

## Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why*, not in filling out sections.

## Optional sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`): useful when decisions are revisited
- **Considered Options**: only when the rejected alternatives are worth remembering
- **Consequences**: only when non-obvious downstream effects need to be called out

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## When to offer an ADR

All three of these must be true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it: you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

Do not write an ADR for standard paved-road choices or structure that is already obvious from reading the code. Record an ADR when the *why* is invisible in the code:

- **Deviations from the paved road or platform defaults.** "We deploy ADK agents in containers rather than managed ADK hosting because ADK did not support OpenTelemetry instrumentation at the time."
- **Deliberate convention-breaking for a trade-off.** "We nest a saga inside an existing saga and trigger it with a command, even though sagas normally only listen to events, so we can reuse its steps and compensations across processes without duplicating them." These stop the next engineer or agent from "fixing" something that was deliberate.
- **Boundary and ownership decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **External or point-in-time constraints not visible in the code.** Partner API SLAs, compliance rules, or upstream platform limitations at the time of build that forced a non-obvious design.
- **Rejected alternatives when the rejection is non-obvious.** If an obvious approach was evaluated and ruled out for subtle reasons, record it so someone does not propose it again in six months.
