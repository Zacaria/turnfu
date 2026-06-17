import type { Element, Resource, Rune } from "../catalog/types.ts";
import type {
  Action,
  ComboPlan,
  ComboSimulationResult,
  ComboSimulationViolation,
  SimulationViolationType,
  TurnState,
} from "../simulation/types.ts";
import type { ComboScoreBreakdown, ComboSustainability } from "./comboOptimizer.ts";

export type DiscoveryViolationCategory =
  | "resourceDebt"
  | "missingTarget"
  | "cooldownLock"
  | "castLimit"
  | "deckLimit"
  | "classStateGate"
  | "invalidSublimation"
  | "unknownSpell"
  | "unsupportedEntry"
  | "other";

export type DiscoveryCurriculumObjective =
  | "bqGeneration"
  | "runeCycling"
  | "validLongPlans"
  | "sustainableLoops"
  | "conditionalUnlocks";

export type DiscoveryOptions = {
  enabled?: boolean;
  curriculumObjectives?: DiscoveryCurriculumObjective[];
  motifSeedBudget?: number;
};

export type DiscoveryCandidateInput = {
  passiveIds?: string[];
  sublimationIds?: string[];
  plan: ComboPlan;
};

export type DiscoveryStateDescriptor = {
  resources: Record<Resource, number>;
  activeRunes: Rune[];
  lastGeneratedRune: Rune | null;
  abundanceLevel: number;
  feuFolletsActive: number;
  temporaryUnlockedSpellElement: Element | null;
  activeHeart: string | null;
  storedBq: number;
  haloChatoyantMarks: number;
  cooldownCount: number;
};

export type DiscoveryDescriptor = {
  valid: boolean;
  turnCount: number;
  actionCount: number;
  passiveCount: number;
  sublimationCount: number;
  damageByTurn: number[];
  totalDamage: number;
  finalScore?: number;
  state: DiscoveryStateDescriptor;
  affordances: string[];
  violation?: {
    type: SimulationViolationType;
    category: DiscoveryViolationCategory;
    turnIndex: number;
    actionIndex: number;
    spellId?: string;
    resource?: Resource;
  };
};

export type DiscoveryScore = {
  score: number;
  reasons: string[];
};

export type DiscoveryPayload = {
  descriptor: DiscoveryDescriptor;
  discoveryScore: DiscoveryScore;
};

export type DiscoveryMotif = {
  key: string;
  actions: Action[];
  requiredState: string[];
  resultingState: string[];
  supportCount: number;
  validCount: number;
  validationRate: number;
  finalScoreContribution: number;
  discoveryScoreContribution: number;
  lastSeenAttempt: number;
  seed: DiscoveryCandidateInput;
};

const resourceOrder: Resource[] = ["ap", "mp", "wp", "bq"];
const runeOrder: Rune[] = ["incandescent", "aquatic", "telluric", "aerial"];

export function isDiscoveryEnabled(options: DiscoveryOptions | undefined): boolean {
  return Boolean(options?.enabled || options?.curriculumObjectives?.length);
}

export function createDiscoveryPayload(args: {
  input: DiscoveryCandidateInput;
  simulation: ComboSimulationResult;
  score?: ComboScoreBreakdown;
  sustainability?: ComboSustainability;
  discovery?: DiscoveryOptions;
}): DiscoveryPayload {
  const descriptor = createDiscoveryDescriptor(args);
  return {
    descriptor,
    discoveryScore: scoreDiscoveryDescriptor(descriptor, args.discovery),
  };
}

export function createCandidateOnlyDiscoveryPayload(args: {
  input: DiscoveryCandidateInput;
  score?: ComboScoreBreakdown;
  discovery?: DiscoveryOptions;
}): DiscoveryPayload {
  const descriptor: DiscoveryDescriptor = {
    valid: Boolean(args.score),
    turnCount: args.input.plan.turns.length,
    actionCount: countActions(args.input.plan),
    passiveCount: args.input.passiveIds?.length ?? 0,
    sublimationCount: args.input.sublimationIds?.length ?? 0,
    damageByTurn: [],
    totalDamage: args.score?.totalDamage ?? 0,
    finalScore: args.score?.score,
    state: createEmptyStateDescriptor(),
    affordances: createPlanAffordances(args.input.plan),
  };
  return {
    descriptor,
    discoveryScore: scoreDiscoveryDescriptor(descriptor, args.discovery),
  };
}

export function classifyDiscoveryViolation(violation: ComboSimulationViolation | undefined): DiscoveryViolationCategory {
  switch (violation?.type) {
    case "insufficientResource":
      return "resourceDebt";
    case "invalidTarget":
      return "missingTarget";
    case "cooldownActive":
      return "cooldownLock";
    case "castLimitExceeded":
      return "castLimit";
    case "deckLimitExceeded":
      return "deckLimit";
    case "invalidClassStateAction":
      return "classStateGate";
    case "invalidSublimation":
      return "invalidSublimation";
    case "unknownSpell":
      return "unknownSpell";
    case "unsupportedEntryKind":
      return "unsupportedEntry";
    default:
      return "other";
  }
}

export function mineDiscoveryMotif(args: {
  input: DiscoveryCandidateInput;
  payload: DiscoveryPayload;
  attempt: number;
}): DiscoveryMotif | undefined {
  const actions = args.input.plan.turns.flatMap((turn) => turn.actions).slice(-3);
  if (actions.length === 0) {
    return undefined;
  }

  const key = [
    actions.map(serializeAction).join(">"),
    args.payload.descriptor.affordances.slice(0, 4).join("|"),
  ].filter(Boolean).join("::");

  return {
    key,
    actions: actions.map(cloneAction),
    requiredState: args.payload.descriptor.affordances.filter((affordance) => affordance.startsWith("needs:")),
    resultingState: args.payload.descriptor.affordances,
    supportCount: 1,
    validCount: args.payload.descriptor.valid ? 1 : 0,
    validationRate: args.payload.descriptor.valid ? 1 : 0,
    finalScoreContribution: args.payload.descriptor.finalScore ?? 0,
    discoveryScoreContribution: args.payload.discoveryScore.score,
    lastSeenAttempt: args.attempt,
    seed: cloneDiscoveryCandidateInput(args.input),
  };
}

export function mergeDiscoveryMotif(existing: DiscoveryMotif, next: DiscoveryMotif): DiscoveryMotif {
  const supportCount = existing.supportCount + 1;
  const validCount = existing.validCount + next.validCount;
  return {
    ...existing,
    supportCount,
    validCount,
    validationRate: validCount / supportCount,
    finalScoreContribution: Math.max(existing.finalScoreContribution, next.finalScoreContribution),
    discoveryScoreContribution: Math.max(existing.discoveryScoreContribution, next.discoveryScoreContribution),
    lastSeenAttempt: Math.max(existing.lastSeenAttempt, next.lastSeenAttempt),
    seed: next.finalScoreContribution >= existing.finalScoreContribution ? cloneDiscoveryCandidateInput(next.seed) : existing.seed,
  };
}

export function rankDiscoveryMotifs(motifs: DiscoveryMotif[]): DiscoveryMotif[] {
  return [...motifs].sort((left, right) => {
    const validationDifference = right.validationRate - left.validationRate;
    if (validationDifference !== 0) {
      return validationDifference;
    }
    const supportDifference = right.supportCount - left.supportCount;
    if (supportDifference !== 0) {
      return supportDifference;
    }
    const discoveryDifference = right.discoveryScoreContribution - left.discoveryScoreContribution;
    if (discoveryDifference !== 0) {
      return discoveryDifference;
    }
    const finalDifference = right.finalScoreContribution - left.finalScoreContribution;
    if (finalDifference !== 0) {
      return finalDifference;
    }
    return left.key.localeCompare(right.key);
  });
}

export function cloneDiscoveryCandidateInput(input: DiscoveryCandidateInput): DiscoveryCandidateInput {
  return {
    passiveIds: [...(input.passiveIds ?? [])],
    sublimationIds: [...(input.sublimationIds ?? [])],
    plan: {
      turns: input.plan.turns.map((turn) => ({
        actions: turn.actions.map(cloneAction),
      })),
    },
  };
}

function createDiscoveryDescriptor(args: {
  input: DiscoveryCandidateInput;
  simulation: ComboSimulationResult;
  score?: ComboScoreBreakdown;
  sustainability?: ComboSustainability;
}): DiscoveryDescriptor {
  const violation = args.simulation.violations[0];
  const descriptor: DiscoveryDescriptor = {
    valid: Boolean(args.score),
    turnCount: args.input.plan.turns.length,
    actionCount: countActions(args.input.plan),
    passiveCount: args.input.passiveIds?.length ?? 0,
    sublimationCount: args.input.sublimationIds?.length ?? 0,
    damageByTurn: args.simulation.turns.map((turn) => turn.result.totalDamage),
    totalDamage: args.simulation.totalDamage,
    finalScore: args.score?.score,
    state: createStateDescriptor(args.simulation.finalState),
    affordances: [],
  };

  descriptor.affordances = createAffordances(descriptor, args.sustainability);

  if (violation) {
    descriptor.violation = {
      type: violation.type,
      category: classifyDiscoveryViolation(violation),
      turnIndex: violation.turnIndex,
      actionIndex: violation.actionIndex,
      spellId: violation.spellId,
      resource: violation.resource,
    };
  }

  return descriptor;
}

function scoreDiscoveryDescriptor(descriptor: DiscoveryDescriptor, discovery: DiscoveryOptions | undefined): DiscoveryScore {
  const reasons: string[] = [];
  let score = 0;

  const add = (reason: string, amount: number) => {
    reasons.push(reason);
    score += amount;
  };

  const activeRuneCount = descriptor.state.activeRunes.length;
  if (activeRuneCount >= 2) {
    add("runeSetup", activeRuneCount * 6);
  }
  if (descriptor.state.resources.bq >= 300 || descriptor.state.storedBq > 0) {
    add("bqRecovery", Math.min(24, Math.floor((descriptor.state.resources.bq + descriptor.state.storedBq) / 50)));
  }
  if (descriptor.state.resources.wp > 0) {
    add("wpPreservation", Math.min(12, descriptor.state.resources.wp * 2));
  }
  if (descriptor.state.temporaryUnlockedSpellElement) {
    add("conditionalUnlock", 18);
  }
  if (descriptor.valid && descriptor.turnCount >= 3 && descriptor.actionCount >= 8) {
    add("validLongPlan", 14);
  }
  if (descriptor.affordances.includes("sustainable")) {
    add("sustainableReplay", 20);
  }
  if (descriptor.violation) {
    add(`boundary:${descriptor.violation.category}`, 4);
  }

  for (const objective of discovery?.curriculumObjectives ?? []) {
    if (objective === "bqGeneration" && descriptor.affordances.includes("bq-ready")) {
      add("curriculum:bqGeneration", 16);
    } else if (objective === "runeCycling" && activeRuneCount >= 3) {
      add("curriculum:runeCycling", 16);
    } else if (objective === "validLongPlans" && descriptor.valid && descriptor.turnCount >= 3) {
      add("curriculum:validLongPlans", 16);
    } else if (objective === "sustainableLoops" && descriptor.affordances.includes("sustainable")) {
      add("curriculum:sustainableLoops", 16);
    } else if (objective === "conditionalUnlocks" && descriptor.state.temporaryUnlockedSpellElement) {
      add("curriculum:conditionalUnlocks", 16);
    }
  }

  return {
    score: Math.round(Math.min(100, score) * 100) / 100,
    reasons,
  };
}

function createStateDescriptor(state: TurnState | undefined): DiscoveryStateDescriptor {
  if (!state) {
    return createEmptyStateDescriptor();
  }

  const huppermage = state.classState.huppermage;
  const activeRunes = runeOrder.filter((rune) => Boolean(huppermage?.runes.active[rune]));

  return {
    resources: {
      ap: state.remainingResources.ap,
      mp: state.remainingResources.mp,
      wp: state.remainingResources.wp,
      bq: state.remainingResources.bq,
    },
    activeRunes,
    lastGeneratedRune: huppermage?.runes.lastGeneratedRune ?? null,
    abundanceLevel: huppermage?.abundanceLevel ?? 0,
    feuFolletsActive: huppermage?.feuFolletsActive ?? 0,
    temporaryUnlockedSpellElement: huppermage?.temporaryUnlockedSpellElement ?? null,
    activeHeart: huppermage?.activeHeart ?? null,
    storedBq: huppermage?.storedBq ?? 0,
    haloChatoyantMarks: huppermage?.haloChatoyantMarks ?? 0,
    cooldownCount: Object.keys(huppermage?.cooldownsBySpellId ?? {}).length,
  };
}

function createEmptyStateDescriptor(): DiscoveryStateDescriptor {
  return {
    resources: { ap: 0, mp: 0, wp: 0, bq: 0 },
    activeRunes: [],
    lastGeneratedRune: null,
    abundanceLevel: 0,
    feuFolletsActive: 0,
    temporaryUnlockedSpellElement: null,
    activeHeart: null,
    storedBq: 0,
    haloChatoyantMarks: 0,
    cooldownCount: 0,
  };
}

function createAffordances(descriptor: DiscoveryDescriptor, sustainability: ComboSustainability | undefined): string[] {
  const affordances = new Set(createPlanAffordancesFromCounts(descriptor.turnCount, descriptor.actionCount));
  if (descriptor.state.activeRunes.length >= 2) {
    affordances.add("rune-setup");
  }
  if (descriptor.state.activeRunes.length >= 3) {
    affordances.add("rune-cycle");
  }
  if (descriptor.state.resources.bq >= 300 || descriptor.state.storedBq > 0) {
    affordances.add("bq-ready");
  }
  if (descriptor.state.resources.wp > 0) {
    affordances.add("wp-preserved");
  }
  if (descriptor.state.temporaryUnlockedSpellElement) {
    affordances.add(`unlock:${descriptor.state.temporaryUnlockedSpellElement}`);
  }
  if (sustainability?.required && sustainability.sustainable) {
    affordances.add("sustainable");
  }
  if (descriptor.violation) {
    affordances.add(`needs:${descriptor.violation.category}`);
  }
  return [...affordances].sort();
}

function createPlanAffordances(plan: ComboPlan): string[] {
  return createPlanAffordancesFromCounts(plan.turns.length, countActions(plan));
}

function createPlanAffordancesFromCounts(turnCount: number, actionCount: number): string[] {
  const affordances = new Set<string>();
  if (turnCount >= 3) {
    affordances.add("long-plan");
  }
  if (actionCount >= 8) {
    affordances.add("dense-plan");
  }
  return [...affordances].sort();
}

function countActions(plan: ComboPlan): number {
  return plan.turns.reduce((total, turn) => total + turn.actions.length, 0);
}

function cloneAction(action: Action): Action {
  return {
    spellId: action.spellId,
    context: action.context ? { ...action.context } : undefined,
    target: action.target ? { ...action.target } : undefined,
  };
}

function serializeAction(action: Action): string {
  return action.target ? `${action.spellId}@${action.target.kind}` : action.spellId;
}
