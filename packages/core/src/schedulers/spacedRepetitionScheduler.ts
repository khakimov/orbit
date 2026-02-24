import { TaskComponentState } from "../entities/task.js";
import { TaskRepetitionOutcome } from "../event.js";
import { Scheduler, SchedulerOutput } from "../scheduler.js";

export const defaultSpacedRepetitionSchedulerConfiguration = {
  intervalGrowthFactor: 2.3, // default ease for new cards / cards without history
  intervalShrinkFactor: 3.0, // asymmetric: forgetting penalises harder than remembering rewards
  initialReviewInterval: 1000 * 60 * 60 * 24 * 5, // five days
  easeIncrement: 0.1, // ease grows by this on success
  easeDecrement: 0.2, // ease shrinks by this on failure
  minEaseFactor: 1.3,
  maxEaseFactor: 3.0,
};

export interface SpacedRepetitionSchedulerConfiguration {
  intervalGrowthFactor: number;
  intervalShrinkFactor: number;
  initialReviewInterval: number;
  easeIncrement: number;
  easeDecrement: number;
  minEaseFactor: number;
  maxEaseFactor: number;
}

export function createSpacedRepetitionScheduler(
  schedulerConfiguration: SpacedRepetitionSchedulerConfiguration = defaultSpacedRepetitionSchedulerConfiguration,
): Scheduler {
  return {
    computeNextDueIntervalMillisForRepetition(
      componentState: TaskComponentState,
      timestampMillis: number,
      outcome: TaskRepetitionOutcome,
    ): SchedulerOutput {
      const currentReviewIntervalMillis = Math.max(
        0,
        timestampMillis -
          (componentState.lastRepetitionTimestampMillis ??
            componentState.createdAtTimestampMillis),
      );

      // Per-card ease factor: adapts growth rate based on review history
      const easeFactor =
        componentState.easeFactor ??
        schedulerConfiguration.intervalGrowthFactor;

      let newIntervalMillis: number;
      let newEaseFactor: number;

      if (
        outcome === TaskRepetitionOutcome.Remembered ||
        outcome === TaskRepetitionOutcome.Skipped
      ) {
        // Growth uses per-card ease factor
        newEaseFactor = Math.min(
          easeFactor + schedulerConfiguration.easeIncrement,
          schedulerConfiguration.maxEaseFactor,
        );

        if (currentReviewIntervalMillis < componentState.intervalMillis) {
          // Retrying or practiced too early: interval unchanged unless natural growth exceeds it.
          newIntervalMillis = Math.max(
            componentState.intervalMillis,
            schedulerConfiguration.initialReviewInterval,
            Math.floor(currentReviewIntervalMillis * easeFactor),
          );
        } else {
          newIntervalMillis = Math.max(
            schedulerConfiguration.initialReviewInterval,
            Math.floor(currentReviewIntervalMillis * easeFactor),
          );
        }
      } else {
        // Shrink is fixed (ignores ease), ease decreases
        newEaseFactor = Math.max(
          easeFactor - schedulerConfiguration.easeDecrement,
          schedulerConfiguration.minEaseFactor,
        );

        if (
          componentState.intervalMillis <
          schedulerConfiguration.initialReviewInterval
        ) {
          // Haven't hit minimum review interval yet, stay at same interval.
          newIntervalMillis = componentState.intervalMillis;
        } else {
          newIntervalMillis = Math.max(
            schedulerConfiguration.initialReviewInterval,
            Math.floor(
              componentState.intervalMillis /
                schedulerConfiguration.intervalShrinkFactor,
            ),
          );
        }
      }

      // Small offset so prompts don't always end up in the same order. Maximum jitter is 10 minutes.
      const jitter = (timestampMillis % 1000) * (60 * 10);
      const newDueTimestampMillis =
        timestampMillis +
        jitter +
        (outcome === TaskRepetitionOutcome.Forgotten
          ? 1000 * 60 * 10 // When forgotten, assign it to be due in 10 minutes or so.
          : newIntervalMillis);

      return {
        dueTimestampMillis: newDueTimestampMillis,
        intervalMillis: newIntervalMillis,
        easeFactor: newEaseFactor,
      };
    },
  };
}
