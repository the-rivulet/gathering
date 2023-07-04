import type { Card } from "./card.js";
import type { Permanent } from "./permanent.js";
import type { Effect } from "./effect.js";
import type { ActivatedAbility } from "./ability.js";
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

export class StackActivation {
  abil: ActivatedAbility;
  permanent: Permanent;
  targets?: any[];
  constructor(
    abil: ActivatedAbility,
    permanent: Permanent,
    forceTargets?: any[]
  ) {
    this.abil = abil;
    this.permanent = permanent;
    this.targets = forceTargets;
  }
}

export class StackManagerClass {
  stack: (StackCard | StackEffect | StackActivation)[] = [];
  constructor() { }
  add(what: StackCard | StackEffect | StackActivation) {
    this.stack.push(what);
  }
  async resolveNext() {
    let next = this.stack.pop();
    if (!next) return;
    if (next instanceof StackCard) {
      if (next.card.owner) next.card.owner.resolve(next.card, next.targets);
    } else if (next instanceof StackEffect) {
      await next.effect.resolve(next.permanent);
    } else {
      next.abil.effect.forEach(i =>
        i.resolve((next as StackActivation).permanent)
      );
    }
  }
  get ready() {
    return !TurnManager.playerList.filter(x => (!x.endedTurn && !x.endedPhase && !x.passedPriority) || x.selectionData).length;
  }
  resolveIfReady(counter = 0) {
    if(!this.ready) return;
    this.resolveNext();
    for(let i of TurnManager.playerList) {
      if(i.passedPriority) {
        i.passedPriority = false;
      }
    }
    if(this.stack.length && counter < Settings.maxRepeats) this.resolveIfReady();
  }
}