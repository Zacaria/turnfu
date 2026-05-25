export type TimelineTurnMark = {
  actionCount: number;
  endStep: number;
  midpointStep: number;
  startStep: number;
  turnIndex: number;
};

export type TimelineCursorMarks = {
  actionSteps: number[];
  turns: TimelineTurnMark[];
};

export function createTimelineCursorMarks(turnActionCounts: number[]): TimelineCursorMarks {
  const actionSteps: number[] = [];
  const turns: TimelineTurnMark[] = [];
  let currentStep = 0;

  for (const [turnIndex, actionCount] of turnActionCounts.entries()) {
    const startStep = actionCount > 0 ? currentStep + 1 : currentStep;

    for (let actionOffset = 1; actionOffset <= actionCount; actionOffset += 1) {
      actionSteps.push(currentStep + actionOffset);
    }

    currentStep += actionCount;

    turns.push({
      actionCount,
      endStep: currentStep,
      midpointStep: actionCount > 0 ? startStep + (actionCount - 1) / 2 : currentStep,
      startStep,
      turnIndex,
    });
  }

  return { actionSteps, turns };
}
