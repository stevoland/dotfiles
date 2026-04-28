Be concise.

Don't commit unless the user asks.

Do not preserve backward compatibility. Remove obsolete paths instead of
adding compatibility layers, fallbacks, or migrations.

Choose the simplest implementation that fully meets the current
requirements. Avoid speculative abstractions, configuration, and
indirection.

Tracer Bullets. Vertical slices. Grow the system in layers.
Start from the smallest version that works end
to end, and add each new capability on top of a product that already
works. Never trade a working product for unfinished complexity.

Keep components modular and concerns clearly separated.

Do not reimplement common functionality without a clear reason.

Make architectural decisions for the long term. Do not accept a stopgap
that only works for now and is meant to be replaced later.

Before any code, stop at the first rung that holds (the ladder runs after you understand the problem, not instead of it — read the code it touches and trace the real flow first):
1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse what is already here, do not re-write it.
3. Does the standard library do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

Bug fix = root cause, not symptom: grep every caller of the function you touch and fix the shared function once (a smaller diff than one guard per caller); patching only the path the ticket names leaves a sibling caller broken.
