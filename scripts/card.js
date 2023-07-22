import { Zone } from "./zone.js";
import { TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { ApplyHooks, HasValidTargetsHook, CheckTargetsHook } from "./hook.js";
export class TypeList {
    list;
    super;
    main;
    sub;
    constructor(types) {
        this.list = types;
        this.super = types.filter(x => ["Legendary", "Basic", "Token"].includes(x));
        this.main = types.filter(x => ["Creature", "Artifact", "Enchantment", "Land", "Instant", "Sorcery", "Planeswalker", "Battle"].includes(x));
        this.sub = types.filter(x => !this.super.includes(x) && !this.main.includes(x));
    }
}
export class Card {
    uuid = Math.random();
    name;
    types;
    text = '';
    manaCost;
    zone;
    owner;
    uiElement;
    click;
    constructor(name, types, text = '', mana) {
        this.name = name;
        this.types = new TypeList(types);
        if (!this.types.main.length)
            throw new Error("Created card with no major types!");
        this.text = text;
        this.manaCost = mana;
        if (this.manaCost)
            this.manaCost.card = this;
    }
    is(card) {
        return this.uuid == card.uuid;
    }
    getTooltip(textAsHTML, pow = true) {
        let t = `
    ${this.manaCost ? "(" + this.manaCost.asHTML() + ") " : ""}${this.name}<br/>
      ${this.types.super.join(" ")} ${this.types.main.join(" ")}${this.types.sub.length ? " - " : ""}${this.types.sub.join(" ")}<br/>
      ${textAsHTML(this.text.replaceAll("{CARDNAME", this.name))}`;
        if (this instanceof CreatureCard && pow) {
            t += `<br/>${this.power}/${this.toughness}`;
        }
        return t;
    }
    hasType(type) {
        return this.types.list.includes(type);
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
    get colors() {
        if (!this.manaCost)
            return [];
        return Object.keys(this.manaCost.simplified);
    }
    castable(by, auto = false, free = false) {
        return ((auto || this.zone == Zone.hand) &&
            this.manaCost &&
            (auto || (this.owner && this.owner == by)) &&
            (auto || this.hasType("Instant") || this.owner == TurnManager.currentPlayer) &&
            (auto || this.hasType("Instant") || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
            (free || by.manaPool.pay(this, by, false)));
    }
    landPlayable(by, auto = false, free = false) {
        return ((auto || this.zone == Zone.hand) &&
            (auto || this.owner == TurnManager.currentPlayer) &&
            this.hasType("Land") &&
            (auto || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
            (auto || free || by.landPlays));
    }
    play() {
        this.owner?.play(this);
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
            throw new Error("Permanent card '" + name + "' has no permanent types! types=" + types);
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
    possible(self, field) {
        return ApplyHooks(HasValidTargetsHook, function (that, field) {
            return that.basePossible(that, field);
        }, self, field);
    }
    validate(self, targets) {
        return ApplyHooks(CheckTargetsHook, function (that, targets) {
            return that.baseValidate(targets);
        }, self, targets);
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
    markAsAttacker(real = true) {
        return this.representedPermanent?.markAsAttacker(real);
    }
    unmarkAsAttacker(real = true) {
        return this.representedPermanent?.unmarkAsAttacker(real);
    }
    markAsBlocker(blocking, real = true) {
        return this.representedPermanent?.markAsBlocker(blocking, real);
    }
    unmarkAsBlocker(blocking, real = true) {
        return this.representedPermanent?.unmarkAsBlocker(blocking, real);
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
        return [...field, ...TurnManager.playerList].filter(x => this.validate(this, x)).length > 0;
    }
    possible(self, field) {
        return ApplyHooks(HasValidTargetsHook, function (that, field) {
            return that.basePossible(field);
        }, self, field);
    }
    validate(self, attached) {
        return ApplyHooks(CheckTargetsHook, function (that, targets) {
            return that.baseValidate(targets[0]);
        }, self, [attached]);
    }
}
