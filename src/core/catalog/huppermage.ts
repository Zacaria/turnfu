import {
  armor,
  classMechanic,
  cost,
  customConstraint,
  damage,
  heal,
  manual,
  maxCastsPerTurn,
  movement,
  normalizeCatalog,
  on,
  passive,
  range,
  requiresTarget,
  resourceDelta,
  screenshot,
  spell,
  state,
  statModifier,
  tag,
  unsupported,
  when,
  zone,
  type DslEntry,
} from "./dsl.ts";
import type { CatalogEntry, CatalogMetadata, Rune } from "./types.ts";
import { assertValidCatalog } from "./validation.ts";

const screenshotRoot = "/Users/zacariachtatar/screenshots";

const screenshots = {
  neutralAndPassives1: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.27.34.png`, "2026-05-22-20-27-34"),
  classMechanics1: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.26.47.png`, "2026-05-22-20-26-47"),
  feuFollet: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.26.40.png`, "2026-05-22-20-26-40"),
  passives1: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.25.34.png`, "2026-05-22-20-25-34"),
  coeurLumiere: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.24.38.png`, "2026-05-22-20-24-38"),
  extension1: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.24.33.png`, "2026-05-22-20-24-33"),
  extension2: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.24.28.png`, "2026-05-22-20-24-28"),
  coeurs: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.24.25.png`, "2026-05-22-20-24-25"),
  surchargeRunification200: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.21.06.png`, "2026-05-22-20-21-06"),
  airAndLight: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.20.32.png`, "2026-05-22-20-20-32"),
  earthAndLight: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.20.36.png`, "2026-05-22-20-20-36"),
  mixedElements: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.19.55.png`, "2026-05-22-20-19-55"),
  elementals: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.18.43.png`, "2026-05-22-20-18-43"),
  passives2: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.23.17.png`, "2026-05-22-20-23-17"),
  completedDetails1: screenshot(
    "/var/folders/j4/g4834gvd4_v3vk11nhpb_6g80000gn/T/TemporaryItems/NSIRD_screencaptureui_MDEVbz/Screenshot 2026-05-22 at 20.36.56.png",
    "2026-05-22-20-36-56",
  ),
  completedDetails2: screenshot(`${screenshotRoot}/Screenshot 2026-05-22 at 20.32.11.png`, "2026-05-22-20-32-11"),
  completedDetails3: screenshot(
    "/var/folders/j4/g4834gvd4_v3vk11nhpb_6g80000gn/T/TemporaryItems/NSIRD_screencaptureui_CWoJEJ/Screenshot 2026-05-22 at 20.38.23.png",
    "2026-05-22-20-38-23",
  ),
};

function extracted(source: ReturnType<typeof screenshot>, observedLevel = 200, notes: string[] = []): CatalogMetadata {
  return {
    status: "extracted",
    normalizedLevel: 200,
    observedLevel,
    valuesStableAtLevel200: observedLevel === 200 ? true : undefined,
    sources: [source],
    extractionNotes: notes.length > 0 ? notes : undefined,
  };
}

function needsReview(source: ReturnType<typeof screenshot>, observedLevel = 200, notes: string[]): CatalogMetadata {
  return {
    status: "needsReview",
    normalizedLevel: 200,
    observedLevel,
    valuesStableAtLevel200: observedLevel === 200 ? true : undefined,
    sources: [source],
    extractionNotes: notes,
  };
}

function stablePassive(source: ReturnType<typeof screenshot>, notes: string[] = []): CatalogMetadata {
  return {
    status: "extracted",
    normalizedLevel: 200,
    observedLevel: 110,
    valuesStableAtLevel200: true,
    sources: [source],
    extractionNotes: [
      "Passive affiche au niveau 110 dans le jeu; l'utilisateur indique que valeur et description ne changent pas au niveau 200.",
      ...notes,
    ],
  };
}

function runeCondition(rune: Rune) {
  return { type: "hasRune" as const, rune };
}

function lastRuneCondition(rune: Rune) {
  return { type: "lastRune" as const, rune };
}

const activeSpellEntries: DslEntry[] = [
  spell("mur-energie", {
    name: "Mur d'energie",
    level: 110,
    cost: cost({ bq: 150 }),
    range: range(1, 3, { lineOfSight: false, modifiable: false }),
    effects: [state({ state: "Mur d'energie", duration: "1 turn", target: "cell" as never })],
    constraints: [requiresTarget("emptyCell")],
    tags: ["neutral", "summon"],
    metadata: needsReview(screenshots.neutralAndPassives1, 110, [
      "Sort neutre affiche au niveau 110; garder en revue avant d'utiliser en baseline niveau 200.",
    ]),
  }),
  spell("runification", {
    name: "Runification",
    level: 200,
    cost: cost({ wp: 1 }),
    range: range(1, 6, { lineOfSight: true, modifiable: true }),
    effects: [
      statModifier({
        stat: "damageInflictedPercent",
        amount: 10,
        duration: "1 turn",
        target: "caster",
        note: "10% Dommages infliges par Rune.",
      }),
      statModifier({
        stat: "healsPerformedPercent",
        amount: 10,
        duration: "1 turn",
        target: "caster",
        note: "10% Soins realises par Rune.",
      }),
      unsupported("Bonus reduit de moitie selon contexte affiche en vert."),
      tag("dynamicBqCostPerRune", 40),
      tag("consumesRunes", true),
    ],
    constraints: [customConstraint("Le sort coute 40 BQ par rune possedee.")],
    tags: ["neutral", "rune-consumer"],
    metadata: extracted(screenshots.surchargeRunification200),
  }),
  spell("surcharge-runique", {
    name: "Surcharge runique",
    level: 200,
    cost: cost({ ap: 2, bq: 200, wp: 1 }),
    range: range(1, 7, { lineOfSight: true, modifiable: true }),
    effects: [
      heal({ element: "light", base: 78, target: "ally" as never }),
      when(runeCondition("incandescent"), [tag("doubleBonusValue", true)]),
      when(runeCondition("aquatic"), [resourceDelta({ resource: "ap", amount: 1, note: "1 PA (1 tour)" })]),
      when(runeCondition("telluric"), [
        statModifier({
          stat: "elementalResistance",
          amount: 40,
          duration: "1 turn",
          target: "caster",
        }),
      ]),
      when(runeCondition("aerial"), [resourceDelta({ resource: "mp", amount: 1, note: "1 PM (1 tour)" })]),
      tag("consumesRunes", true),
    ],
    constraints: [],
    tags: ["neutral", "rune-consumer", "support"],
    metadata: extracted(screenshots.surchargeRunification200),
  }),
  spell("forteresse-solaire", {
    name: "Forteresse solaire",
    level: 110,
    cost: cost({ ap: 3, wp: 1 }),
    range: range(1, 2, { lineOfSight: false, modifiable: false }),
    effects: [
      state({ state: "Forteresse Solaire", level: 1, target: "carrier" }),
      statModifier({ stat: "elementalResistance", amount: 100, target: "carrier" }),
      on(
        "carrierTakesDamageWithAtLeast50BQ",
        [
          unsupported("Genere la rune liee a l'element des dommages subis."),
          resourceDelta({ resource: "bq", amount: -50 }),
        ],
        "Lorsque le porteur subit des dommages et possede au moins 50 BQ.",
      ),
    ],
    constraints: [],
    tags: ["neutral", "defense"],
    metadata: stablePassive(screenshots.completedDetails2, ["Sort neutre affiche au niveau 110."]),
  }),
  spell("principio-valere", {
    name: "Principio Valere",
    level: 110,
    cost: cost({ ap: 2 }),
    range: range(0, 6, { lineOfSight: false, modifiable: false }),
    effects: [
      unsupported("Joue un sort sur la cible selon la derniere rune generee."),
      when(lastRuneCondition("incandescent"), [movement({ mode: "swapWithTarget", target: "target" })]),
      when(lastRuneCondition("aquatic"), [
        movement({ mode: "teleportCaster", target: "feuFollet", cells: 6, note: "Teleporte sur le Feu-Follet le plus proche." }),
      ]),
      when(lastRuneCondition("telluric"), [
        movement({ mode: "teleportCaster", target: "target", note: "Teleporte face a la cible." }),
      ]),
      when(lastRuneCondition("aerial"), [movement({ mode: "teleportCaster", target: "cell", note: "Le lanceur se teleporte sur la case ciblee." })]),
    ],
    constraints: [],
    tags: ["neutral", "movement"],
    metadata: stablePassive(screenshots.completedDetails2, ["Sort neutre affiche au niveau 110."]),
  }),
  spell("visio-imperium", {
    name: "Visio Imperium",
    level: 110,
    cost: cost({ ap: 2 }),
    range: range(0, 4, { lineOfSight: false, modifiable: false }),
    effects: [
      unsupported("Joue un sort sur la cible selon la derniere rune generee."),
      when(lastRuneCondition("incandescent"), [
        state({ state: "Incurable", level: 5, target: "target" }),
        statModifier({ stat: "armorReceivedPercent", amount: 50, target: "target" }),
      ]),
      when(lastRuneCondition("aquatic"), [
        state({ state: "Friable", level: 5, target: "target" }),
        statModifier({ stat: "healsReceivedPercent", amount: 50, target: "target" }),
      ]),
      when(lastRuneCondition("telluric"), [state({ state: "Stabilise", duration: "1 turn", target: "target" })]),
      when(lastRuneCondition("aerial"), [
        statModifier({ stat: "range", amount: -3, duration: "1 turn", target: "target" }),
        statModifier({ stat: "range", amount: 3, duration: "1 turn", target: "caster" }),
      ]),
    ],
    constraints: [],
    tags: ["neutral", "debuff"],
    metadata: stablePassive(screenshots.completedDetails2, ["Sort neutre affiche au niveau 110."]),
  }),
  spell("coeur-de-lumiere", {
    name: "Coeur de Lumiere",
    level: 200,
    cost: cost({}),
    range: range(0),
    effects: [
      when(lastRuneCondition("incandescent"), [state({ state: "Coeur Incandescent", duration: "1 turn", target: "caster" })]),
      when(lastRuneCondition("aquatic"), [state({ state: "Coeur Aquatique", duration: "1 turn", target: "caster" })]),
      when(lastRuneCondition("telluric"), [state({ state: "Coeur Tellurique", duration: "1 turn", target: "caster" })]),
      when(lastRuneCondition("aerial"), [state({ state: "Coeur Aerien", duration: "1 turn", target: "caster" })]),
      unsupported("Convertit la meilleure maitrise elementaire dans l'element du Coeur et l'augmente de 20%."),
      tag("storesNaturalBqRegeneration", true),
    ],
    constraints: [],
    tags: ["neutral", "class-core"],
    metadata: extracted(screenshots.coeurs),
  }),
  spell("cycle-elementaire", {
    name: "Cycle elementaire",
    level: 110,
    cost: cost({ ap: 1, wp: 1 }),
    range: range(0),
    effects: [
      when({ type: "custom", description: "L'Huppermage possede la derniere rune generee." }, [
        unsupported("Transforme la derniere rune generee dans sa Rune nemesis."),
      ]),
      when({ type: "custom", description: "Sinon." }, [unsupported("Genere la rune.")]),
      tag("increasingBqCostPerUseThisTurn", 50),
    ],
    constraints: [],
    tags: ["neutral", "rune-management"],
    metadata: stablePassive(screenshots.classMechanics1, ["Sort neutre affiche au niveau 110."]),
  }),
  spell("feu-follet", {
    name: "Feu-Follet",
    level: 110,
    cost: cost({ ap: 1 }),
    range: range(1, 3, { lineOfSight: false, modifiable: false }),
    effects: [
      when({ type: "targetIs", value: "emptyCell" }, [
        movement({ mode: "placeSummon", target: "cell", note: "Pose un nouveau Feu-Follet." }),
        tag("savesLastGeneratedRune", true),
      ]),
      when({ type: "targetIs", value: "feuFollet" }, [
        tag("recoverSavedRune", true),
        unsupported("Recupere un sort aleatoire de l'element de la rune sauvegardee."),
        resourceDelta({ resource: "ap", amount: 2 }),
        unsupported("Retire le Feu-Follet."),
      ]),
      tag("maxFeuFollet", 2),
    ],
    constraints: [maxCastsPerTurn(2)],
    tags: ["neutral", "summon", "rune-management"],
    metadata: stablePassive(screenshots.feuFollet, ["Sort neutre affiche au niveau 110."]),
  }),
  spell("mirage", {
    name: "Mirage",
    level: 200,
    element: "air",
    cost: cost({ ap: 2, bq: 50 }),
    range: range(1, 3, { lineOfSight: false, modifiable: false }),
    effects: [
      movement({ mode: "swapWithTarget", target: "target" }),
      damage({ element: "air", base: 50 }),
      when(runeCondition("aerial"), [
        unsupported("La portee min et max du sort augmente de 3."),
        tag("consumeRune", "aerial"),
      ]),
    ],
    constraints: [],
    tags: ["air", "movement"],
    metadata: extracted(screenshots.airAndLight),
  }),
  spell("ombres-dansantes", {
    name: "Ombres dansantes",
    level: 200,
    element: "air",
    cost: cost({ ap: 2 }),
    range: range(1, 4, { lineOfSight: false, modifiable: false }),
    effects: [
      damage({ element: "air", base: 50 }),
      movement({ mode: "teleportTarget", target: "target", cells: 2, note: "Teleporte la cible 2 cases plus loin." }),
      when({ type: "exactRuneCount", count: 2 }, [
        movement({ mode: "teleportTarget", target: "target", cells: 4, note: "Teleporte la cible 4 cases plus loin." }),
        tag("consumeAllRunes", true),
      ]),
    ],
    constraints: [],
    tags: ["air", "movement"],
    metadata: extracted(screenshots.airAndLight),
  }),
  spell("papillons-diurnes", {
    name: "Papillons diurnes",
    level: 200,
    element: "air",
    cost: cost({ ap: 2 }),
    range: range(1, 4, { lineOfSight: false, modifiable: false }),
    effects: [
      damage({ element: "air", base: 54 }),
      when(runeCondition("incandescent"), [tag("doubleMovementValue", true)]),
      when(runeCondition("aquatic"), [movement({ mode: "pull", target: "target", cells: 1 })]),
      when(runeCondition("telluric"), [movement({ mode: "push", target: "target", cells: 1 })]),
    ],
    constraints: [],
    tags: ["air", "movement"],
    metadata: needsReview(screenshots.airAndLight, 200, ["Aucun effet de rune aerienne visible sur le screenshot."]),
  }),
  spell("halo-chatoyant", {
    name: "Halo Chatoyant",
    level: 200,
    element: "light",
    cost: cost({ ap: 2, bq: 50 }),
    range: range(1, 7, { lineOfSight: true, modifiable: true }),
    effects: [
      state({ state: "Halo Chatoyant", level: 81, target: "target" }),
      on("markedTargetDiesOrIsTargetedAgain", [
        damage({ element: "light", base: 81, note: "Zone." }),
        unsupported("Declenche les autres Halo Chatoyant dans la zone."),
        tag("consumeMark", true),
      ]),
      when(runeCondition("aerial"), [tag("triggerMarkImmediately", true), tag("consumeRune", "aerial")]),
    ],
    constraints: [],
    tags: ["light", "mark"],
    metadata: extracted(screenshots.completedDetails1),
  }),
  spell("orbes-luisants", {
    name: "Orbes luisants",
    level: 200,
    element: "light",
    cost: cost({ ap: 3, bq: 100 }),
    range: range(1, 7, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "light", base: 52, times: 2 }),
      heal({ element: "light", base: 30, times: 2 }),
      when({ type: "targetIs", value: "feuFollet" }, [zone({ shape: "unknown", size: 1, note: "La zone devient l'icone affichee (1)." })]),
      unsupported("Abondance (+10 Niv.) par Rune possedee."),
    ],
    constraints: [],
    tags: ["light", "heal"],
    metadata: extracted(screenshots.airAndLight),
  }),
  spell("faisceau-de-lune", {
    name: "Faisceau de lune",
    level: 200,
    element: "light",
    cost: cost({ ap: 4 }),
    range: range(1),
    effects: [
      damage({ element: "light", base: 108, note: "Zone." }),
      when({ type: "custom", description: "Un Feu-Follet est dans la zone." }, [
        unsupported("Les dommages sont propages dessus en zone (5)."),
      ]),
      when(runeCondition("telluric"), [
        unsupported("20% vie volee et convertie en Armure."),
        tag("consumeRune", "telluric"),
      ]),
    ],
    constraints: [],
    tags: ["light", "zone"],
    metadata: extracted(screenshots.completedDetails1),
  }),
  spell("resonance", {
    name: "Resonance",
    level: 200,
    element: "light",
    cost: cost({ ap: 4 }),
    range: range(1, 6, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "light", base: 100, note: "Zone." }),
      when(runeCondition("incandescent"), [zone({ shape: "unknown", note: "La zone devient l'icone affichee." })]),
      when(runeCondition("aquatic"), [tag("costDelta", "ap:-1")]),
      when(runeCondition("telluric"), [tag("damageBypassesArmor", true)]),
      when(runeCondition("aerial"), [tag("lineOfSightRequired", false)]),
      tag("additionalBqCostPerRune", 25),
    ],
    constraints: [],
    tags: ["light", "zone"],
    metadata: extracted(screenshots.completedDetails1),
  }),
  spell("epee-de-lumiere", {
    name: "Epee de lumiere",
    level: 200,
    element: "light",
    cost: cost({ ap: 2, bq: 100 }),
    range: range(1),
    effects: [
      damage({ element: "light", base: 42, times: 2, note: "Zone." }),
      unsupported("Par Rune: vole 30% des Dommages infliges."),
    ],
    constraints: [],
    tags: ["light", "life-steal"],
    metadata: extracted(screenshots.earthAndLight),
  }),
  spell("fleche-de-lumiere", {
    name: "Fleche de lumiere",
    level: 200,
    element: "light",
    cost: cost({ ap: 6, bq: 200 }),
    range: range(2, 8, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "light", base: 261 }),
      when(lastRuneCondition("incandescent"), [zone({ shape: "unknown", size: 3, note: "La zone d'effet devient l'icone affichee (3)." })]),
      when(lastRuneCondition("aquatic"), [tag("costDelta", "ap:-1")]),
      when(lastRuneCondition("telluric"), [armor({ amount: 3000, target: "target", note: "-3000 Armure avant d'infliger les dommages." })]),
      when(lastRuneCondition("aerial"), [unsupported("Le sort n'a plus de restriction de lancer en ligne.")]),
    ],
    constraints: [],
    tags: ["light", "burst"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("rayon-crepusculaire", {
    name: "Rayon crepusculaire",
    level: 200,
    element: "light",
    cost: cost({ ap: 4 }),
    range: range(1, 8, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "light", base: 108 }),
      when(runeCondition("incandescent"), [
        unsupported("0.5% Dommages supplementaires par %BQ restante."),
        tag("consumeRune", "incandescent"),
      ]),
    ],
    constraints: [],
    tags: ["light", "scales-with-bq"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("larmes-scintillantes", {
    name: "Larmes scintillantes",
    level: 200,
    element: "light",
    cost: cost({ ap: 3 }),
    range: range(1, 7, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "light", base: 81 }),
      heal({ element: "light", base: 45 }),
      when(runeCondition("aquatic"), [heal({ element: "light", base: 45 }), tag("consumeRune", "aquatic")]),
    ],
    constraints: [],
    tags: ["light", "heal"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("lueur-de-laube", {
    name: "Lueur de l'aube",
    level: 200,
    element: "fire",
    cost: cost({ ap: 2, bq: 50 }),
    range: range(1, 7, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "fire", base: 54 }),
      when(runeCondition("incandescent"), [
        unsupported("A la fin du tour de la cible, elle subit 10% de dommages supplementaires dans l'element de la derniere rune generee (1 tour)."),
        tag("consumeRune", "incandescent"),
      ]),
    ],
    constraints: [],
    tags: ["fire", "delayed-damage"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("disque-luminescent", {
    name: "Disque luminescent",
    level: 200,
    element: "fire",
    cost: cost({ ap: 2 }),
    range: range(1, 5, { lineOfSight: false, modifiable: false }),
    effects: [
      damage({ element: "fire", base: 50 }),
      when({ type: "exactRuneCount", count: 3 }, [
        statModifier({
          stat: "damageReceivedPercent",
          amount: 10,
          duration: "1 turn",
          target: "target",
          note: "La cible subit 10% de dommages supplementaires dans tous les elements.",
        }),
        tag("consumeAllRunes", true),
      ]),
    ],
    constraints: [],
    tags: ["fire"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("flux-denergie", {
    name: "Flux d'energie",
    level: 200,
    element: "fire",
    cost: cost({ ap: 2 }),
    range: range(1, 4, { lineOfSight: false, modifiable: false }),
    effects: [
      damage({ element: "fire", base: 54 }),
      when(runeCondition("telluric"), [statModifier({ stat: "parry", amount: -10, target: "target" })]),
      when(runeCondition("aquatic"), [statModifier({ stat: "criticalHitPercent", amount: 10, target: "caster" })]),
      when(runeCondition("aerial"), [zone({ shape: "unknown", note: "La zone devient l'icone affichee." })]),
    ],
    constraints: [],
    tags: ["fire"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("debacle", {
    name: "Debacle",
    level: 200,
    element: "water",
    cost: cost({ ap: 2 }),
    range: range(1, 3, { lineOfSight: false, modifiable: false }),
    effects: [
      damage({ element: "water", base: 58 }),
      heal({ element: "water", base: 32 }),
      when(runeCondition("aquatic"), [state({ state: "Transparent", level: 1, target: "caster" }), tag("consumeRune", "aquatic")]),
    ],
    constraints: [],
    tags: ["water", "heal"],
    metadata: extracted(screenshots.elementals),
  }),
  spell("averse", {
    name: "Averse",
    level: 200,
    element: "water",
    cost: cost({ ap: 2, wp: 1 }),
    range: range(1, 8, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "water", base: 46 }),
      heal({ element: "water", base: 26 }),
      on("eachCast", [unsupported("Repete ses effets sur les cibles precedentes.")]),
    ],
    constraints: [],
    tags: ["water", "repeat", "heal"],
    metadata: needsReview(screenshots.elementals, 200, ["Le cout affiche inclut une icone supplementaire; encode comme 1 WP a confirmer."]),
  }),
  spell("vestige", {
    name: "Vestige",
    level: 200,
    element: "water",
    cost: cost({ ap: 2, bq: 50 }),
    range: range(2, 7, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "water", base: 58 }),
      heal({ element: "water", base: 32 }),
      when(runeCondition("incandescent"), [statModifier({ stat: "damageInflictedPercent", amount: 10, duration: "1 turn", target: "ally" })]),
      when(runeCondition("telluric"), [statModifier({ stat: "damageInflictedPercent", amount: -10, duration: "1 turn", target: "target" })]),
      when(runeCondition("aerial"), [zone({ shape: "unknown", size: 1, note: "La zone passe en icone affichee (1)." })]),
    ],
    constraints: [customConstraint("Doit cibler un combattant ou un Feu-Follet.")],
    tags: ["water", "heal", "support"],
    metadata: extracted(screenshots.completedDetails3, 110, ["Valeurs niveau 200 reprises du screenshot 20.18.43; condition basse clarifiee par screenshot 20.38.23."]),
  }),
  spell("eboulement", {
    name: "Eboulement",
    level: 200,
    element: "earth",
    cost: cost({ ap: 2 }),
    range: range(1, 6, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "earth", base: 54 }),
      when(runeCondition("incandescent"), [tag("doubleRemovalValue", true)]),
      when(runeCondition("aquatic"), [resourceDelta({ resource: "ap", amount: -1, target: "target" })]),
      when(runeCondition("aerial"), [resourceDelta({ resource: "mp", amount: -1, target: "target" })]),
    ],
    constraints: [],
    tags: ["earth", "removal"],
    metadata: extracted(screenshots.earthAndLight),
  }),
  spell("faille", {
    name: "Faille",
    level: 200,
    element: "earth",
    cost: cost({ ap: 2 }),
    range: range(1, 6, { lineOfSight: true, modifiable: true }),
    effects: [
      damage({ element: "earth", base: 50 }),
      armor({ amount: 540, target: "target" }),
      armor({ amount: 540, target: "caster" }),
      when(runeCondition("telluric"), [tag("doubleArmor", true), tag("consumeRune", "telluric")]),
    ],
    constraints: [],
    tags: ["earth", "armor"],
    metadata: extracted(screenshots.completedDetails1),
  }),
  spell("feuillure", {
    name: "Feuillure",
    level: 200,
    element: "earth",
    cost: cost({ ap: 2, bq: 50 }),
    range: range(1),
    effects: [
      damage({ element: "earth", base: 50 }),
      resourceDelta({ resource: "mp", amount: -2, target: "target" }),
      statModifier({
        stat: "willpower",
        amount: 10,
        target: "caster",
        note: "+10 Volonte par rune possedee pour la duree du sort.",
      }),
    ],
    constraints: [],
    tags: ["earth", "removal"],
    metadata: extracted(screenshots.earthAndLight),
  }),
];

const passiveEntries: DslEntry[] = [
  classMechanic("guerrier-elementaire", {
    name: "Guerrier elementaire",
    level: 110,
    effects: [
      on("combatStart", [
        tag("unlocksSpell", "coeur-de-lumiere"),
        tag("unlocksSpell", "feu-follet"),
        tag("unlocksSpell", "cycle-elementaire"),
      ]),
      on("elementalSpellCast", [unsupported("Genere une rune Incandescente, Aquatique, Tellurique ou Aerienne selon l'element.")]),
      on("runeGenerated", [resourceDelta({ resource: "ap", amount: 1, note: "1x par tour par rune." })]),
      on("runeConsumed", [state({ state: "Abondance", level: 15, target: "caster" })]),
      unsupported("Convertit chaque PW en 75 BQ."),
      on("turnEndNotInCoeurDeLumiere", [resourceDelta({ resource: "bq", amount: 100 }), unsupported("+ BQ stockee.")]),
      on("turnEndInCoeurDeLumiere", [tag("storeBq", 75)]),
    ],
    constraints: [],
    tags: ["class-mechanic", "runes", "bq"],
    metadata: stablePassive(screenshots.classMechanics1),
  }),
  classMechanic("coeur-incandescent", {
    name: "Coeur Incandescent",
    level: 1,
    effects: [
      unsupported("La plus haute maitrise elementaire est augmentee de 20% puis copiee dans l'element Feu."),
      statModifier({ stat: "damageInflictedPercent", amount: 30, target: "caster" }),
      statModifier({ stat: "healsPerformedPercent", amount: 15, target: "caster" }),
    ],
    constraints: [],
    tags: ["class-mechanic", "heart", "fire"],
    metadata: extracted(screenshots.coeurs, 1),
  }),
  classMechanic("coeur-aquatique", {
    name: "Coeur Aquatique",
    level: 1,
    effects: [
      unsupported("La plus haute maitrise elementaire est augmentee de 20% puis copiee dans l'element Eau."),
      statModifier({ stat: "damageInflictedPercent", amount: 30, target: "caster" }),
      statModifier({ stat: "healsPerformedPercent", amount: 15, target: "caster" }),
    ],
    constraints: [],
    tags: ["class-mechanic", "heart", "water"],
    metadata: extracted(screenshots.coeurs, 1),
  }),
  classMechanic("coeur-tellurique", {
    name: "Coeur Tellurique",
    level: 1,
    effects: [
      unsupported("La plus haute maitrise elementaire est augmentee de 20% puis copiee dans l'element Terre."),
      statModifier({ stat: "damageInflictedPercent", amount: 30, target: "caster" }),
      statModifier({ stat: "healsPerformedPercent", amount: 15, target: "caster" }),
    ],
    constraints: [],
    tags: ["class-mechanic", "heart", "earth"],
    metadata: extracted(screenshots.coeurs, 1),
  }),
  classMechanic("coeur-aerien", {
    name: "Coeur Aerien",
    level: 1,
    effects: [
      unsupported("La plus haute maitrise elementaire est augmentee de 20% puis copiee dans l'element Air."),
      statModifier({ stat: "damageInflictedPercent", amount: 30, target: "caster" }),
      statModifier({ stat: "healsPerformedPercent", amount: 15, target: "caster" }),
    ],
    constraints: [],
    tags: ["class-mechanic", "heart", "air"],
    metadata: extracted(screenshots.coeurs, 1),
  }),
  passive("extension-des-sens", {
    name: "Extension des sens",
    level: 110,
    effects: [
      unsupported("Sous Coeur de Lumiere, l'Huppermage possede une regeneration de BQ active dependante de l'element."),
      tag("coeurDeLumiereDuration", 2),
    ],
    constraints: [],
    tags: ["passive", "bq", "heart"],
    metadata: stablePassive(screenshots.extension2),
  }),
  classMechanic("regeneration-aerienne", {
    name: "Regeneration aerienne",
    level: 110,
    effects: [on("huppermageCreatesMovement", [resourceDelta({ resource: "bq", amount: 20, note: "20 BQ par PA." })])],
    constraints: [],
    tags: ["class-mechanic", "bq", "air"],
    metadata: stablePassive(screenshots.extension2),
  }),
  classMechanic("regeneration-tellurique", {
    name: "Regeneration tellurique",
    level: 110,
    effects: [
      on("huppermageCastsContactSpellOnTargetOrFeuFollet", [resourceDelta({ resource: "bq", amount: 20, note: "20 BQ par PA." })]),
    ],
    constraints: [],
    tags: ["class-mechanic", "bq", "earth"],
    metadata: stablePassive(screenshots.extension2),
  }),
  classMechanic("regeneration-aquatique", {
    name: "Regeneration aquatique",
    level: 110,
    effects: [
      on("huppermageAlternatesElementalAndLightSpellsOnTargetOrFeuFollet", [
        resourceDelta({ resource: "bq", amount: 20, note: "20 BQ par PA." }),
      ]),
    ],
    constraints: [],
    tags: ["class-mechanic", "bq", "water"],
    metadata: stablePassive(screenshots.extension2),
  }),
  classMechanic("regeneration-incandescente", {
    name: "Regeneration incandescente",
    level: 110,
    effects: [
      on("huppermageCastsElementalSpellAtMaximumRangeOnTargetOrFeuFollet", [
        resourceDelta({ resource: "bq", amount: 20, note: "20 BQ par PA." }),
      ]),
    ],
    constraints: [],
    tags: ["class-mechanic", "bq", "fire"],
    metadata: stablePassive(screenshots.extension2),
  }),
  passive("sauvegarde-runique", {
    name: "Sauvegarde Runique",
    level: 110,
    effects: [
      when({ type: "exactRuneCount", count: 1 }, [unsupported("Sauvegarde les 3 autres Runes sur le Feu-Follet en l'invoquant.")]),
      tag("feuFolletMaxCastsPerTurn", 1),
    ],
    constraints: [],
    tags: ["passive", "feu-follet", "runes"],
    metadata: stablePassive(screenshots.passives1),
  }),
  passive("nouveau-souffle", {
    name: "Nouveau souffle",
    level: 110,
    effects: [
      statModifier({ stat: "range", amount: 3, target: "caster", note: "Augmente de 3 la portee du sort Feu-Follet." }),
      on("castFeuFolletWhenAlreadyOnField", [movement({ mode: "moveFeuFollet", target: "feuFollet" })]),
      tag("maxFeuFollet", 1),
    ],
    constraints: [],
    tags: ["passive", "feu-follet"],
    metadata: stablePassive(screenshots.passives1),
  }),
  passive("carnage", {
    name: "Carnage",
    level: 110,
    effects: [
      statModifier({ stat: "damageInflictedPercent", amount: 15, target: "caster" }),
      statModifier({ stat: "damageInflictedPercent", amount: 10, target: "caster", note: "Aux cibles ayant de l'Armure." }),
      statModifier({ stat: "healsPerformedPercent", amount: -30, target: "caster" }),
    ],
    constraints: [],
    tags: ["passive", "damage"],
    metadata: stablePassive(screenshots.passives1),
  }),
  passive("initiative-de-lame", {
    name: "Initiative de l'ame",
    level: 110,
    effects: [
      when({ type: "event", event: "coeurDeLumiereIsFirstSpellOfTurn" }, [resourceDelta({ resource: "ap", amount: 2 })]),
      unsupported("Les maitrises elementaires autres que celle du Coeur de Lumiere sont fixees a 0."),
    ],
    constraints: [],
    tags: ["passive", "heart"],
    metadata: stablePassive(screenshots.completedDetails1),
  }),
  passive("altruisme-de-lame", {
    name: "Altruisme de l'ame",
    level: 110,
    effects: [
      when({ type: "inState", state: "Coeur de Lumiere", target: "caster" }, [
        statModifier({ stat: "healsPerformedPercent", amount: 15, target: "caster" }),
        unsupported("Le bonus de Dommages infliges est perdu."),
        on("healsAlly", [resourceDelta({ resource: "bq", amount: 20, note: "+20 BQ par PA du sort." })]),
      ]),
    ],
    constraints: [],
    tags: ["passive", "heal", "heart"],
    metadata: stablePassive(screenshots.completedDetails1),
  }),
  passive("combinaison-elementaire", {
    name: "Combinaison Elementaire",
    level: 110,
    effects: [
      when({ type: "custom", description: "Genere une Rune nemesis a la derniere rune generee." }, [
        state({ state: "Abondance", level: 15, target: "caster" }),
      ]),
      tag("abondanceLimit", 60),
    ],
    constraints: [],
    tags: ["passive", "abondance"],
    metadata: stablePassive(screenshots.passives1),
  }),
  passive("transcendance-runique", {
    name: "Transcendance Runique",
    level: 110,
    effects: [
      when({ type: "hasAllRunes" }, [tag("doubleBqGains", true)]),
      when({ type: "custom", description: "Sinon." }, [tag("bqGainMultiplier", 0.5)]),
    ],
    constraints: [],
    tags: ["passive", "bq", "runes"],
    metadata: stablePassive(screenshots.passives1),
  }),
  passive("liaison-lumineuse", {
    name: "Liaison Lumineuse",
    level: 110,
    effects: [on("summonsFeuFollet", [movement({ mode: "swapWithFeuFollet", target: "feuFollet" })])],
    constraints: [],
    tags: ["passive", "feu-follet", "movement"],
    metadata: stablePassive(screenshots.passives2, ["La phrase 'Echange de position avec' designe le Feu-Follet, confirme par l'utilisateur."]),
  }),
  passive("plenitude", {
    name: "Plenitude",
    level: 110,
    effects: [
      on("consumesFeuFollet", [
        tag("doesNotRecoverRune", true),
        state({ state: "Abondance", level: 25, target: "caster" }),
      ]),
    ],
    constraints: [],
    tags: ["passive", "feu-follet", "abondance"],
    metadata: stablePassive(screenshots.passives2),
  }),
  passive("universalite", {
    name: "Universalite",
    level: 110,
    effects: [
      on("turnEndRunesOwned", [
        when(runeCondition("incandescent"), [statModifier({ stat: "damageInflictedPercent", amount: 15, duration: "1 turn", target: "caster" })]),
        when(runeCondition("aquatic"), [statModifier({ stat: "healsPerformedPercent", amount: 15, duration: "1 turn", target: "caster" })]),
        when(runeCondition("telluric"), [statModifier({ stat: "elementalResistance", amount: 75, duration: "1 turn", target: "caster" })]),
        when(runeCondition("aerial"), [statModifier({ stat: "range", amount: 2, duration: "1 turn", target: "caster" })]),
        resourceDelta({ resource: "bq", amount: -50, note: "-50 BQ par rune possedee." }),
      ]),
    ],
    constraints: [],
    tags: ["passive", "runes"],
    metadata: stablePassive(screenshots.completedDetails1),
  }),
  passive("distension-elementaire", {
    name: "Distension Elementaire",
    level: 110,
    effects: [
      when({ type: "inState", state: "Coeur de Lumiere", target: "caster" }, [
        statModifier({ stat: "range", amount: 2, target: "caster", note: "Les sorts elementaires lies au Coeur gagnent 2 Portee." }),
      ]),
    ],
    constraints: [],
    tags: ["passive", "heart", "range"],
    metadata: stablePassive(screenshots.passives2),
  }),
  passive("antithese", {
    name: "Antithese",
    level: 110,
    effects: [
      on("runeGenerated", [resourceDelta({ resource: "bq", amount: 20 })]),
      statModifier({ stat: "damageInflictedPercent", amount: -10, target: "caster", note: "Sur les sorts elementaires." }),
    ],
    constraints: [],
    tags: ["passive", "bq", "damage-tradeoff"],
    metadata: stablePassive(screenshots.passives2),
  }),
  passive("dynamo", {
    name: "Dynamo",
    level: 110,
    effects: [on("turnEnd", [tag("runesDisappearAtTurnEnd", true)])],
    constraints: [],
    tags: ["passive", "runes"],
    metadata: stablePassive(screenshots.passives2),
  }),
  passive("refraction-elementaire", {
    name: "Refraction Elementaire",
    level: 110,
    effects: [
      tag("coeurDeLumiereMaxCastsPerTurn", 4),
      unsupported("Le bonus de maitrise elementaire sous Coeur de Lumiere est perdu."),
    ],
    constraints: [],
    tags: ["passive", "heart"],
    metadata: stablePassive(screenshots.passives2),
  }),
  passive("absorption-quadramentale", {
    name: "Absorption Quadramentale",
    level: 110,
    effects: [
      statModifier({ stat: "willpower", amount: 20, target: "caster" }),
      on("casterRemovesApMpOrRange", [resourceDelta({ resource: "bq", amount: 20 })]),
      statModifier({ stat: "damageInflictedPercent", amount: -10, target: "caster", note: "Par les sorts Lumiere." }),
    ],
    constraints: [],
    tags: ["passive", "bq", "removal"],
    metadata: stablePassive(screenshots.passives2),
  }),
  passive("profusion-runique", {
    name: "Profusion Runique",
    level: 110,
    effects: [
      on("turnEnd", [state({ state: "Abondance", level: 15, target: "caster", note: "Par Rune possedee." })]),
      tag("bqGainsDeltaPercent", -20),
    ],
    constraints: [],
    tags: ["passive", "abondance", "bq"],
    metadata: stablePassive(screenshots.completedDetails3),
  }),
];

export const huppermageCatalogDslEntries = [...activeSpellEntries, ...passiveEntries];

export const huppermageCatalog: CatalogEntry[] = normalizeCatalog(huppermageCatalogDslEntries);

assertValidCatalog(huppermageCatalog);

export function getHuppermageEntry(id: string): CatalogEntry | undefined {
  return huppermageCatalog.find((entry) => entry.id === id);
}

export function getHuppermageSpells(): CatalogEntry[] {
  return huppermageCatalog.filter((entry) => entry.kind === "spell");
}

export function getHuppermagePassives(): CatalogEntry[] {
  return huppermageCatalog.filter((entry) => entry.kind === "passive");
}

export function getHuppermageClassMechanics(): CatalogEntry[] {
  return huppermageCatalog.filter((entry) => entry.kind === "classMechanic");
}

export const huppermageCatalogSources = {
  ...screenshots,
  userClarification: manual("User clarified Liaison Lumineuse exchanges position with Feu-Follet."),
};
