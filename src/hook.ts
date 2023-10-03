import type { Player, SelectionData } from "./player.js";
import type { Cost } from "./cost.js";
import type { AuraCard, SpellCard, SplitSpellCard, TypeList } from "./card.js";
import type { Card } from "./card.js";
import type { Selection } from "./ui.js";
import { Permanent, Creature, Planeswalker } from "./permanent.js";
import { TurnManagerClass, Step } from "./turn.js";
import { Battlefield, TurnManager } from "./globals.js";
import { Ability, ComputedAbility, ReachAbility } from "./ability.js";
import { Zone } from "./zone.js";

/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`. Pass `this` to the parameter `that`.
*/
export function ApplyHooks<T, U extends any[], V>(hook: new (...args: any[]) => Hook<T, U, V>, orig: (that: T, ...args: U) => V, that: T, ...args: U) {
  for (let c of Battlefield) {
    for (let a of (hook instanceof AbilitiesHook ? c.abilities : [...c.tempAbilities, ...c.eternalAbilities, ...c.baseAbilities].map(x => x instanceof ComputedAbility ? x.evaluate(c) : x).flat())) {
      if (a instanceof hook) {
        orig = a.apply(c, orig);
      }
    }
  }
  return orig(that, ...args);
}

export abstract class Hook<T, U extends any[], V> extends Ability {
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

export class IndestructibleAbility extends DestroyPermanentHook {
  constructor() {
    // Do nothing.
    super((me, orig, that) => { });
  }
}

export class BeginStepHook extends Hook<TurnManagerClass, [], void> {
  constructor(apply: (me: Permanent, orig: (that: TurnManagerClass) => void, that: TurnManagerClass) => void) {
    super(apply);
  }
}

export class PlayCardHook extends Hook<Player, [Card, boolean, boolean], boolean> {
  constructor(apply: (me: Permanent, orig: (that: Player, card: Card, free: boolean, auto: boolean) => boolean, that: Player, card: Card, free: boolean, auto: boolean) => boolean) {
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
        return orig(that, field.filter(x => !x.is(me) || !applicable(that as Card || (that as SelectionData).card)));
      }),
      new CheckTargetsHook((me, orig, that, field) => {
        return orig(that, field.filter(x => !x.is(me) || !applicable(that as Card || (that as SelectionData).card)));
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

export class ResolveCardHook extends Hook<Player, [Card, any[]], void> {
  constructor(apply: (me: Permanent, orig: (that: Player, card: Card, targets: any[]) => void, that: Player, card: Card, targets: any[]) => void) {
    super(apply);
  }
}

export class TypesHook extends Hook<Permanent, [], TypeList> {
  constructor(apply: (me: Permanent, orig: (that: Permanent) => TypeList, that: Permanent) => TypeList) {
    super(apply);
  }
}

export class AbilitiesHook extends Hook<Permanent, [], Ability[]> {
  constructor(apply: (me: Permanent, orig: (that: Permanent) => Ability[], that: Permanent) => Ability[]) {
    super(apply);
  }
}

export class ValidStateHook extends Hook<TurnManagerClass, [], boolean> {
  constructor(apply: (me: Permanent, orig: (that: TurnManagerClass) => boolean, that: TurnManagerClass) => boolean) {
    super(apply);
  }
}

export class MenaceAbility extends ValidStateHook {
  constructor() {
    super((me, orig, that) => {
      if (that.step == Step.declare_blockers && me instanceof Creature && me.blockedBy.length == 1) return false;
      else return orig(that);
    });
  }
}

export class TakeDamageHook extends Hook<Creature | Player | Planeswalker, [Card | Permanent, number | (() => number), boolean, boolean], void> {
  constructor(apply: (me: Permanent, orig: (that: Creature | Player | Planeswalker, source: Card | Permanent, amount: number | (() => number), combat: boolean, destroy: boolean) => void, that: Creature | Player | Planeswalker, source: Card | Permanent, amount: number | (() => number), combat: boolean, destroy: boolean) => void) {
    super(apply);
  }
}

export class LifelinkAbility extends TakeDamageHook {
  constructor() {
    super((me, orig, that, source, amount, combat, destroy) => {
      orig(that, source, amount, combat, destroy);
      if (that instanceof Permanent && that.is(me)) that.controller.gainLife(that, amount);
    });
  }
}

export class CardClickHook extends Hook<Card, [], void> {
  constructor(apply: (me: Permanent, orig: (that: Card) => void, that: Card) => void) {
    super(apply);
  }
}

export class SubmitSelectionHook extends Hook<Player, [Selection[]], void> {
  constructor(apply: (me: Permanent, orig: (that: Player, selection: Selection[]) => void, that: Player, selection: Selection[]) => void) {
    super(apply);
  }
}

export class WardAbility extends ComputedAbility {
  cost: Cost;
  constructor(cost: Cost) {
    super(card => [
      new CardClickHook((me, orig, that) => {
        if (!that.is(me.representedCard) || !TurnManager.ongoingSelection || !that.is(me.representedCard)) return orig(that);
        if (!cost.payPlayer(TurnManager.selectingPlayer, false)) return;
        orig(that);
      }),
      new SubmitSelectionHook((me, orig, that, selection) => {
        if (selection.filter(x => x.item instanceof Permanent && x.item.is(me)).length) cost.payPlayer(that, true);
        orig(that, selection);
      })
    ]);
    this.cost = cost;
  }
}

export class FinishedResolvingSpellHook extends Hook<SpellCard | SplitSpellCard, [Player, any[]], Zone> {
  constructor(apply: (me: Permanent, orig: (that: SpellCard | SplitSpellCard, player: Player, targets: any[]) => Zone, that: SpellCard | SplitSpellCard, player: Player, targets: any[]) => Zone) {
    super(apply);
  }
}