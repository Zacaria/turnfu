import type { Resource } from "../core/catalog/types.ts";
import { createResources, deriveHuppermageBqFromWp } from "../core/simulation/index.ts";
import type { ResourcePool, SimulatedCharacter } from "../core/simulation/types.ts";

const allResourceOptions: Resource[] = ["ap", "mp", "wp", "bq"];
const huppermageCombatResourceOptions: Resource[] = ["ap", "mp", "bq"];
const huppermageBuildResourceOptions: Resource[] = ["ap", "mp", "wp"];

export function getStatStep(event: { shiftKey: boolean }): number {
  return event.shiftKey ? 10 : 1;
}

export function getCombatResourceOptions(className?: string): Resource[] {
  return className === "huppermage" ? huppermageCombatResourceOptions : allResourceOptions;
}

export function getBuildResourceOptions(className?: string): Resource[] {
  return className === "huppermage" ? huppermageBuildResourceOptions : allResourceOptions;
}

export function createHuppermageBuildResources(
  aptitudeResources: ResourcePool,
  equipmentResources: ResourcePool,
): ResourcePool {
  const wp = aptitudeResources.wp + equipmentResources.wp;

  return createResources({
    ap: aptitudeResources.ap + equipmentResources.ap,
    mp: aptitudeResources.mp + equipmentResources.mp,
    wp,
    bq: deriveHuppermageBqFromWp(wp),
  });
}

export function syncHuppermageBqFromWp(character: SimulatedCharacter): SimulatedCharacter {
  if (character.className !== "huppermage") {
    return character;
  }

  const bq = deriveHuppermageBqFromWp(character.resources.wp);

  return {
    ...character,
    resources: createResources({
      ...character.resources,
      bq,
    }),
    classState: {
      ...character.classState,
      huppermage: {
        ...character.classState?.huppermage,
        bqMax: bq,
      },
    },
  };
}
