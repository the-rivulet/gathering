import { ManaPool } from "./mana.js";
import { TypeList } from "./card.js";
import { StackEffect } from "./stack.js";
import { StackManager } from "./globals.js";
export class Effect {
    queue(card) {
        StackManager.add(new StackEffect(this, card));
    }
}
export class MultipleEffect extends Effect {
    effects;
    constructor(...effects) {
        super();
        this.effects = effects;
    }
    resolve(card) {
        for (let i of this.effects)
            i.resolve(card);
    }
}
/**
 * Generally you would use `resolve`, rather than `queue`, on this effect.
 */
export class AddManaEffect extends Effect {
    mana;
    constructor(mana = {}) {
        super(); // Pointless lol
        this.mana = mana instanceof ManaPool ? mana : new ManaPool(mana);
    }
    resolve(card) {
        card.controller.manaPool.add(this.mana);
    }
}
export class ApplyAbilityEffect extends Effect {
    abil;
    temp;
    constructor(abil, temp = true) {
        super(); // Pointless lol
        this.abil = abil;
        this.temp = temp;
    }
    resolve(card) {
        card.applyAbility(this.abil, this.temp);
    }
}
export class CreateTokenEffect extends Effect {
    token;
    constructor(token) {
        super(); // Pointless lol
        this.token = token;
    }
    resolve(card) {
        card.controller.createToken(this.token);
    }
}
export class AddCounterEffect extends Effect {
    counter;
    amount = 1;
    constructor(counter, amount) {
        super(); // Pointless lol
        this.counter = counter;
        if (amount)
            this.amount = amount;
    }
    resolve(card) {
        card.addCounter(this.counter, this.amount);
    }
}
export class DrawCardsEffect extends Effect {
    amount;
    constructor(amount = 1) {
        super();
        this.amount = amount;
    }
    resolve(card) {
        card.controller.drawCard(this.amount);
    }
}
class DestroyCardsEffect extends Effect {
    cards;
    constructor(...cards) {
        super();
        this.cards = cards;
    }
    resolve(card) {
        for (let i of this.cards) {
            i.destroy();
        }
    }
}
export class SetStatsEffect extends Effect {
    power;
    toughness;
    constructor(power, toughness) {
        super();
        this.power = power;
        this.toughness = toughness;
    }
    queue(card) {
        StackManager.add(new StackEffect(this, card));
    }
    resolve(card) {
        if (this.power)
            card.power = this.power;
        if (this.toughness)
            card.toughness = this.toughness;
    }
}
export class SetTypesEffect extends Effect {
    types;
    constructor(types) {
        super();
        this.types = types instanceof TypeList ? types : new TypeList(types);
    }
    resolve(card) {
        card.types = this.types;
    }
}
