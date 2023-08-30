import { Card } from "./card.js";
import { Cost } from "./cost.js";
import { UI } from "./ui.js";
export var Color;
(function (Color) {
    Color["generic"] = "generic";
    Color["white"] = "white";
    Color["blue"] = "blue";
    Color["black"] = "black";
    Color["red"] = "red";
    Color["green"] = "green";
    Color["colorless"] = "colorless";
})(Color || (Color = {}));
export class ManaCost extends Cost {
    mana;
    card;
    isAbility;
    constructor(mana = {}, card, isAbility = false) {
        super();
        this.mana = structuredClone(isSimple(mana) ? { required: mana } : mana);
        if (!this.mana.choices)
            this.mana.choices = [];
        if (!this.mana.required)
            this.mana.required = {};
        this.card = card;
        this.isAbility = isAbility;
    }
    get simplified() {
        return new ManaPool([this.mana.required, ...this.mana.choices.flat()]).simplified;
    }
    get value() {
        // Take the greatest value from each choice
        let values = this.mana.choices.map(x => Math.max(...x.map(y => manaValueOf(y))));
        return [manaValueOf(this.mana.required), ...values].reduce((a, b) => a + b, 0);
    }
    pay(card, spend = true) {
        this.card = card.representedCard; // Just in case it wasn't initialized with the card
        return card.controller.manaPool.pay(this.card, card.controller, spend);
    }
    payPlayer(player, spend = true) {
        return player.manaPool.pay(this.card || this.mana, player, spend);
    }
    get asString() {
        return asString(this.mana).length ? asString(this.mana) : "0";
    }
    get asStringWithBraces() {
        return asString(this.mana, true).length ? asString(this.mana, true) : "{0}";
    }
    asHTML(manaTag = "") {
        return UI.textAsHTML(asString(this.mana, true, manaTag));
    }
}
export class ManaPool {
    mana;
    constructor(mana = {}) {
        this.mana = structuredClone(Array.isArray(mana) ? mana : [mana]);
    }
    get simplified() {
        let c = {};
        for (let i of this.mana) {
            for (let j of Object.keys(i).filter(x => Object.keys(Color).includes(x))) {
                if (c[j])
                    c[j] += i[j];
                else
                    c[j] = i[j];
            }
        }
        return c;
    }
    get value() {
        return manaValueOf(this.simplified);
    }
    pay(thing, player, spend = true) {
        let cost = thing instanceof Card ? thing.manaCost.mana : thing;
        if (!cost)
            return false;
        let card = thing instanceof Card ? thing : (thing instanceof ManaCost && thing.card) ? thing.card : undefined;
        let abil = (thing instanceof ManaCost && thing.isAbility) ? thing.isAbility : false;
        let copy = new ManaPool(this.mana.filter(x => (!card || !x.canPayFor || x.canPayFor(card, abil))));
        //copy.mana = this.mana.slice(0).filter(x => (!card || !x.canPayFor || x.canPayFor(card, abil)));
        let pay = simplePay(this, cost.required);
        if (pay.success)
            this.mana = pay.remain.mana;
        // This doesn't pay generic, so we'll get back to that later.
        else
            return false;
        // Now is probably a good time to see if the rest of the cost is payable before we get into asking about it
        let savePoint = new ManaPool(this.mana);
        let validPaths = [];
        let combo = cost.choices.map(x => 0);
        let keepGoing = true;
        while (cost.choices.length && keepGoing) {
            this.mana = structuredClone(savePoint.mana); // deep copy both ways
            // See if the current combo works
            let worked = true;
            let generic = 0;
            for (let i = 0; i < combo.length; i++) {
                let choice = combo[i];
                let mana = cost.choices[i][choice];
                let pay = simplePay(this, mana);
                if (pay.success && this.value >= (mana.generic || 0)) {
                    this.mana = pay.remain.mana;
                    generic += mana.generic || 0;
                }
                else {
                    worked = false;
                    break;
                }
            }
            if (worked && this.value >= (generic + cost.required.generic || 0))
                validPaths.push(structuredClone(combo)); // deep copy again
            combo[0]++;
            while (combo.filter((x, i) => x >= cost.choices[i].length).length) {
                let problem = combo.indexOf(combo.filter((x, i) => x >= cost.choices[i].length)[0]);
                if (problem + 1 == combo.length) {
                    keepGoing = false;
                    break;
                }
                else {
                    combo[problem + 1]++;
                    combo[problem] = 0;
                }
            }
        }
        if (cost.choices.length && !validPaths.length)
            return false;
        this.mana = structuredClone(savePoint.mana); // Save point!
        // Pay the ones where there is no choice
        let obvious = cost.choices.filter((x, i) => validPaths.map(y => y[i]).filter((y, j, a) => a.indexOf(y) == j).length == 1).map((x, i) => x[validPaths.map(y => y[i])[0]]);
        for (let i of obvious) {
            let pay = simplePay(this, i);
            if (pay.success)
                this.mana = pay.remain.mana;
            else
                throw new Error("I think there is a problem");
        }
        let decisions = cost.choices.filter((x, i) => validPaths.map(y => y[i]).filter((y, j, a) => a.indexOf(y) == j).length > 1);
        // Ask for the generic mana, plus the real choices
        if (spend && (decisions.length || (cost.required.generic || 0) > 0)) {
            player.payComplexCosts(this, cost.required.generic || 0, decisions, (choices, forGeneric) => {
                console.group("Results:");
                console.log(this.mana);
                console.log(choices);
                this.mana = simplePay(this, choices).remain.mana;
                console.log(this.mana);
                console.log(forGeneric);
                this.mana = simplePay(this, forGeneric).remain.mana;
                console.log(this.mana);
                console.log(choices.generic);
                this.mana = simplePay(this, { generic: choices.generic }, true).remain.mana;
                console.log(this.mana);
                console.groupEnd();
            });
        }
        // Go back to the copied value if you don't want to save the payment
        if (!spend)
            this.mana = copy.mana;
        return true;
    }
    add(other) {
        if (other instanceof ManaPool)
            this.mana = [...this.mana, ...other.mana];
        else if (Array.isArray(other))
            this.mana = [...this.mana, ...other];
        else
            this.mana.push(other);
    }
    get asString() {
        return asString(this.simplified).length ? asString(this.simplified) : "0";
    }
    get asStringWithBraces() {
        return asString(this.simplified, true).length ? asString(this.simplified, true) : "{0}";
    }
    get asHTML() {
        return UI.textAsHTML(asString(this.simplified, true));
    }
}
function letterToColor(letter) {
    let l = letter[0].toLowerCase();
    if (l == "u")
        return Color.blue;
    else
        return Object.values(Color).filter(x => x != Color.generic && x[0] == l)[0];
}
function isSimple(mana) {
    return !("required" in mana || "choices" in mana);
}
function manaValueOf(mana) {
    return Object.values(mana).reduce((a, b) => a + b, 0);
}
function asString(mana, withBraces = false, manaTag = "") {
    // TODO: use manaTag in the split bits. should be a SimpleManaObject.
    let m = (isSimple(mana) ? { required: mana } : mana);
    let order = Object.keys(Color);
    let s = m.required.generic ? m.required.generic.toString() : "";
    let keys = Object.keys(m.required).filter(x => x != Color.generic);
    keys.sort((a, b) => order.includes(a) ? (order.includes(b) ? (order.indexOf(a) > order.indexOf(b) ? 1 : -1) : 1) : order.includes(b) ? -1 : 0);
    for (let i of keys)
        s += (i == Color.blue ? "U" : i[0].toUpperCase()).repeat(m.required[i]);
    if (withBraces)
        s = s.split("").map(x => "ø" + letterToColor(x) + "µ{" + x + "}¬").join("");
    if (m.choices)
        for (let i of m.choices)
            s += "(" + i.map(x => `ø${JSON.stringify(x)}µ${asString(x, withBraces)}¬`).filter(x => x.length).join("/") + ")";
    s = s.replaceAll("ø", `<span class='${manaTag}' mana_type='`).replaceAll("µ", "'>").replaceAll("¬", "</span>");
    //if (manaTag) s = `<span class='${manaTag}'>${s}</span>`;
    return s;
}
/**
 * Watch out, this doesn't cover generic mana. You have to deal with that yourself.
 */
function simplePay(mana, cost, tryPayingGeneric = false) {
    let pool = new ManaPool(mana.mana);
    let keys = Object.keys(cost);
    if (!tryPayingGeneric)
        keys = keys.filter(x => x != Color.generic);
    for (let col of keys) {
        let payables = pool.mana.filter(x => x[col] && x[col] > 0);
        let toPay = cost[col];
        // Is there enough?
        if (payables.reduce((a, b) => a + b[col], 0) < toPay)
            return { success: false, remain: new ManaPool(mana.mana) };
        // Now pay
        for (let i of payables) {
            if (i[col] >= toPay) {
                i[col] -= toPay;
                break;
            }
            else {
                toPay -= i[col];
                i[col] = 0;
            }
        }
    }
    return { success: true, remain: pool };
}
export let ManaUtils = {
    isSimple: isSimple,
    simplePay: simplePay
};
