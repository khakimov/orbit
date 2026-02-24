import { TaskComponentState, TaskID } from "../entities/task.js";
import { TaskRepetitionOutcome } from "../event.js";
import {
  createSpacedRepetitionScheduler,
  defaultSpacedRepetitionSchedulerConfiguration,
} from "./spacedRepetitionScheduler.js";

const scheduler = createSpacedRepetitionScheduler();
const testTaskID = "test_task_123" as TaskID;
const testComponentID = "main";

describe("first repetition", () => {
  const state: TaskComponentState = {
    createdAtTimestampMillis: 1000,
    lastRepetitionTimestampMillis: null,
    dueTimestampMillis: 1000,
    intervalMillis: 0,
  };

  test("remembered almost immediately", () => {
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        state,
        2000,
        TaskRepetitionOutcome.Remembered,
        testTaskID,
        testComponentID,
      );

    expect(intervalMillis).toBe(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval,
    );

    // Should be small, within jitter.
    expect(dueTimestampMillis - (2000 + intervalMillis)).toMatchInlineSnapshot(
      `86000`,
    );
  });

  test("remembered with long delay", () => {
    const reviewTimestampMillis =
      state.dueTimestampMillis +
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        state,
        reviewTimestampMillis,
        TaskRepetitionOutcome.Remembered,
        testTaskID,
        testComponentID,
      );

    expect(intervalMillis).toBe(
      Math.floor(
        defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval *
          2 *
          defaultSpacedRepetitionSchedulerConfiguration.intervalGrowthFactor,
      ),
    );

    // Should be small, within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });

  test("skipped", () => {
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        state,
        state.dueTimestampMillis,
        TaskRepetitionOutcome.Skipped,
        testTaskID,
        testComponentID,
      );

    expect(intervalMillis).toBe(
      Math.floor(
        defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval,
      ),
    );

    // Should be small, within jitter.
    expect(
      dueTimestampMillis - (state.dueTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });

  test("forgotten", () => {
    const reviewTimestampMillis = 10000;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        state,
        reviewTimestampMillis,
        TaskRepetitionOutcome.Forgotten,
        testTaskID,
        testComponentID,
      );

    expect(intervalMillis).toBe(0);
    // Should be roughly ten minutes + jitter.
    expect(dueTimestampMillis - reviewTimestampMillis).toMatchInlineSnapshot(
      `686000`,
    );
  });
});

const testState: TaskComponentState = {
  createdAtTimestampMillis: 0,
  lastRepetitionTimestampMillis: 1000,
  dueTimestampMillis:
    defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
  intervalMillis:
    defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
};

describe.each([
  { outcome: TaskRepetitionOutcome.Remembered, label: "successful" },
  { outcome: TaskRepetitionOutcome.Skipped, label: "skipped" },
])("$label repetition", ({ outcome }) => {
  test("typical repetition", () => {
    const reviewTimestampMillis = testState.dueTimestampMillis + 100000;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        testState,
        reviewTimestampMillis,
        outcome,
        testTaskID,
        testComponentID,
      );

    // Interval should grow by a little more than growth rate (because we remembered for a bit longer than requested).
    expect(
      intervalMillis /
        (testState.intervalMillis *
          defaultSpacedRepetitionSchedulerConfiguration.intervalGrowthFactor),
    ).toBeCloseTo(1);

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });

  test("very delayed repetition", () => {
    const reviewTimestampMillis =
      testState.dueTimestampMillis + testState.intervalMillis;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        testState,
        reviewTimestampMillis,
        outcome,
        testTaskID,
        testComponentID,
      );

    // Interval should grow by roughly double the normal more than growth rate (because we remembered for around twice as long as requested)
    expect(
      intervalMillis /
        testState.intervalMillis /
        defaultSpacedRepetitionSchedulerConfiguration.intervalGrowthFactor,
    ).toBeCloseTo(2);

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });

  test("too-early repetition", () => {
    const reviewTimestampMillis =
      testState.lastRepetitionTimestampMillis! + testState.intervalMillis / 2.0;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        testState,
        reviewTimestampMillis,
        TaskRepetitionOutcome.Remembered,
        testTaskID,
        testComponentID,
      );

    // The interval should still grow, but less than usual.
    expect(intervalMillis / testState.intervalMillis).toBeGreaterThan(1);
    expect(
      intervalMillis /
        testState.intervalMillis /
        defaultSpacedRepetitionSchedulerConfiguration.intervalGrowthFactor,
    ).toBeCloseTo(0.5); // i.e. half as much growth as usual

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });
});

test.each([
  // Forgetting doesn't penalize "extra" or less if you reviewed with a very different timeframe.
  {
    reviewTimestampMillis: testState.dueTimestampMillis + 100000,
    label: "typical",
  },
  {
    reviewTimestampMillis:
      testState.dueTimestampMillis + testState.intervalMillis / 2,
    label: "early",
  },
  {
    reviewTimestampMillis:
      testState.dueTimestampMillis + testState.intervalMillis * 2,
    label: "late",
  },
])("forgotten repetition: $label", ({ reviewTimestampMillis }) => {
  const { dueTimestampMillis, intervalMillis } =
    scheduler.computeNextDueIntervalMillisForRepetition(
      testState,
      reviewTimestampMillis,
      TaskRepetitionOutcome.Forgotten,
      testTaskID,
      testComponentID,
    );

  // Interval should shrink.
  expect(intervalMillis).toBeLessThan(testState.intervalMillis);

  // Should be 10 min retry + jitter.
  expect(dueTimestampMillis - reviewTimestampMillis).toMatchInlineSnapshot(
    `686000`,
  );
});

describe("per-card ease factor", () => {
  const stateWithEase: TaskComponentState = {
    createdAtTimestampMillis: 0,
    lastRepetitionTimestampMillis: 1000,
    dueTimestampMillis:
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
    intervalMillis:
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
    easeFactor: 2.0,
  };

  test("increases on success", () => {
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      stateWithEase,
      stateWithEase.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Remembered,
      testTaskID,
      testComponentID,
    );
    expect(result.easeFactor).toBe(2.1);
  });

  test("decreases on failure", () => {
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      stateWithEase,
      stateWithEase.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Forgotten,
      testTaskID,
      testComponentID,
    );
    expect(result.easeFactor).toBe(1.8);
  });

  test("shrink ignores ease factor", () => {
    // Use a larger interval so shrunk value stays above initialReviewInterval floor
    const largeIntervalState: TaskComponentState = {
      ...stateWithEase,
      intervalMillis:
        defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 6,
    };
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      largeIntervalState,
      largeIntervalState.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Forgotten,
      testTaskID,
      testComponentID,
    );
    expect(result.intervalMillis).toBe(
      Math.floor(
        largeIntervalState.intervalMillis /
          defaultSpacedRepetitionSchedulerConfiguration.intervalShrinkFactor,
      ),
    );
  });

  test("growth uses per-card ease", () => {
    const reviewTimestamp = stateWithEase.dueTimestampMillis + 100000;
    const currentInterval =
      reviewTimestamp - stateWithEase.lastRepetitionTimestampMillis!;
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      stateWithEase,
      reviewTimestamp,
      TaskRepetitionOutcome.Remembered,
      testTaskID,
      testComponentID,
    );
    expect(result.intervalMillis).toBe(
      Math.floor(currentInterval * stateWithEase.easeFactor!),
    );
  });

  test("capped at maxEaseFactor", () => {
    const highEaseState = { ...stateWithEase, easeFactor: 2.95 };
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      highEaseState,
      highEaseState.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Remembered,
      testTaskID,
      testComponentID,
    );
    expect(result.easeFactor).toBe(
      defaultSpacedRepetitionSchedulerConfiguration.maxEaseFactor,
    );
  });

  test("floored at minEaseFactor", () => {
    const lowEaseState = { ...stateWithEase, easeFactor: 1.35 };
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      lowEaseState,
      lowEaseState.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Forgotten,
      testTaskID,
      testComponentID,
    );
    expect(result.easeFactor).toBe(
      defaultSpacedRepetitionSchedulerConfiguration.minEaseFactor,
    );
  });

  test("defaults to intervalGrowthFactor when absent", () => {
    const noEaseState = { ...stateWithEase, easeFactor: undefined };
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      noEaseState,
      noEaseState.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Remembered,
      testTaskID,
      testComponentID,
    );
    expect(result.easeFactor).toBe(
      defaultSpacedRepetitionSchedulerConfiguration.intervalGrowthFactor +
        defaultSpacedRepetitionSchedulerConfiguration.easeIncrement,
    );
  });
});

describe("stable per-card jitter", () => {
  const baseState: TaskComponentState = {
    createdAtTimestampMillis: 0,
    lastRepetitionTimestampMillis: 1000,
    dueTimestampMillis: 5000,
    intervalMillis: 10000,
    easeFactor: 2.0,
  };

  test("same card gets same jitter across reviews", () => {
    const result1 = scheduler.computeNextDueIntervalMillisForRepetition(
      baseState,
      6000,
      TaskRepetitionOutcome.Remembered,
      "card_abc" as TaskID,
      "main",
    );
    const result2 = scheduler.computeNextDueIntervalMillisForRepetition(
      baseState,
      7000, // Different timestamp
      TaskRepetitionOutcome.Remembered,
      "card_abc" as TaskID,
      "main",
    );

    // Due timestamps differ by exactly 1000ms (the timestamp delta), not jitter
    const dueDelta = result2.dueTimestampMillis - result1.dueTimestampMillis;
    expect(dueDelta).toBe(1000);
  });

  test("different cards get different jitter", () => {
    const result1 = scheduler.computeNextDueIntervalMillisForRepetition(
      baseState,
      6000,
      TaskRepetitionOutcome.Remembered,
      "card_abc" as TaskID,
      "main",
    );
    const result2 = scheduler.computeNextDueIntervalMillisForRepetition(
      baseState,
      6000, // Same timestamp
      TaskRepetitionOutcome.Remembered,
      "card_xyz" as TaskID,
      "main",
    );

    // Same interval base, same timestamp, but different jitter → different due times
    expect(result1.dueTimestampMillis).not.toBe(result2.dueTimestampMillis);
  });

  test("jitter is within 0-10 minute range", () => {
    const jitters: number[] = [];
    for (let i = 0; i < 100; i++) {
      const result = scheduler.computeNextDueIntervalMillisForRepetition(
        baseState,
        6000,
        TaskRepetitionOutcome.Remembered,
        `card_${i}` as TaskID,
        "main",
      );
      // jitter = dueTimestamp - timestamp - interval
      const jitter = result.dueTimestampMillis - 6000 - result.intervalMillis;
      jitters.push(jitter);
    }

    // All jitters should be >= 0 and <= 10 minutes (600000ms)
    expect(Math.min(...jitters)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...jitters)).toBeLessThanOrEqual(600000);
  });
});

describe.each([
  { outcome: TaskRepetitionOutcome.Remembered, label: "successful" },
  { outcome: TaskRepetitionOutcome.Skipped, label: "skipped" },
])("$label after retry", ({ outcome }) => {
  test("not yet successful", () => {
    const reviewTimestampMillis = 10000;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        {
          createdAtTimestampMillis: 0,
          lastRepetitionTimestampMillis: 1000,
          dueTimestampMillis: 1000,
          intervalMillis: 0,
        },
        reviewTimestampMillis,
        outcome,
        testTaskID,
        testComponentID,
      );

    // After a successful initial retry, the interval should jump from 0 to the initial interval.
    expect(intervalMillis).toEqual(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval,
    );

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });

  test("with past success", () => {
    const lastRepetitionTimestampMillis =
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 4;
    const reviewTimestampMillis = lastRepetitionTimestampMillis + 10000;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        {
          createdAtTimestampMillis: 0,
          lastRepetitionTimestampMillis,
          dueTimestampMillis: lastRepetitionTimestampMillis,
          intervalMillis:
            defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval *
            2,
        },
        reviewTimestampMillis,
        outcome,
        testTaskID,
        testComponentID,
      );

    // The interval shouldn't grow.
    expect(intervalMillis).toEqual(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
    );

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });

  test("very delayed, with past success", () => {
    const lastRepetitionTimestampMillis =
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 4;
    const reviewTimestampMillis =
      lastRepetitionTimestampMillis +
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 4;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        {
          createdAtTimestampMillis: 0,
          lastRepetitionTimestampMillis,
          dueTimestampMillis: lastRepetitionTimestampMillis,
          intervalMillis:
            defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval *
            2,
        },
        reviewTimestampMillis,
        outcome,
        testTaskID,
        testComponentID,
      );

    // Because they waited so long, and still rememberd, the interval should grow.
    expect(intervalMillis).toBeGreaterThan(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
    );

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`86000`);
  });
});
