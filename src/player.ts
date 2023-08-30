import { Card, PermanentCard, CreatureCard, AuraCard, SpellCard, SplitSpellCard } from "./card.js";
import { ManaPool, SimpleManaObject, Color } from "./mana.js";
import { Creature, Permanent, Planeswalker } from "./permanent.js";
import { Battlefield, TurnManager, StackManager } from "./globals.js";
import { ApplyHooks, HasValidTargetsHook, PlayCardHook, CheckTargetsHook, MarkAsBlockerHook, SelectTargetsHook, ResolveCardHook, TakeDamageHook } from "./hook.js";
import { TapCost } from "./cost.js";
import { ZoneManager, Zone } from "./zone.js";
import { Step } from "./turn.js";
import { UI } from "./ui.js";

export class SelectionData {
  card?: Card;
  baseValidate: (t: any[]) => boolean;
  basePossible: (field: Permanent[]) => boolean;
  message: string;
  continuation: (result: any) => any;
  limitOne: boolean;
  constructor(card: Card, validate: (t: any[]) => boolean, possible: (field: Permanent[]) => boolean, message: string, continuation: (result: any) => any, limitOne = false) {
    this.card = card;
    this.baseValidate = validate;
    this.basePossible = possible;
    this.message = message;
    this.continuation = continuation;
    this.limitOne = limitOne;
  }
  possible(field: Permanent[]): boolean {
    return ApplyHooks(HasValidTargetsHook, function (that: SelectionData, field) {
      return that.basePossible(field);
    }, this, field);
  }
  validate(t: any[]): boolean {
    return ApplyHooks(CheckTargetsHook, function (that: SelectionData, t) {
      return that.baseValidate(t);
    }, this, t);
  }
}

export class Player {
  uuid = Math.random();
  name: string;
  manaPool: ManaPool = new ManaPool();
  deck: Card[] = [];
  zones = new ZoneManager();
  landPlays = 1;
  startingLifeTotal = 20;
  lifeTotal = 20;
  timesTempted = 0;
  ringBearer: Creature;
  selectionData?: SelectionData;
  choosing = false;
  constructor(name: string, deck: Card[], life = 20, shuffleDeck = true) {
    this.name = name;
    this.deck = deck;
    for (let i of deck) {
      this.createNewCard(i, Zone.library);
    }
    // Shuffle
    if (shuffleDeck) {
      let arr = this.zones.library, ci = arr.length, ri;
      while (ci != 0) {
        ri = Math.floor(Math.random() * ci);
        ci--;
        [arr[ci], arr[ri]] = [arr[ri], arr[ci]];
      }
    }
    this.startingLifeTotal = life;
    this.lifeTotal = life;
  }
  is(player: Player) {
    return this.uuid == player.uuid;
  }
  createNewCard(c: Card, zone = Zone.limbo, clone = false) {
    let card = clone ? c.makeEquivalentCopy() : c;
    this.zones[zone].push(card);
    card.zone = zone;
    card.owner = this;
    return card;
  }
  moveCardTo(card: Card, to: Zone, render = true) {
    if (card.zone == to) return false;
    if (card.owner != this) return false;
    if (this.zones[card.zone] && !this.zones[card.zone].includes(card))
      throw new Error("Card is not in expected zone!");
    this.zones[card.zone]?.splice(this.zones[card.zone].indexOf(card), 1);
    this.zones[to]?.push(card);
    card.zone = to;
    if (card instanceof PermanentCard) {
      if (card.representedPermanent && to != Zone.battlefield) card.representedPermanent.destroy();
      if (to == Zone.battlefield) {
        card.representedPermanent =
          card instanceof CreatureCard
            ? new Creature(card)
            : new Permanent(card);
      }
    }
    // Update the UI to reflect the change
    if (render) UI.renderBattlefield();
    return true;
  }
  get uiElement() {
    return UI.getId("playerinfo" + TurnManager.playerList.indexOf(this));
  }
  /**
   * feel free to pass `undefined` to `casting` if you aren't casting a card, idk why I put it as the first argument lol
   */
  selectTargets(casting: Card, validate: (t: any[]) => boolean, possible: () => boolean, message: string, continuation: (result: any[]) => void) {
    return ApplyHooks(SelectTargetsHook, (that, casting, validate, possible, message, continuation, limitOne) => {
      if (!possible()) return false;
      that.selectionData = new SelectionData(casting, validate, possible, message, continuation, limitOne);
      UI.selectTargets(that);
      return true;
    }, this, casting, validate, possible, message, continuation, false);
  }
  selectSingleTarget<T>(casting: Card, validate: (t: T) => boolean, possible: () => boolean, message: string, continuation: (result: T) => void) {
    let targetType: new (...args: any) => T;
    let v = targets => targets.length == 1 && targets[0] instanceof targetType && validate(targets[0]);
    let c = result => continuation(result[0]);
    return ApplyHooks(SelectTargetsHook, (that, casting, validate, possible, message, continuation, limitOne) => {
      if (!possible()) return false;
      that.selectionData = new SelectionData(casting, validate, possible, message, continuation, limitOne);
      UI.selectTargets(that);
      return true;
    }, this, casting, v, possible, message, c, true);
  }
  playLand(card: PermanentCard, free = false, auto = false) {
    if (!card.landPlayable(this, auto, free)) return false;
    if (!free) this.landPlays--;
    this.moveCardTo(card, Zone.battlefield);
    return true;
  }
  castPermanent(card: PermanentCard, free = false, auto = false) {
    if (!card.castable(this, auto, free)) return false;
    if (!free) this.manaPool.pay(card, this);
    StackManager.add({ card: card });
    this.moveCardTo(card, Zone.stack);
    UI.renderStack();
    return true;
  }
  castSpell(card: SpellCard, forceTargets?: any[], free = false, auto = false) {
    if (!card.castable(this, auto, free) || !card.possible(card, Battlefield)) return false;
    let doIt = (targets: any[]) => {
      if (!card.validate(card, targets)) {
        this.moveCardTo(card, Zone.graveyard);
        return false;
      }
      card.controller = this;
      StackManager.add({ card: card, targets: targets });
      this.moveCardTo(card, Zone.stack);
      UI.renderStack();
      return true;
    };
    if (!free) this.manaPool.pay(card, this);
    this.moveCardTo(card, (card.partOf ? Zone.limbo : Zone.stack));
    if (forceTargets) return doIt(forceTargets);
    else {
      this.selectTargets(card, t => card.validate(card, t), () => card.possible(card, Battlefield), "Select the spell's targets", doIt);
      return true;
    }
  }
  castAura(card: AuraCard, forceTarget?: Permanent | Player, free = false, auto = false) {
    if (!card.castable(this, auto, free) || !card.possible(card, Battlefield)) return false;
    let doIt = (target: Permanent | Player) => {
      if (!card.validate(card, target)) {
        this.moveCardTo(card, Zone.graveyard);
        return false;
      }
      StackManager.add({ card: card, targets: [target] });
      this.moveCardTo(card, Zone.stack);
      UI.renderStack();
      return true;
    };
    if (!free) this.manaPool.pay(card, this);
    this.moveCardTo(card, Zone.stack);
    if (forceTarget) return doIt(forceTarget);
    else {
      this.selectSingleTarget(card, t => card.validate(card, t), () => card.possible(card, Battlefield), "Select the aura's targets", doIt);
      return true;
    }
  }
  castSplitSpell(card: SplitSpellCard, forceModes?: number[] | number, free = false, auto = false) {
    if (!card.castable(this, auto, free)) return false;
    let fm = (typeof forceModes == "number" ? [forceModes] : forceModes);
    let wm = card.parts.filter(x => x.castable(this, auto, free) && x.possible(x, Battlefield));
    if (fm && fm.filter(x => !wm.includes(card.parts[x])).length) return false;
    let doIt = (modes: number[]) => {
      let cards = modes.map(x => card.parts[x]);
      if (cards.filter(x => !x.castable(this, auto, free) || !x.possible(x, Battlefield)).length) return false;
      this.moveCardTo(card, Zone.limbo);
      for (let i of cards) {
        this.createNewCard(i);
        this.play(i);
      }
      this.moveCardTo(card, Zone.stack);
      return true;
    };
    if (fm) return doIt(fm);
    else {
      this.chooseOptions(card.parts.map(x => x.name), (card.fuse ? x => x >= 1 : 1), "Choose a part to cast", doIt);
      return true;
    }
  }
  play(card: Card, free = false, noCheck = false, forceTargets?: any[]) {
    ApplyHooks(PlayCardHook, (that, card, free, noCheck, forceTargets) => {
      if (card.hasType("Land") && card instanceof PermanentCard) return that.playLand(card, free, noCheck);
      else if (card instanceof AuraCard)
        return that.castAura(card, forceTargets ? forceTargets[0] : undefined, free, noCheck);
      else if (card instanceof PermanentCard)
        return that.castPermanent(card, free, noCheck);
      else if (card instanceof SpellCard)
        return that.castSpell(card, forceTargets, free, noCheck);
      return false;
    }, this, card, free, noCheck, forceTargets);
  }
  createToken(card: PermanentCard) {
    // Cannot just create the card on the battlefield, it needs to trigger move effects
    this.createNewCard(card);
    this.moveCardTo(card, Zone.battlefield);
  }
  resolve(card: Card, targets: any[] = []) {
    ApplyHooks(ResolveCardHook, (that, card, targets) => {
      if (card instanceof AuraCard) {
        if (targets.length == 1 && card.validate(card, targets[0])) {
          card.attached = targets[0]; that.moveCardTo(card, Zone.battlefield);
        } else {
          that.moveCardTo(card, Zone.graveyard); // fizzle
        }
      }
      else if (card instanceof PermanentCard) { that.moveCardTo(card, Zone.battlefield); }
      else if (card instanceof SpellCard) {
        card.resolve(card, targets);
        let zwf = card.zoneWhenFinished(that, targets);
        if (card.partOf) {
          that.moveCardTo(card.partOf, zwf);
          card.destroy();
        } else that.moveCardTo(card, zwf);
      }
    }, this, card, targets);
  }
  markAsAttacker(card: Creature, attacking: Player | Planeswalker, real = true) {
    if (!card.controller.is(this) || TurnManager.step != Step.declare_attackers || !TurnManager.currentPlayer.is(this) || card.attacking || !new TapCost().pay(card, false)) return false;
    if (real) card.attacking = attacking;
    return true;
  }
  unmarkAsAttacker(card: Creature, real = true) {
    if (!card.controller.is(this) || TurnManager.step != Step.declare_attackers || !TurnManager.currentPlayer.is(this) || !card.attacking) return false;
    if (real) card.attacking = undefined;
    return true;
  }
  get attackers() {
    return (Battlefield.filter(x => x instanceof Creature && x.attacking && this.is(x.controller)) as Creature[]);
  }
  markAsBlocker(card: Creature, blocking?: Creature, real = true) {
    return ApplyHooks(MarkAsBlockerHook, (that, card, blocking, real) => {
      if ((blocking && (that.is(blocking.controller) || !blocking.attacking || card.blocking.includes(blocking))) || !card.controller.is(that) || TurnManager.step != Step.declare_blockers || !blocking.defendingPlayer.is(that) || card.tapped || card.blocking.length) return false;
      if (blocking && real) card.blocking.push(blocking);
      return true;
    }, this, card, blocking, real);
  }
  unmarkAsBlocker(card: Creature, blocking?: Creature, real = true) {
    if ((blocking && (this.is(blocking.controller) || !blocking.attacking || !card.blocking.includes(blocking))) || !card.controller.is(this) || TurnManager.step != Step.declare_blockers || !blocking.defendingPlayer.is(this)) return false;
    if (blocking && real) card.blocking.splice(card.blocking.indexOf(blocking), 1);
    return true;
  }
  takeDamage(source: Card | Permanent, amount: number | (() => number), combat = false) {
    ApplyHooks(TakeDamageHook, (that, source, amount, combat, destroy) => {
      if (!(that instanceof Player)) return;
      let a = typeof amount == "number" ? amount : amount();
      that.lifeTotal -= a;
    }, this, source, amount, combat, false);
  }
  drawCard(amount = 1) {
    if (!amount) return true;
    for (let i = 0; i < amount; i++) {
      if (!this.zones.library.length) return false;
      this.moveCardTo(this.zones.library[0], Zone.hand, false);
    }
    UI.renderBattlefield();
    return true;
  }
  getConfirmation(message: string, continuation: (result: boolean) => void) {
    UI.chooseOptions(this, ["Yes", "No"], 1, message, result => continuation(result[0] == 0));
  }
  getColor(message: string, continuation: (result: Color) => void) {
    UI.chooseOptions(this, Object.keys(Color).map(x => new ManaPool({ [x]: 1 }).asHTML + " " + x), 1, message, result => continuation(Color[result[0]]));
  }
  chooseOptions(descriptions: string[], howMany: number | ((x: number) => boolean), message: string, continuation: (choices: number[]) => void) {
    UI.chooseOptions(this, descriptions, howMany, message, continuation);
  }
  /**
   * You probably don't need to call this directly, as `ManaPool.pay` will do it for you.
   * Also, keep in mind that this function does not drain the selected mana automatically.
   */
  payComplexCosts(mana: ManaPool, generic: number, choices: SimpleManaObject[][], continuation: (choices: SimpleManaObject, forGeneric: SimpleManaObject) => void) {
    UI.payComplexCosts(this, mana, generic, choices, continuation);
  }
  devotionTo(...colors: Color[]) {
    return colors.map(color => this.zones.battlefield.map(x => x.manaCost.simplified[color]).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0);
  }
  gainLife(source: Card | Permanent, amount: number | (() => number)) {
    let a = typeof amount == "number" ? amount : amount();
    this.lifeTotal += a;
  }
}
