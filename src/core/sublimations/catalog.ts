import { manual } from "../catalog/dsl.ts";
import type { SublimationCatalogEntry } from "./types.ts";

const wakfuGuideSource = manual("wakfu.guide sublimations, releve 2026-05-31");
const wakfuliSource = manual("Wakfuli sublimations inventory, releve 2026-05-31");

export const sublimationCatalog: SublimationCatalogEntry[] = [
  {
    id: "appret-3",
    familyId: "appret",
    name: "Apprêt III",
    category: "normal",
    level: 3,
    cumulativeMax: 4,
    supportStatus: "supported",
    effects: [
      { type: "statModifier", stat: "damageInflictedPercent", amount: 1 },
    ],
    sources: [wakfuliSource],
  },
  {
    id: "critique-maitrise-1",
    familyId: "critique-maitrise",
    name: "Maîtrise Critique I",
    category: "normal",
    level: 1,
    cumulativeMax: 6,
    supportStatus: "supported",
    effects: [
      { type: "statModifier", stat: "criticalMastery", amount: 20 },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "distance-1",
    familyId: "distance",
    name: "Distance I",
    category: "normal",
    level: 1,
    cumulativeMax: 6,
    supportStatus: "supported",
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 2,
        condition: { type: "rangeMode", mode: "distance", minRange: 3 },
      },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "diagonale-1",
    familyId: "diagonale",
    name: "Diagonale I",
    category: "normal",
    level: 1,
    cumulativeMax: 6,
    supportStatus: "supported",
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 2,
        condition: { type: "geometry", geometry: "diagonal" },
      },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "zone-1",
    familyId: "zone",
    name: "Zone I",
    category: "normal",
    level: 1,
    cumulativeMax: 6,
    supportStatus: "supported",
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 2,
        condition: { type: "zone" },
      },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "report-pa",
    familyId: "report-pa",
    name: "Report PA",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    supportStatus: "supported",
    effects: [
      { type: "carryoverResource", resource: "ap", maxAmount: 2 },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "vitalite-90",
    familyId: "vitalite-90",
    name: "Vitalité supérieure",
    category: "normal",
    level: 1,
    cumulativeMax: 1,
    supportStatus: "supported",
    hpRequirement: { minPercent: 90 },
    effects: [
      { type: "statModifier", stat: "damageInflictedPercent", amount: 2 },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "berserk-20",
    familyId: "berserk-20",
    name: "Berserk inférieur",
    category: "normal",
    level: 1,
    cumulativeMax: 1,
    supportStatus: "supported",
    hpRequirement: { maxPercent: 20 },
    effects: [
      { type: "statModifier", stat: "damageInflictedPercent", amount: 2 },
    ],
    sources: [wakfuGuideSource],
  },
  {
    id: "premier-critique",
    familyId: "premier-critique",
    name: "Premier critique",
    category: "normal",
    level: 1,
    cumulativeMax: 1,
    supportStatus: "planned",
    supportReason: "Nécessite un modèle d'événement critique par action.",
    effects: [],
    sources: [wakfuGuideSource],
  },
  {
    id: "retour-pa",
    familyId: "retour-pa",
    name: "Retour PA",
    category: "normal",
    level: 1,
    cumulativeMax: 1,
    supportStatus: "ignored",
    supportReason: "Dépend de la mort d'un ennemi, exclue du modèle.",
    effects: [],
    sources: [wakfuGuideSource],
  },
];

export function findSublimation(id: string, catalog: SublimationCatalogEntry[] = sublimationCatalog): SublimationCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}
