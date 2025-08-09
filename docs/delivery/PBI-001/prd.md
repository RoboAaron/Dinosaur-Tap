# PBI-001: Simple Dinosaur Game for a 3-year-old

- Backlog: [Backlog](../backlog.md)

## Overview
A gentle, tap-based web game with big buttons, cheerful sounds, no fail states, and short positive feedback loops.

## Problem Statement
Young children need simple, immediate, positive interactions without reading or complex rules.

## User Stories
- As a 3-year-old, I can tap friendly dinosaurs and get fun visual/sound feedback.
- As a parent, I can open it on a device and let my child play safely offline.

## Technical Approach
- Web app with plain HTML/CSS/JS. No build step. Works offline via simple service worker (later task).
- One-screen app with large Play/Home buttons. High contrast.

## UX/UI Considerations
- Big tap targets (min 96px). Bright colors. Subtle motion. No negative feedback. No ads.

## Acceptance Criteria
- Loads in a modern mobile browser.
- Tap interaction produces positive audio/visual feedback.
- No fail state. Session length ~30–60s loop.

## Dependencies
- Open, attribution-free images/sounds.

## Open Questions
- Preferred color/theme? Asset preferences?

## Related Tasks
- [Tasks for PBI PBI-001](./tasks.md)
