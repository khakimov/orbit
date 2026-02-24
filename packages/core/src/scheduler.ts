import { TaskComponentState, TaskID } from "./entities/task.js";
import { TaskRepetitionOutcome } from "./event.js";

export interface Scheduler {
  computeNextDueIntervalMillisForRepetition(
    componentState: TaskComponentState,
    timestampMillis: number,
    outcome: TaskRepetitionOutcome,
    taskID?: TaskID,
    componentID?: string,
  ): SchedulerOutput;
}

export type SchedulerOutput = {
  dueTimestampMillis: number;
  intervalMillis: number;
  easeFactor?: number;
};
