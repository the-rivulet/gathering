import { ManaCost } from "./mana.js";
import { Zone } from "./zone.js";
import { TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { ApplyHooks, HasValidTargetsHook, CheckTargetsHook, FinishedResolvingSpellHook } from "./hook.js";
import { UI } from "./ui.js";
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
    text = "";
    manaCost;
    zone;
    owner;
    uiElement;
    click;
    constructor(name, types, text, mana) {
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
    ${this.manaCost ? this.manaCost.asHTML() + " " : ""}${this.name}<br/>
      ${this.types.super.join(" ")} ${this.types.main.join(" ")}${this.types.sub.length ? " - " : ""}${this.types.sub.join(" ")}<br/>
      ${textAsHTML(this.text.replaceAll("{CARDNAME}", this.name))}`;
        if (this instanceof CreatureCard && pow) {
            t += `<br/>${this.power}/${this.toughness}`;
        }
        return t;
    }
    hasType(type) {
        return this.types.list.includes(type);
    }
    hasAbilityMarker(ability) {
        let a = ability + 1;
        return this.text.includes(`{A${a}}`) && this.text.includes(`{EC${a}}`) && this.text.includes(`{EA${a}}`);
    }
    getAbilityInfo(ability, what = "all") {
        let a = ability + 1;
        let begin = what == "effect" ? `{EC${a}}` : `{A${a}}`;
        let end = what == "cost" ? `{EC${a}}` : `{EA${a}}`;
        let t = what == "all" ? this.text.replace(`{EC${a}}`, ": ") : this.text;
        return this.hasAbilityMarker(ability) ? t.split(begin)[1].split(end)[0].replaceAll("{CARDNAME}", this.name) : "";
    }
    get colors() {
        if (!this.manaCost)
            return [];
        return Object.keys(this.manaCost.simplified);
    }
    castable(by, auto = false, free = false) {
        return ((auto || this.zone == Zone.hand) &&
            this.manaCost &&
            (auto || (this.owner && this.owner.is(by))) &&
            (auto || this.hasType("Instant") || this.owner.is(TurnManager.currentPlayer)) &&
            (auto || this.hasType("Instant") || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
            (free || by.manaPool.pay(this, by, false)));
    }
    landPlayable(by, auto = false, free = false) {
        return ((auto || this.zone == Zone.hand) &&
            (auto || this.owner.is(TurnManager.currentPlayer)) &&
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
    constructor(name, types, text, mana, ...abilities) {
        if (!types.includes("Creature") &&
            !types.includes("Enchantment") &&
            !types.includes("Artifact") &&
            !types.includes("Land") &&
            !types.includes("Planeswalker")) {
            throw new Error("Permanent card " + name + " has no permanent types! types=" + types);
        }
        super(name, types, text, mana);
        this.abilities = abilities;
    }
    makeEquivalentCopy;
}
export class SpellCard extends Card {
    resolve;
    baseValidate;
    basePossible;
    controller;
    partOf;
    constructor(name, types, text, validate, possible, func, mana) {
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
            return that.baseValidate(self, targets);
        }, self, targets);
    }
    zoneWhenFinished(player, targets) {
        return ApplyHooks(FinishedResolvingSpellHook, (that, player, targets) => {
            return Zone.graveyard;
        }, this, player, targets);
    }
    makeEquivalentCopy;
}
export class SimpleSpellCard extends SpellCard {
    constructor(name, types, text, instance, func, mana) {
        let possible = (self, field) => [...field, ...TurnManager.playerList, ...TurnManager.playerList.map(x => Object.values(x.zones)).flat()].filter(x => instance(x)).length > 0;
        let validate = (self, targets) => targets.length == 1 && instance(targets[0]);
        let func2 = (self, targets) => func(self, targets[0]);
        super(name, types, text, validate, possible, func2, mana);
    }
}
export class UntargetedSpellCard extends SpellCard {
    constructor(name, types, text, func, mana) {
        let possible = (self, field) => true;
        let validate = (self, targets) => targets.length == 0;
        let func2 = (self, targets) => func(self);
        super(name, types, text, validate, possible, func2, mana);
    }
}
export class CreatureCard extends PermanentCard {
    power = 1;
    toughness = 1;
    constructor(name, types, text, power, toughness, mana, ...abilities) {
        super(name, types.includes("Creature") ? types : ["Creature", ...types], text, mana, abilities);
        this.power = power;
        this.toughness = toughness;
    }
    markAsAttacker(attacking) {
        return this.representedPermanent?.markAsAttacker(attacking);
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
    constructor(name, text, validate, mana, ...abilities) {
        super(name, ["Enchantment", "Aura"], text, mana, abilities);
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
export class PlaneswalkerCard extends PermanentCard {
    startingLoyalty;
    constructor(name, type, text, loyalty, mana, ...abilities) {
        super(name, ["Legendary", "Planeswalker", type], text, mana, abilities);
        this.startingLoyalty = loyalty;
    }
}
export class SplitSpellCard extends Card {
    parts;
    fuse;
    constructor(fuse, ...parts) {
        if (parts.map(x => x.types.list.join(" ")).filter((x, i, a) => a.indexOf(x) == i).length > 1)
            throw new Error("Tried to create split spell card with non-matching types!");
        super(parts.map(x => x.name).join(" // "), parts[0].types.list, parts.map(x => x.getTooltip(UI.textAsHTML)).join("<br/><br/>"), new ManaCost({ choices: parts.map(x => [x.manaCost.mana.required, ...x.manaCost.mana.choices.flat()]) }));
        for (let i of parts) {
            i.partOf = this;
        }
        this.parts = parts;
        this.fuse = fuse;
    }
    castable(by, auto = false, free = false) {
        return this.parts.filter(x => x.castable(by, auto, free)).length > 0;
    }
}
