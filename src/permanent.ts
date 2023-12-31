import { ManaCost } from "./mana.js";
import type { Player } from "./player.js";
import { Card, PermanentCard, CreatureCard, PlaneswalkerCard, TypeList } from "./card.js";
import { Ability, ComputedAbility, FirstStrikeAbility, DoubleStrikeAbility, HasteAbility } from "./ability.js";
import { Battlefield } from "./globals.js";
import { ApplyHooks, DestroyPermanentHook, StatsHook, TypesHook, AbilitiesHook, TakeDamageHook } from "./hook.js";
import { Zone } from "./zone.js";
import { UI } from "./ui.js";


export class Permanent {
  uuid = Math.random();
  representedCard: PermanentCard;
  name: string;
  baseTypes: TypeList;
  text: string;
  manaCost?: ManaCost;
  baseAbilities: Ability[] = [];
  eternalAbilities: Ability[] = [];
  tempAbilities: Ability[] = [];
  tapped_REAL = false;
  controller_REAL: Player;
  owner: Player;
  counters: object = {};
  constructor(card: PermanentCard) {
    this.representedCard = card;
    this.name = card.name;
    this.baseTypes = card.types;
    this.text = card.text;
    this.manaCost = new ManaCost(card.manaCost?.mana);
    this.baseAbilities = card.abilities;
    if (!card.owner) throw new Error("Tried to create a permanent without specifying an owner!");
    this.controller = card.owner;
    this.owner = card.owner;
    Battlefield.push(this);
    UI.renderBattlefield();
  }
  is(card: Permanent) {
    return this.uuid == card.uuid;
  }
  hasType(type: string) {
    return this.types.list.includes(type);
  }
  hasAbility(kwd: new (...args: any[]) => Ability) {
    return this.abilities.filter(x => x instanceof kwd).length > 0;
  }
  get tapped() {
    return this.tapped_REAL;
  }
  set tapped(value: boolean) {
    this.tapped_REAL = value;
    UI.renderBattlefield();
  }
  destroy() {
    ApplyHooks(DestroyPermanentHook, that => {
      Battlefield.splice(Battlefield.indexOf(that), 1);
      UI.renderBattlefield();
      if (that.representedCard.zone == Zone.battlefield) that.owner.moveCardTo(that.representedCard, Zone.graveyard);
    }, this);
  }
  sacrifice() {
    Battlefield.splice(Battlefield.indexOf(this), 1);
  }
  get controller() {
    return this.controller_REAL;
  }
  set controller(value: Player) {
    if (this.controller && this.controller != value) {
      this.controller.zones.battlefield.splice(this.controller.zones.battlefield.indexOf(this.representedCard), 1);
      value.zones.battlefield.push(this.representedCard);
    }
    this.controller_REAL = value;
  }
  applyAbility(abil: Ability, temp: boolean = true) {
    if (temp) this.tempAbilities.push(abil);
    else this.eternalAbilities.push(abil);
  }
  addCounter(counter: string, amount = 1) {
    if (!this.counters[counter]) this.counters[counter] = 0;
    this.counters[counter] += amount;
  }
  removeCounter(counter: string, amount = 1) {
    if (!this.counters[counter]) return;
    this.counters[counter] = Math.max(0, this.counters[counter] - amount);
  }
  get abilities(): Ability[] {
    return ApplyHooks(AbilitiesHook, that => {
      let a = [...that.tempAbilities, ...that.eternalAbilities, ...that.baseAbilities];
      return a.map(x => x instanceof ComputedAbility ? x.evaluate(that) : x).flat(2);
    }, this);
  }
  set types(t: TypeList | string[]) {
    this.baseTypes = (t instanceof TypeList ? t : new TypeList(t));
  }
  get types(): TypeList {
    return ApplyHooks(TypesHook, that => {
      return that.baseTypes;
    }, this);
  }
}

export class Creature extends Permanent {
  staticPower: number | ((card: Creature) => number);
  staticToughness: number | ((card: Creature) => number);
  summoningSickness = true;
  attacking: Player | Planeswalker;
  blocking: Creature[] = [];
  damage = 0;
  ringBearer = false;
  constructor(card: CreatureCard) {
    super(card);
    this.staticPower = card.power;
    this.staticToughness = card.toughness;
    if (this.hasAbility(HasteAbility)) this.summoningSickness = false;
  }
  get basePower() {
    return typeof this.staticPower == "number"
      ? this.staticPower
      : this.staticPower(this);
  }
  get baseToughness() {
    return typeof this.staticToughness == "number"
      ? this.staticToughness
      : this.staticToughness(this);
  }
  getStat(stat: "power" | "toughness"): number {
    return ApplyHooks(StatsHook, (that, stat) => {
      return (stat == "power" ? that.basePower : that.baseToughness) + (this.counters["+1/+1"] || 0);
    }, this, stat);
  }
  set types(t: TypeList | string[]) {
    let t2 = (t instanceof TypeList ? t.list : t);
    this.baseTypes = new TypeList(t2.includes("Creature") ? t2 : ["Creature", ...t2]);
  }
  get types(): TypeList {
    // It's kinda bizarre that I need this, seeing as it already exists above.
    return ApplyHooks(TypesHook, that => {
      return that.baseTypes;
    }, this);
  }
  set power(p: number | (() => number)) {
    this.staticPower = p;
  }
  get power(): number {
    return this.getStat("power");
  }
  set toughness(t: number | (() => number)) {
    this.staticToughness = t;
  }
  get toughness(): number {
    return this.getStat("toughness");
  }
  get blockedBy() {
    return (Battlefield.filter(x => x instanceof Creature && x.blocking.includes(this)) as Creature[]);
  }
  get defendingPlayer() {
    return (this.attacking instanceof Planeswalker ? this.attacking.controller : this.attacking);
  }
  markAsAttacker(attacking?: Player | Planeswalker) {
    return this.controller.markAsAttacker(this, attacking);
  }
  unmarkAsAttacker(real = true) {
    return this.controller.unmarkAsAttacker(this, real);
  }
  markAsBlocker(blocking?: Creature, real = true) {
    return this.controller.markAsBlocker(this, blocking, real);
  }
  unmarkAsBlocker(blocking?: Creature, real = true) {
    return this.controller.unmarkAsBlocker(this, blocking, real);
  }
  get combatStat(): "power" | "toughness" {
    return "power";
  }
  dealCombatDamage(target: Creature) {
    // First strike and double strike are a bit special.
    if (this.hasAbility(DoubleStrikeAbility)) target.takeDamage(this, this.power, true, !target.hasAbility(FirstStrikeAbility));
    target.takeDamage(this, this.power, true, !this.hasAbility(DoubleStrikeAbility) && !target.hasAbility(FirstStrikeAbility));
  }
  takeDamage(source: Card | Permanent, amount: number | (() => number), combat = false, destroy?: boolean) {
    ApplyHooks(TakeDamageHook, (that, source, amount, combat, destroy) => {
      if (!(that instanceof Creature)) return;
      if (destroy == undefined) destroy = !combat;
      let a = typeof amount == "number" ? amount : amount();
      that.damage += a;
      if (destroy && that.damage >= that.toughness) that.destroy();
    }, this, source, amount, combat, destroy);
  }
  removeDamage(amount: number = Infinity) {
    this.damage = Math.max(0, this.damage - amount);
  }
}

export class Emblem extends Permanent {
  constructor(name: string, text: string, abilities: Ability | Ability[]) {
    super(new PermanentCard(name, ["Emblem"], text, undefined, abilities));
  }
}

export class Planeswalker extends Permanent {
  constructor(card: PlaneswalkerCard) {
    super(card);
    this.counters["loyalty"] = card.startingLoyalty;
  }
  get loyalty() {
    return this.counters["loyalty"];
  }
  set loyalty(value: number) {
    let v = Math.max(0, value);
    this.counters["loyalty"] = v;
  }
  takeDamage(source: Card | Permanent, amount: number | (() => number), combat = false, destroy?: boolean) {
    ApplyHooks(TakeDamageHook, (that, source, amount, combat, destroy) => {
      if (!(that instanceof Planeswalker)) return;
      if (destroy == undefined) destroy = !combat;
      let a = typeof amount == "number" ? amount : amount();
      that.loyalty -= a;
      if (that.loyalty <= 0 && destroy) that.destroy();
    }, this, source, amount, combat, destroy);
  }
}