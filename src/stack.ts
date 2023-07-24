import type { Card } from "./card.js";
import type { Permanent } from "./permanent.js";
import type { Effect } from "./effect.js";
import { TurnManager, Settings } from "./globals.js";
import { Step } from "./turn.js";

interface StackCard {
  card: Card;
  targets?: any[];
}

interface StackEffect {
  effect: Effect;
  permanent: Permanent;
}

function isCard(item: StackCard | StackEffect): item is StackCard {
  return "card" in item;;
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
    if (isCard(next)) {
      if (next.card.owner) next.card.owner.resolve(next.card, next.targets);
    } else next.effect.resolve(next.permanent);
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