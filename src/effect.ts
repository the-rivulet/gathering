import type { Ability } from "./ability.js";
import type { Permanent } from "./permanent.js";
import { SimpleManaObject, ManaPool } from "./mana.js";
import { Card, PermanentCard } from "./card.js";
import { StackEffect } from "./stack.js";
import { StackManager } from "./globals.js";

export abstract class Effect {
  // A common parent for the different effect types.
  abstract resolve(card: Permanent): boolean | Promise<boolean>;
  queue(card: Permanent) {
    StackManager.add(new StackEffect(this, card));
  }
}

export class AddManaEffect extends Effect {
  mana: ManaPool;
  constructor(mana: SimpleManaObject | SimpleManaObject[] | ManaPool = {}) {
    super(); // Pointless lol
    this.mana = mana instanceof ManaPool ? mana : new ManaPool(mana);
  }
  resolve(card: Permanent) {
    card.controller.manaPool.add(this.mana);
    return true;
  }
}

export class ApplyAbilityOnSelfEffect extends Effect {
  abil: Ability;
  temp: boolean;
  constructor(abil: Ability, temp = true) {
    super(); // Pointless lol
    this.abil = abil;
    this.temp = temp;
  }
  resolve(card: Permanent) {
    card.applyAbility(this.abil, this.temp);
    return true;
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
    return true;
  }
}

export class AddCounterOnSelfEffect extends Effect {
  counter: string;
  amount = 1;
  constructor(counter: string, amount?: number) {
    super(); // Pointless lol
    this.counter = counter;
    if (amount) this.amount = amount;
  }
  resolve(card: Permanent) {
    card.addCounter(this.counter, this.amount);
    return true;
  }
}

export class DrawCardsEffect extends Effect {
  amount: number;
  constructor(amount = 1) {
    super();
    this.amount = amount;
  }
  resolve(card: Permanent) {
    return card.controller.drawCard(this.amount);
  }
}

class DestroyCardsEffect extends Effect {
  cards: Card[];
  constructor(card: Card | Card[]) {
    super();
    this.cards = card instanceof Card ? [card] : card;
  }
  resolve(card: Permanent) {
    for (let i of this.cards) {
      i.destroy();
    }
    return true;
  }
}