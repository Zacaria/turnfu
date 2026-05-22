## Context

Le moteur de simulation a besoin d'un catalogue Huppermage structure avant de pouvoir valider et appliquer des sequences d'actions. Les valeurs exactes des sorts peuvent etre saisies manuellement au depart ou extraites de screenshots, mais leur structure doit etre assez stricte pour eviter des effets textuels impossibles a simuler.

Ce change ne vise pas encore l'exactitude complete de Wakfu. Il pose le contrat de donnees et un DSL declaratif pour exprimer sorts, passifs et mecanique de classe. Le premier niveau de reference est le niveau 200.

## Goals / Non-Goals

**Goals:**

- Definir les types de domaine pour sorts, ressources, couts, effets, contraintes et metadonnees de verification.
- Definir un DSL lisible et validable pour organiser les effets de sorts, passifs et mecanique de classe.
- Fournir un catalogue Huppermage maintenable et lisible.
- Representer les effets necessaires au MVP et au proche terme: degats directs, generation ou perte de ressources, conditions, limites de lancers, tags, passifs et hooks de mecanique de classe.
- Normaliser les valeurs au niveau 200.
- Permettre une workflow d'extraction depuis screenshots avec provenance et statut de verification.
- Identifier explicitement les mecaniques non modelisees.
- Ajouter des validations structurelles pour proteger le simulateur.

**Non-Goals:**

- Recuperer automatiquement les donnees depuis une API ou un site.
- Implementer l'OCR ou la vision automatique dans ce change.
- Garantir l'exactitude complete des valeurs Wakfu au premier commit.
- Modeliser equipement, sublimations, placement, ligne de vue, zone d'effet, multi-cible ou etats complexes.
- Implementer le moteur de simulation.

## Decisions

### Decision: catalogue data-driven

Chaque sort est une entree de donnees avec identifiant stable, nom, classe, element, degats de base, couts, effets, contraintes et metadonnees. Le simulateur consommera ce format sans connaitre les sorts Huppermage un par un.

Alternative consideree: une fonction par sort. Rejetee car les futurs ajouts de sorts, corrections et sublimations deviendraient plus couteux.

### Decision: effets sous forme d'union typee

Les effets supportes doivent etre enumeres: `damage`, `resourceDelta`, et `unsupportedMechanic` au minimum. Les effets non modelises restent visibles sans bloquer la saisie du catalogue.

Alternative consideree: champ texte libre pour tous les effets. Rejetee car il serait impossible de simuler et tester correctement.

### Decision: DSL declaratif au-dessus des types d'effets

Le catalogue doit etre ecrit dans un DSL declaratif qui compile ou se normalise vers les types de domaine. Le DSL est la forme auteur lisible; le modele normalise est la forme consommee par le simulateur.

Exemple de forme visee:

```ts
spell("lueur", {
  class: "huppermage",
  level: 200,
  element: "light",
  cost: cost({ ap: 2 }),
  effects: [
    damage({ element: "light", base: 30 }),
    resourceDelta({ resource: "bq", amount: 10 }),
  ],
  constraints: [maxCastsPerTurn(3)],
  source: screenshot("huppermage-lueur-level-200.png", { status: "unverified" }),
});
```

Le DSL doit rester simple: pas de langage interprete libre, pas d'expressions arbitraires, pas d'evaluation dynamique non controlee. Les primitives doivent etre connues, typees et validables.

Alternative consideree: JSON pur. Rejetee comme format auteur principal car les effets conditionnels, tags et passifs deviendraient verbeux et difficiles a relire. Le modele normalise pourra toutefois etre serialisable en JSON.

### Decision: passifs et mecanique de classe comme entrees du catalogue

Les screenshots peuvent contenir des sorts actifs, des passifs et des regles de classe Huppermage. Le catalogue doit pouvoir stocker ces trois familles, meme si le MVP de simulation ne consomme d'abord que les sorts actifs.

Alternative consideree: ignorer passifs et mecanique de classe jusqu'a plus tard. Rejetee car les screenshots fournis risquent de contenir des interactions importantes; il vaut mieux les capturer comme DSL/metadata avant de les simuler.

### Decision: niveau 200 comme baseline

Les valeurs de degats et effets sont d'abord normalisees au niveau 200. Si une capture montre un autre niveau, l'entree doit etre marquee comme non conforme a la baseline ou transformee manuellement avant d'etre consideree verifiee.

Alternative consideree: stocker plusieurs niveaux immediatement. Rejetee pour garder le MVP stable.

### Decision: extraction screenshot assistee, pas automatique au depart

Les screenshots sont des preuves d'entree et de verification. L'extraction peut etre manuelle ou assistee, mais le resultat doit etre relu et encode dans le DSL avec une reference au screenshot source.

Alternative consideree: implementer directement OCR/vision. Rejetee car cela ajoute de la complexite avant d'avoir stabilise le DSL.

### Decision: couts et effets separes

Les couts d'un sort representent ce qui doit etre disponible avant le lancement. Les effets representent les changements appliques apres le lancement.

Alternative consideree: tout representer comme effets. Rejetee car les validations de ressources avant cast deviendraient ambigues.

### Decision: metadonnees de verification

Chaque entree doit pouvoir indiquer si elle est `demo`, `unverified` ou `verified`, avec source et notes optionnelles. Cela permet de commencer sans bloquer sur l'exhaustivite.

Alternative consideree: ne stocker que les valeurs finales. Rejetee car les donnees Wakfu risquent de changer et les valeurs manuelles doivent etre auditables.

## Risks / Trade-offs

- Les donnees manuelles peuvent etre fausses -> Ajouter statut de verification, source et tests structurels.
- Les screenshots peuvent etre ambigus ou incomplets -> Stocker les sources, notes, niveau observe et statut de verification par entree.
- Certaines mecaniques Huppermage ne rentrent pas dans les effets MVP -> Les declarer comme `unsupportedMechanic` avec une note.
- DSL trop puissant ou difficile a valider -> Limiter les primitives, interdire les fonctions arbitraires et normaliser vers un modele strict.
- Trop de genericite trop tot -> Limiter les types d'effets aux besoins MVP/proche terme et ajouter les autres par changes futurs.
- Confusion entre BQ et PW -> Les ressources doivent etre enumerees explicitement et testees.

## Migration Plan

1. Ajouter les types de domaine du catalogue.
2. Ajouter les primitives du DSL et la normalisation vers le modele de domaine.
3. Ajouter le catalogue Huppermage niveau 200 initial.
4. Ajouter les champs de provenance screenshot et statut de verification.
5. Ajouter une validation structurelle du catalogue.
6. Ajouter des tests garantissant identifiants uniques, ressources valides, couts non negatifs, niveau 200 et effets supportes.

## Open Questions

- Le catalogue initial doit-il viser tous les sorts Huppermage niveau 200 ou commencer par un lot extrait des premiers screenshots fournis?
- Quelle source sera consideree comme reference lorsqu'un screenshot et une source externe divergent?
- Faut-il stocker les screenshots source dans le depot, dans un dossier local ignore, ou sous forme de chemins/references externes?
- Les passifs doivent-ils etre modelises dans le meme fichier que les sorts ou dans un catalogue separe mais compatible DSL?
