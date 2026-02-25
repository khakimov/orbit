# Learning Steps for New Cards

refs: `specs/`, `packages/core/src/schedulers/spacedRepetitionScheduler.ts`

## Problem

New cards jumped from creation straight to a 5-day interval on first success (or 10-minute retry on failure). Too harsh — a card you just learned 30 seconds ago shouldn't wait 5 days. FSRS and Anki both use "learning steps" to reinforce new material before entering spaced review.

## Design

Two configurable learning steps (1min, 10min) before graduating to spaced review:

```
New card -> Remembered -> due in 10 min (step 0 -> 1)
         -> Forgotten  -> due in 1 min  (stay step 0)

Step 1   -> Remembered -> graduate: 5-day interval, normal spaced review
         -> Forgotten  -> due in 1 min  (back to step 0)

Graduated (no learningStep) -> existing logic unchanged
```

First successful review skips step 0 (1min) and goes directly to step 1 (10min). Rationale: if you remember it immediately, the 1-minute cram adds nothing.

## Implementation

#### Data model
- `learningStep?: number` added to `TaskComponentState` and `SchedulerOutput`
- Optional field: backward compatible, old cards without it are treated as graduated

#### Scheduler (`spacedRepetitionScheduler.ts`)
- Config: `learningSteps: [60_000, 600_000]` (1min, 10min in ms)
- Three-way branching: learning phase -> first review -> graduated card
- During learning: no jitter (exact timing matters), no ease changes
- On graduation: sets initial ease (`intervalGrowthFactor + easeIncrement`)
- Graduated cards: entirely unchanged

#### Task reducers
- No changes needed. Spread of `SchedulerOutput` carries `learningStep` through.

## Decisions

- First-review detection uses explicit `intervalMillis === 0 && learningStep === undefined` to be robust against future branch reordering
- Ease factor is not adjusted during learning — only established on graduation
- Jitter applied on graduation (consistent with normal spaced review)
- Forgotten during learning always resets to step 0 (1min), regardless of which step you were on

## Verification

- 37/37 scheduler tests pass (8 new + existing updated)
- 18/18 task reducer tests pass (unchanged)
- `tsc -b` clean build
