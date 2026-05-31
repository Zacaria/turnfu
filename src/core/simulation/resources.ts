import type { Resource, SpellCost } from "../catalog/types.ts";
import type { ResourcePool } from "./types.ts";

export const zeroResources: ResourcePool = {
  ap: 0,
  mp: 0,
  wp: 0,
  bq: 0,
};

export const huppermageBqPerWp = 75;
export const huppermageBaseBq = 500;
export const huppermageBaseWp = 6;

export function createResources(input: Partial<ResourcePool>): ResourcePool {
  return {
    ap: input.ap ?? 0,
    mp: input.mp ?? 0,
    wp: input.wp ?? 0,
    bq: input.bq ?? 0,
  };
}

export function cloneResources(resources: ResourcePool): ResourcePool {
  return { ...resources };
}

export function getCostAmount(cost: SpellCost | undefined, resource: Resource): number {
  return cost?.[resource] ?? 0;
}

export function payCost(resources: ResourcePool, cost: SpellCost | undefined): ResourcePool {
  return {
    ap: resources.ap - getCostAmount(cost, "ap"),
    mp: resources.mp - getCostAmount(cost, "mp"),
    wp: resources.wp - getCostAmount(cost, "wp"),
    bq: resources.bq - getCostAmount(cost, "bq"),
  };
}

export function addResource(resources: ResourcePool, resource: Resource, amount: number): ResourcePool {
  return {
    ...resources,
    [resource]: resources[resource] + amount,
  };
}

export function deriveHuppermageBqFromWp(wp: number): number {
  return Math.max(0, huppermageBaseBq + (wp - huppermageBaseWp) * huppermageBqPerWp);
}
