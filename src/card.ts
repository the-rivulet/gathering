import type { Permanent, Creature, Planeswalker } from "./permanent.js";
import type { Player } from "./player.js";
import type { Ability } from "./ability.js";
import { ManaCost, Color } from "./mana.js";
import { Zone } from "./zone.js";
import { TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { ApplyHooks, HasValidTargetsHook, CheckTargetsHook } from "./hook.js";
import { UI } from "./ui.js";

export class TypeList {
  list: string[];
  super: string[];
  main: string[];
  sub: string[];
  constructor(types: string[]) {
    this.list = types;
    this.super = types.filter(x => ["Legendary", "Basic", "Token"].includes(x));
    this.main = types.filter(x => ["Creature", "Artifact", "Enchantment", "Land", "Instant", "Sorcery", "Planeswalker", "Battle"].includes(x));
    this.sub = types.filter(x => !this.super.includes(x) && !this.main.includes(x));
  }
}

export abstract class Card {
  uuid = Math.random();
  name: string;
  types: TypeList;
  text = "";
  manaCost?: ManaCost;
  zone?: Zone;
  owner?: Player;
  uiElement?: HTMLSpanElement;
  click?: () => void;
  constructor(name: string, types: string[], text: string, mana?: ManaCost) {
    this.name = name;
    this.types = new TypeList(types);
    if (!this.types.main.length) throw new Error("Created card with no major types!");
    this.text = text;
    this.manaCost = mana;
    if (this.manaCost) this.manaCost.card = this;
  }
  is(card: Card) {
    return this.uuid == card.uuid;
  }
  getTooltip(textAsHTML: (text: string) => string, pow = true) {
    let t = `
    ${this.manaCost ? "(" + this.manaCost.asHTML() + ") " : ""}${this.name}<br/>
      ${this.types.super.join(" ")} ${this.types.main.join(" ")}${this.types.sub.length ? " - " : ""}${this.types.sub.join(" ")}<br/>
      ${textAsHTML(this.text.replaceAll("{CARDNAME", this.name))}`;
    if (this instanceof CreatureCard && pow) {
      t += `<br/>${this.power}/${this.toughness}`;
    }
    return t;
  }
  hasType(type: string) {
    return this.types.list.includes(type);
  }
  hasAbilityMarker(a: number) {
    return this.text.includes(`{A${a}}`) && this.text.includes(`{EC${a}}`) && this.text.includes(`{EA${a}}`);
  }
  getAbilityInfo(a: number, what: "cost" | "effect" | "all" = "all") {
    let begin = what == "effect" ? `{EC${a}}` : `{A${a}}`;
    let end = what == "cost" ? `{EC${a}}` : `{EA${a}}`;
    let t = what == "all" ? this.text.replace(`{EC${a}}`, ": ") : this.text;
    return this.hasAbilityMarker(a) ? t.split(begin)[1].split(end)[0] : "";
  }
  get colors() {
    if (!this.manaCost) return [];
    return Object.keys(this.manaCost.simplified);
  }
  castable(by: Player, auto = false, free = false) {
    return (
      (auto || this.zone == Zone.hand) &&
      this.manaCost &&
      (auto || (this.owner && this.owner.is(by))) &&
      (auto || this.hasType("Instant") || this.owner.is(TurnManager.currentPlayer)) &&
      (auto || this.hasType("Instant") || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
      (free || by.manaPool.pay(this, by, false))
    );
  }
  landPlayable(by: Player, auto = false, free = false) {
    return (
      (auto || this.zone == Zone.hand) &&
      (auto || this.owner.is(TurnManager.currentPlayer)) &&
      this.hasType("Land") &&
      (auto || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
      (auto || free || by.landPlays)
    );
  }
  play() {
    this.owner?.play(this);
  }
  destroy() {
    if (!this.owner) return;
    this.owner.moveCardTo(this, Zone.limbo);
    this.owner.zones[this.zone].splice(this.owner.zones[this.zone].indexOf(this), 1);
    this.owner = undefined;
  }
  abstract makeEquivalentCopy: () => Card;
}

export class PermanentCard extends Card {
  abilities: Ability[] = [];
  representedPermanent?: Permanent;
  constructor(name: string, types: string[], text: string, mana?: ManaCost, ...abilities: Ability[]) {
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
  makeEquivalentCopy: () => PermanentCard;
}

export class SpellCard extends Card {
  resolve: (card: SpellCard, target: any[]) => void;
  baseValidate: (self: SpellCard, targets: any[]) => boolean;
  basePossible: (self: SpellCard, field: Permanent[]) => boolean;
  controller?: Player;
  constructor(name: string, types: string[], text: string, validate: (self: SpellCard, targets: any[]) => boolean, possible: (self: SpellCard, field: Permanent[]) => boolean, func: (self: SpellCard, targets: any[]) => void, mana?: ManaCost) {
    super(name, (types.includes("Instant") || types.includes("Sorcery")) ? types : ["Instant", ...types], text, mana);
    this.resolve = func;
    this.baseValidate = validate;
    this.basePossible = possible;
  }
  possible(self: SpellCard, field: Permanent[]): boolean {
    return ApplyHooks(HasValidTargetsHook, function (that: SpellCard, field: Permanent[]) {
      return that.basePossible(that, field);
    }, self, field);
  }
  validate(self: SpellCard, targets: any[]): boolean {
    return ApplyHooks(CheckTargetsHook, function (that: SpellCard, targets: any[]) {
      return that.baseValidate(self, targets);
    }, self, targets);
  }
  makeEquivalentCopy: () => SpellCard;
}

export class SimpleSpellCard<T> extends SpellCard {
  constructor(name: string, types: string[], text: string, func: (self: SpellCard, target: T) => void, mana?: ManaCost) {
    let targetType: new (...args: any) => T;
    let possible = (self: SimpleSpellCard<T>, field: Permanent[]) => field.filter(x => x instanceof targetType).length > 0;
    let validate = (self: SimpleSpellCard<T>, target: any[]) => target.length == 1 && target[0] instanceof targetType;
    let func2 = (self: SpellCard, targets: any[]) => func(self, targets[0]);
    super(name, types, text, validate, possible, func2, mana);
  }
}

export class SplitSpellCard extends SpellCard {
  parts: SpellCard[];
  constructor(...parts: SpellCard[]) {
    if (parts.map(x => x.types).filter((x, i, a) => a.indexOf(x) == i).length > 1) throw new Error("Tried to create split spell card with non-matching types!");
    super(parts.map(x => x.name).join(" / "), parts[0].types.list, parts.map(x => x.getTooltip(UI.textAsHTML)).join("<br/><br/>"), (self, targets) => parts.map(x => x.validate(self, targets)).length > 0, (self, field) => parts.map(x => x.possible(self, field)).length > 0, (self, targets) => {
      let castable = parts.filter(x => x.castable(self.controller));
      self.controller.chooseOptions(castable.map(x => "Cast " + x.name), 1, "Choose one half to cast", choices => {
        let c = castable[choices[0]];
        self.controller.castSpell(c);
      });
    }, new ManaCost({ choices: parts.map(x => x.manaCost.mana.choices.flat()) })); // No idea if this will work but whatever
    this.parts = parts;
  }
}

export class CreatureCard extends PermanentCard {
  power: number | ((x: Creature) => number) = 1;
  toughness: number | ((x: Creature) => number) = 1;
  declare representedPermanent?: Creature;
  constructor(name: string, types: string[], text: string, power: number | ((x: Creature) => number), toughness: number | ((x: Creature) => number), mana?: ManaCost, ...abilities: Ability[]) {
    super(name, types.includes("Creature") ? types : ["Creature", ...types], text, mana, abilities);
    this.power = power;
    this.toughness = toughness;
  }
  markAsAttacker(attacking?: Player | Planeswalker) {
    return this.representedPermanent?.markAsAttacker(attacking);
  }
  unmarkAsAttacker(real = true) {
    return this.representedPermanent?.unmarkAsAttacker(real);
  }
  markAsBlocker(blocking?: Creature, real = true) {
    return this.representedPermanent?.markAsBlocker(blocking, real);
  }
  unmarkAsBlocker(blocking?: Creature, real = true) {
    return this.representedPermanent?.unmarkAsBlocker(blocking, real);
  }
  declare makeEquivalentCopy: () => CreatureCard;
}

export class AuraCard extends PermanentCard {
  baseValidate: (attached: Permanent | Player) => boolean;
  attached: Permanent | Player;
  constructor(name: string, text: string, validate: (attached: Permanent | Player) => boolean, mana?: ManaCost, ...abilities: Ability[]) {
    super(name, ["Enchantment", "Aura"], text, mana, abilities);
    this.baseValidate = validate;
  }
  basePossible(field: Permanent[]) {
    return [...field, ...TurnManager.playerList].filter(x => this.validate(this, x)).length > 0;
  }
  possible(self: AuraCard, field: Permanent[]): boolean {
    return ApplyHooks(HasValidTargetsHook, function (that: AuraCard, field: Permanent[]) {
      return that.basePossible(field);
    }, self, field);
  }
  validate(self: AuraCard, attached: Permanent | Player): boolean {
    return ApplyHooks(CheckTargetsHook, function (that: AuraCard, targets: Permanent[] | Player[]) {
      return that.baseValidate(targets[0]);
    }, self, [attached]);
  }
  declare makeEquivalentCopy: () => AuraCard;
}

export class PlaneswalkerCard extends PermanentCard {
  startingLoyalty: number;
  constructor(name: string, type: string, text: string, loyalty: number, mana?: ManaCost, ...abilities: Ability[]) {
    super(name, ["Legendary", "Planeswalker", type], text, mana, abilities);
    this.startingLoyalty = loyalty;
  }
  declare makeEquivalentCopy: () => PlaneswalkerCard;
}