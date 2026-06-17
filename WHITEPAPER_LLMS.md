---
title: xeokit SDK — How AI Was Used in Its Design and Implementation
---

# xeokit SDK — How AI Was Used in Its Design and Implementation

*A precise account of how large language models were used to build this SDK, and the engineering process that governed their use.*

---

## TL;DR

The SDK's core — Scene, Data, Viewer, WebGLRenderer, and the architecture connecting them — was designed and built by hand, from prior experience building WebGL-based SDKs and engines. Once that core was proven with hand-written loaders, AI was used to accelerate implementation within it: additional format loaders and exporters, plus some renderer effects, written against the established API and grounded in the proven xeokit V2 codebase. Every AI contribution was read, tested, code-inspected, and revised by an engineer before it was kept.

---

## Purpose of this document

This document describes how AI tools were used in designing and implementing this SDK. The intent is to be precise about what was human-designed, what was AI-assisted, and what review every contribution passed through — so that anyone evaluating the SDK understands exactly what they are adopting.

---

## The core was designed by hand

The core of the SDK — the Scene, the Data model, the Viewer, the WebGLRenderer, and the relationships between them — was designed by hand. The API shape and the architecture follow a deliberate set of opinions about how these systems should be built, drawn from prior experience building other WebGL-based SDKs and engines.

The coordinate system, the scene-graph / data-graph separation, the data-texture batching strategy in the renderer, the error-handling conventions, and the overall module organisation are deliberate, human-made choices established up front.

During this phase, GitHub Copilot and ChatGPT were used for polish and debugging — filling in mechanical detail, catching mistakes, and working through problems.

---

## Building on a proven core

Once the core was working and proven with a couple of hand-written loaders, the architecture was stable enough to build against. At that point, Claude was introduced to extend the SDK along the lines the core already established.

Claude was used to produce:

- additional model and drawing format loaders and exporters, written against the existing Scene/Data API and the conventions the hand-written loaders set, and
- some of the visual effects in the renderer.

In every case the architecture came first and the AI worked within it, filling in implementations against an API and a set of patterns that already existed.

---

## The xeokit V2 codebase as a reference

Claude was given the existing xeokit V2 codebase to work from as a reference. V2 already contained mature, proven implementations of many formats and techniques, so the work was largely one of carrying established approaches forward onto the new architecture, rather than inventing them from scratch. This based the AI's output on code that had already been used in production.

---

## Review, testing, and iteration

Every contribution Claude made passed through human review:

- Each piece was read and understood before it was accepted.
- Everything was tested and code-inspected.
- Each piece went through many iterations of review — correcting mistakes, simplifying over-engineered solutions, enforcing the SDK's conventions, and revising output until it met the standard.

AI accelerated the work; engineering judgement decided what is correct, what fits the architecture, and what is released.

---

## What this means for adopters

- The architecture and core are human-designed, based on prior engineering experience.
- AI assistance was scoped to implementation within that architecture, after the foundations were proven.
- Proven prior art (xeokit V2) provided the basis for that assistance.
- Human review, testing, and iteration applied to every contribution.

---

<!--
Notes for further development (to be distilled into WHITEPAPER.md / WHITEPAPER_EXEC.md):
- Concrete examples of the review/push-back loop on a specific loader or effect.
- Which parts are hand-written vs AI-assisted, at a finer grain.
- Testing approach (unit tests, snapshot/visual checks) as evidence of verification.
- A short statement on provenance / licensing of AI-assisted code if relevant.
-->
