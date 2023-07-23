import type { Ability } from "./ability.js";
import type { Step } from "./turn.js";
import type { Permanent, Creature } from "./permanent.js";
import { SimpleManaObject, ManaPool } from "./mana.js";
import { Card, PermanentCard, TypeList } from "./card.js";
import { StackManager, TurnManager } from "./globals.js";
import { Zone } from "./zone.js";

export abstract class Effect {
  // A common parent for the different effect types.
  abstract resolve(card: Permanent): void;
  queue(card: Permanent) {
    StackManager.add({ effect: this, permanent: card });
  }
}

export class MultipleEffect extends Effect {
  effects: Effect[];
  constructor(...effects: Effect[]) {
    super();
    this.effects = effects;
  }
  resolve(card: Permanent) {
    for (let i of this.effects) i.resolve(card);
  }
}

/**
 * Generally you would use `resolve`, rather than `queue`, on this effect.
 */
export class AddManaEffect extends Effect {
  mana: ManaPool;
  constructor(mana: SimpleManaObject | SimpleManaObject[] | ManaPool = {}) {
    super(); // Pointless lol
    this.mana = mana instanceof ManaPool ? mana : new ManaPool(mana);
  }
  resolve(card: Permanent) {
    card.controller.manaPool.add(this.mana);
  }
}

export class ApplyAbilityEffect extends Effect {
  abil: Ability;
  temp: boolean;
  constructor(abil: Ability, temp = true) {
    super(); // Pointless lol
    this.abil = abil;
    this.temp = temp;
  }
  resolve(card: Permanent) {
    card.applyAbility(this.abil, this.temp);
  }
}

export class CreateTokenEffect extends Effect {
  token: PermanentCard;
  constructor(token: PermanentCard) {
    super(); // Pointless lol
    this.token = token;
  }
  resolve(card: Permanent) {
    card.controller.createToken(this.token);
  }
}

export class AddCounterEffect extends Effect {
  counter: string;
  amount = 1;
  constructor(counter: string, amount?: number) {
    super(); // Pointless lol
    this.counter = counter;
    if (amount) this.amount = amount;
  }
  resolve(card: Permanent) {
    card.addCounter(this.counter, this.amount);
  }
}

export class DrawCardsEffect extends Effect {
  amount: number;
  constructor(amount = 1) {
    super();
    this.amount = amount;
  }
  resolve(card: Permanent) {
    card.controller.drawCard(this.amount);
  }
}

export class DestroyCardsEffect extends Effect {
  cards: Card[];
  constructor(...cards: Card[]) {
    super();
    this.cards = cards;
  }
  resolve(card: Permanent) {
    for (let i of this.cards) {
      i.destroy();
    }
  }
}

export class SetStatsEffect extends Effect {
  power: number;
  toughness: number;
  constructor(power?: number, toughness?: number) {
    super();
    this.power = power;
    this.toughness = toughness;
  }
  queue(card: Creature) {
    StackManager.add({ effect: this, permanent: card });
  }
  resolve(card: Creature) {
    if (this.power) card.power = this.power;
    if (this.toughness) card.toughness = this.toughness;
  }
}

export class SetTypesEffect extends Effect {
  types: TypeList;
  constructor(types: string[] | TypeList) {
    super();
    this.types = types instanceof TypeList ? types : new TypeList(types);
  }
  resolve(card: Permanent) {
    card.types = this.types;
  }
}

export class DelayedEffect extends Effect {
  effect: Effect;
  step: Step;
  constructor(effect: Effect, step: Step) {
    super();
    this.effect = effect;
    this.step = step;
  }
  resolve(card: Permanent) {
    TurnManager.delays.push({ effect: this.effect, step: this.step, permanent: card });
  }
}

export class MoveCardsEffect extends Effect {
  cards: Card[];
  zone: Zone;
  constructor(zone: Zone, ...cards: Card[]) {
    super();
    this.zone = zone;
    this.cards = cards;
  }
  resolve(card: Permanent) {
    for (let i of this.cards) {
      card.controller.moveCardTo(i, this.zone);
    }
  }
}