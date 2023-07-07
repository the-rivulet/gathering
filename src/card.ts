import type { Permanent, Creature } from "./permanent.js";
import type { Player } from "./player.js";
import type { ManaCost } from "./mana.js";
import type { Ability } from "./ability.js";
import { Zone } from "./zone.js";
import { TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { ApplyHooks, HasValidTargetsHook, CheckTargetsHook } from "./hook.js";

export abstract class Card {
  uuid = Math.random();
  name: string;
  types: string[];
  supertypes: string[];
  majorTypes: string[];
  subtypes: string[];
  text = '';
  manaCost?: ManaCost;
  zone?: Zone;
  owner?: Player;
  uiElement?: HTMLSpanElement;
  constructor(name: string, types: string[], text = '', mana?: ManaCost) {
    this.name = name;
    this.types = types;
    this.supertypes = types.filter(x => ["Legendary", "Basic", "Token"].includes(x));
    this.majorTypes = types.filter(x => ["Creature", "Artifact", "Enchantment", "Land", "Instant", "Sorcery", "Planeswalker", "Battle"].includes(x));
    if (!this.majorTypes.length) throw new Error("Card '" + name + "' has no major types!");
    this.subtypes = types.filter(x => !this.supertypes.includes(x) && !this.majorTypes.includes(x));
    this.text = text;
    this.manaCost = mana;
    if (this.manaCost) this.manaCost.card = this;
  }
  getTooltip(textAsHTML: (text: string) => string, pow = true) {
    let t = `
    ${this.manaCost ? "(" + this.manaCost.asHTML + ") " : ""}${this.name}<br/>
      ${this.supertypes.join(" ")} ${this.majorTypes.join(" ")}${this.subtypes.length ? " - " : ""}${this.subtypes.join(" ")}<br/>
      ${textAsHTML(this.text.replaceAll("{CARDNAME", this.name))}`;
    if (this instanceof CreatureCard && pow) {
      t += `<br/>${this.power}/${this.toughness}`;
    }
    return t;
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
    return Object.keys(this.manaCost.mana.colors);
  }
  castable(by: Player, auto = false, free = false) {
    return (
      (auto || this.zone == Zone.hand) &&
      this.manaCost &&
      (auto || (this.owner && this.owner == by)) &&
      (auto || this.types.includes("Instant") || this.owner == TurnManager.currentPlayer) &&
      (auto || this.types.includes("Instant") || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
      (free || by.manaPool.pay(this, false))
    );
  }
  landPlayable(by: Player, auto = false, free = false) {
    return (
      (auto || this.zone == Zone.hand) &&
      (auto || this.owner == TurnManager.currentPlayer) &&
      this.types.includes("Land") &&
      (auto || TurnManager.step == Step.precombat_main || TurnManager.step == Step.postcombat_main) &&
      (auto || free || by.landPlays)
    )
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
  constructor(name: string, types: string[], text = '', mana?: ManaCost, abilities?: Ability[] | Ability) {
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
  makeEquivalentCopy: () => PermanentCard;
}

export class SpellCard extends Card {
  resolve: (card: SpellCard, target: any[]) => void;
  baseValidate: (targets: any[]) => boolean;
  basePossible: (self: SpellCard, field: Permanent[]) => boolean;
  controller?: Player;
  constructor(
    name: string,
    types: string[],
    text = '',
    validate: (targets: any[]) => boolean,
    possible: (self: SpellCard, field: Permanent[]) => boolean,
    func: (self: SpellCard, targets: any[]) => void,
    mana?: ManaCost
  ) {
    super(name, (types.includes("Instant") || types.includes("Sorcery")) ? types : ["Instant", ...types], text, mana);
    this.resolve = func;
    this.baseValidate = validate;
    this.basePossible = possible;
  }
  possible(self: SpellCard, field: Permanent[]): boolean {
    return ApplyHooks(x => x instanceof HasValidTargetsHook, function (that: SpellCard, field: Permanent[]) {
      return that.basePossible(that, field);
    }, self, field);
  }
  validate(self: SpellCard, targets: any[]): boolean {
    return ApplyHooks(x => x instanceof CheckTargetsHook, function (that: SpellCard, targets: any[]) {
      return that.baseValidate(targets);
    }, self, targets);
  }
  makeEquivalentCopy: () => SpellCard;
}

export class CreatureCard extends PermanentCard {
  power: number | ((x: Creature) => number) = 1;
  toughness: number | ((x: Creature) => number) = 1;
  declare representedPermanent?: Creature;
  constructor(
    name: string,
    types: string[],
    text = '',
    power: number | ((x: Creature) => number),
    toughness: number | ((x: Creature) => number),
    mana?: ManaCost,
    abilities?: Ability[] | Ability
  ) {
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
  constructor(
    name: string,
    text = '',
    validate: (attached: Permanent | Player) => boolean,
    mana?: ManaCost,
    abilities?: Ability[] | Ability
  ) {
    super(name, ['Enchantment', 'Aura'], text, mana, abilities);
    this.baseValidate = validate;
  }
  basePossible(field: Permanent[]) {
    return [...field, ...TurnManager.playerList].filter(x => this.validate(this, x)).length > 0;
  }
  possible(self: AuraCard, field: Permanent[]): boolean {
    return ApplyHooks(x => x instanceof HasValidTargetsHook, function (that: AuraCard, field: Permanent[]) {
      return that.basePossible(field);
    }, self, field);
  }
  validate(self: AuraCard, attached: Permanent | Player): boolean {
    return ApplyHooks(x => x instanceof CheckTargetsHook, function (that: AuraCard, targets: Permanent[] | Player[]) {
      return that.baseValidate(targets[0]);
    }, self, [attached]);
  }
  declare makeEquivalentCopy: () => AuraCard;
}