import { formatUiMessage } from "./i18n.ts";

type PlannedTurn = Array<{ uid: string; spellId: string }>;

type TurnResultSummary = {
  turnIndex: number;
  result: {
    totalDamage: number;
    valid: boolean;
    breakdown: unknown[];
    finalState: {
      remainingResources: {
        ap: number;
      };
    };
  };
};

export type TurnRowSummary = {
  turnIndex: number;
  label: string;
  remainingAp: number;
  totalDamage: number;
  valid: boolean;
  plannedActionCount: number;
  completedActionCount: number;
};

export function createTurnRows({
  turns,
  turnResults,
}: {
  turns: PlannedTurn[];
  turnResults: TurnResultSummary[];
}): TurnRowSummary[] {
  return turns.map((turn, turnIndex) => {
    const result = turnResults.find((turnResult) => turnResult.turnIndex === turnIndex)?.result;

    return {
      turnIndex,
      label: formatUiMessage("combo.turnLabel", { index: turnIndex + 1 }),
      remainingAp: result?.finalState.remainingResources.ap ?? 0,
      totalDamage: result?.totalDamage ?? 0,
      valid: result?.valid ?? true,
      plannedActionCount: turn.length,
      completedActionCount: result?.breakdown.length ?? 0,
    };
  });
}
