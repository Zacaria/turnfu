import {
  cost,
  damage,
  maxCastsPerTurn,
  resourceDelta,
  screenshot,
  spell,
} from "./dsl.ts";

export const huppermageSpellDslExample = spell("example-lueur", {
  name: "Lueur example",
  level: 200,
  element: "light",
  cost: cost({ ap: 2 }),
  effects: [
    damage({ element: "light", base: 30 }),
    resourceDelta({ resource: "bq", amount: 10 }),
  ],
  constraints: [maxCastsPerTurn(3)],
  metadata: {
    status: "demo",
    sources: [screenshot("/tmp/example-lueur-level-200.png", "example")],
  },
});
