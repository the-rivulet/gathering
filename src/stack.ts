import type { Card } from "./card.js";
import type { Permanent } from "./permanent.js";
import type { Effect } from "./effect.js";
import { TurnManager, Settings } from "./globals.js";

export class StackCard {
  card: Card;
  targets: any[];
  constructor(card: Card, targets: any[] = []) {
    this.card = card;
    this.targets = targets;
  }
}

export class StackEffect {
  effect: Effect;
  permanent: Permanent;
  constructor(
    effect: Effect,
    perm: Permanent,
  ) {
    this.effect = effect;
    this.permanent = perm;
  }
}

export class StackManagerClass {
  stack: (StackCard | StackEffect)[] = [];
  constructor() { }
  add(what: StackCard | StackEffect) {
    this.stack.push(what);
  }
  async resolveNext() {
    let next = this.stack.pop();
    if (!next) return;
    if (next instanceof StackCard) {
      if (next.card.owner) next.card.owner.resolve(next.card, next.targets);
    } else if (next instanceof StackEffect) {
      await next.effect.resolve(next.permanent);
    }
  }
  get ready() {
    return (TurnManager.passedPriority || TurnManager.endedPhase || TurnManager.endedTurn) && !TurnManager.ongoingSelection && !TurnManager.choosing;
  }
  resolveIfReady(counter = 0) {
    if (!this.ready) return;
    this.resolveNext();
    TurnManager.passedPriority = false;
    if (this.stack.length && counter < Settings.maxRepeats) this.resolveIfReady();
  }
}