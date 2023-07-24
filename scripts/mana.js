import { Card } from "./card.js";
import { Cost } from "./cost.js";
import { UI } from "./ui.js";
export var Color;
(function (Color) {
    Color["generic"] = "1";
    Color["white"] = "W";
    Color["blue"] = "U";
    Color["black"] = "B";
    Color["red"] = "R";
    Color["green"] = "G";
    Color["colorless"] = "C";
})(Color || (Color = {}));
export class ManaCost extends Cost {
    mana;
    card;
    isAbility;
    constructor(mana = {}, card, isAbility = false) {
        super();
        this.mana = isSimple(mana) ? { required: mana } : mana;
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
        return card.controller.manaPool.pay(this.mana, card.controller, spend);
    }
    payPlayer(player, spend = true) {
        return player.manaPool.pay(this.mana, player, spend);
    }
    get asString() {
        let s = asString(this.mana.required) + this.mana.choices.map(x => "(" + x.map(y => asString(y)).join("/") + ")").join("");
        if (!s.length)
            s = "0";
        return s;
    }
    asHTML(manaTag = "") {
        // Be careful with JSON.stringify, sometimes it adds single quotes for some reason and we need to trash them
        return UI.textAsHTML(Object.keys(this.mana.required).filter(x => x != 'generic').map(x => ("<span mana_type='" + JSON.stringify(x).replaceAll("'", '"') + "' class='" + manaTag + "'>{" + (x == "blue" ? "U" : x[0].toUpperCase()) + "}</span>").repeat(this.mana.required[x])).join("") + this.mana.choices.map(x => "<span>(" + x.map(y => "<span mana_type='" + JSON.stringify(y).replaceAll("'", '"') + "' class='" + manaTag + "'>" + asString(y, true) + "</span>").join("/") + ")</span>").join(""));
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
        //savePoint.mana = this.mana.slice(0);
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
        // Well that's over. If there are no valid paths then we failed.
        if (cost.choices.length && !validPaths.length)
            return false;
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
        if (decisions.length || (cost.required.generic || 0) > 0) {
            player.payComplexCosts(this, cost.required.generic || 0, decisions, (choices, forGeneric) => {
                this.mana = simplePay(this, choices).remain.mana;
                this.mana = simplePay(this, forGeneric).remain.mana;
                this.mana = simplePay(this, { generic: choices.generic }, true).remain.mana;
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
function isSimple(mana) {
    return !('required' in mana || 'choices' in mana);
}
function manaValueOf(mana) {
    return Object.values(mana).reduce((a, b) => a + b, 0);
}
function asString(mana, withBraces = false) {
    let order = Object.keys(Color);
    let s = mana.generic ? mana.generic.toString() : "";
    let keys = Object.keys(mana).filter(x => x != 'generic');
    keys.sort((a, b) => order.includes(a) ? (order.includes(b) ? (order.indexOf(a) > order.indexOf(b) ? 1 : -1) : 1) : order.includes(b) ? -1 : 0);
    for (let i of keys)
        s += (i == "blue" ? "U" : i[0].toUpperCase()).repeat(mana[i]);
    if (withBraces)
        s = s.split("").map(x => "{" + x + "}").join("");
    return s;
}
/**
 * Watch out, this doesn't cover generic mana. You have to deal with that yourself.
 */
function simplePay(mana, cost, tryPayingGeneric = false) {
    let pool = new ManaPool(mana.mana);
    let keys = Object.keys(cost);
    if (!tryPayingGeneric)
        keys = keys.filter(x => x != 'generic');
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
