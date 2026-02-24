# LECTOR: LLM-Enhanced Concept-based Test-Oriented Repetition

refs: `packages/core/src/schedulers/spacedRepetitionScheduler.ts`, `arxiv:2508.03275`

Reference implementation: `/Users/rus/Projects/current/rnd/mochi/Talimio/backend/src/courses/services/`

## Summary

LECTOR extends standard spaced repetition with semantic awareness and per-learner adaptation.
Core insight: cards about similar concepts cause *interference* — reviewing "mitosis" right
after "meiosis" increases confusion. The scheduler detects this and adjusts intervals.

Benchmarked against SM-2, FSRS, SSP-MMC, and others on 100 simulated learners over 100 days:

| Algorithm | Success Rate | Avg Interval (days) | Total Attempts |
|-----------|-------------|---------------------|----------------|
| LECTOR    | 90.2%       | 5.20                | 50,706         |
| FSRS      | 89.6%       | 1.70                | 151,848        |
| SSP-MMC   | 88.4%       | 6.25                | 42,743         |
| THRESHOLD | 84.7%       | 12.88               | 25,012         |
| SM-2      | 47.1%       | 18.81               | 18,611         |

FSRS achieves similar retention but at 3x the review cost (avg 1.7-day intervals).
LECTOR and SSP-MMC hit ~88-90% with far fewer reviews.

Caveat: simulated learners, vocabulary domain, 100 days. Not validated on real humans
or conceptual knowledge.


## Architecture

### State vector (per learner-concept pair)

```
S(t) = (difficulty, half_life, repetition_count, mastery, semantic_interference)
```

Five dimensions tracked for each card a user is learning.


### Memory model

```
R(t + Δt) = exp(-Δt / (τ(t) * α(t) * β(t)))
```

- `R` — recall probability (0..1)
- `τ` — mastery-scaled half-life
- `α` — semantic interference modulation
- `β` — per-learner retention factor

Standard exponential forgetting curve, modulated by three independent factors.


### Semantic similarity

```
Φ(concept_a, concept_b) → [0, 1]
```

Computed via LLM embeddings of concept text. Builds an n*n interference matrix.
Only pairs above a similarity threshold are stored (saves computation at scheduling time).


## Implementation (from Talimio reference)

The reference implementation simplifies the paper's abstract formulas into concrete code.
What follows are the actual computations used.

### Constants

```
// Review intervals by rating (minutes)
INTERVALS = { 1: 5, 2: 60, 3: 240, 4: 360 }

// Mastery
DELTA_CORRECT   = +0.18
DELTA_INCORRECT = -0.25
LATENCY_PENALTY_MAX = 0.12
LATENCY_PENALTY_MULTIPLIER = 10000.0

// Interval adjustment
EXPOSURE_MULTIPLIER = 0.2
DURATION_BASE_MS = 90000          // 90 seconds reference
DURATION_ADJUSTMENT_MIN = 0.6
DURATION_ADJUSTMENT_MAX = 1.2

// Semantic
SIMILARITY_THRESHOLD = 0.78       // cosine similarity cutoff
CONFUSION_LAMBDA = 0.3            // weight of σ in scheduling
RISK_RECENT_K = 3                 // number of recent concepts for context

// Learner profile
EMA_LAMBDA = 0.1                  // exponential moving average weight
SPEED_MIN = 0.3
SPEED_MAX = 2.0
SPEED_BASE_MS = 60000             // 60 seconds reference
SENSITIVITY_DECAY = 0.9           // on low rating
SENSITIVITY_BOOST = 1.1           // on high rating
SENSITIVITY_MIN = 0.4
SENSITIVITY_MAX = 1.6

// Prerequisites
UNLOCK_MASTERY_THRESHOLD = 0.5
```


### 1. Interval calculation

```
base = INTERVALS[rating]
multiplier = 1.0 + (exposures * EXPOSURE_MULTIPLIER)

// Speed factor: fast response = longer interval
if duration_ms > 0:
    speed = clamp(DURATION_BASE_MS / max(duration_ms, 1000),
                  DURATION_ADJUSTMENT_MIN,
                  DURATION_ADJUSTMENT_MAX)
    multiplier *= speed

interval = base * multiplier

// Semantic dampening: similar recent concepts = shorter interval
σ = max_cosine_similarity_to_last_K_concepts
dampener = 1.0 / (1.0 + CONFUSION_LAMBDA * σ)    // range: ~0.77..1.0
interval = max(interval * dampener, 1.0)

next_review = now + interval
```

#### Worked example

```
Rating 4, 1 prior exposure, answered in 30 seconds, σ = 0.85

base = 360 min
multiplier = 1.0 + (1 * 0.2) = 1.2
speed = 90000 / 30000 = 3.0 → clamped to 1.2
multiplier = 1.2 * 1.2 = 1.44
interval = 360 * 1.44 = 518.4 min

dampener = 1 / (1 + 0.3 * 0.85) = 0.797
final = 518.4 * 0.797 ≈ 413 min ≈ 7 hours
```


### 2. Mastery update

```
delta = correct ? DELTA_CORRECT : DELTA_INCORRECT

// Latency penalty: slow answers penalised
if latency_ms > 0:
    penalty = min(latency_ms / LATENCY_PENALTY_MULTIPLIER, LATENCY_PENALTY_MAX)
    delta -= penalty

mastery = clamp(mastery + delta, 0.0, 1.0)
```

Asymmetric: correct +0.18, incorrect -0.25. Forgetting punishes harder than
remembering rewards. Latency adds up to -0.12 additional penalty.


### 3. Learner profile update (EMA)

Four dimensions, updated after each review with λ = 0.1:

```
profile.success_rate = (1 - λ) * old + λ * (rating >= 3 ? 1.0 : 0.0)

profile.retention_rate = (1 - λ) * old + λ * current_mastery

if duration_ms > 0:
    speed = clamp(SPEED_BASE_MS / duration_ms, SPEED_MIN, SPEED_MAX)
    profile.learning_speed = (1 - λ) * old + λ * speed

adjustment = rating <= 2 ? SENSITIVITY_DECAY : SENSITIVITY_BOOST
profile.semantic_sensitivity = clamp(
    old * adjustment, SENSITIVITY_MIN, SENSITIVITY_MAX
)
```

Default profile: `{ success_rate: 0.5, retention_rate: 0.8, learning_speed: 1.0, semantic_sensitivity: 1.0 }`


### 4. Semantic similarity pipeline

1. Embed concept text: `"{name}\n\n{description}"` via LLM embedding model
2. Compute pairwise similarity: `1.0 - L2_distance(embedding_a, embedding_b)`
3. Store pairs with similarity >= `SIMILARITY_THRESHOLD` (0.78)
4. At scheduling time: find max similarity between candidate and last K reviewed concepts

The similarity matrix is precomputed at content creation time, not during reviews.


### 5. Frontier sorting (what to review next)

```
priority = (1.0 - mastery) - (CONFUSION_LAMBDA * sensitivity * σ)
```

Cards with low mastery are prioritised, but penalised if they're semantically
close to recently reviewed cards (high σ). This prevents confusion from
back-to-back similar concepts.


## Comparison with Orbit's current scheduler

| Aspect | Orbit (SM-2 style) | LECTOR |
|--------|-------------------|--------|
| Interval growth | Fixed 2.3x multiplier | Rating-based base + 4 adjustment factors |
| Per-card difficulty | None | Mastery + semantic interference |
| Per-user adaptation | None | 4D learner profile with EMA |
| Semantic awareness | None | Embedding similarity, dampened intervals |
| Response time | Ignored | Speed factor adjusts interval |
| Forgotten handling | interval / 2.3 | mastery -= 0.25, short interval (5 min) |
| Initial interval | 5 days | 5 min to 6 hours (rating-dependent) |

Orbit's scheduler: `packages/core/src/schedulers/spacedRepetitionScheduler.ts`

```ts
// Current Orbit config
intervalGrowthFactor: 2.3
initialReviewInterval: 5 days
```


## Integration notes for Orbit

### What would need to change

1. *Card embeddings* — generate embeddings from card question + answer text.
   Could use provenance/source as additional signal for grouping.

2. *Similarity table* — precompute pairwise similarity at card creation time.
   Store pairs above threshold. Event-sourced: a `CardSimilarityEvent` or
   computed on-the-fly from stored embeddings.

3. *Mastery tracking* — add `mastery` field to task component state.
   Currently Orbit tracks `intervalMillis` and `dueTimestampMillis` but not
   an explicit mastery score.

4. *Learner profile* — new per-user state: `{ success_rate, retention_rate, learning_speed, semantic_sensitivity }`.
   Updated via EMA on each `TaskRepetitionEvent`.

5. *Interval calculation* — replace the single `interval * 2.3` with
   the multi-factor computation. The semantic dampening is the key addition:
   `interval *= 1 / (1 + λσ)`.

6. *Review queue ordering* — add frontier sorting that accounts for
   semantic interference with recently reviewed cards.

### What can stay the same

- Event-sourced architecture (events produce state, same pattern)
- `TaskRepetitionEvent` with outcome (maps to rating)
- `dueTimestampMillis` / `intervalMillis` on component state
- Review session max size (50) and lookahead window (16h)
- Jitter for queue clustering prevention

### Incremental path

1. Add per-card mastery tracking (no breaking changes)
2. Add response-time tracking to `TaskRepetitionEvent`
3. Implement speed factor and asymmetric mastery deltas
4. Add embeddings + similarity computation
5. Add semantic dampening to interval calculation
6. Add learner profile with EMA updates
7. Add frontier sorting with confusion penalty


## Source files (Talimio reference)

- `backend/src/courses/services/concept_scheduler_service.py` — interval calculation, profile update
- `backend/src/courses/services/concept_state_service.py` — mastery tracking
- `backend/src/courses/services/concept_graph_service.py` — embeddings, similarity
- `backend/src/courses/models.py` — database schema
- `backend/src/config/settings.py` — all constants

## References

- Paper: arxiv.org/abs/2508.03275
- FSRS: github.com/open-spaced-repetition/free-spaced-repetition-scheduler
- Implementing FSRS in 100 lines: borretti.me/article/implementing-fsrs-in-100-lines
