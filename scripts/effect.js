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
    resolve(card) {
        let colorList = ["white", "blue", "black", "red", "green"];
        let mana = this.mana;
        let anys = Object.keys(this.mana.colors).filter(x => x.startsWith("any"));
        let func;
        let vals = [];
        for (let i = 0; i < anys.length; i++) {
            let name = anys[i];
            let val = this.mana.colors[name];
            vals.push(val);
            let curInd = func ? func.length - 1 : -1;
            if (curInd >= 0) {
                func.push((x) => {
                    card.controller.getColor("Choose a color to add " + vals[x] + " of", result => {
                        let col = colorList[result[0]];
                        mana.add(new Mana({ [col]: vals[x] }));
                        func[curInd](x - 1);
                    });
                });
            }
            else {
                func = [(x) => {
                        card.controller.getColor("Choose a color to add " + vals[x] + " of", result => {
                            let col = colorList[result[0]];
                            mana.add(new Mana({ [col]: vals[x] }));
                            this.mana.symbols = this.mana.symbols.filter(x => !x.color.startsWith("any"));
                            card.controller.manaPool.add(mana);
                        });
                    }];
            }
        }
        if (func)
            func[func.length - 1](func.length - 1);
        else
            card.controller.manaPool.add(mana);
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
