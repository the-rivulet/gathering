import type { Player } from "./player.js";
import { Permanent, Creature } from "./permanent.js";
import { Battlefield } from "./globals.js";

export abstract class Cost {
  // A common parent for the different cost types.
  abstract pay(card: Permanent, spend: boolean): boolean;
  abstract payPlayer(player: Player, spend: boolean): boolean;
}

abstract class TargetedCost {
  abstract pay(card: Permanent, targets: any[]): boolean;
}

class MultipleCost extends Cost {
  costs: Cost[];
  constructor(costs: Cost[]) { super(); this.costs = costs; }
  pay(card: Permanent, spend = true) {
    let payment = this.costs.map(x => x.pay(card, false));
    if (payment.filter(x => !x).length) return false;
    if (!spend) return true;
    for (let i of this.costs) i.pay(card, true);
    return true;
  }
  payPlayer(player: Player, spend = true) {
    let payment = this.costs.map(x => x.payPlayer(player, false));
    if (payment.filter(x => !x).length) return false;
    if (!spend) return true;
    for (let i of this.costs) i.payPlayer(player, true);
    return true;
  }
}

export class TapCost extends Cost {
  ignoreAttacking: boolean;
  constructor(ignoreAttacking = false) {
    super();
    this.ignoreAttacking = ignoreAttacking;
  }
  pay(card: Permanent, spend = true) {
    if (card.tapped || (card instanceof Creature && (card.summoningSickness || (!this.ignoreAttacking && card.attacking)))) return false;
    if (spend) {
      card.tapped = true;
    }
    return true;
  }
  payPlayer(player: Player, spend = true) {
    // This makes no sense.
    return true;
  }
}

class LifeCost extends Cost {
  life: number;
  constructor(life = 1) {
    super();
    this.life = life;
  }
  pay(card: Permanent, spend = true) {
    if (card.controller.lifeTotal <= this.life) return false;
    if (spend) card.controller.lifeTotal -= this.life;
    return true;
  }
  payPlayer(player: Player, spend = true) {
    if (player.lifeTotal <= this.life) return false;
    if (spend) player.lifeTotal -= this.life;
    return true;
  }
}

class SacrificeTargetsCost extends TargetedCost {
  validate: (t: Permanent[], c?: Permanent) => boolean;
  canPay: (t: Permanent[], c?: Permanent) => boolean;
  constructor(validate: (t: Permanent[], c?: Permanent) => boolean, canPay: (t: Permanent[], c?: Permanent) => boolean) {
    super();
    this.validate = validate;
    this.canPay = canPay;
  }
  pay(card: Permanent, targets: any[]) {
    for (let i of targets) {
      if (i instanceof Permanent) i.sacrifice();
    }
    return true;
  }
  async payPlayer(player: Player, spend = true) {
    if (!this.canPay(Battlefield.filter(x => x.controller.is(player)))) return false;
    if (spend) {
      player.selectTargets(
        undefined,
        x => !x.filter(y => !(y instanceof Permanent) || y.controller != player).length && this.validate((x as Permanent[])),
        () => this.canPay(Battlefield.filter(x => x.controller.is(player))),
        "Select something to sacrifice",
        result => {
          for (let i of (result as Permanent[])) i.sacrifice();
        }
      );
    }
    return true;
  }
}

class SacrificeCost extends Cost {
  getTargets: (self: Permanent | Player) => Permanent[];
  constructor(getTargets: (self: Permanent | Player) => Permanent[]) {
    super();
    this.getTargets = getTargets;
  }
  pay(card: Permanent, spend = true) {
    this.getTargets(card).forEach(x => x.sacrifice());
    return true;
  }
  payPlayer(player: Player, spend: boolean) {
    this.getTargets(player).forEach(x => x.sacrifice());
    return true;
  }
}

export class SacrificeSelfCost extends Cost {
  constructor() {
    super();
  }
  pay(card: Permanent, spend = true) {
    if (!spend) return true;
    card.sacrifice();
    return true;
  }
  payPlayer(player: Player, spend = true) {
    // This makes no sense.
    return true;
  }
}
