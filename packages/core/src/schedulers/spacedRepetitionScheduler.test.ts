import { TaskComponentState } from "../entities/task.js";
import { TaskRepetitionOutcome } from "../event.js";
import {
  createSpacedRepetitionScheduler,
  defaultSpacedRepetitionSchedulerConfiguration,
} from "./spacedRepetitionScheduler.js";

const scheduler = createSpacedRepetitionScheduler();

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
      );

    expect(intervalMillis).toBe(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval,
    );

    // Should be small, within jitter.
    expect(dueTimestampMillis - (2000 + intervalMillis)).toMatchInlineSnapshot(
      `0`,
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
    ).toMatchInlineSnapshot(`0`);
  });

  test("skipped", () => {
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        state,
        state.dueTimestampMillis,
        TaskRepetitionOutcome.Skipped,
      );

    expect(intervalMillis).toBe(
      Math.floor(
        defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval,
      ),
    );

    // Should be small, within jitter.
    expect(
      dueTimestampMillis - (state.dueTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`0`);
  });

  test("forgotten", () => {
    const reviewTimestampMillis = 10000;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        state,
        reviewTimestampMillis,
        TaskRepetitionOutcome.Forgotten,
      );

    expect(intervalMillis).toBe(0);
    // Should be roughly ten minutes.
    expect(dueTimestampMillis - reviewTimestampMillis).toMatchInlineSnapshot(
      `600000`,
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
    ).toMatchInlineSnapshot(`0`);
  });

  test("very delayed repetition", () => {
    const reviewTimestampMillis =
      testState.dueTimestampMillis + testState.intervalMillis;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        testState,
        reviewTimestampMillis,
        outcome,
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
    ).toMatchInlineSnapshot(`0`);
  });

  test("too-early repetition", () => {
    const reviewTimestampMillis =
      testState.lastRepetitionTimestampMillis! + testState.intervalMillis / 2.0;
    const { dueTimestampMillis, intervalMillis } =
      scheduler.computeNextDueIntervalMillisForRepetition(
        testState,
        reviewTimestampMillis,
        TaskRepetitionOutcome.Remembered,
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
    ).toMatchInlineSnapshot(`0`);
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
    );

  // Interval should shrink.
  expect(intervalMillis).toBeLessThan(testState.intervalMillis);

  // Should be within jitter.
  expect(dueTimestampMillis - reviewTimestampMillis).toMatchInlineSnapshot(
    `600000`,
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
    );
    expect(result.easeFactor).toBe(2.1);
  });

  test("decreases on failure", () => {
    const result = scheduler.computeNextDueIntervalMillisForRepetition(
      stateWithEase,
      stateWithEase.dueTimestampMillis + 100000,
      TaskRepetitionOutcome.Forgotten,
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
    );
    expect(result.easeFactor).toBe(
      defaultSpacedRepetitionSchedulerConfiguration.intervalGrowthFactor +
        defaultSpacedRepetitionSchedulerConfiguration.easeIncrement,
    );
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
      );

    // After a successful initial retry, the interval should jump from 0 to the initial interval.
    expect(intervalMillis).toEqual(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval,
    );

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`0`);
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
      );

    // The interval shouldn't grow.
    expect(intervalMillis).toEqual(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
    );

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`0`);
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
      );

    // Because they waited so long, and still rememberd, the interval should grow.
    expect(intervalMillis).toBeGreaterThan(
      defaultSpacedRepetitionSchedulerConfiguration.initialReviewInterval * 2,
    );

    // Should be within jitter.
    expect(
      dueTimestampMillis - (reviewTimestampMillis + intervalMillis),
    ).toMatchInlineSnapshot(`0`);
  });
});
