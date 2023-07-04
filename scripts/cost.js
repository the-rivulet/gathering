import { Permanent, Creature } from "./permanent.js";
import { Battlefield } from "./globals.js";
export class Cost {
}
export class AsyncCost extends Cost {
}
class ComplexCost extends Cost {
    costs;
    constructor(costs) { super(); this.costs = costs; }
    pay(card, spend = true) {
        for (let i of this.costs) {
            if (!i.pay(card, false))
                return false;
        }
        if (!spend)
            return true;
        for (let i of this.costs) {
            i.pay(card, true);
        }
        return true;
    }
    payPlayer(player, spend = true) {
        for (let i of this.costs) {
            if (!i.payPlayer(player, false))
                return false;
        }
        if (!spend)
            return true;
        for (let i of this.costs) {
            i.payPlayer(player, true);
        }
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
    life = 1;
    constructor(life) {
        super();
        if (life)
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
class SacrificeTargetsCost extends AsyncCost {
    validate;
    canPay;
    constructor(validate, canPay) {
        super();
        this.validate = validate;
        this.canPay = canPay;
    }
    async pay(card, spend = true) {
        if (!this.canPay(Battlefield.filter(x => x.controller == card.controller), card))
            return false;
        if (spend) {
            card.controller.selectTargets(card.representedCard, x => !x.filter(y => !(y instanceof Permanent) || y.controller != card.controller).length && this.validate(x, card), () => this.canPay(Battlefield.filter(x => x.controller == card.controller), card), "Select something to sacrifice", result => {
                for (let i of result)
                    i.sacrifice();
            });
        }
        return true;
    }
    async payPlayer(player, spend = true) {
        if (!this.canPay(Battlefield.filter(x => x.controller == player)))
            return false;
        if (spend) {
            player.selectTargets(undefined, x => !x.filter(y => !(y instanceof Permanent) || y.controller != player).length && this.validate(x), () => this.canPay(Battlefield.filter(x => x.controller == player)), "Select something to sacrifice", result => {
                for (let i of result)
                    i.sacrifice();
            });
        }
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
