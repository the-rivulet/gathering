import type { Permanent } from "./permanent.js";
import type { Cost } from "./cost.js";
import type { Effect } from "./effect.js";
import { StackManager } from "./globals.js";

export abstract class Ability {
  // Merely a common parent for the ability types, so I can type 'Ability' and have it work for them all.
  // Doesn't do anything itself.
}

export class ComputedAbility extends Ability {
  evaluate: (card: Permanent) => Ability[];
  constructor(e: (card: Permanent) => Ability[]) {
    super();
    this.evaluate = e;
  }
}

export abstract class ActivatedAbility extends Ability {
  abstract activate(card: Permanent): boolean;
}

export class SimpleActivatedAbility<T extends Permanent> extends ActivatedAbility {
  cost: Cost;
  effect: (card: Permanent) => void;
  manaAbility: boolean;
  constructor(cost: Cost, effect: (card: T) => void, isManaAbility = false) {
    super(); // Pointless lol
    this.cost = cost;
    this.effect = effect;
    this.manaAbility = isManaAbility;
  }
  activate(card: T) {
    //if (Battlefield.filter(x => x.abilities.filter(y => y instanceof PreventActivationAbility && y.req(x, card, this)).length).length) return false;
    if (!this.cost.pay(card, true)) return false;
    this.effect(card);
    return true;
  }
}

export class SingleTargetActivatedAbility<T extends Permanent, U> extends ActivatedAbility {
  validate: (card: T) => (target: U) => boolean;
  possible: (card: T) => () => boolean;
  effect: (card: Permanent, target: U) => void;
  constructor(validate: (card: T) => (target: U) => boolean, possible: (card: T) => () => boolean, effect: (card: Permanent, target: U) => void) {
    super();
    this.validate = validate;
    this.possible = possible;
    this.effect = effect;
  };
  activate(card: T) {
    return card.controller.selectSingleTarget(undefined, this.validate(card), this.possible(card), "Select some targets", result => this.effect(card, result));
  }
}

export class TargetedActivatedAbility<T extends Permanent> extends ActivatedAbility {
  validate: (card: T) => (targets: any[]) => boolean;
  possible: (card: T) => () => boolean;
  effect: (card: Permanent, targets: any[]) => void;
  constructor(validate: (card: T) => (targets: any[]) => boolean, possible: (card: T) => () => boolean, effect: (card: Permanent, targets: any[]) => void) {
    super();
    this.validate = validate;
    this.possible = possible;
    this.effect = effect;
  };
  activate(card: T) {
    return card.controller.selectTargets(undefined, this.validate(card), this.possible(card), "Select some targets", result => this.effect(card, result));
  }
}

export abstract class EmptyAbility extends Ability {
  // Has nothing in it, just used by other things. Reach is the only example I can think of.
}

export class ReachAbility extends EmptyAbility { constructor() { super(); } }
export class FirstStrikeAbility extends EmptyAbility { constructor() { super(); } }
export class DoubleStrikeAbility extends EmptyAbility { constructor() { super(); } }
export class VigilanceAbility extends EmptyAbility { constructor() { super(); } }
export class TrampleAbility extends EmptyAbility { constructor() { super(); } }
export class HasteAbility extends EmptyAbility { constructor() { super(); } }