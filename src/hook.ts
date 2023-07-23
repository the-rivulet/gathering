import type { Player, SelectionData } from "./player.js";
import type { TurnManagerClass } from "./turn.js";
import type { Permanent, Creature } from "./permanent.js";
import type { AuraCard, SpellCard } from "./card.js";
import type { Card } from "./card.js";
import { Battlefield } from "./globals.js";
import { Ability, ComputedAbility, ReachAbility } from "./ability.js";

/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`. Pass `this` to the parameter `that`.
*/
export function ApplyHooks<T, U extends any[], V>(hook: new (...args: any[]) => Hook<T, U, V>, orig: (that: T, ...args: U) => V, that: T, ...args: U) {
  for (let c of Battlefield) {
    for (let a of c.abilities) {
      if (a instanceof hook) {
        orig = a.apply(c, orig);
      }
    }
  }
  return orig(that, ...args);
}

export abstract class Hook<T, U extends any[], V> extends Ability {
  // "Hooks" a method to modify it.
  apply: (me: Permanent, orig: (that: T, ...args: U) => V) => (that: T, ...args: U) => V;
  constructor(apply: (me: Permanent, orig: (that: T, ...args: U) => V, that: T, ...args: U) => V) {
    super();
    this.apply = (me, orig) => (that: T, ...args: U) => apply(me, orig, that, ...args);
  }
}

export class DestroyPermanentHook extends Hook<Permanent, [], void> {
  constructor(apply: (me: Permanent, orig: (that: Permanent) => void, that: Permanent) => void) {
    super(apply);
  }
}

export class BeginStepHook extends Hook<TurnManagerClass, [], void> {
  constructor(apply: (me: Permanent, orig: (that: TurnManagerClass) => void, that: TurnManagerClass) => void) {
    super(apply);
  }
}

export class PlayCardHook extends Hook<Player, [Card, boolean, boolean, any[]], boolean> {
  constructor(apply: (me: Permanent, orig: (that: Player, card: Card, free: boolean, noCheck: boolean, force: any[]) => boolean, that: Player, card: Card, free: boolean, noCheck: boolean, force: any[]) => boolean) {
    super(apply);
  }
}

export class StatsHook extends Hook<Creature, ["power" | "toughness"], number> {
  constructor(apply: (me: Permanent, orig: (that: Creature, stat: "power" | "toughness") => number, that: Creature, stat: "power" | "toughness") => number) {
    super(apply);
  }
}

export class HasValidTargetsHook extends Hook<SelectionData | SpellCard | AuraCard, [Permanent[]], boolean> {
  constructor(apply: (me: Permanent, orig: (that: SelectionData | SpellCard | AuraCard, field: Permanent[]) => boolean, that: SelectionData | SpellCard | AuraCard, field: Permanent[]) => boolean) {
    super(apply);
  }
}

export class CheckTargetsHook extends Hook<SelectionData | SpellCard | AuraCard, [Permanent[]], boolean> {
  constructor(apply: (me: Permanent, orig: (that: SelectionData | SpellCard | AuraCard, t: any[]) => boolean, that: SelectionData | SpellCard | AuraCard, t: any[]) => boolean) {
    super(apply);
  }
}

export class ProtectionAbility extends ComputedAbility {
  constructor(applicable: (source: Card) => boolean) {
    super(card => [
      new HasValidTargetsHook((me, orig, that, field) => {
        return orig(that, field.filter(x => x != card || !applicable(that as Card || (that as SelectionData).card)));
      }),
      new CheckTargetsHook((me, orig, that, field) => {
        return orig(that, field.filter(x => x != card || !applicable(that as Card || (that as SelectionData).card)));
      })
    ]);
  }
}

export class MarkAsBlockerHook extends Hook<Player, [Creature, Creature, boolean], boolean> {
  constructor(apply: (me: Permanent, orig: (that: Player, card: Creature, blocking: Creature, real: boolean) => boolean, that: Player, card: Creature, blocking: Creature, real: boolean) => boolean) {
    super(apply);
  }
}

export class FlyingAbility extends MarkAsBlockerHook {
  constructor() {
    super((me, orig, that, card, blocking, real) => {
      if (me.is(blocking) && !card.hasAbility(ReachAbility) && !card.hasAbility(FlyingAbility)) return false;
      return orig(that, card, blocking, real);
    });
  }
}

export class SelectTargetsHook extends Hook<Player, [Card, (t: any[]) => boolean, () => boolean, string, (result: any) => any, boolean], boolean> {
  constructor(apply: (me: Permanent, orig: (that: Player, casting: Card, validate: (t: any[]) => boolean, possible: () => boolean, message: string, continuation: (result: any) => any, limitOne: boolean) => boolean, that: Player, casting: Card, validate: (t: any[]) => boolean, possible: () => boolean, message: string, continuation: (result: any) => any, limitOne: boolean) => boolean) {
    super(apply);
  }
}

export class HeroicAbility extends SelectTargetsHook {
  constructor(effect: (me: Permanent, casting: Card, targets: any) => void) {
    super((me, orig, that, casting, validate, possible, message, continuation, limitOne) => {
      return orig(that, casting, validate, possible, message, result => {
        continuation(result);
        if (result.includes(me)) effect(me, casting, result);
      }, limitOne);
    });
  }
}