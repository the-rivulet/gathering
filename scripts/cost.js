import { Permanent, Creature } from "./permanent.js";
import { Battlefield } from "./globals.js";
export class Cost {
}
class TargetedCost {
}
class MultipleCost extends Cost {
    costs;
    constructor(costs) { super(); this.costs = costs; }
    pay(card, spend = true) {
        let payment = this.costs.map(x => x.pay(card, false));
        if (payment.filter(x => !x).length > 0)
            return false;
        if (!spend)
            return true;
        for (let i of this.costs)
            i.pay(card, true);
        return true;
    }
    payPlayer(player, spend = true) {
        let payment = this.costs.map(x => x.payPlayer(player, false));
        if (payment.filter(x => !x).length > 0)
            return false;
        if (!spend)
            return true;
        for (let i of this.costs)
            i.payPlayer(player, true);
        return true;
    }
}
export class TapCost extends Cost {
    ignoreAttacking;
    constructor(ignoreAttacking = false) {
        super();
        this.ignoreAttacking = ignoreAttacking;
    }
    pay(card, spend = true) {
        if (card.tapped || (card instanceof Creature && (card.summoningSickness || (!this.ignoreAttacking && card.attacking))))
            return false;
        if (spend) {
            card.tapped = true;
        }
        return true;
    }
    payPlayer(player, spend = true) {
        // This makes no sense.
        return true;
    }
}
class LifeCost extends Cost {
    life;
    constructor(life = 1) {
        super();
        this.life = life;
    }
    pay(card, spend = true) {
        if (card.controller.lifeTotal <= this.life)
            return false;
        if (spend)
            card.controller.lifeTotal -= this.life;
        return true;
    }
    payPlayer(player, spend = true) {
        if (player.lifeTotal <= this.life)
            return false;
        if (spend)
            player.lifeTotal -= this.life;
        return true;
    }
}
class SacrificeTargetsCost extends TargetedCost {
    validate;
    canPay;
    constructor(validate, canPay) {
        super();
        this.validate = validate;
        this.canPay = canPay;
    }
    pay(card, targets) {
        for (let i of targets) {
            if (i instanceof Permanent)
                i.sacrifice();
        }
        return true;
    }
    async payPlayer(player, spend = true) {
        if (!this.canPay(Battlefield.filter(x => x.controller.is(player))))
            return false;
        if (spend) {
            player.selectTargets(undefined, x => !x.filter(y => !(y instanceof Permanent) || y.controller != player).length && this.validate(x), () => this.canPay(Battlefield.filter(x => x.controller.is(player))), "Select something to sacrifice", result => {
                for (let i of result)
                    i.sacrifice();
            });
        }
        return true;
    }
}
class SacrificeCost extends Cost {
    getTargets;
    constructor(getTargets) {
        super();
        this.getTargets = getTargets;
    }
    pay(card, spend = true) {
        this.getTargets(card).forEach(x => x.sacrifice());
        return true;
    }
    payPlayer(player, spend) {
        this.getTargets(player).forEach(x => x.sacrifice());
        return true;
    }
}
export class SacrificeSelfCost extends Cost {
    constructor() {
        super();
    }
    pay(card, spend = true) {
        if (!spend)
            return true;
        card.sacrifice();
        return true;
    }
    payPlayer(player, spend = true) {
        // This makes no sense.
        return true;
    }
}
