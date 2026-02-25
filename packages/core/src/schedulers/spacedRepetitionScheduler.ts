import { TaskComponentState, TaskID } from "../entities/task.js";
import { TaskRepetitionOutcome } from "../event.js";
import { Scheduler, SchedulerOutput } from "../scheduler.js";

// Simple string hash for stable per-card jitter
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export const defaultSpacedRepetitionSchedulerConfiguration = {
  intervalGrowthFactor: 2.3, // default ease for new cards / cards without history
  intervalShrinkFactor: 3.0, // asymmetric: forgetting penalises harder than remembering rewards
  initialReviewInterval: 1000 * 60 * 60 * 24 * 5, // five days
  easeIncrement: 0.1, // ease grows by this on success
  easeDecrement: 0.2, // ease shrinks by this on failure
  minEaseFactor: 1.3,
  maxEaseFactor: 3.0,
  learningSteps: [60_000, 600_000] as number[], // 1min, 10min — steps before graduating to spaced review
};

export interface SpacedRepetitionSchedulerConfiguration {
  intervalGrowthFactor: number;
  intervalShrinkFactor: number;
  initialReviewInterval: number;
  easeIncrement: number;
  easeDecrement: number;
  minEaseFactor: number;
  maxEaseFactor: number;
  learningSteps: number[];
}

export function createSpacedRepetitionScheduler(
  schedulerConfiguration: SpacedRepetitionSchedulerConfiguration = defaultSpacedRepetitionSchedulerConfiguration,
): Scheduler {
  return {
    computeNextDueIntervalMillisForRepetition(
      componentState: TaskComponentState,
      timestampMillis: number,
      outcome: TaskRepetitionOutcome,
      taskID?: TaskID,
      componentID?: string,
    ): SchedulerOutput {
      const { learningSteps } = schedulerConfiguration;
      const remembered =
        outcome === TaskRepetitionOutcome.Remembered ||
        outcome === TaskRepetitionOutcome.Skipped;

      // --- Learning phase: card has not yet graduated to spaced review ---
      if (componentState.learningStep != null) {
        if (remembered) {
          const nextStep = componentState.learningStep + 1;
          if (nextStep >= learningSteps.length) {
            // Graduate: enter spaced review
            const hash = hashString(`${taskID}:${componentID}`);
            const jitter = (hash % 600) * 1000;
            return {
              dueTimestampMillis:
                timestampMillis +
                schedulerConfiguration.initialReviewInterval +
                jitter,
              intervalMillis: schedulerConfiguration.initialReviewInterval,
              easeFactor:
                schedulerConfiguration.intervalGrowthFactor +
                schedulerConfiguration.easeIncrement,
              learningStep: undefined,
            };
          }
          // Advance to next learning step (no jitter — exact timing matters)
          return {
            dueTimestampMillis: timestampMillis + learningSteps[nextStep],
            intervalMillis: 0,
            easeFactor: componentState.easeFactor,
            learningStep: nextStep,
          };
        }
        // Forgotten during learning: back to step 0
        return {
          dueTimestampMillis: timestampMillis + learningSteps[0],
          intervalMillis: 0,
          easeFactor: componentState.easeFactor,
          learningStep: 0,
        };
      }

      // --- First review of a brand-new card: enter learning phase ---
      if (componentState.intervalMillis === 0 && componentState.learningStep === undefined) {
        if (remembered) {
          return {
            dueTimestampMillis: timestampMillis + learningSteps[1],
            intervalMillis: 0,
            easeFactor: componentState.easeFactor,
            learningStep: 1,
          };
        }
        // Forgotten on first review
        return {
          dueTimestampMillis: timestampMillis + learningSteps[0],
          intervalMillis: 0,
          easeFactor: componentState.easeFactor,
          learningStep: 0,
        };
      }

      // --- Graduated card: existing spaced repetition logic ---
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

      if (remembered) {
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

      // Stable per-card jitter so prompts don't cluster. Same card always gets same offset.
      // Hash combines taskID and componentID for unique jitter per card component.
      const hash = hashString(`${taskID}:${componentID}`);
      const jitter = (hash % 600) * 1000; // 0-600 seconds -> 0-10 minutes
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
