## Context

Le moteur de simulation est la base de tout solveur de tour. Il doit consommer un personnage, un etat initial de tour, le catalogue de sorts Huppermage et une sequence d'actions, puis produire un resultat deterministe et explicable.

Ce change depend conceptuellement de `catalog-huppermage-spells-effects`. Il ne doit pas implementer d'optimiseur complet, mais il doit fournir une API assez stable pour qu'un optimiseur exhaustif ou genetique puisse tester des sequences sans connaitre les regles de sorts.

## Goals / Non-Goals

**Goals:**

- Simuler un seul tour a partir d'une sequence de sorts.
- Valider les spell ids, couts en ressources, limites de lancers et contraintes supportees.
- Appliquer couts puis effets dans un ordre explicite.
- Calculer les degats via une formule proche ZenithWakfu, sans prendre en compte les resistances de la cible.
- Permettre aux statistiques configurees avant le tour d'evoluer pendant la simulation via les effets supportes.
- Representer les etats specifiques Huppermage dans `classState.huppermage`, notamment runes actives, derniere rune generee et nombre de Feu-Follets actifs.
- Retourner un resultat complet: validite, violations, total de degats, ressources finales et breakdown par action.
- Garder le moteur pur et independant de la GUI.

**Non-Goals:**

- Implementer la recherche exhaustive.
- Implementer l'algorithme genetique.
- Simuler plusieurs tours.
- Simuler equipement, sublimations, critiques aleatoires, resistances complexes, placement ou ligne de vue.
- Corriger ou enrichir le catalogue de sorts.

## Decisions

### Decision: simulation pure et deterministe

Le moteur sera expose comme une fonction ou un service pur. Pour les memes entrees, il retourne toujours le meme resultat.

Alternative consideree: moteur avec etat global ou dependance au store UI. Rejetee pour permettre tests unitaires et optimisation fiable.

### Decision: invalidation explicite

Une sequence invalide retourne un resultat invalide avec violations et etat atteint avant l'erreur, plutot que de lever systematiquement une exception.

Alternative consideree: lancer une exception a la premiere erreur. Rejetee car les optimiseurs doivent evaluer beaucoup de sequences invalides sans interrompre le processus.

### Decision: breakdown obligatoire

Chaque action simulee doit produire une entree de breakdown contenant le sort, les ressources avant/apres, les degats et les effets appliques.

Alternative consideree: retourner seulement le total. Rejetee car les utilisateurs doivent comprendre pourquoi une sequence gagne.

### Decision: formule de degats complete sans resistances cible

La formule initiale reprend les multiplicateurs exposes par ZenithWakfu en excluant volontairement les resistances de la cible:

```text
degats =
  base
  * (1 + (maitrise elementaire + maitrise additionnelle) / 100)
  * multiplicateur critique
  * multiplicateur position
  * multiplicateur degats infliges
  * multiplicateur blocage
```

Les multiplicateurs retenus sont:

- critique: `1.25` si critique, sinon `1`
- position: face `1`, cote `1.1`, dos `1.25`
- blocage: `0.8` si bloque, sinon `1`
- degats infliges: `1 + degatsInfliges / 100`

La maitrise additionnelle agrège les statistiques applicables selon le contexte de l'action: melee/distance, berserk, dos et critique. La resistance cible reste explicitement hors scope pour ce change.

Alternative consideree: conserver la formule MVP simplifiee. Rejetee car le builder doit rapidement produire des comparaisons plus proches du jeu.

### Decision: statistiques courantes dans l'etat du tour

Le personnage fournit des statistiques initiales configurees avant le T1. Le simulateur conserve une copie `currentStats` dans l'etat du tour et applique les effets supportes de type `statModifier` sur cette copie. Les actions suivantes utilisent les statistiques mises a jour.

Alternative consideree: garder les statistiques immuables pendant tout le tour. Rejetee car Huppermage modifie ses bonus pendant la rotation.

### Decision: etats de classe isoles

Les etats specifiques Huppermage ne sont pas modelises comme des ressources generiques. Ils vivent dans `classState.huppermage`:

- `runes.active`: runes Incandescente, Aquatique, Tellurique et Aerienne possedees
- `runes.lastGeneratedRune`: derniere rune generee, toujours presente et `null` si aucune rune n'a ete generee
- `feuFolletsActive`: nombre de Feu-Follets actuellement actifs
- `feuFolletStoredRunes`: file deterministe des runes stockees par les Feu-Follets actifs
- `activePassives`: passifs Huppermage actives pour les mecanismes de classe deja supportes
- `activeHeart`: Coeur elementaire actif pour les mecanismes dependants de Coeur de Lumiere
- `waterHeartLastSpellKind`: dernier type de sort utile a l'alternance du Coeur Eau

Un sort elementaire feu/eau/terre/air genere la rune correspondante. Le sort Feu-Follet utilise la cible d'action pour distinguer ses deux comportements: `target.kind = "emptyCell"` pose un nouveau Feu-Follet, `target.kind = "feuFollet"` recupere un Feu-Follet actif.

Lorsque le passif `sauvegarde-runique` est actif, poser un Feu-Follet avec exactement une rune active stocke les trois autres runes sur ce Feu-Follet. Sans modelisation de position individuelle, les recuperations consomment la file `feuFolletStoredRunes` en FIFO. A la recuperation, les runes stockees sont appliquees dans l'ordre Feu, Eau, Terre, Air; la derniere rune generee devient donc la derniere rune appliquee dans cet ordre.

Lorsque le passif `extension-des-sens` est actif, le moteur applique une regeneration de BQ simplifiee selon le Coeur actif:

- Coeur Feu: les conditions de portee maximale sont considerees remplies; un sort elementaire feu/eau/terre/air genere 20 BQ par PA du sort.
- Coeur Terre: les conditions de contact sont considerees remplies; un sort coutant des PA genere 20 BQ par PA du sort.
- Coeur Air: les effets de deplacement declares et dont les conditions de rune sont satisfaites sont consideres effectifs; chaque deplacement genere 20 BQ par PA du sort. Un sort comme Papillons diurnes peut donc declencher deux gains si les runes Eau et Terre sont actives.
- Coeur Eau: le moteur suit l'alternance entre sorts elementaires feu/eau/terre/air et sorts Lumiere. Le premier sort ne genere pas de BQ par alternance; chaque alternance reussie genere 20 BQ par PA du sort courant. Un sort neutre casse l'alternance.

Alternative consideree: stocker les runes et Feu-Follets au niveau racine du `TurnState`. Rejetee car cela rendrait le moteur generique dependendant d'une classe specifique.

### Decision: le simulateur ne choisit pas les actions

Le simulateur evalue une sequence fournie. La generation de sequences et le choix de la meilleure sequence appartiennent a des optimiseurs separes.

Alternative consideree: simulateur qui optimise directement. Rejetee car cela couplerait validation, calcul et strategie de recherche.

## Risks / Trade-offs

- Formule sans resistances cible -> Garder ce choix explicite et ajouter les resistances dans un change separe quand la cible sera modelisee.
- Beaucoup de sequences invalides en optimisation -> Retourner des violations structurees plutot que lancer des erreurs fatales.
- Effets de sorts trop limites -> Rejeter ou marquer explicitement les effets non supportes au lieu de les ignorer silencieusement.
- Ordre couts/effets ambigu -> Definir et tester l'ordre: validation, paiement des couts, calcul des degats, application des effets.
- Etat Huppermage incomplet -> Representer d'abord les runes, le compteur Feu-Follet et une file minimale de runes stockees; les positions individuelles des invocations restent hors scope.

## Migration Plan

1. Ajouter les types de simulation: action, sequence, turn state, action result, simulation result, violation.
2. Ajouter la validation d'une action contre l'etat courant.
3. Ajouter l'application de couts et effets supportes.
4. Ajouter le calcul de degats MVP.
5. Ajouter les tests unitaires couvrant sequences valides, invalides et breakdown.

## Open Questions

- Les resistances cible doivent-elles etre ajoutees dans le prochain change ou rester dans un mode avance?
- Les effets de generation de ressource sont-ils appliques apres les degats ou seulement apres le paiement du cout? Le design propose apres paiement et calcul, mais cela doit rester explicite.
