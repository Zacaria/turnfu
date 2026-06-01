import { manual } from "../catalog/dsl.ts";
import type { SublimationCatalogEntry, SublimationEffect } from "./types.ts";

const wakfuGuideSource = manual("wakfu.guide sublimations, relevé 2026-06-01");
const wakfuWikiScrollSource = manual("wakfu.wiki.gg Sublimation Scrolls, relevé 2026-06-01");

type SupportedSublimationDefinition = {
  effects: SublimationEffect[];
  supportReason?: string;
};

const stackableSublimationVariantOverrides: Record<string, number[]> = {
  "agilite-vitale-2": [2],
  "force-vitale-2": [2],
  "sauvegarde-6": [2],
  "sauvegarde-critique-6": [2],
  "velocite-2": [2],
  "vivacite-2": [2],
};

const sublimationEntryLevelOverrides: Record<string, { level: number; cumulativeMax: number }> = {
  "influence-de-wakfu-ii": { level: 2, cumulativeMax: 4 },
};

const levelVariantLabels: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
};

const supportedSublimations: Record<string, SupportedSublimationDefinition> = {
  "sauvegarde-6": {
    effects: [
      {
        type: "carryoverResource",
        resource: "ap",
        maxAmount: 0.5
      }
    ]
  },
  "tolerance-2": {
    effects: [
      {
        type: "carryoverResource",
        resource: "mp",
        maxAmount: 1
      }
    ]
  },
  "vivacite-2": {
    effects: [
      {
        type: "resourceDelta",
        resource: "ap",
        amount: 0.5
      },
      {
        type: "statModifier",
        stat: "elementalResistance",
        amount: -37.5
      }
    ]
  },
  "velocite-2": {
    effects: [
      {
        type: "resourceDelta",
        resource: "mp",
        amount: 0.5
      },
      {
        type: "statModifier",
        stat: "damageInflictedPercent",
        amount: -5
      }
    ]
  },
  "devastation-3": {
    effects: [
      {
        type: "resourceDelta",
        resource: "wp",
        amount: 0.3333333333333333
      },
      {
        type: "statModifier",
        stat: "willpower",
        amount: -3.3333333333333335
      }
    ]
  },
  "cicatrisation-6": {
    effects: [
      {
        type: "statModifier",
        stat: "hitPointsPercent",
        amount: 5
      }
    ]
  },
  "influence-6": {
    effects: [
      {
        type: "statModifier",
        stat: "criticalHitPercent",
        amount: 3
      }
    ]
  },
  "influence-vitale-6": {
    effects: [
      {
        type: "statModifier",
        stat: "criticalHitPercent",
        amount: 4
      }
    ]
  },
  "critique-berserk-6": {
    effects: [
      {
        type: "statModifier",
        stat: "criticalHitPercent",
        amount: 5
      }
    ]
  },
  "force-vitale-2": {
    effects: [
      {
        type: "resourceDelta",
        resource: "ap",
        amount: 0.5
      }
    ]
  },
  "agilite-vitale-2": {
    effects: [
      {
        type: "resourceDelta",
        resource: "mp",
        amount: 0.5
      }
    ]
  },
  "armure-lourde-2": {
    effects: [
      {
        type: "resourceDelta",
        resource: "mp",
        amount: -0.5
      },
      {
        type: "statModifier",
        stat: "damageInflictedPercent",
        amount: 5
      }
    ]
  },
  "carnage-6": {
    effects: [
      {
        type: "statModifier",
        stat: "generalMastery",
        amount: 90
      }
    ]
  },
  "brulure-4": {
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 4,
        condition: {
          type: "spellElement",
          element: "fire"
        }
      }
    ]
  },
  "brulure-secondaire-4": {
    effects: [
      {
        type: "elementalCarryoverDamageInflictedPercent",
        triggerElements: ["water", "earth", "air"],
        targetElement: "fire",
        amount: 2,
        maxAmount: 30
      }
    ]
  },
  "gel-4": {
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 4,
        condition: {
          type: "spellElement",
          element: "water"
        }
      }
    ]
  },
  "gel-secondaire-4": {
    effects: [
      {
        type: "elementalCarryoverDamageInflictedPercent",
        triggerElements: ["fire", "earth", "air"],
        targetElement: "water",
        amount: 2,
        maxAmount: 30
      }
    ]
  },
  "tellurisme-4": {
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 4,
        condition: {
          type: "spellElement",
          element: "earth"
        }
      }
    ]
  },
  "tellurisme-secondaire-4": {
    effects: [
      {
        type: "elementalCarryoverDamageInflictedPercent",
        triggerElements: ["fire", "water", "air"],
        targetElement: "earth",
        amount: 2,
        maxAmount: 30
      }
    ]
  },
  "ventilation-4": {
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 4,
        condition: {
          type: "spellElement",
          element: "air"
        }
      }
    ]
  },
  "ventilation-secondaire-4": {
    effects: [
      {
        type: "elementalCarryoverDamageInflictedPercent",
        triggerElements: ["fire", "water", "earth"],
        targetElement: "air",
        amount: 2,
        maxAmount: 30
      }
    ]
  },
  "puissance-brute-4": {
    effects: [
      {
        type: "resourceDelta",
        resource: "wp",
        amount: -1
      },
      {
        type: "spentResourceDamageInflictedPercent",
        resources: ["wp", "bq"],
        amount: 2,
        maxAmount: 4
      }
    ]
  },
  "concentration-elementaire": {
    effects: [
      {
        type: "statModifier",
        stat: "damageInflictedPercent",
        amount: 20
      },
      {
        type: "statModifier",
        stat: "healsPerformedPercent",
        amount: 20
      },
      {
        type: "elementalMasteryPercentModifier",
        target: "weakest",
        count: 3,
        percent: -30
      }
    ]
  },
  "chaos": {
    effects: [
      {
        type: "statModifier",
        stat: "damageInflictedPercent",
        amount: 20
      },
      {
        type: "statModifier",
        stat: "healsPerformedPercent",
        amount: 20
      },
      {
        type: "elementalMasteryPercentModifier",
        target: "weakest",
        count: 4,
        percent: -100
      }
    ]
  },
  "secret-critique": {
    effects: [
      {
        type: "conditionalInitialStatModifier",
        stat: "criticalHitPercent",
        amount: 30,
        condition: {
          type: "statAtMost",
          stat: "criticalMastery",
          value: 0
        }
      }
    ]
  },
  "inflexibilite": {
    effects: [
      {
        type: "conditionalInitialStatModifier",
        stat: "damageInflictedPercent",
        amount: 15,
        condition: {
          type: "resourceAtMost",
          resource: "ap",
          value: 10
        }
      },
      {
        type: "conditionalInitialStatModifier",
        stat: "willpower",
        amount: 10,
        condition: {
          type: "resourceAtMost",
          resource: "ap",
          value: 10
        }
      }
    ]
  },
  "inflexibilite-ii": {
    effects: [
      {
        type: "conditionalInitialStatModifier",
        stat: "damageInflictedPercent",
        amount: 20,
        condition: {
          type: "secondaryMasteriesAtMost",
          value: 0
        }
      },
      {
        type: "conditionalInitialStatModifier",
        stat: "healsPerformedPercent",
        amount: 20,
        condition: {
          type: "secondaryMasteriesAtMost",
          value: 0
        }
      }
    ]
  },
  "alternance": {
    effects: [
      {
        type: "alternatingElementDamageInflictedPercent",
        amount: 20,
        mode: "singlePreviousElementThisTurn"
      }
    ]
  },
  "alternance-ii": {
    effects: [
      {
        type: "alternatingElementDamageInflictedPercent",
        amount: 15,
        mode: "previousDamageElement"
      }
    ]
  },
  "exces": {
    effects: [
      {
        type: "statModifier",
        stat: "damageInflictedPercent",
        amount: -10
      },
      {
        type: "spellCountCarryoverDamageInflictedPercent",
        qualifiedCostResource: "ap",
        interval: 10,
        amount: 100
      }
    ]
  },
  "exces-ii": {
    effects: [
      {
        type: "statModifier",
        stat: "damageInflictedPercent",
        amount: -10
      },
      {
        type: "spellCountCarryoverDamageInflictedPercent",
        qualifiedCostResource: "ap",
        interval: 5,
        amount: 50
      }
    ]
  },
  "expert-des-armes-legeres-6": {
    supportReason: "Partie non supportée : +12 % dégâts infligés sur une cible avec de l’armure, et condition d’équipement sans bouclier, dague ni arme à deux mains.",
    effects: [
      {
        type: "statModifier",
        stat: "generalMastery",
        amount: 150
      }
    ]
  },
  "longueur-6": {
    effects: [
      {
        type: "actionDamageInflictedPercent",
        amount: 2,
        condition: {
          type: "rangeMode",
          mode: "distance",
          minRange: 2
        }
      }
    ]
  }
};

const wakfuGuideSublimations = [
  {
    id: "abandon-6",
    familyId: "abandon",
    name: "Abandon",
    wakfuGuideName: "Abandon 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🔵",
    sourceDescription: "+3 PW +3 PO -30 % armure donnée et reçue (si maîtrises secondaire = 0)",
    sourceLocation: "Brèche d'Amakna (lvl 111 minimum)"
  },
  {
    id: "accumulation-4",
    familyId: "accumulation",
    name: "Accumulation",
    wakfuGuideName: "Accumulation 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔵",
    sourceDescription: "-20% soins réalisés mais chaque tour passé sans soigner : +20% soins réalisés (max 40%)",
    sourceLocation: "Stèle Compost du grand Potofeu (Donjon lvl 140)"
  },
  {
    id: "acribie-6",
    familyId: "acribie",
    name: "Acribie",
    wakfuGuideName: "Acribie 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "+12% dégâts infligés aux cibles à 5 cases et +",
    sourceLocation: "Stèle Crustargneux (Donjon lvl 215)"
  },
  {
    id: "agilite-vitale-2",
    familyId: "agilite-vitale",
    name: "Agilité vitale",
    wakfuGuideName: "Agilité vitale 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🟢🔵🔴",
    sourceDescription: "En début de tour, si PV >= 90% : +1PM",
    sourceLocation: "Stèle Mansots (Donjon lvl 215)",
    hpRequirement: {
      minPercent: 90
    }
  },
  {
    id: "aisance-2",
    familyId: "aisance",
    name: "Aisance",
    wakfuGuideName: "Aisance 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "Après avoir subi une perte de 2pm : +10 volonté (3 tours)",
    sourceLocation: "Stèle Source du mal (Donjon lvl 155)"
  },
  {
    id: "allocentrisme-4",
    familyId: "allocentrisme",
    name: "Allocentrisme",
    wakfuGuideName: "Allocentrisme 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🟢",
    sourceDescription: "+20% d’armure donnée si le porteur de possède pas d’armure",
    sourceLocation: "Stèle Toundrasoirs (Donjon lvl 215)"
  },
  {
    id: "altruisme-6",
    familyId: "altruisme",
    name: "Altruisme",
    wakfuGuideName: "Altruisme 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔴",
    sourceDescription: "12 % soins réalisés sur un allié en ligne et à distance",
    sourceLocation: "Brèche Moon (lvl 171 minimum)"
  },
  {
    id: "ambition-6",
    familyId: "ambition",
    name: "Ambition",
    wakfuGuideName: "Ambition 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🔴",
    sourceDescription: "au début du premier tour, si les maîtrises secondaires sont ≤ 0, +30% cc",
    sourceLocation: "Brèche de la Shukrute (lvl 216 minimum)"
  },
  {
    id: "appret-6",
    familyId: "appret",
    name: "Apprêt",
    wakfuGuideName: "Apprêt 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔵🔴",
    sourceDescription: "+6% de dégâts infligés pour le tour suivant par ennemi au corps à corps à la fin de votre tour",
    sourceLocation: "Stèle Mansots (Donjon lvl 215)"
  },
  {
    id: "appret-secondaire-6",
    familyId: "appret-secondaire",
    name: "Apprêt Secondaire",
    wakfuGuideName: "Apprêt Secondaire 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "En fin de tour, si un ennemi est au contact : +12% dégâts infligés au tour suivant",
    sourceLocation: "Stèle Nox (Boss Ultime lvl 245)"
  },
  {
    id: "arcanes-6",
    familyId: "arcanes",
    name: "Arcanes",
    wakfuGuideName: "Arcanes 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "si le porteur de l’état ne possède pas d’armure en fin de tour : +300 % du niveau en armure",
    sourceLocation: "Brèche de Tainéla (lvl 21 minimum)"
  },
  {
    id: "arme-empoisonnee-4",
    familyId: "arme-empoisonnee",
    name: "Arme empoisonnée",
    wakfuGuideName: "Arme empoisonnée 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "-10 % de dégâts infligés avec une arme, en infligeant des dommages à un ennemi avec une arme à deux mains : incurable +X niveau (selon le coût en PA de l’arme) sur l’ennemi ET le porteur",
    sourceLocation: "Brèche Moon (lvl 171 minimum)"
  },
  {
    id: "arme-solide-2",
    familyId: "arme-solide",
    name: "Arme solide",
    wakfuGuideName: "Arme solide 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🔵🔵",
    sourceDescription: "En infligeant des dégâts avec une arme, l’ennemi touché diminue ses dégâts de 10 % sur la cible ayant l’effet (le porteur de l’état doit posséder un bouclier)",
    sourceLocation: "Brèche de Sufokia (lvl 66 minimum)"
  },
  {
    id: "armure-lourde-2",
    familyId: "armure-lourde",
    name: "Armure lourde",
    wakfuGuideName: "Armure lourde 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "-1PM +10 % de dégâts infligés",
    sourceLocation: "Brèche Ultime Shukrute (lvl 216 minimum)"
  },
  {
    id: "art-du-cachement-4",
    familyId: "art-du-cachement",
    name: "Art du cachement",
    wakfuGuideName: "Art du cachement 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🔵",
    sourceDescription: "-24% dommages reçues hors ligne de vues, +12% dommages reçues lorsque le porteur est en ligne de vue",
    sourceLocation: "Stèle Crustargneux (Donjon lvl 215)"
  },
  {
    id: "balance-critique-6",
    familyId: "balance-critique",
    name: "Balance Critique",
    wakfuGuideName: "Balance Critique 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "A chaque sort non critique effectué : +12% de CC cumulable. Le bonus est perdu au prochain CC",
    sourceLocation: "Stèle Plantigardes (Donjon lvl 215)"
  },
  {
    id: "barriere-distance-4",
    familyId: "barriere-distance",
    name: "Barrière distance",
    wakfuGuideName: "Barrière distance 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "réduit les dommages distance subis de 50 % du niveau, 8 fois par tour",
    sourceLocation: "Stèle Kannibouls (Donjon lvl 185)"
  },
  {
    id: "barriere-melee-4",
    familyId: "barriere-melee",
    name: "Barrière mêlée",
    wakfuGuideName: "Barrière mêlée 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔵",
    sourceDescription: "réduit les dommages mêlée subis de 50 % du niveau, 8 fois par tour",
    sourceLocation: "Stèle Tropikes (Donjon lvl 185)"
  },
  {
    id: "bouclier-critique-6",
    familyId: "bouclier-critique",
    name: "Bouclier critique",
    wakfuGuideName: "Bouclier critique 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔴",
    sourceDescription: "+30 résistances critiques",
    sourceLocation: "Stèle Toundrasoirs (Donjon lvl 215)"
  },
  {
    id: "bouclier-dorsal-6",
    familyId: "bouclier-dorsal",
    name: "Bouclier dorsal",
    wakfuGuideName: "Bouclier dorsal 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "+30 résistances dos",
    sourceLocation: "Stèle Carapattes (Donjon lvl 215)"
  },
  {
    id: "brulure-4",
    familyId: "brulure",
    name: "Brûlure",
    wakfuGuideName: "Brûlure 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔴🔵",
    sourceDescription: "+16% de dégâts feu",
    sourceLocation: "Stèle Blopéra (Donjon lvl 155)"
  },
  {
    id: "brulure-secondaire-4",
    familyId: "brulure-secondaire",
    name: "Brûlure secondaire",
    wakfuGuideName: "Brûlure secondaire 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔴🟢",
    sourceDescription: "En lançant un sort eau, terre ou air : +8% dégâts infligés au prochain sort feu (cumul max 30). Effet consommé au prochain sort feu direct",
    sourceLocation: "Stèle Enutrosor (Donjon lvl 155)"
  },
  {
    id: "carapace-2",
    familyId: "carapace",
    name: "Carapace",
    wakfuGuideName: "Carapace 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔵🔵",
    sourceDescription: "-1PA +75 résistances élémentaire",
    sourceLocation: "Brèche Ultime Shukrute (lvl 216 minimum)"
  },
  {
    id: "carapace-sanguine-6",
    familyId: "carapace-sanguine",
    name: "Carapace sanguine",
    wakfuGuideName: "Carapace sanguine 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "En début de tour, convertit 60 % des PV courants en Armure",
    sourceLocation: "Stèle Trouffe Salée (Donjon lvl 140)"
  },
  {
    id: "carnage-6",
    familyId: "carnage",
    name: "Carnage",
    wakfuGuideName: "Carnage 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔴🟢",
    sourceDescription: "lorsque les PV sont supérieurs a 90 % : +90 % du niveau en maîtrise elem",
    sourceLocation: "Stèle Crête Givrée (Donjon lvl 200)",
    hpRequirement: {
      minPercent: 90
    }
  },
  {
    id: "cicatrisation-6",
    familyId: "cicatrisation",
    name: "Cicatrisation",
    wakfuGuideName: "Cicatrisation 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔴🔵",
    sourceDescription: "+30 % PV",
    sourceLocation: "Stèle Tombeau de Pandala (Donjon lvl 200)"
  },
  {
    id: "clameur-6",
    familyId: "clameur",
    name: "Clameur",
    wakfuGuideName: "Clameur 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🔴",
    sourceDescription: "-20 volonté. Réduit de 1 les 3 prochaines pertes de PM subis. L'effet se réapplique à chaque tour",
    sourceLocation: "Stèle Crocodailles (Donjon lvl 185)"
  },
  {
    id: "combat-rapproche-2",
    familyId: "combat-rapproche",
    name: "Combat rapproché",
    wakfuGuideName: "Combat rapproché 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "-1PO +100 % du niveau en tacle et esquive",
    sourceLocation: "Brèche Shukrute (lvl 216 minimum)"
  },
  {
    id: "conservation-4",
    familyId: "conservation",
    name: "Conservation",
    wakfuGuideName: "Conservation 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "+40% parade quand le porteur à plus de 90% de PV",
    sourceLocation: "Stèle Vandaliénés (Donjon lvl 215)"
  },
  {
    id: "consolation-critique-4",
    familyId: "consolation-critique",
    name: "Consolation critique",
    wakfuGuideName: "Consolation critique 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "A chaque sort non critique effectué : +8% de dégâts infligés au prochain coup critique (cumulable jusqu’à 40%)",
    sourceLocation: "Stèle Carapattes (Donjon lvl 215)"
  },
  {
    id: "contre-attaque-6",
    familyId: "contre-attaque",
    name: "Contre-attaque",
    wakfuGuideName: "Contre-attaque 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "Lorsque le porteur de l’état subit des dommages au cac, une fois par tour : +60 % du niveau en dommages lumière",
    sourceLocation: "Brèche de Sufokia (lvl 66 minimum)"
  },
  {
    id: "courage-6",
    familyId: "courage",
    name: "Courage",
    wakfuGuideName: "Courage 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "+12 % dommages et soins non critiques infligés -12 % dommages et soins critiques infligés",
    sourceLocation: "Brèche Ultime Frigost (lvl 111 minimum)"
  },
  {
    id: "critique-berserk-6",
    familyId: "critique-berserk",
    name: "Critique Berserk",
    wakfuGuideName: "Critique Berserk 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "Lorsque les PV sont inférieurs à 50 % : +30 % cc",
    sourceLocation: "Stèle Tombeau de Pandala (Donjon lvl 200)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "critique-tactique-4",
    familyId: "critique-tactique",
    name: "Critique tactique",
    wakfuGuideName: "Critique tactique 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "+12 % dommages critiques infligés si la cible a >50 % HP, -12 % si la cible a <50 % HP",
    sourceLocation: "Brèche d'Osamosa (lvl 201 minimum)"
  },
  {
    id: "critique-technique-2",
    familyId: "critique-technique",
    name: "Critique technique",
    wakfuGuideName: "Critique technique 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "Le premier CC du tour inflige 12% de dégâts en plus. Les suivants infligent -6% de moins",
    sourceLocation: "Brèche d'Amakna (lvl 111 minimum)"
  },
  {
    id: "cyclothymie-2",
    familyId: "cyclothymie",
    name: "Cyclothymie",
    wakfuGuideName: "Cyclothymie 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🟢🔴",
    sourceDescription: "+20 volonté tour pair -20 tour impair",
    sourceLocation: "Stèle Womewo (Donjon lvl 155)"
  },
  {
    id: "dernier-soin-6",
    familyId: "dernier-soin",
    name: "Dernier soin",
    wakfuGuideName: "Dernier soin 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "En tombant sous 20% PV (1 fois par combat) : +30% PV max",
    sourceLocation: "Stèle Noirespore (Donjon lvl 140)",
    hpRequirement: {
      maxPercent: 20
    }
  },
  {
    id: "dernier-souffle-6",
    familyId: "dernier-souffle",
    name: "Dernier souffle",
    wakfuGuideName: "Dernier souffle 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🔴",
    sourceDescription: "lorsque le porteur commence son tour en dessous de 20 % de PV : +18 % de dégâts infligés et +300 % du niveau en armure",
    sourceLocation: "Brèche Ultime Zinit (lvl 201 minimum)",
    hpRequirement: {
      maxPercent: 20
    }
  },
  {
    id: "derniere-armure-6",
    familyId: "derniere-armure",
    name: "Dernière Armure",
    wakfuGuideName: "Dernière Armure 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔵🔴",
    sourceDescription: "En tombant sous 20% PV (1 fois par combat) : +30% de PV max en armure",
    sourceLocation: "Stèle Srambad (Donjon lvl 155)",
    hpRequirement: {
      maxPercent: 20
    }
  },
  {
    id: "dernieres-resistances-6",
    familyId: "dernieres-resistances",
    name: "Dernières résistances",
    wakfuGuideName: "Dernières résistances 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "En tombant sous 20% PV (1 fois par combat) : +120 résistances élémentaires (1 tour)",
    sourceLocation: "Stèle Sabléoptères (Donjon lvl 155)",
    hpRequirement: {
      maxPercent: 20
    }
  },
  {
    id: "derobade-6",
    familyId: "derobade",
    name: "Dérobade",
    wakfuGuideName: "Dérobade 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "+30 % parade t1",
    sourceLocation: "Stèle Jawdin de la Weine (Donjon lvl 140)"
  },
  {
    id: "derobade-continue-6",
    familyId: "derobade-continue",
    name: "Dérobade continue",
    wakfuGuideName: "Dérobade continue 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "+18% parade",
    sourceLocation: "Stèle Toundrasoirs (Donjon lvl 215)"
  },
  {
    id: "derobade-lente-4",
    familyId: "derobade-lente",
    name: "Dérobade lente",
    wakfuGuideName: "Dérobade lente 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔴🟢",
    sourceDescription: "+6 % de parade par tour (max 40)",
    sourceLocation: "Stèle Cité interdite (Donjon 3 joueurs lvl 185)"
  },
  {
    id: "destruction-6",
    familyId: "destruction",
    name: "Destruction",
    wakfuGuideName: "Destruction 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "+18 % dégâts dos -12 % dégâts face et côté",
    sourceLocation: "Brèche de Bonta (lvl 141 minimum)"
  },
  {
    id: "determination-4",
    familyId: "determination",
    name: "Détermination",
    wakfuGuideName: "Détermination 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "-30 % dommages indirects reçus",
    sourceLocation: "Stèle E-Bou (Donjon lvl 170)"
  },
  {
    id: "devastation-3",
    familyId: "devastation",
    name: "Dévastation",
    wakfuGuideName: "Dévastation 3",
    displayLevel: "3",
    category: "normal",
    level: 3,
    cumulativeMax: 3,
    socketPattern: "🔵🔵🔵",
    sourceDescription: "+1PW -10 volonté",
    sourceLocation: "Stèle Kannivores (Donjon lvl 185)"
  },
  {
    id: "diagnostic-6",
    familyId: "diagnostic",
    name: "Diagnostic",
    wakfuGuideName: "Diagnostic 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "En soignant un allié en monocible, +12% de soins réalisés supplémentaire sur cette cible au prochain tour",
    sourceLocation: "Stèle Nox (Boss Ultime lvl 245)"
  },
  {
    id: "dimensionnalite-2",
    familyId: "dimensionnalite",
    name: "Dimensionnalité",
    wakfuGuideName: "Dimensionnalité 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔵🟢",
    sourceDescription: "+1PW au t1 (non régénérable)",
    sourceLocation: "Stèle Méka (Donjon lvl 170)"
  },
  {
    id: "ecailles-de-lune-6",
    familyId: "ecailles-de-lune",
    name: "Ecailles de lune",
    wakfuGuideName: "Ecailles de lune 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🔴",
    sourceDescription: "+18% armure reçue",
    sourceLocation: "Stèle Sanctuaire des Dragoeufs (Donjon lvl 200)"
  },
  {
    id: "elan-6",
    familyId: "elan",
    name: "Elan",
    wakfuGuideName: "Elan 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "Si le porteur se déplace avec un sort, +30% de dégâts infligés sur la prochaine attaque",
    sourceLocation: "Stèle Nox (Boss Ultime lvl 245)"
  },
  {
    id: "embuscade-6",
    familyId: "embuscade",
    name: "Embuscade",
    wakfuGuideName: "Embuscade 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔵🔴",
    sourceDescription: "+12 % de dégâts infligés aux cibles au contact",
    sourceLocation: "Stèle Méka (Donjon lvl 170)"
  },
  {
    id: "embuscade-ecartee-6",
    familyId: "embuscade-ecartee",
    name: "Embuscade écartée",
    wakfuGuideName: "Embuscade écartée 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔴🔵",
    sourceDescription: "+24 % de dégâts infligés aux cibles à 2 cases (exactement)",
    sourceLocation: "Stèle Tombeau de Pandala (Donjon lvl 200)"
  },
  {
    id: "endurance-6",
    familyId: "endurance",
    name: "Endurance",
    wakfuGuideName: "Endurance 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🔵",
    sourceDescription: "-30% aux malus de caractéristiques reçues",
    sourceLocation: "Stèle Kannivores (Donjon lvl 185)"
  },
  {
    id: "enveloppe-rocheuse-6",
    familyId: "enveloppe-rocheuse",
    name: "Enveloppe rocheuse",
    wakfuGuideName: "Enveloppe rocheuse 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔵🔵",
    sourceDescription: "+18% armure donnée",
    sourceLocation: "Stèle Abraknyde (Donjon lvl 140)"
  },
  {
    id: "epines-6",
    familyId: "epines",
    name: "Epines",
    wakfuGuideName: "Epines 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔵🔴",
    sourceDescription: "effectuer une parade donne +6 préparation (+6 % dégâts finaux au prochain sort du prochain tour)",
    sourceLocation: "Stèle Sanctuaire des Dragoeufs (Donjon lvl 200)"
  },
  {
    id: "esquive-berserk-6",
    familyId: "esquive-berserk",
    name: "Esquive Berserk",
    wakfuGuideName: "Esquive Berserk 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "300% du niveau en Esquive si pv inférieurs à 50 %",
    sourceLocation: "Stèle Kannivores (Donjon lvl 185)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "etre-sensible-4",
    familyId: "etre-sensible",
    name: "Être sensible",
    wakfuGuideName: "Être sensible 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "Si deux alliés ou plus sont entre 1 et 4 cases du porteur : +8 % de dégâts infligés",
    sourceLocation: "Brèche Ultime Zinit (lvl 201 minimum)"
  },
  {
    id: "evasion-6",
    familyId: "evasion",
    name: "Evasion",
    wakfuGuideName: "Evasion 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔵🔴",
    sourceDescription: "+300% du niveau en esquive",
    sourceLocation: "Stèle Noirespore (Donjon lvl 140)"
  },
  {
    id: "expert-des-armes-legeres-6",
    familyId: "expert-des-armes-legeres",
    name: "Expert des armes légères",
    wakfuGuideName: "Expert des armes légères 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔵🔴",
    sourceDescription: "+150 % du niveau en maîtrise elem et +12 % de dégâts infligés sur une cible avec de l’armure (si aucun bouclier, ni dague, ni armes à deux mains n’est équipé)",
    sourceLocation: "Brèche Ultime Frigost (lvl 111 minimum)"
  },
  {
    id: "expert-des-coups-critiques-4",
    familyId: "expert-des-coups-critiques",
    name: "Expert des coups critiques",
    wakfuGuideName: "Expert des coups critiques 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🟢🟢",
    sourceDescription: "En fin de tour, si un coup critique a été effectué, +8 % des pv manquants du lanceur",
    sourceLocation: "Stèle Crête Givrée (Donjon lvl 200)"
  },
  {
    id: "expert-des-parades-2",
    familyId: "expert-des-parades",
    name: "Expert des parades",
    wakfuGuideName: "Expert des parades 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🟢🔵🔵",
    sourceDescription: "-50 résistances élémentaire -15 % dommage reçus lors d’une parade",
    sourceLocation: "Stèle Kannibouls (Donjon lvl 185)"
  },
  {
    id: "fermete-3",
    familyId: "fermete",
    name: "Fermeté",
    wakfuGuideName: "Fermeté 3",
    displayLevel: "3",
    category: "normal",
    level: 3,
    cumulativeMax: 3,
    socketPattern: "🔴🔵🔴",
    sourceDescription: "Après avoir subi une perte de 3pa : +30 volonté",
    sourceLocation: "Stèle Volcan Or'Hodruin (Donjon lvl 200)"
  },
  {
    id: "focalisation-2",
    familyId: "focalisation",
    name: "Focalisation",
    wakfuGuideName: "Focalisation 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🟢🔴🔴",
    sourceDescription: "-15% de dégâts infligés. En début de tour, +25% de dégâts infligé si un seul ennemi à été touché au tour précédent",
    sourceLocation: "Stèle E-Bou (Donjon lvl 170)"
  },
  {
    id: "folie-4",
    familyId: "folie",
    name: "Folie",
    wakfuGuideName: "Folie 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "+24% dommage infligés en diagonale",
    sourceLocation: "Stèle Womewo (Donjon lvl 155)"
  },
  {
    id: "folie-vampirique-4",
    familyId: "folie-vampirique",
    name: "Folie Vampirique",
    wakfuGuideName: "Folie Vampirique 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "-20% soins reçus mais vole 16% des dégâts infligés sur les dégâts infligés en diagonale",
    sourceLocation: "Stèle Trouffe Salée (Donjon lvl 140)"
  },
  {
    id: "force-legere-6",
    familyId: "force-legere",
    name: "Force légère",
    wakfuGuideName: "Force légère 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "+18% de dommages infligés tant que le porteur ne possède pas d’armure",
    sourceLocation: "Stèle Plantigardes (Donjon lvl 215)"
  },
  {
    id: "force-vitale-2",
    familyId: "force-vitale",
    name: "Force vitale",
    wakfuGuideName: "Force vitale 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "En début de tour, si PV >= 90% : +1PA",
    sourceLocation: "Stèle Carapattes (Donjon lvl 215)",
    hpRequirement: {
      minPercent: 90
    }
  },
  {
    id: "frenesie-2",
    familyId: "frenesie",
    name: "frénésie",
    wakfuGuideName: "frénésie 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "-20 % de dégâts infligés, en début de tour +10 % de dégâts infligés par ennemi touché dans le tour précédent",
    sourceLocation: "Stèle d'intervention Aguabrial (1) (Donjon Blérox/Volcan/Dragoeufs/Crête Givrée 200)"
  },
  {
    id: "fuite-6",
    familyId: "fuite",
    name: "Fuite",
    wakfuGuideName: "Fuite 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "En esquivant un ennemi (avec pertes) : +1 PM (3 max/tour)",
    sourceLocation: "Stèle Jawdin de la Weine (Donjon lvl 140)"
  },
  {
    id: "fureur-2",
    familyId: "fureur",
    name: "Fureur",
    wakfuGuideName: "Fureur 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "-15 % de dégâts infligés, +5 % de dégâts infligés par entité touchée dans le tour précédent",
    sourceLocation: "Stèle Tanière des Blérox (Donjon lvl 200)"
  },
  {
    id: "gel-4",
    familyId: "gel",
    name: "Gel",
    wakfuGuideName: "Gel 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "+16% de dégâts eau",
    sourceLocation: "Stèle Blopéra (Donjon lvl 155)"
  },
  {
    id: "gel-secondaire-4",
    familyId: "gel-secondaire",
    name: "Gel secondaire",
    wakfuGuideName: "Gel secondaire 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔵",
    sourceDescription: "En lançant un sort feu, terre ou air : +8% dégâts infligés au prochain sort eau (cumul max 30). Effet consommé au prochain sort eau direct",
    sourceLocation: "Stèle Enutrosor (Donjon lvl 155)"
  },
  {
    id: "influence-6",
    familyId: "influence",
    name: "Influence",
    wakfuGuideName: "Influence 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "+18% cc",
    sourceLocation: "Drop sur mimic Runique"
  },
  {
    id: "influence-de-wakfu-ii",
    familyId: "influence-de-wakfu",
    name: "influence de Wakfu",
    wakfuGuideName: "influence de Wakfu II",
    displayLevel: "II",
    category: "normal",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🔴🔴🔵",
    sourceDescription: "+20 % cc si le porteur commence son tour avec tous ses PW",
    sourceLocation: "Brèche de Sufokia (lvl 66 minimum)"
  },
  {
    id: "influence-lente-4",
    familyId: "influence-lente",
    name: "Influence lente",
    wakfuGuideName: "Influence lente 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "+4 % cc par tour (max 30)",
    sourceLocation: "Stèle E-Bou (Donjon lvl 170)"
  },
  {
    id: "influence-paradoxale-4",
    familyId: "influence-paradoxale",
    name: "Influence paradoxale",
    wakfuGuideName: "Influence paradoxale 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🔴🔵",
    sourceDescription: "Si un coup non critique est effectué avec un sort élémentaire : +20 % de Coup Critique au tour suivant",
    sourceLocation: "Stèle Vandaliénés (Donjon lvl 215)"
  },
  {
    id: "influence-vitale-6",
    familyId: "influence-vitale",
    name: "Influence vitale",
    wakfuGuideName: "Influence vitale 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "Lorsque les PV sont supérieurs à 90 % : +24 % de Coup Critique",
    sourceLocation: "Stèle Crustargneux (Donjon lvl 215)",
    hpRequirement: {
      minPercent: 90
    }
  },
  {
    id: "integrite-2",
    familyId: "integrite",
    name: "Intégrité",
    wakfuGuideName: "Intégrité 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🔵🔴",
    sourceDescription: "En soignant un allié, si cet allié à moins de 15 % de pv : +14 % des pv max de la cible sont soignés (supplémentaire)",
    sourceLocation: "Stèle d'intervention Aguabrial (2) (Donjon Blérox lvl 200)",
    hpRequirement: {
      maxPercent: 15
    }
  },
  {
    id: "interception-6",
    familyId: "interception",
    name: "Interception",
    wakfuGuideName: "Interception 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "+300% du niveau en tacle",
    sourceLocation: "Stèle Trouffe Salée (Donjon lvl 140)"
  },
  {
    id: "interposition-6",
    familyId: "interposition",
    name: "Interposition",
    wakfuGuideName: "Interposition 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🟢",
    sourceDescription: "En taclant un ennemi : +300% du niveau en armure",
    sourceLocation: "Stèle Plantigardes (Donjon lvl 215)"
  },
  {
    id: "jugement-6",
    familyId: "jugement",
    name: "Jugement",
    wakfuGuideName: "Jugement 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔴🔵",
    sourceDescription: "En infligeant des dommages monocibles à un ennemi, +18% dégâts infligés sur cette cible au prochain tour",
    sourceLocation: "Stèle Nox (Boss Ultime lvl 245)"
  },
  {
    id: "legerete-3",
    familyId: "legerete",
    name: "Légèreté",
    wakfuGuideName: "Légèreté 3",
    displayLevel: "3",
    category: "normal",
    level: 3,
    cumulativeMax: 3,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "Après avoir subi une perte de 3pm : +30 volonté",
    sourceLocation: "Stèle Sanctuaire des Dragoeufs (Donjon lvl 200)"
  },
  {
    id: "longueur-6",
    familyId: "longueur",
    name: "longueur",
    wakfuGuideName: "longueur 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔴",
    sourceDescription: "+12 % de dégâts infligés aux cibles alignées et à 2 cases et plus du porteur de l’état",
    sourceLocation: "Drop Mimic Runique"
  },
  {
    id: "longueur-d-armure-6",
    familyId: "longueur-d-armure",
    name: "longueur d’armure",
    wakfuGuideName: "longueur d’armure 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔵🟢",
    sourceDescription: "+24 % armure donnée sur un allié en ligne et à distance",
    sourceLocation: "Brèche de Bonta (lvl 141 minimum)"
  },
  {
    id: "loup-solitaire-4",
    familyId: "loup-solitaire",
    name: "Loup solitaire",
    wakfuGuideName: "Loup solitaire 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔵🟢",
    sourceDescription: "+8 % de dégâts infligés si aucun allié n’est entre 1 et 4 cases du porteur",
    sourceLocation: "Stèle d'intervention Aguabrial (2) (Donjon Volcan Or'Hodruin lvl 200)"
  },
  {
    id: "main-forte-6",
    familyId: "main-forte",
    name: "Main forte",
    wakfuGuideName: "Main forte 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🔴",
    sourceDescription: "finir son tour au contact d’un ennemi lui applique -30 % d’armure reçue (1tour)",
    sourceLocation: "Brèche de Tainéla (lvl 21 minimum)"
  },
  {
    id: "manie-4",
    familyId: "manie",
    name: "Manie",
    wakfuGuideName: "Manie 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔴🟢",
    sourceDescription: "Les dommages en mêlée retirent 200 % du niveau en armure sur la cible, -12% armure reçue",
    sourceLocation: "Brèche Moon (lvl 171 minimum)"
  },
  {
    id: "muraille-4",
    familyId: "muraille",
    name: "Muraille",
    wakfuGuideName: "Muraille 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔵🟢",
    sourceDescription: "En début de combat, 600 % du niveau en armure",
    sourceLocation: "Stèle Tropikes (Donjon lvl 185)"
  },
  {
    id: "nature-6",
    familyId: "nature",
    name: "Nature",
    wakfuGuideName: "Nature 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🔵",
    sourceDescription: "12 % soins réalisés sur un allié au contact d’un autre allié",
    sourceLocation: "Brèche de Sufokia (lvl 66 minimum)"
  },
  {
    id: "neutralite-4",
    familyId: "neutralite",
    name: "Neutralité",
    wakfuGuideName: "Neutralité 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🟢🔴",
    sourceDescription: "Au début du t1, si maîtrise secondaires ≤ 0, +32 % de dégâts infligés",
    sourceLocation: "Brèche d'Osamosa (lvl 201 minimum)"
  },
  {
    id: "opiniatrete-2",
    familyId: "opiniatrete",
    name: "Opiniâtreté",
    wakfuGuideName: "Opiniâtreté 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔵🔴",
    sourceDescription: "Après avoir subi une perte de 2pa : +10 volonté (3 tours)",
    sourceLocation: "Stèle Canyon des Fléopards (Donjon lvl 200)"
  },
  {
    id: "parade-berserk-6",
    familyId: "parade-berserk",
    name: "Parade Berserk",
    wakfuGuideName: "Parade Berserk 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "+30 % parade si pv inférieurs à 50 %",
    sourceLocation: "Stèle Tanière des Blérox (Donjon lvl 200)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "parade-berzerk-6",
    familyId: "parade-berzerk",
    name: "Parade Berzerk",
    wakfuGuideName: "Parade Berzerk 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "+30 % parade si pv inférieurs à 50 %",
    sourceLocation: "Stèle Tanière des Blérox (Donjon lvl 200)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "parade-offensive-2",
    familyId: "parade-offensive",
    name: "Parade offensive",
    wakfuGuideName: "Parade offensive 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔴🟢",
    sourceDescription: "en faisant une parade sur une attaque directe ennemie : +4 % de dégâts infligés -10 % parade",
    sourceLocation: "Brèche d'Osamosa (lvl 201 minimum)"
  },
  {
    id: "persistance-2",
    familyId: "persistance",
    name: "Persistance",
    wakfuGuideName: "Persistance 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "En fin de tour, si le porteur de l’état a 6PA ou plus, +60res elem (2 tours)",
    sourceLocation: "Stèle Canyon des Fléopards (Donjon lvl 200)"
  },
  {
    id: "pied-ferme-4",
    familyId: "pied-ferme",
    name: "Pied ferme",
    wakfuGuideName: "Pied ferme 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔴🔴",
    sourceDescription: "finir son tour au contact d’un ennemi lui applique -20 % de soins réalisés (1tour)",
    sourceLocation: "Brèche Ultime Zinit (lvl 201 minimum)"
  },
  {
    id: "poids-plume-4",
    familyId: "poids-plume",
    name: "Poids plume",
    wakfuGuideName: "Poids plume 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔴🔴",
    sourceDescription: "par PM supérieur à 4 (au début du combat) +8 % de dégâts infligés (max 24)",
    sourceLocation: "Brèche Ultime Shukrute (lvl 216 minimum)"
  },
  {
    id: "precaution-4",
    familyId: "precaution",
    name: "Précaution",
    wakfuGuideName: "Précaution 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "En terminant son tour avec moins de 50 % PV : soins de 20 % des pv manquants",
    sourceLocation: "Brèche d'Amakna (lvl 111 minimum)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "preparation-critique-4",
    familyId: "preparation-critique",
    name: "Préparation critique",
    wakfuGuideName: "Préparation critique 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "A chaque cc effectué (max 5) +8 niveau de préparation (+8 % de dégâts infligés au prochain sort du prochain tour)",
    sourceLocation: "Brèche Shukrute (lvl 216 minimum)"
  },
  {
    id: "pretention-6",
    familyId: "pretention",
    name: "Prétention",
    wakfuGuideName: "Prétention 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "Au début du t1, si maîtrise secondaire ≤ 0 , +30 % parade",
    sourceLocation: "Brèche d'Osamosa (lvl 201 minimum)"
  },
  {
    id: "profit-6",
    familyId: "profit",
    name: "Profit",
    wakfuGuideName: "Profit 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "Après avoir effectué un retrait PA ou PM : +1 PA (3 max/tour)",
    sourceLocation: "Stèle Cagnardeurs (Donjon lvl 215)"
  },
  {
    id: "propagation-4",
    familyId: "propagation",
    name: "Propagation",
    wakfuGuideName: "Propagation 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "Une fois par tour, quand vous infligez des dommages : inflige 40% du niveau en dommages lumières aux cibles alignées avec la cible",
    sourceLocation: "Stèle Jawdin de la Weine (Donjon lvl 140)"
  },
  {
    id: "prosperite-4",
    familyId: "prosperite",
    name: "Prospérité",
    wakfuGuideName: "Prospérité 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🔴🔵",
    sourceDescription: "+12 % aux bonus de caractéristiques reçues (maîtrises, résistances, armure) lancé par un allié",
    sourceLocation: "Stèle Source du mal (Donjon lvl 155)"
  },
  {
    id: "puissance-brute-4",
    familyId: "puissance-brute",
    name: "Puissance Brute",
    wakfuGuideName: "Puissance Brute 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🟢",
    sourceDescription: "-4 PW, Pour chaque PW dépensé au cours du tours +8 % de dégâts infligés (1 tour) (max 16)",
    sourceLocation: "Brèche Ultime Zinit (lvl 201 minimum)"
  },
  {
    id: "puits-de-vitalite-6",
    familyId: "puits-de-vitalite",
    name: "Puits de vitalité",
    wakfuGuideName: "Puits de vitalité 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "augmente de 30 % les vols de vie réalisés",
    sourceLocation: "Stèle Sabléoptères (Donjon lvl 155)"
  },
  {
    id: "ravage-4",
    familyId: "ravage",
    name: "Ravage",
    wakfuGuideName: "Ravage 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🟢",
    sourceDescription: "en début de combat, toutes les maîtrises +20 % du niveau toutes les res +12",
    sourceLocation: "Stèle Volcan Or'Hodruin (Donjon lvl 200)"
  },
  {
    id: "ravage-secondaire-6",
    familyId: "ravage-secondaire",
    name: "Ravage secondaire",
    wakfuGuideName: "Ravage secondaire 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🟢🟢",
    sourceDescription: "+9%cc +9 % parade +9volonté",
    sourceLocation: "Stèle Canyon des Fléopards (Donjon lvl 200)"
  },
  {
    id: "relations-sociales-6",
    familyId: "relations-sociales",
    name: "Relations sociales",
    wakfuGuideName: "Relations sociales 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "+12 % dégâts dos en tour pair, +12 % dégâts de face tour impair",
    sourceLocation: "Brèche Moon (lvl 171 minimum)"
  },
  {
    id: "represailles-4",
    familyId: "represailles",
    name: "Représailles",
    wakfuGuideName: "Représailles 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔴🟢",
    sourceDescription: "+24% de dégâts infligés sur les cibles qui vous ont infligés des dégâts directs à distance (non cumulable)",
    sourceLocation: "Stèle Mansots (Donjon lvl 215)"
  },
  {
    id: "reprobation-6",
    familyId: "reprobation",
    name: "Réprobation",
    wakfuGuideName: "Réprobation 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "-20 volonté. Réduit de 1 les 3 prochaines pertes de PA subis. L'effet se réapplique à chaque tour",
    sourceLocation: "Drop Mimic Runique"
  },
  {
    id: "retour-d-armure-4",
    familyId: "retour-d-armure",
    name: "Retour d’armure",
    wakfuGuideName: "Retour d’armure 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔴🔴",
    sourceDescription: "En tuant un ennemi : 10 % des PV max en Armure (2 activations par tour)",
    sourceLocation: "Stèle Srambad (Donjon lvl 155)"
  },
  {
    id: "retour-enflamme-2",
    familyId: "retour-enflamme",
    name: "Retour enflammé",
    wakfuGuideName: "Retour enflammé 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔴🟢",
    sourceDescription: "gagne 100 % du niveau en enflammé en tuant un ennemi (1 fois par tour)",
    sourceLocation: "Brèche de Bonta (lvl 141 minimum)"
  },
  {
    id: "retour-pa-4",
    familyId: "retour-pa",
    name: "Retour PA",
    wakfuGuideName: "Retour PA 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔴🟢",
    sourceDescription: "regagne +2PA en tuant un ennemi (2 max par tour)",
    sourceLocation: "Stèle Crête Givrée (Donjon lvl 200)"
  },
  {
    id: "retour-pm-4",
    familyId: "retour-pm",
    name: "Retour PM",
    wakfuGuideName: "Retour PM 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔴🟢",
    sourceDescription: "regagne +2PM en tuant un ennemi (2 max par tour)",
    sourceLocation: "Stèle Source du mal (Donjon lvl 155)"
  },
  {
    id: "retour-vital-2",
    familyId: "retour-vital",
    name: "Retour vital",
    wakfuGuideName: "Retour vital 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "soigne 20 % des pv manquants du lanceur en tuant un ennemi (2 par tour max)",
    sourceLocation: "Brèche de Tainéla (lvl 21 minimum)"
  },
  {
    id: "revigoration-4",
    familyId: "revigoration",
    name: "Revigoration",
    wakfuGuideName: "Revigoration 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🔵🔴",
    sourceDescription: "-10 % soins réalisés, le porteur de l’état est soigne de 16 % des soins réalisés sur ses alliés",
    sourceLocation: "Brèche d'Amakna (lvl 111 minimum)"
  },
  {
    id: "ruine-6",
    familyId: "ruine",
    name: "Ruine",
    wakfuGuideName: "Ruine 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔴🔴🔴",
    sourceDescription: "+30 % dégâts indirects",
    sourceLocation: "Stèle Sabléoptères (Donjon lvl 155)"
  },
  {
    id: "ruine-cyclique-2",
    familyId: "ruine-cyclique",
    name: "Ruine cyclique",
    wakfuGuideName: "Ruine cyclique 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔴🔴",
    sourceDescription: "+20 % dégâts indirects dans les tours de table pairs",
    sourceLocation: "Stèle Cité interdite (Donjon 3 joueurs lvl 185)"
  },
  {
    id: "rupture-pa-4",
    familyId: "rupture-pa",
    name: "Rupture PA",
    wakfuGuideName: "Rupture PA 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🔵",
    sourceDescription: "Si vous retirez intégralement l’armure d’une cible : vous regagnez 2PA (2 fois par tour)",
    sourceLocation: "Stèle Abraknyde (Donjon lvl 140)"
  },
  {
    id: "rupture-violente-4",
    familyId: "rupture-violente",
    name: "Rupture violente",
    wakfuGuideName: "Rupture violente 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "Si vous retirez intégralement l’armure d’une cible : vous infligez 40% de votre niveau en dégâts lumières",
    sourceLocation: "Stèle Srambad (Donjon lvl 155)"
  },
  {
    id: "sanguinolence-4",
    familyId: "sanguinolence",
    name: "Sanguinolence",
    wakfuGuideName: "Sanguinolence 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "A chaque malus ou perte appliqués sur une cible : +8% de dégâts reçus par la cible (max 40%)",
    sourceLocation: "Stèle Cagnardeurs (Donjon lvl 215)"
  },
  {
    id: "sauvegarde-6",
    familyId: "sauvegarde",
    name: "Sauvegarde",
    wakfuGuideName: "Sauvegarde 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔴",
    sourceDescription: "En fin de tour, les PA non utilisés sont transmis au tour suivants (max 3)",
    sourceLocation: "Stèle Volcan Or'Hodruin (Donjon lvl 200)"
  },
  {
    id: "sauvegarde-critique-6",
    familyId: "sauvegarde-critique",
    name: "Sauvegarde critique",
    wakfuGuideName: "Sauvegarde critique 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "En fin de tour, les PA non utilisés sont transmis en Coup critique au tour suivant (10% CC par PA, max 3)",
    sourceLocation: "Stèle Nox (Boss Ultime lvl 245)"
  },
  {
    id: "sauvegarde-du-wakfu-2",
    familyId: "sauvegarde-du-wakfu",
    name: "Sauvegarde du Wakfu",
    wakfuGuideName: "Sauvegarde du Wakfu 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔵🔵",
    sourceDescription: "-1PW / En fin de tour, +1PW si le porteur n’a pas dépensé de PW",
    sourceLocation: "Stèle Womewo (Donjon lvl 155)"
  },
  {
    id: "secret-de-la-vie-2",
    familyId: "secret-de-la-vie",
    name: "Secret de la vie",
    wakfuGuideName: "Secret de la vie 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🟢🔵🔵",
    sourceDescription: "Au début du combat : +10 % soins réalisés, réduit la maîtrise soin à 0",
    sourceLocation: "Stèle d'intervention Aguabrial (2) (Donjon Dragoeufs lvl 200)"
  },
  {
    id: "solidite-2",
    familyId: "solidite",
    name: "Solidité",
    wakfuGuideName: "Solidité 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🟢🔴",
    sourceDescription: "réduit les dommages directs reçus supérieurs à 20 % des PV max de 400 % du niveau (une fois par tour de table)",
    sourceLocation: "Stèle Palais Lenald (Donjon lvl 140)"
  },
  {
    id: "stupefaction-4",
    familyId: "stupefaction",
    name: "Stupéfaction",
    wakfuGuideName: "Stupéfaction 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "+20%cc (1 tour) +20 % du niveau en maîtrise crit (1 tour)",
    sourceLocation: "Stèle Tanière des Blérox (Donjon lvl 200)"
  },
  {
    id: "tabass-carapace-4",
    familyId: "tabass-carapace",
    name: "Tabass’Carapace",
    wakfuGuideName: "Tabass’Carapace 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🔵",
    sourceDescription: "+24% de dégâts infligés sur une cible qui possède de l’armure",
    sourceLocation: "Stèle Cagnardeurs (Donjon lvl 215)"
  },
  {
    id: "tacle-berserk-6",
    familyId: "tacle-berserk",
    name: "Tacle Berserk",
    wakfuGuideName: "Tacle Berserk 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔵🔵",
    sourceDescription: "lorsque les PV sont inférieurs à 50 % : +300% du niveau en tacle",
    sourceLocation: "Stèle Crocodailles (Donjon lvl 185)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "tellurisme-4",
    familyId: "tellurisme",
    name: "Tellurisme",
    wakfuGuideName: "Tellurisme 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "+16% de dégâts terre",
    sourceLocation: "Stèle Enutrosor (Donjon lvl 155)"
  },
  {
    id: "tellurisme-secondaire-4",
    familyId: "tellurisme-secondaire",
    name: "Tellurisme secondaire",
    wakfuGuideName: "Tellurisme secondaire 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🔴",
    sourceDescription: "En lançant un sort feu, eau ou air : +8% dégâts infligés au prochain sort terre (cumul max 30). Effet consommé au prochain sort terre direct",
    sourceLocation: "Stèle Blopéra (Donjon lvl 155)"
  },
  {
    id: "temerite-4",
    familyId: "temerite",
    name: "Témérité",
    wakfuGuideName: "Témérité 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "Lorsque le porteur retire toute son armure à une cible, +12% de dégâts infligés pour le reste du tour (max 30%)",
    sourceLocation: "Stèle Abraknyde (Donjon lvl 140)"
  },
  {
    id: "temporisation-4",
    familyId: "temporisation",
    name: "Temporisation",
    wakfuGuideName: "Temporisation 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🔴🔵",
    sourceDescription: "En début de tour, si aucun PW n'a été utilisé au tour précédent : +16% de dommage infligé et + 16% de soins réalisés",
    sourceLocation: "Brèche Ultime Shukrute (lvl 216 minimum)"
  },
  {
    id: "tenacite-4",
    familyId: "tenacite",
    name: "Ténacité",
    wakfuGuideName: "Ténacité 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔵",
    sourceDescription: "en fin de tour, si le porteur de l’état a 2pa ou plus : +50 résistances élémentaires (1 tour)",
    sourceLocation: "Stèle Palais Lenald (Donjon lvl 140)"
  },
  {
    id: "theorie-de-la-matiere-2",
    familyId: "theorie-de-la-matiere",
    name: "Théorie de la matière",
    wakfuGuideName: "Théorie de la matière 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🟢🔴",
    sourceDescription: "+100 % cc -50 % dommages et soins",
    sourceLocation: "Stèle Méka (Donjon lvl 170)"
  },
  {
    id: "tolerance-2",
    familyId: "tolerance",
    name: "Tolérance",
    wakfuGuideName: "Tolérance 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔵🔵",
    sourceDescription: "en fin de tour, 50 % des PM non utilisés sont transmis au tour suivant (max 2)",
    sourceLocation: "Stèle d'intervention Aguabrial (2) (Donjon Crète Givrée lvl 200)"
  },
  {
    id: "topologie-3",
    familyId: "topologie",
    name: "Topologie",
    wakfuGuideName: "Topologie 3",
    displayLevel: "3",
    category: "normal",
    level: 3,
    cumulativeMax: 3,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "au début du combat, toute l’esquive du porteur est convertie en armure avec un ratio de 1 pour 3 (esquive perdue)",
    sourceLocation: "Stèle Cité interdite (Donjon 3 joueurs lvl 185)"
  },
  {
    id: "valeur-ajoutee-4",
    familyId: "valeur-ajoutee",
    name: "Valeur ajoutée",
    wakfuGuideName: "Valeur ajoutée 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🟢🟢",
    sourceDescription: "Pour chaque dommage indirect effectué: +8% dégâts indirects et -8% dégâts directs (max 40%) → bonus perdu en début de tour",
    sourceLocation: "Stèle Compost du grand Potofeu (Donjon lvl 140)"
  },
  {
    id: "velocite-2",
    familyId: "velocite",
    name: "Vélocité",
    wakfuGuideName: "Vélocité 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🟢🔴🔴",
    sourceDescription: "+1PM -10 % de dégâts infligés",
    sourceLocation: "Stèle Tropikes (Donjon lvl 185) + récompense de quête de Pandala (Par le Bambou Sacré !)"
  },
  {
    id: "ventilation-4",
    familyId: "ventilation",
    name: "Ventilation",
    wakfuGuideName: "Ventilation 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🔵🟢",
    sourceDescription: "+16% de dégâts air",
    sourceLocation: "Stèle Enutrosor (Donjon lvl 155)"
  },
  {
    id: "ventilation-secondaire-4",
    familyId: "ventilation-secondaire",
    name: "Ventilation secondaire",
    wakfuGuideName: "Ventilation secondaire 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔴🟢🟢",
    sourceDescription: "En lançant un sort feu, eau ou terre : +8% dégâts infligés au prochain sort air (cumul max 30). Effet consommé au prochain sort air direct",
    sourceLocation: "Stèle Blopéra (Donjon lvl 155)"
  },
  {
    id: "verrouillage-6",
    familyId: "verrouillage",
    name: "Verrouillage",
    wakfuGuideName: "Verrouillage 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔴🟢",
    sourceDescription: "+24% de dégâts infligés aux cibles sans ligne de vue à 3cases et plus",
    sourceLocation: "Brèche Shukrute (lvl 216 minimum)"
  },
  {
    id: "visibilite-2",
    familyId: "visibilite",
    name: "Visibilité",
    wakfuGuideName: "Visibilité 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🟢🟢",
    sourceDescription: "+1PO -150 tacle -150 esquive",
    sourceLocation: "Stèle Kannibouls (Donjon lvl 185)"
  },
  {
    id: "vision-intermediaire-6",
    familyId: "vision-intermediaire",
    name: "Vision intermédiaire",
    wakfuGuideName: "Vision intermédiaire 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🔴🔵",
    sourceDescription: "+18% dégâts infligés aux cibles à 3PO pile poil",
    sourceLocation: "Stèle Noirespore (Donjon lvl 140)"
  },
  {
    id: "vivacite-2",
    familyId: "vivacite",
    name: "Vivacité",
    wakfuGuideName: "Vivacité 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔴🔵🔵",
    sourceDescription: "+1PA -75 résistances",
    sourceLocation: "Stèle Crocodailles (Donjon lvl 185) + récompense de quête de Pandala (Par le Bambou Sacré !)"
  },
  {
    id: "vol-d-esquive-4",
    familyId: "vol-d-esquive",
    name: "Vol d’esquive",
    wakfuGuideName: "Vol d’esquive 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔵",
    sourceDescription: "-10 % de dégâts infligés avec une arme, en infligeant des dommages avec une arme à 2 mains : vole 60 % du niveau en esquive (1 fois par tour max)",
    sourceLocation: "Brèche de Bonta (lvl 141 minimum)"
  },
  {
    id: "vol-de-tacle-4",
    familyId: "vol-de-tacle",
    name: "Vol de tacle",
    wakfuGuideName: "Vol de tacle 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🟢🟢🔴",
    sourceDescription: "-10 % de dégâts infligés avec une arme, en infligeant des dommages avec une arme à 2 mains : vole 60 % du niveau en tacle (1 fois par tour max)",
    sourceLocation: "Brèche de Tainéla (lvl 21 minimum)"
  },
  {
    id: "volonte-directe-6",
    familyId: "volonte-directe",
    name: "Volonté directe",
    wakfuGuideName: "Volonté directe 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🔵🟢🔵",
    sourceDescription: "+18 Volonté pendant votre tour de jeu / -24 volonté en dehors de votre tour de jeu",
    sourceLocation: "Stèle Vandaliénés (Donjon lvl 215)"
  },
  {
    id: "volonte-indirecte-6",
    familyId: "volonte-indirecte",
    name: "Volonté indirecte",
    wakfuGuideName: "Volonté indirecte 6",
    displayLevel: "6",
    category: "normal",
    level: 6,
    cumulativeMax: 6,
    socketPattern: "🟢🔵🟢",
    sourceDescription: "+18 Volonté en dehors de votre tour de jeu / -24 volonté pendant votre tour de jeu",
    sourceLocation: "Stèle Compost du grand Potofeu (Donjon lvl 140)"
  },
  {
    id: "volte-face-2",
    familyId: "volte-face",
    name: "Volte face",
    wakfuGuideName: "Volte face 2",
    displayLevel: "2",
    category: "normal",
    level: 2,
    cumulativeMax: 2,
    socketPattern: "🔵🔵🟢",
    sourceDescription: "Lorsque le porteur de l’état subis des dommages au contact : se retourne vers l’attaquant (une fois par tour)",
    sourceLocation: "Brèche Ultime Frigost (lvl 111 minimum)"
  },
  {
    id: "wakfu-berzerk-4",
    familyId: "wakfu-berzerk",
    name: "Wakfu Berzerk",
    wakfuGuideName: "Wakfu Berzerk 4",
    displayLevel: "4",
    category: "normal",
    level: 4,
    cumulativeMax: 4,
    socketPattern: "🔵🔵🔴",
    sourceDescription: "Si le porteur de l’état commence son tour avec 50 % ou moins de ses PW : +12 % dégats crit, +400 % du niveau en armure",
    sourceLocation: "Brèche Ultime Frigost (lvl 111 minimum)",
    hpRequirement: {
      maxPercent: 50
    }
  },
  {
    id: "abnegation",
    familyId: "abnegation",
    name: "Abnégation",
    wakfuGuideName: "Abnégation",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si la Maîtrise élémentaire la plus haute est supérieure à la Maîtrise soin : -15 % Dommages infligés, +30 % Soins réalisés.",
    sourceLocation: ""
  },
  {
    id: "anatomie",
    familyId: "anatomie",
    name: "Anatomie",
    wakfuGuideName: "Anatomie",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si la Maîtrise élémentaire la plus haute est supérieure à la Maîtrise dos : -20 % Dommages infligés, +40 % Dommages infligés de dos.",
    sourceLocation: ""
  },
  {
    id: "brutalite",
    familyId: "brutalite",
    name: "Brutalité",
    wakfuGuideName: "Brutalité",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur a 0 de portée : +20% dégâts sur les sorts qui sont de nature mêlée ET zone à la fois",
    sourceLocation: ""
  },
  {
    id: "chaos",
    familyId: "chaos",
    name: "Chaos",
    wakfuGuideName: "Chaos",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, +20% de dommages infligés et de soins réalisés mais vos maîtrises élémentaires sont réduite à 0",
    sourceLocation: ""
  },
  {
    id: "concentration-elementaire",
    familyId: "concentration-elementaire",
    name: "Concentration élémentaire",
    wakfuGuideName: "Concentration élémentaire",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat : 20 % Dommages infligés et Soins réalisés, -30 % de maîtrises dans les 3 éléments les plus faibles",
    sourceLocation: ""
  },
  {
    id: "constance",
    familyId: "constance",
    name: "Constance",
    wakfuGuideName: "Constance",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état a 10 % cc ou moins : +20 % de dégâts infligés +50res elem",
    sourceLocation: ""
  },
  {
    id: "constance-ii",
    familyId: "constance",
    name: "Constance",
    wakfuGuideName: "Constance II",
    displayLevel: "II",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat +40% de dommages indirects si vous avez 10% de cc ou moins",
    sourceLocation: ""
  },
  {
    id: "controle-de-l-espace",
    familyId: "controle-de-l-espace",
    name: "Contrôle de l’espace",
    wakfuGuideName: "Contrôle de l’espace",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Si le lanceur a exactement 1PO dans son build : +15 % de dégâts infligés et soins réalisés sur les cibles à 2,3 et 4 cases de distance du lanceur",
    sourceLocation: ""
  },
  {
    id: "controle-de-l-espace-ii",
    familyId: "controle-de-l-espace",
    name: "Contrôle de l’espace",
    wakfuGuideName: "Contrôle de l’espace II",
    displayLevel: "II",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état a au moins 3 Portée : +30 % Dommages indirects.",
    sourceLocation: ""
  },
  {
    id: "demesure",
    familyId: "demesure",
    name: "Démesuré",
    wakfuGuideName: "Démesuré",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède plus de Parade que de Coup Critique : la Parade est convertie en Coup Critique",
    sourceLocation: ""
  },
  {
    id: "denouement",
    familyId: "denouement",
    name: "Dénouement",
    wakfuGuideName: "Dénouement",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Convertit 100 % de maîtrise critique en maîtrise élémentaire au lancement du combat si le porteur a au moins 40 coups critiques",
    sourceLocation: ""
  },
  {
    id: "elementalisme",
    familyId: "elementalisme",
    name: "Elémentalisme",
    wakfuGuideName: "Elémentalisme",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède 3 maîtrises élémentaires égales : +20 % de dommages infligés et soins réalisés.",
    sourceLocation: ""
  },
  {
    id: "engagement",
    familyId: "engagement",
    name: "Engagement",
    wakfuGuideName: "Engagement",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède <= 0 de maîtrise soin : 30 % de soins réalisés",
    sourceLocation: ""
  },
  {
    id: "force-herculeenne",
    familyId: "force-herculeenne",
    name: "Force Herculéenne",
    wakfuGuideName: "Force Herculéenne",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur a un nombre impair de PA : +250 % du niveau en tacle et esquive",
    sourceLocation: ""
  },
  {
    id: "furie",
    familyId: "furie",
    name: "Furie",
    wakfuGuideName: "Furie",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "au lancement du combat, si le porteur a moins de 100 % de son niveau en esquive : +15 % de dégâts infligés en berzerk +100 % du niveau en tacle",
    sourceLocation: ""
  },
  {
    id: "furie-ii",
    familyId: "furie",
    name: "Furie",
    wakfuGuideName: "Furie II",
    displayLevel: "II",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur à 4PO ou + : +15 % dégâts distance en étant en berzerk et +1PO",
    sourceLocation: ""
  },
  {
    id: "inflexibilite",
    familyId: "inflexibilite",
    name: "Inflexibilité",
    wakfuGuideName: "Inflexibilité",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "+15% de dégâts infligés et +10 volonté (au lvl 100 ou + pour la volonté) si le porteur de l’état a 10PA ou moins au lancement du combat",
    sourceLocation: ""
  },
  {
    id: "inflexibilite-ii",
    familyId: "inflexibilite",
    name: "Inflexibilité",
    wakfuGuideName: "Inflexibilité II",
    displayLevel: "II",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si les maîtrises secondaires sont inférieures ou égales à 0 : +20% de Dommages infligés et Soins réalisés.",
    sourceLocation: ""
  },
  {
    id: "maniement-bouclier",
    familyId: "maniement-bouclier",
    name: "Maniement : Bouclier",
    wakfuGuideName: "Maniement : Bouclier",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Si le porteur de l’état a un bouclier équipé : +1PM et la PO est fixée à 0",
    sourceLocation: ""
  },
  {
    id: "maniement-deux-mains",
    familyId: "maniement-deux-mains",
    name: "Maniement : Deux mains",
    wakfuGuideName: "Maniement : Deux mains",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Si le porteur de l’état a une arme à deux mains équipée : +2PA -2PM (12 PA max de build de base)",
    sourceLocation: ""
  },
  {
    id: "maniement-dague",
    familyId: "maniement-dague",
    name: "Maniement dague",
    wakfuGuideName: "Maniement dague",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Si le joueur a une dague équipée : +25 % de dégâts infligés sur les cibles de face, +15 % de dégâts infligés sur les cibles de coté, -30 % de dégâts infligés sur les cibles de dos",
    sourceLocation: ""
  },
  {
    id: "mesure",
    familyId: "mesure",
    name: "Mesure",
    wakfuGuideName: "Mesure",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état a plus de 40 % de parade : +10 % cc et +10% de de dégâts infligés",
    sourceLocation: ""
  },
  {
    id: "mesure-ii",
    familyId: "mesure",
    name: "Mesure",
    wakfuGuideName: "Mesure II",
    displayLevel: "II",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède >= 50 % Coup critique : 20 Parade et 10 Volonté",
    sourceLocation: ""
  },
  {
    id: "mesure-iii",
    familyId: "mesure",
    name: "Mesure",
    wakfuGuideName: "Mesure III",
    displayLevel: "III",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède 50 % Coup critique maximum : 20 % Dommages infligés en Coup critique",
    sourceLocation: ""
  },
  {
    id: "pacte-wakfu",
    familyId: "pacte-wakfu",
    name: "Pacte Wakfu",
    wakfuGuideName: "Pacte Wakfu",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état à 8PW ou plus : +10 volonté +15 % parade",
    sourceLocation: ""
  },
  {
    id: "pilier",
    familyId: "pilier",
    name: "Pilier",
    wakfuGuideName: "Pilier",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au début du combat : Si le porteur a 50 % parade ou plus, +30 % PV -50 % armure reçue",
    sourceLocation: ""
  },
  {
    id: "pilier-ii",
    familyId: "pilier",
    name: "Pilier",
    wakfuGuideName: "Pilier II",
    displayLevel: "II",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède 50 % Parade ou plus : -30 % PV et +30 % Armure donnée",
    sourceLocation: ""
  },
  {
    id: "precision-chirurgicale",
    familyId: "precision-chirurgicale",
    name: "Précision chirurgicale",
    wakfuGuideName: "Précision chirurgicale",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état à 1PO ou moins : +20 % soins réalisés, +15 % armure donnée et reçue",
    sourceLocation: ""
  },
  {
    id: "sante-de-fer",
    familyId: "sante-de-fer",
    name: "Santé de fer",
    wakfuGuideName: "Santé de fer",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "-30 % PV +30 % soins reçues et armures reçues",
    sourceLocation: ""
  },
  {
    id: "science-du-placement",
    familyId: "science-du-placement",
    name: "Science du placement",
    wakfuGuideName: "Science du placement",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "+50 res elem -200 res dos",
    sourceLocation: ""
  },
  {
    id: "secret-critique",
    familyId: "secret-critique",
    name: "Secret Critique",
    wakfuGuideName: "Secret Critique",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si la maîtrise critique est inférieure ou égale à 0 : +30% de Coups Critiques",
    sourceLocation: ""
  },
  {
    id: "volonte-de-fer",
    familyId: "volonte-de-fer",
    name: "Volonté de fer",
    wakfuGuideName: "Volonté de fer",
    displayLevel: "",
    category: "epic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟠",
    sourceDescription: "Au lancement du combat, si le porteur de l’état possède <= 3 de portée : 20 de volonté",
    sourceLocation: ""
  },
  {
    id: "absolution",
    familyId: "absolution",
    name: "Absolution",
    wakfuGuideName: "Absolution",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+1PA et +1PM si au moins 2 alliés sont en mêlée en début de tour",
    sourceLocation: ""
  },
  {
    id: "alternance",
    familyId: "alternance",
    name: "Alternance",
    wakfuGuideName: "Alternance",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur n'a utilisé qu'un élément pour occasionner des dégâts durant son tour, il gagne +20 % Dommages infligés et Soins réalisés dans les autres éléments.",
    sourceLocation: ""
  },
  {
    id: "alternance-ii",
    familyId: "alternance",
    name: "Alternance",
    wakfuGuideName: "Alternance II",
    displayLevel: "II",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur inflige des dommages dans un élément, il gagne +15 % Dommages infligés et Soins réalisés dans les autres éléments pour le prochain sort. Uniquement la première ligne de dégâts occasionnée par le sort est prise en compte.",
    sourceLocation: ""
  },
  {
    id: "aplomb-naturel",
    familyId: "aplomb-naturel",
    name: "Aplomb naturel",
    wakfuGuideName: "Aplomb naturel",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "50 Résistance élémentaire si le porteur n’a pas d’Armure, sinon -100 Résistance élémentaire.",
    sourceLocation: ""
  },
  {
    id: "arme-de-lumiere",
    familyId: "arme-de-lumiere",
    name: "Arme de lumière",
    wakfuGuideName: "Arme de lumière",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Les dommages effectués par l’arme du porteur sont réduits de 20 % et appliquent un poison de 10 dégâts lumière par PA de l’arme utilisée (3 tours)",
    sourceLocation: ""
  },
  {
    id: "arrogance",
    familyId: "arrogance",
    name: "Arrogance",
    wakfuGuideName: "Arrogance",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Vole 25 % des dommages infligés en mêlée, -100 Résistance élémentaire",
    sourceLocation: ""
  },
  {
    id: "assimilation",
    familyId: "assimilation",
    name: "Assimilation",
    wakfuGuideName: "Assimilation",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "-50 res elem, si le porteur subit des dommages d’un ennemi, +100 res elem dans l’élément de l’attaque (non cumulable, durée 1tour)",
    sourceLocation: ""
  },
  {
    id: "aura-de-flammes",
    familyId: "aura-de-flammes",
    name: "Aura de flammes",
    wakfuGuideName: "Aura de flammes",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si aucun ennemi est au contact du personnage au début de son tour, il gagne 100 % de son niveau en Enflammé. Ajoute également 15 niveaux d’enflammé pour chaque sort reçu en mêlée",
    sourceLocation: ""
  },
  {
    id: "brasero",
    familyId: "brasero",
    name: "Brasero",
    wakfuGuideName: "Brasero",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+10 % de dégâts infligés dans 2 catégories selon les tours : tour 1 mêlée + monocible, tour 2 distance + monocible, tour 3 distance + zone, tour 4 mêlée + zone",
    sourceLocation: ""
  },
  {
    id: "brise",
    familyId: "brise",
    name: "Brise",
    wakfuGuideName: "Brise",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+25 % dégâts des sorts de zones sur la cible directe du sort -25 % dégâts sur les autres",
    sourceLocation: ""
  },
  {
    id: "calibrage",
    familyId: "calibrage",
    name: "Calibrage",
    wakfuGuideName: "Calibrage",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur a infligé des dommages en mêlée à un ennemi pendant son tour : 25 % de dommages infligés à distance pour le tour suivant",
    sourceLocation: ""
  },
  {
    id: "calibrage-ii",
    familyId: "calibrage",
    name: "Calibrage",
    wakfuGuideName: "Calibrage II",
    displayLevel: "II",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur a infligé des dommages en mêlée à un ennemi pendant son tour : 10 % de dommages infligés à distance pour le tour suivant. (1 fois par tour / cumulable 5 fois maximum)",
    sourceLocation: ""
  },
  {
    id: "chatiment",
    familyId: "chatiment",
    name: "Châtiment",
    wakfuGuideName: "Châtiment",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+1PA et +1PM si au moins 2 ennemis sont en mêlée en début de tour",
    sourceLocation: ""
  },
  {
    id: "confiance",
    familyId: "confiance",
    name: "Confiance",
    wakfuGuideName: "Confiance",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+30 % parade si le porteur n’a pas reçu de soin le tour précédent",
    sourceLocation: ""
  },
  {
    id: "contact",
    familyId: "contact",
    name: "Contact",
    wakfuGuideName: "Contact",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "En fin de tour par ennemi au contact : +5% des PV max en Armure",
    sourceLocation: ""
  },
  {
    id: "controle-du-temps",
    familyId: "controle-du-temps",
    name: "Contrôle du temps",
    wakfuGuideName: "Contrôle du temps",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Tous les 3 sorts lancés : fixe les Coups critiques à 100",
    sourceLocation: ""
  },
  {
    id: "cuirasse-singuliere",
    familyId: "cuirasse-singuliere",
    name: "Cuirasse singulière",
    wakfuGuideName: "Cuirasse singulière",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "30 % d’Armure donnée aux alliés qui ne possèdent pas d’Armure -100 % d’Armure donnée aux alliés qui possèdent déjà de l’Armure",
    sourceLocation: ""
  },
  {
    id: "cuirasse-singuliere-ii",
    familyId: "cuirasse-singuliere",
    name: "Cuirasse singulière",
    wakfuGuideName: "Cuirasse singulière II",
    displayLevel: "II",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "40 % Armure donnée sur la première Armure posée dans le tour ; -50 % Armure donnée sur les autres.",
    sourceLocation: ""
  },
  {
    id: "dernier-instant",
    familyId: "dernier-instant",
    name: "Dernier instant",
    wakfuGuideName: "Dernier instant",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le sort coûte 1 PW ou plus : +5% dommages par PW courant sur le porteur (max 30%)",
    sourceLocation: ""
  },
  {
    id: "directives",
    familyId: "directives",
    name: "Directives",
    wakfuGuideName: "Directives",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+15 % de dégâts infligés sur les sorts de zones sur les cibles alignées avec le porteur de l’état",
    sourceLocation: ""
  },
  {
    id: "distribution",
    familyId: "distribution",
    name: "Distribution",
    wakfuGuideName: "Distribution",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Lorsque le porteur soigne un allié, 25% du soin est converti en Armure et 25% du soin est perdu",
    sourceLocation: ""
  },
  {
    id: "empressement",
    familyId: "empressement",
    name: "Empressement",
    wakfuGuideName: "Empressement",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur se déplace avec un sort : 1 PM (2 max par tour)",
    sourceLocation: ""
  },
  {
    id: "energie-ancestrale",
    familyId: "energie-ancestrale",
    name: "Energie ancestrale",
    wakfuGuideName: "Energie ancestrale",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Au début de son tour si le porteur à 6PW ou plus, +4% de dégâts infligés et +15 résistances elem (max 12 % et 45) L’état est perdu si le personnage commence son tour avec moins de 6PW",
    sourceLocation: ""
  },
  {
    id: "exces",
    familyId: "exces",
    name: "Excès",
    wakfuGuideName: "Excès",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "-10% de dégâts infligés, tous les 10 sorts lancés (coûtant au moins 1pa), le porteur de l’état gagne 100 % de dégâts infligés pour le prochain sort",
    sourceLocation: ""
  },
  {
    id: "exces-ii",
    familyId: "exces",
    name: "Excès",
    wakfuGuideName: "Excès II",
    displayLevel: "II",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "-10% de dégâts infligés, tous les 5 sorts lancés (coûtant au moins 1pa), le porteur de l’état gagne 50% de dégâts infligés pour le prochain sort",
    sourceLocation: ""
  },
  {
    id: "face-a-face",
    familyId: "face-a-face",
    name: "Face-à-Face",
    wakfuGuideName: "Face-à-Face",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "En fin de tour, si vous êtes de face à un ennemi, +10% des PV max en armure",
    sourceLocation: ""
  },
  {
    id: "fracass-carcasse",
    familyId: "fracass-carcasse",
    name: "Fracass’carcasse",
    wakfuGuideName: "Fracass’carcasse",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Le premier sort qui occasionne des dégâts du tour retire 30 % armure à la cible",
    sourceLocation: ""
  },
  {
    id: "garde-levee",
    familyId: "garde-levee",
    name: "Garde levée",
    wakfuGuideName: "Garde levée",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "-30% dommage subis au cours de son propre tour",
    sourceLocation: ""
  },
  {
    id: "hypermetrope",
    familyId: "hypermetrope",
    name: "Hypermétrope",
    wakfuGuideName: "Hypermétrope",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+30% de dommages infligés sur les cibles à 7 cases ou plus, sinon -15%",
    sourceLocation: ""
  },
  {
    id: "lourdeur-involontaire",
    familyId: "lourdeur-involontaire",
    name: "Lourdeur involontaire",
    wakfuGuideName: "Lourdeur involontaire",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur est déplacé en dehors de son tour : applique Stabilisé à la fin de son prochain tour",
    sourceLocation: ""
  },
  {
    id: "lunatique",
    familyId: "lunatique",
    name: "Lunatique",
    wakfuGuideName: "Lunatique",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Tours impairs -25 % de dégâts infligés +25 % soins réalisés +25 % armure donnée. Tours pairs +25 % de dégâts infligés -25 % soins réalisés -25 % armure donnée",
    sourceLocation: ""
  },
  {
    id: "lunatique-ii",
    familyId: "lunatique",
    name: "Lunatique",
    wakfuGuideName: "Lunatique II",
    displayLevel: "II",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Après avoir infligé des dommages à un ennemi : -30 % dégâts infligés et 30 % Soins reçus et Armure donnée pour le tour suivant. Après avoir soigné ou donné de l’Armure à un allié : 30 % Dégâts infligés et -30 % Soins reçus et Armure donnée pour le tour suivant.",
    sourceLocation: ""
  },
  {
    id: "modularite",
    familyId: "modularite",
    name: "Modularité",
    wakfuGuideName: "Modularité",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Après avoir subi des dommages : 50 en résistance élémentaire dans cet élément (1 tour), non cumulable (un nouvel élément remplace le précédent)",
    sourceLocation: ""
  },
  {
    id: "paisible",
    familyId: "paisible",
    name: "Paisible",
    wakfuGuideName: "Paisible",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "par PM utilisé : +3 % parade (max 18%), si le porteur effectue une parade : le bonus est transformé en coups critiques au prochain tour",
    sourceLocation: ""
  },
  {
    id: "par-dela-la-barriere",
    familyId: "par-dela-la-barriere",
    name: "Par-delà la barrière",
    wakfuGuideName: "Par-delà la barrière",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+15% dégâts critiques infligés par sort à 4PA ou +. +15% dégâts critiques infligés par sort à 1PW ou plus",
    sourceLocation: ""
  },
  {
    id: "parade-unique",
    familyId: "parade-unique",
    name: "Parade Unique",
    wakfuGuideName: "Parade Unique",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "En effectuant une parade : -30% dégats reçus supplémentaires et -100 Parade pour 1 tour",
    sourceLocation: ""
  },
  {
    id: "petillance",
    familyId: "petillance",
    name: "Pétillance",
    wakfuGuideName: "Pétillance",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "En début de tour, si le porteur ne possède pas d’Armure : +20% de dommages infligés, sinon -10%",
    sourceLocation: ""
  },
  {
    id: "petulance",
    familyId: "petulance",
    name: "Pétulance",
    wakfuGuideName: "Pétulance",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Si le porteur se déplace avec un sort : 1 PA (2 max par tour)",
    sourceLocation: ""
  },
  {
    id: "renaissance",
    familyId: "renaissance",
    name: "Renaissance",
    wakfuGuideName: "Renaissance",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "-50 résistances elem, si le porteur de l’état passe en berzerk : +1PM +15% de dégâts infligés +50res elem",
    sourceLocation: ""
  },
  {
    id: "robuste",
    familyId: "robuste",
    name: "Robuste",
    wakfuGuideName: "Robuste",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "100 % du niveau en Barrière contre les dégâts à distance",
    sourceLocation: ""
  },
  {
    id: "sang-de-la-dechirure",
    familyId: "sang-de-la-dechirure",
    name: "Sang de la déchirure",
    wakfuGuideName: "Sang de la déchirure",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "tours impairs : +25 % de dégâts mais subit 15 % des dommages infligés",
    sourceLocation: ""
  },
  {
    id: "sceau-de-wakfu",
    familyId: "sceau-de-wakfu",
    name: "Sceau de Wakfu",
    wakfuGuideName: "Sceau de Wakfu",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+2% de soins réalisés par tour (max 20)",
    sourceLocation: ""
  },
  {
    id: "sentinelle",
    familyId: "sentinelle",
    name: "Sentinelle",
    wakfuGuideName: "Sentinelle",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+3PO et +15 % de dégâts infligés à distance et +15 % soins réalisés tant que le porteur ne se déplace pas avec ses PM",
    sourceLocation: ""
  },
  {
    id: "stasification",
    familyId: "stasification",
    name: "Stasification",
    wakfuGuideName: "Stasification",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "+2 % de dégâts infligés par tour (max 20%)",
    sourceLocation: ""
  },
  {
    id: "vehemence",
    familyId: "vehemence",
    name: "Véhémence",
    wakfuGuideName: "Véhémence",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "Chaque tour, vole 50 % des dommages infligés du premier sort qui inflige des dommages -50% d'armure reçue",
    sourceLocation: ""
  },
  {
    id: "we",
    familyId: "we",
    name: "Wé",
    wakfuGuideName: "Wé",
    displayLevel: "",
    category: "relic",
    level: 1,
    cumulativeMax: 1,
    socketPattern: "🟣",
    sourceDescription: "tour pair : +2PA si un sort à PW est utilisée (max 1) , -2PA en tour impair (max 1)",
    sourceLocation: ""
  }
] as const;

const legacySublimationAliases = new Map<string, SublimationCatalogEntry>();

export const sublimationCatalog: SublimationCatalogEntry[] = wakfuGuideSublimations.flatMap((entry) => {
  const variants = getStackableSublimationVariantLevels(entry);
  if (!variants) {
    return [createCatalogEntry(entry, entry.id, entry.displayLevel, entry.level, entry.cumulativeMax)];
  }

  legacySublimationAliases.set(
    entry.id,
    createCatalogEntry(entry, entry.id, entry.displayLevel, entry.cumulativeMax, entry.cumulativeMax),
  );

  return variants.map((level) => createCatalogEntry(
    entry,
    `${entry.familyId}-${levelVariantLabels[level]!.toLowerCase()}`,
    levelVariantLabels[level],
    level,
    entry.cumulativeMax,
  ));
});

function createCatalogEntry(
  entry: (typeof wakfuGuideSublimations)[number],
  id: string,
  displayLevel: string | undefined,
  level: number,
  cumulativeMax: number,
): SublimationCatalogEntry {
  const supported = supportedSublimations[entry.id];
  const supportStatus = supported ? "supported" : isIgnoredSublimation(entry.sourceDescription) ? "ignored" : "planned";
  const levelOverride = sublimationEntryLevelOverrides[id];
  return {
    ...entry,
    id,
    name: formatCatalogName(entry.name, displayLevel),
    wakfuGuideName: formatCatalogName(entry.name, displayLevel),
    displayLevel,
    level: levelOverride?.level ?? level,
    cumulativeMax: levelOverride?.cumulativeMax ?? cumulativeMax,
    supportStatus,
    supportReason: supported?.supportReason ?? (supportStatus === "ignored"
      ? "Dépend de la mort d’un ennemi ou d’une cible, exclue du modèle actuel."
      : "Effet Wakfu.Guide conservé, pas encore modélisé dans le simulateur."),
    effects: supported?.effects ?? [],
    sources: [wakfuGuideSource, ...(id === entry.id ? [] : [wakfuWikiScrollSource])],
  };
}

export function findSublimation(id: string, catalog: SublimationCatalogEntry[] = sublimationCatalog): SublimationCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id) ?? (catalog === sublimationCatalog ? legacySublimationAliases.get(id) : undefined);
}

function getStackableSublimationVariantLevels(entry: (typeof wakfuGuideSublimations)[number]): number[] | undefined {
  if (entry.category !== "normal") {
    return undefined;
  }

  const level = Number(entry.displayLevel);
  if (!Number.isInteger(level) || level <= 1) {
    return undefined;
  }

  const overridden = stackableSublimationVariantOverrides[entry.id];
  if (overridden) {
    return overridden;
  }

  return level >= 3 ? [1, 2, 3] : [1, 2];
}

function isIgnoredSublimation(description: string): boolean {
  const lower = description.toLowerCase();
  return lower.includes("en tuant") || lower.includes("tuant un ennemi") || lower.includes("mort d") || lower.includes("mort de");
}

function formatCatalogName(name: string, displayLevel: string | undefined): string {
  if (!displayLevel || !/^[IVX]+$/.test(displayLevel) || name.endsWith(` ${displayLevel}`)) {
    return name;
  }

  return `${name} ${displayLevel}`;
}
