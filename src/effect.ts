import type { Ability } from "./ability.js";
import type { Permanent } from "./permanent.js";
import { Mana } from "./mana.js";
import { Card, PermanentCard } from "./card.js";
import { StackEffect } from "./stack.js";
import { StackManager } from "./globals.js";

export abstract class Effect {
  // A common parent for the different effect types.
  abstract resolve(card: Permanent): boolean | Promise<boolean>;
  manaEffect = false;
  queue(card: Permanent) {
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
  constructor(mana?: Mana | object) {
    super(); // Pointless lol
    if (mana instanceof Mana) this.mana = mana;
    else if (typeof mana == 'object') this.mana = new Mana(mana);
  }
  resolve(card: Permanent) {
    let colorList = ["white", "blue", "black", "red", "green"];
    let mana = this.mana;
    let anys = Object.keys(this.mana.colors).filter(x => x.startsWith("any"));
    let func: any[];
    let vals = [];
    for (let i = 0; i < anys.length; i++) {
      let name = anys[i];
      let val: number = this.mana.colors[name];
      vals.push(val);
      let curInd = func ? func.length - 1 : -1;
      if (curInd >= 0) {
        func.push((x) => {
          card.controller.getColor("Choose a color to add " + vals[x] + " of", result => {
            let col = colorList[result[0]];
            mana.add(new Mana({ [col]: vals[x] }));
            func[curInd](x - 1);
          })
        });
      } else {
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
    if (func) func[func.length - 1](func.length - 1);
    else card.controller.manaPool.add(mana);
    return true;
  }
}

export class ApplyAbilityOnSelfEffect extends Effect {
  abil: Ability;
  temp: boolean;
  constructor(abil: Ability, temp = true) {
    super(); // Pointless lol
    this.abil = abil;
    this.temp = temp;
  }
  resolve(card: Permanent) {
    card.applyAbility(this.abil, this.temp);
    return true;
  }
}

export class CreateTokenEffect extends Effect {
  token: PermanentCard;
  constructor(token: PermanentCard) {
    super(); // Pointless lol
    this.token = token;
  }
  resolve(card: Permanent) {
    card.controller.createToken(this.token);
    return true;
  }
}

export class AddCounterOnSelfEffect extends Effect {
  counter: string;
  amount = 1;
  constructor(counter: string, amount?: number) {
    super(); // Pointless lol
    this.counter = counter;
    if (amount) this.amount = amount;
  }
  resolve(card: Permanent) {
    card.addCounter(this.counter, this.amount);
    return true;
  }
}

export class DrawCardsEffect extends Effect {
  amount: number;
  constructor(amount = 1) {
    super();
    this.amount = amount;
  }
  resolve(card: Permanent) {
    return card.controller.drawCard(this.amount);
  }
}

class DestroyCardsEffect extends Effect {
  cards: Card[];
  constructor(card: Card | Card[]) {
    super();
    this.cards = card instanceof Card ? [card] : card;
  }
  resolve(card: Permanent) {
    for (let i of this.cards) {
      i.destroy();
    }
    return true;
  }
}