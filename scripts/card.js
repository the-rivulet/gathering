import { Zone } from "./zone.js";
import { TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { UI } from "./ui.js";
import { ApplyHooks, HasValidTargetsHook, CheckTargetsHook } from "./hook.js";
export class Card {
    uuid = Math.random();
    name;
    types;
    supertypes;
    majorTypes;
    subtypes;
    text = '';
    manaCost;
    zone;
    owner;
    uiElement;
    constructor(name, types, text = '', mana) {
        this.name = name;
        this.types = types;
        this.supertypes = types.filter(x => ["Legendary", "Basic", "Token"].includes(x));
        this.majorTypes = types.filter(x => ["Creature", "Artifact", "Enchantment", "Land", "Instant", "Sorcery", "Planeswalker", "Battle"].includes(x));
        if (!this.majorTypes.length)
            throw new Error("Card '" + name + "' has no major types!");
        this.subtypes = types.filter(x => !this.supertypes.includes(x) && !this.majorTypes.includes(x));
        this.text = text;
        this.manaCost = mana;
        if (this.manaCost)
            this.manaCost.card = this;
    }
    hasAbilityMarker(a) {
        return this.text.includes(`{A${a}}`) && this.text.includes(`{EC${a}}`) && this.text.includes(`{EA${a}}`);
    }
    getAbilityInfo(a, what = "all") {
        let begin = what == "effect" ? `{EC${a}}` : `{A${a}}`;
        let end = what == "cost" ? `{EC${a}}` : `{EA${a}}`;
        let t = what == "all" ? this.text.replace(`{EC${a}}`, ": ") : this.text;
        return this.hasAbilityMarker(a) ? t.split(begin)[1].split(end)[0] : "";
    }
    get textAsHTML() {
        return UI.textAsHTML(this.text.replaceAll("{CARDNAME}", this.name));
    }
    get colors() {
        if (!this.manaCost)
            return [];
        return Object.keys(this.manaCost.mana.colors);
    }
    castable(by, auto = false, free = false) {
        return ((auto || this.zone == Zone.hand) &&
            this.manaCost &&
            (auto || (this.owner && this.owner == by)) &&
            (auto || this.types.includes("Instant") || this.owner == TurnManager.currentPlayer) &&
            (auto || this.types.includes("Instant") || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
            (free || by.manaPool.pay(this, false)));
    }
    landPlayable(by, auto = false, free = false) {
        return ((auto || this.zone == Zone.hand) &&
            (auto || this.owner == TurnManager.currentPlayer) &&
            this.types.includes("Land") &&
            (auto || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
            (auto || free || by.landPlays));
    }
    destroy() {
        if (!this.owner)
            return;
        this.owner.moveCardTo(this, Zone.limbo);
        this.owner.zones[this.zone].splice(this.owner.zones[this.zone].indexOf(this), 1);
        this.owner = undefined;
    }
}
export class PermanentCard extends Card {
    abilities = [];
    representedPermanent;
    constructor(name, types, text = '', mana, abilities) {
        if (!types.includes("Creature") &&
            !types.includes("Enchantment") &&
            !types.includes("Artifact") &&
            !types.includes("Land") &&
            !types.includes("Planeswalker")) {
            throw new Error("PermanentCard '" + name + "' has no permanent types! types=" + types);
        }
        super(name, types, text, mana);
        if (abilities)
            this.abilities = Array.isArray(abilities) ? abilities : [abilities];
    }
    makeEquivalentCopy;
}
export class SpellCard extends Card {
    resolve;
    baseValidate;
    basePossible;
    controller;
    constructor(name, types, text = '', validate, possible, func, mana) {
        super(name, (types.includes("Instant") || types.includes("Sorcery")) ? types : ["Instant", ...types], text, mana);
        this.resolve = func;
        this.baseValidate = validate;
        this.basePossible = possible;
    }
    possible(field) {
        return ApplyHooks(x => x instanceof HasValidTargetsHook, function (that, field) {
            return that.basePossible(that, field);
        }, this, field);
    }
    validate(targets) {
        return ApplyHooks(x => x instanceof CheckTargetsHook, function (that, targets) {
            return that.baseValidate(targets);
        }, this, targets);
    }
    makeEquivalentCopy;
}
export class CreatureCard extends PermanentCard {
    power = 1;
    toughness = 1;
    constructor(name, types, text = '', power, toughness, mana, abilities) {
        super(name, types.includes("Creature") ? types : ["Creature", ...types], text, mana, abilities);
        this.power = power;
        this.toughness = toughness;
    }
}
export class AuraCard extends PermanentCard {
    baseValidate;
    attached;
    constructor(name, text = '', validate, mana, abilities) {
        super(name, ['Enchantment', 'Aura'], text, mana, abilities);
        this.baseValidate = validate;
    }
    basePossible(field) {
        return [...field, ...TurnManager.playerList].filter(x => this.validate(x)).length > 0;
    }
    possible(field) {
        return ApplyHooks(x => x instanceof HasValidTargetsHook, function (that, field) {
            return that.basePossible(field);
        }, this, field);
    }
    validate(attached) {
        return ApplyHooks(x => x instanceof CheckTargetsHook, function (that, targets) {
            return that.baseValidate(targets[0]);
        }, this, [attached]);
    }
}
