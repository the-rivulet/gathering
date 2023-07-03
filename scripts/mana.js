import { Card } from "./card.js";
import { Cost } from "./cost.js";
import { UI } from "./ui.js";
class ManaSymbol {
    color = '';
    canPayFor = (c, a) => true;
    limited = false;
    floating = false;
    keep;
    constructor(col, cpf, keep = false) {
        if (cpf)
            this.canPayFor = cpf;
        this.color = col;
        this.keep = keep;
    }
    get priority() {
        let p = 0;
        if (this.limited)
            p++;
        if (this.floating)
            p += 2;
        return p;
    }
}
export class ManaCost extends Cost {
    mana;
    card;
    isAbility;
    constructor(mana, card, isAbility = false) {
        super();
        this.mana = mana instanceof Mana ? mana : new Mana(mana);
        this.card = card;
        this.isAbility = isAbility;
    }
    pay(card, spend = true) {
        this.card = card.representedCard; // Just in case it wasn't initialized with the card
        return card.controller.manaPool.pay(this, spend);
    }
    payPlayer(player, spend = true) {
        return player.manaPool.pay(this, spend);
    }
    get asString() {
        return this.mana.asString;
    }
    get asHTML() {
        return this.mana.asHTML;
    }
}
/**
* Use the color 'generic' to indicate a generic mana cost.
* Ex: {generic: 1, blue: 2} = 1UU
 */
export class Mana {
    symbols = [];
    constructor(colors = {}, cpf, keep = false) {
        // Generate simple `ManaSymbol` object for each symbol
        for (let i of Object.keys(colors)) {
            for (let j = 0; j < colors[i]; j++) {
                this.symbols.push(new ManaSymbol(i, cpf, keep));
            }
        }
    }
    get colors() {
        let col = {};
        for (let i of this.symbols) {
            if (!col[i.color])
                col[i.color] = 0;
            col[i.color]++;
        }
        return col;
    }
    get value() {
        let v = 0;
        for (let i of Object.values(this.colors))
            v += i;
        return v;
    }
    get asString() {
        let s = this.colors["generic"] ? this.colors["generic"].toString() : "";
        for (let i of Object.keys(this.colors))
            s += (i == "blue" ? "U" : i[0].toUpperCase()).repeat(this.colors[i]);
        if (!s.length)
            s = "nothing";
        return s;
    }
    get asHTML() {
        let order = ["white", "blue", "black", "red", "green"];
        let s = this.colors["generic"] || 0;
        let keys = Object.keys(this.colors);
        keys.sort((a, b) => order.includes(a) ? (order.includes(b) ? (order.indexOf(a) < order.indexOf(b) ? 1 : -1) : 1) : order.includes(b) ? -1 : 0);
        return UI.textAsHTML(this.value ? (s ? "{" + s + "}" : "") + keys.map(x => (x == "generic" ? "" : ("{" + x[0].toUpperCase() + "}").repeat(this.colors[x]))).join("") : "{0}");
    }
    plus(other) {
        return ManaFromSymbols([
            ...this.symbols,
            ...(other instanceof Mana ? other.symbols : [other]),
        ]);
    }
    add(other) {
        this.symbols = this.plus(other).symbols;
    }
    pay(thing, spend = true) {
        let cost = thing instanceof Card ? thing.manaCost.mana.colors : thing instanceof ManaCost ? thing.mana : thing;
        if (!cost)
            return false;
        let card = thing instanceof Card ? thing : (thing instanceof ManaCost && thing.card) ? thing.card : undefined;
        let abil = (thing instanceof ManaCost && thing.isAbility) ? thing.isAbility : false;
        let sym = this.symbols.filter(x => !x.limited || !card || x.canPayFor(card, abil));
        if (new Mana(cost).value > sym.length) {
            return false; // Not enough total mana
        }
        for (let col of Object.keys(cost).filter(x => x != 'generic')) {
            let payables = sym.filter(x => x.color == col);
            let toPay = cost[col];
            if (payables.length < toPay)
                return false;
            // Now pay in order of priority
            while (toPay) {
                if (!payables.length)
                    throw new Error('Problem while paying colored mana!');
                let best = payables.sort((a, b) => a.priority > b.priority ? -1 : b.priority > a.priority ? 1 : 0)[0];
                sym.splice(sym.indexOf(best), 1);
                toPay--;
            }
        }
        for (let c = 0; c < cost['generic'] || 0; c++) {
            if (!sym.length)
                throw new Error('Problem while paying generic mana!');
            let best = sym.sort((a, b) => a.priority > b.priority ? -1 : b.priority > a.priority ? 1 : 0)[0];
            sym.splice(sym.indexOf(best), 1);
        }
        // Woot!
        if (spend)
            this.symbols = sym;
        console.log((spend ? "Paid " : "Can pay ") + JSON.stringify(cost) + (card ? " (" + card.name + ")" : "") + " successfully. New symbols: " + JSON.stringify(this.symbols));
        return true;
    }
}
export function ManaFromSymbols(symbols) {
    let col = {};
    for (let i of symbols) {
        if (!col[i.color])
            col[i.color] = 0;
        col[i.color]++;
    }
    return new Mana(col);
}
