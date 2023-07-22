import { ManaPool } from "./mana.js";
import { Card } from "./card.js";
import { StackEffect } from "./stack.js";
import { StackManager } from "./globals.js";
export class Effect {
    queue(card) {
        StackManager.add(new StackEffect(this, card));
    }
}
export class AddManaEffect extends Effect {
    mana;
    constructor(mana = {}) {
        super(); // Pointless lol
        this.mana = mana instanceof ManaPool ? mana : new ManaPool(mana);
    }
    resolve(card) {
        card.controller.manaPool.add(this.mana);
        return true;
    }
}
export class ApplyAbilityOnSelfEffect extends Effect {
    abil;
    temp;
    constructor(abil, temp = true) {
        super(); // Pointless lol
        this.abil = abil;
        this.temp = temp;
    }
    resolve(card) {
        card.applyAbility(this.abil, this.temp);
        return true;
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
        return true;
    }
}
export class AddCounterOnSelfEffect extends Effect {
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
        return true;
    }
}
export class DrawCardsEffect extends Effect {
    amount;
    constructor(amount = 1) {
        super();
        this.amount = amount;
    }
    resolve(card) {
        return card.controller.drawCard(this.amount);
    }
}
class DestroyCardsEffect extends Effect {
    cards;
    constructor(card) {
        super();
        this.cards = card instanceof Card ? [card] : card;
    }
    resolve(card) {
        for (let i of this.cards) {
            i.destroy();
        }
        return true;
    }
}
