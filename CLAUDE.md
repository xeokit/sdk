# CLAUDE.md

Behavioral guidelines to reduce common coding and design mistakes.

These guidelines bias toward maintainability, correctness, and clarity over speed.

---

# 1. Think Before Coding

Do not assume. Do not hide uncertainty.

Before implementing:

* State assumptions explicitly.
* If multiple interpretations exist, present them.
* If requirements are unclear, ask.
* If a simpler solution exists, mention it.
* Push back on unnecessary complexity.

When requirements are ambiguous:

* Prefer clarification over speculative implementation.
* Do not silently choose an interpretation.
* Explain tradeoffs when multiple solutions are viable.

---

# 2. Simplicity First

Prefer the simplest solution that fully solves the problem.

* No features beyond what was requested.
* No speculative abstractions.
* No future-proofing without a concrete need.
* No configurability that is not required.
* No error handling for impossible scenarios.

Ask:

> Would a senior engineer consider this over-engineered?

If yes, simplify.

Generate code that minimizes cognitive load.

Prefer:

* local reasoning
* explicit dependencies
* small cohesive modules
* delayed abstraction

Avoid:

* unnecessary interfaces
* factories without need
* indirection layers
* configuration mechanisms without multiple use cases

Favor:

* readability over cleverness
* duplication over premature generalization
* understanding over architectural elegance

Treat cognitive load as a primary design constraint.

---

# 3. Surgical Changes

Touch only what is required.

When modifying existing code:

* Do not refactor unrelated code.
* Do not reformat unrelated code.
* Do not modify adjacent code unnecessarily.
* Match existing project conventions.

If your changes create unused code:

* Remove imports made unused by your changes.
* Remove variables made unused by your changes.
* Remove functions made unused by your changes.

Do not remove pre-existing dead code unless explicitly asked.

Every changed line should trace directly to the requested task.

---

# 4. Goal-Driven Execution

Convert requests into verifiable outcomes.

Examples:

* "Fix bug" → reproduce with a test, then make it pass.
* "Add validation" → add failing tests, then implement validation.
* "Refactor" → preserve behavior and verify tests before and after.

For multi-step work:

```text
1. Step → verification
2. Step → verification
3. Step → verification
```

Define success criteria before implementation.

---

# 5. Agent Behavior

Work autonomously.

* Do not ask permission between implementation steps.
* Do not provide progress updates unless blocked.
* Do not ask for feedback on your performance.
* Do not ask whether the result is satisfactory.
* Only ask questions when information is genuinely required.

Assume the user is technically proficient.

Keep communication concise and direct.

---

# 6. Communication Style

Use plain engineering language.

Avoid fashionable or metaphorical terminology such as:

* blast radius
* vibe
* sharp edges
* footgun
* magic
* escape hatch
* mental model

Prefer:

* API
* module
* class
* method
* dependency
* side effect
* limitation
* implementation detail
* scope of change

Write as an engineer communicating with another engineer.

Keep explanations concrete and grounded in the codebase.

---

# 7. Code Comments

Minimize comments.

Code should explain what it does through structure and naming.

Use comments only when explaining:

* why something exists
* a constraint
* a non-obvious tradeoff
* a protocol requirement

Do not:

* narrate obvious behavior
* explain what the code literally does
* reference previous implementations
* reference historical changes

Avoid comments such as:

```text
Changed from X to Y
Legacy implementation did Z
```

Describe only current behavior.

---

# 8. Design Principles

## SOLID

* A class should have a single reason to change.
* Extend behavior through composition before modification.
* Subtypes must be substitutable for base types.
* Prefer small, role-focused interfaces.
* Depend on abstractions at architectural boundaries.

Do not introduce abstractions solely for future flexibility.

Create abstractions when they:

* isolate a dependency
* define a role
* simplify testing
* reduce coupling

---

## GRASP

* Place behavior where the required information exists.
* Prefer low coupling.
* Prefer high cohesion.
* Use polymorphism where it simplifies conditional logic.
* Use indirection to reduce direct dependencies.
* Protect stable code from volatile dependencies.

---

## Tell, Don't Ask

Behavior should live with the data it operates on.

Prefer:

```java
order.cancel();
```

Over:

```java
if (order.getStatus() == OPEN) {
    order.setStatus(CANCELLED);
}
```

---

## Law of Demeter

Objects should communicate only with:

* themselves
* direct dependencies
* objects they create

Avoid deep call chains.

Prefer:

```java
order.getCustomerCountry();
```

Over:

```java
order.getCustomer().getAddress().getCountry();
```

---

## Encapsulation

* Keep invariants inside the owning object.
* Avoid exposing mutable state.
* Minimize setters.
* Avoid public fields.

Illegal states should be difficult to represent.

---

## Composition Over Inheritance

Prefer composition unless:

* there is a genuine "is-a" relationship
* substitutability is guaranteed
* inheritance reduces complexity

Do not use inheritance solely for code reuse.

---

## Rich Domain Models

Business behavior belongs in domain objects.

Prefer:

```java
account.withdraw(amount);
```

Over:

```java
accountService.withdraw(account, amount);
```

Use domain terminology in names.

Avoid generic names such as:

* Manager
* Processor
* Helper
* Util
* Engine

Prefer names that reflect business concepts.

---

## Package and Module Design

* Dependency graphs should be acyclic.
* Depend toward stable modules.
* Stable modules should expose abstractions, not implementation details.

Respect layering.

A lower-level module must not reference higher-level implementations.

Modules should remain agnostic of their consumers.

Follow the Hollywood Principle:

> Don't call us, we'll call you.

---

## Functional Core / Imperative Shell

When practical:

* Keep business logic pure.
* Isolate side effects.
* Push infrastructure concerns to boundaries.

Examples of side effects:

* databases
* HTTP
* filesystems
* queues
* clocks
* randomness

---

# 9. Code Smells

Flag and avoid:

## God Objects

Classes that accumulate unrelated responsibilities.

## Anemic Domain Models

Data structures with behavior pushed into services.

## Feature Envy

Methods that primarily manipulate another object's state.

## Shotgun Surgery

Small changes requiring edits across many files.

## Divergent Change

A class changing for unrelated reasons.

## Primitive Obsession

Using primitives where domain types should exist.

## Long Parameter Lists

Often indicates a missing abstraction.

## Boolean Parameters

Prefer explicit behavior.

Avoid:

```java
save(user, true);
```

Prefer:

```java
saveAndPublish(user);
```

---

# 10. Review Checklist

Before finalizing:

1. Does each class have a clear responsibility?
2. Are dependencies explicit?
3. Is coupling minimized?
4. Is cohesion high?
5. Is composition preferred over inheritance?
6. Are invariants encapsulated?
7. Are domain concepts represented explicitly?
8. Are interfaces role-focused?
9. Are there Law of Demeter violations?
10. Can the design be simplified further?

When principles conflict, prioritize:

1. Correctness
2. Simplicity
3. Maintainability
4. Clarity
5. Flexibility

Do not sacrifice simplicity for hypothetical future requirements.
