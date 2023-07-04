import type { Player, SelectionData } from "./player.js";
import type { TurnManagerClass } from "./turn.js";
import type { Permanent, Creature } from "./permanent.js";
import type { AuraCard, SpellCard } from "./card.js";
import type { Card } from "./card.js";
import { Battlefield } from "./globals.js";
import { Ability, ComputedAbility } from "./ability.js";

/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`. Pass `this` to the parameter `that`.
*/
export function ApplyHooks(isHook: (hook: Ability) => boolean, orig: any, that: any, ...args: any) {
  for(let c of Battlefield) {
    for(let a of c.abilities) {
      if(isHook(a)) {
        orig = (a as Hook).apply(orig);
      }
    }
  }
  return orig(that, ...args);
}

export abstract class Hook extends Ability {
  // "Hooks" a method to modify it.
  abstract apply(orig);
}

export class DestroyPermanentHook extends Hook {
  apply: (orig: (that: Permanent) => void) => ((that: Permanent) => void);
  constructor(apply: (orig: (that: Permanent) => void) => ((that: Permanent) => void)) {
    super();
    this.apply = apply;
  }
}

export class BeginStepHook extends Hook {
  apply: (orig: (that: TurnManagerClass) => void) => ((that: TurnManagerClass) => void);
  constructor(apply: (orig: (that: TurnManagerClass) => void) => (that: TurnManagerClass) => void) {
    super();
    this.apply = apply;
  }
}

export class PlayCardHook extends Hook {
  apply: (orig: (that: Player, card: Card, free: boolean, noCheck: boolean, force: any[]) => boolean) => ((that: Player, card: Card, free: boolean, noCheck: boolean, force: any[]) => boolean);
  constructor(apply: (orig: (that: Player, card: Card, free: boolean, noCheck: boolean, force: any[]) => boolean) => (that: Player, card: Card, free: boolean, noCheck: boolean, force: any[]) => boolean) {
    super();
    this.apply = apply;
  }
}

export class StatsHook extends Hook {
  apply: (orig: (that: Creature, stat: "power" | "toughness") => number) => ((that: Creature, stat: "power" | "toughness") => number);
  constructor(apply: (orig: (that: Creature, stat: "power" | "toughness") => number) => (that: Creature, stat: "power" | "toughness") => number) {
    super();
    this.apply = apply;
  }
}

export class HasValidTargetsHook extends Hook {
  apply: (orig: (that: SelectionData | SpellCard | AuraCard, field: Permanent[]) => boolean) => ((that: SelectionData | SpellCard | AuraCard, field: Permanent[]) => boolean);
  constructor(apply: (orig: (that: SelectionData | SpellCard | AuraCard, field: Permanent[]) => boolean) => (that: SelectionData | SpellCard | AuraCard, field: Permanent[]) => boolean) {
    super();
    this.apply = apply;
  }
}

export class CheckTargetsHook extends Hook {
  apply: (orig: (that: SelectionData | SpellCard | AuraCard, t: any[]) => boolean) => ((that: SelectionData | SpellCard | AuraCard, t: any[]) => boolean);
  constructor(apply: (orig: (that: SelectionData | SpellCard | AuraCard, t: any[]) => boolean) => (that: SelectionData | SpellCard | AuraCard, t: any[]) => boolean) {
    super();
    this.apply = apply;
  }
}

export class ProtectionAbility extends ComputedAbility {
  constructor(applicable: (source: Card) => boolean) {
    super(card => [
      new HasValidTargetsHook(orig => (that, field) => {
        return orig(that, field.filter(x => x != card || !applicable(that as Card || (that as SelectionData).card)));
      }),
      new CheckTargetsHook(orig => (that, field) => {
        return orig(that, field.filter(x => x != card || !applicable(that as Card || (that as SelectionData).card)));
      })
    ]);
  }
}