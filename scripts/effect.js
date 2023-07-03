import { Mana } from "./mana.js";
import { Card } from "./card.js";
import { StackEffect } from "./stack.js";
import { StackManager } from "./globals.js";
export class Effect {
    manaEffect = false;
    queue(card) {
        StackManager.add(new StackEffect(this, card));
    }
}
/**
 * Use a color starting with 'any' to have the controller choose a color.
 * Ex: {any1: 1, any2: 1} would add two mana of any colors.
 */
export class AddManaEffect extends Effect {
    manaEffect = true;
    mana = new Mana();
    constructor(mana) {
        super(); // Pointless lol
        if (mana instanceof Mana)
            this.mana = mana;
        else if (typeof mana == 'object')
            this.mana = new Mana(mana);
    }
    async resolve(card) {
        let nm = this.mana;
        for (let i of Object.keys(nm.colors).filter(x => x.startsWith('any'))) {
            let c = await card.controller.getColor();
            if (nm[c])
                nm[c] += nm[i];
            else
                nm[c] = nm[i];
        }
        card.controller.manaPool.add(nm);
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
class ChooseOptionsEffect extends Effect {
    desc;
    effects;
    count;
    constructor(desc, effects, count = 1) {
        super(); // Pointless lol
        this.desc = desc;
        this.effects = effects;
        this.count = count;
    }
    async resolve(card) {
        let c = await card.controller.chooseOptions(this.desc, this.count);
        let worked = false;
        for (let i of c) {
            let n = this.desc.indexOf(i);
            let p = this.effects[n];
            let x = (p instanceof Effect ? [p] : p);
            for (let e of (n < this.effects.length ? x : [new AddManaEffect()])) {
                let r = await e.resolve(card);
                if (!r)
                    break;
                else
                    worked = true;
            }
        }
        return worked;
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
