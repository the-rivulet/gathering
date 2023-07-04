import { Card, PermanentCard, CreatureCard, AuraCard, SpellCard } from "./card.js";
import { Mana } from "./mana.js";
import { Creature, Permanent } from "./permanent.js";
import { Battlefield, TurnManager, StackManager } from "./globals.js";
import { StackCard } from "./stack.js";
import { ApplyHooks, HasValidTargetsHook, PlayCardHook, CheckTargetsHook } from "./hook.js";
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
  constructor(card: Card, validate: (t: any[]) => boolean, possible: (field: Permanent[]) => boolean, message: string, continuation: (result: any) => any) {
    this.card = card;
    this.baseValidate = validate;
    this.basePossible = possible;
    this.message = message;
    this.continuation = continuation;
  }
  possible(field: Permanent[]): boolean {
    return ApplyHooks(x => x instanceof HasValidTargetsHook, function (that: SelectionData, field: Permanent[]) {
      return that.basePossible(field);
    }, this, field);
  }
  validate(t: any[]): boolean {
    return ApplyHooks(x => x instanceof CheckTargetsHook, function (that: SelectionData, t: any[]) {
      return that.baseValidate(t);
    }, this, t);
  }
}

export class Player {
  uuid = Math.random();
  name: string;
  manaPool = new Mana();
  deck: Card[] = [];
  zones = new ZoneManager();
  landPlays = 1;
  startingLifeTotal = 20;
  lifeTotal = 20;
  timesTempted = 0;
  ringBearer: Creature;
  selectionData?: SelectionData;
  passedPriority = false;
  endedPhase = false;
  endedTurn = false;
  constructor(name: string, deck: Card[], life = 20) {
    this.name = name;
    this.deck = deck;
    for (let i of deck) {
      this.createNewCard(i, Zone.library);
    }
    this.startingLifeTotal = life;
    this.lifeTotal = life;
  }
  createNewCard(c: Card, zone = Zone.limbo, clone = false) {
    let card = clone ? c.makeEquivalentCopy() : c;
    this.zones[zone].push(card);
    card.zone = zone;
    card.owner = this;
    return card;
  }
  moveCardTo(card: Card, to: Zone) {
    if (card.zone == to) return false;
    if (card.owner != this) return false;
    if (this.zones[card.zone] && !this.zones[card.zone].includes(card))
      throw new Error('Card is not in expected zone!');
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
    UI.renderBattlefield();
    return true;
  }
  selectTargets(card: Card = undefined, validate: (t: any[]) => boolean, possible: () => boolean, message: string, continuation: (result: any) => any) {
    if (!possible()) return;
    this.selectionData = new SelectionData(card, validate, possible, message, continuation);
    UI.selectTargets(this);
  }
  playLand(card: Card, free = false, auto = false) {
    if (!card.landPlayable(this, auto, free)) return false;
    if (!free) this.landPlays--;
    this.moveCardTo(card, Zone.battlefield);
    return true;
  }
  castPermanent(card: PermanentCard, free = false, auto = false) {
    if (!card.castable(this, auto, free)) return false;
    if (!free) this.manaPool.pay(card);
    //TriggerEffects(Events.onCardCast, { player: this, card: card });
    StackManager.add(new StackCard(card));
    this.moveCardTo(card, Zone.stack);
    UI.renderStack();
    return true;
  }
  async castSpell(card: SpellCard, forceTargets?: any[], free = false, auto = false) {
    if (!card.castable(this, auto, free)) return false;
    if (!card.possible(card, Battlefield)) return false;
    let doIt = (targets: any[]) => {
      if (!card.validate(card, targets)) {
        this.moveCardTo(card, Zone.graveyard);
        return false;
      }
      card.controller = this;
      StackManager.add(new StackCard(card, targets));
      UI.renderStack();
      return true;
    }
    if (!free) this.manaPool.pay(card);
    this.moveCardTo(card, Zone.stack);
    if (forceTargets) return doIt(forceTargets);
    else {
      this.selectTargets(
        card,
        t => card.validate(card, t),
        () => card.possible(card, Battlefield),
        "Select the spell's targets",
        doIt
      );
      return true;
    }
  }
  async castAura(card: AuraCard, forceTarget?: Permanent | Player, free = false, auto = false) {
    if (!card.castable(this, auto, free) || !card.possible(card, Battlefield))
      return false;
    let doIt = (targets: any[]) => {
      if (!card.validate(card, targets[0])) {
        this.moveCardTo(card, Zone.graveyard);
        return false;
      }
      StackManager.add(new StackCard(card, targets));
      UI.renderStack();
      return true;
    }
    if (!free) this.manaPool.pay(card);
    this.moveCardTo(card, Zone.stack);
    if (forceTarget) return doIt([forceTarget]);
    else {
      this.selectTargets(
        card,
        t => t.length == 1 && card.validate(card, t[0]),
        () => card.possible(card, Battlefield),
        "Select the aura's targets",
        doIt
      );
      return true;
    }
  }
  async play(card: Card, free = false, noCheck = false, forceTargets?: any[]) {
    ApplyHooks(x => x instanceof PlayCardHook, (that: Player, card: Card, free: boolean, noCheck: boolean, forceTargets: any[]) => {
      console.log("Playing " + card.name + ".");
      if (card.types.includes('Land')) return that.playLand(card, free, noCheck);
      else if (card instanceof AuraCard)
        return that.castAura(card, forceTargets ? forceTargets[0] : undefined, free, noCheck);
      else if (card instanceof PermanentCard)
        return that.castPermanent(card, free, noCheck);
      else if (card instanceof SpellCard)
        return that.castSpell(card, forceTargets, free, noCheck);
      return false;
    }, this, card, free, noCheck, forceTargets);
  }
  async getConfirmation() {
    return true;
  }
  createToken(card: PermanentCard) {
    // Cannot just create the card on the battlefield, it needs to trigger move effects
    this.createNewCard(card);
    this.moveCardTo(card, Zone.battlefield);
  }
  resolve(card: Card, targets: any[] = []) {
    if (card instanceof AuraCard) {
      if (targets.length == 1 && card.validate(card, targets[0])) {
        card.attached = targets[0]; this.moveCardTo(card, Zone.battlefield);
      } else {
        this.moveCardTo(card, Zone.graveyard); // fizzle
      }
    }
    else if (card instanceof PermanentCard) { this.moveCardTo(card, Zone.battlefield); }
    else if (card instanceof SpellCard) { card.resolve(card, targets); this.moveCardTo(card, Zone.graveyard); }
  }
  markAsAttacker(card: Creature, real = true) {
    if (card.controller != this || TurnManager.step != Step.declare_attackers || TurnManager.currentPlayer != this || card.attacking) return false;
    if (!new TapCost().pay(card, false)) return false;
    if (real) card.attacking = true;
    return true;
  }
  unmarkAsAttacker(card: Creature, real = true) {
    if (card.controller != this || TurnManager.step != Step.declare_attackers || TurnManager.currentPlayer != this || !card.attacking) return false;
    if (real) card.attacking = false;
    return true;
  }
  get attackers() {
    return (Battlefield.filter(x => x instanceof Creature && x.attacking && x.controller == this) as Creature[]);
  }
  markAsBlocker(card: Creature, blocking?: Creature) {
    if (blocking && (blocking.controller == this || !blocking.attacking)) return false;
    if (card.controller != this || TurnManager.step != Step.declare_blockers || TurnManager.defendingPlayer != this || card.tapped) return false;
    if (card.blocking.length) return false; // TODO: make this its own function and add a hook
    if (blocking) card.blocking.push(blocking);
    return true;
  }
  unmarkAsBlocker(card: Creature, blocking?: Creature) {
    if (card.controller != this || TurnManager.step != Step.declare_blockers || TurnManager.defendingPlayer != this) return false;
    if (!blocking && (blocking.controller == this || !card.blocking.includes(blocking))) return false;
    if (blocking) card.blocking.splice(card.blocking.indexOf(blocking), 1);
    return true;
  }
  takeDamage(source: Card | Permanent, amount: number | (() => number), combat = false) {
    let a = typeof amount == 'number' ? amount : amount();
    this.lifeTotal -= a;
  }
  drawCard(amount = 1) {
    for (let i = 0; i < amount; i++) {
      if (!this.zones.library.length) return false;
      this.moveCardTo(this.zones.library[0], Zone.hand);
    }
    return true;
  }
  async getColor(): Promise<'white' | 'blue' | 'black' | 'red' | 'green'> {
    return 'white';
  }
  async chooseOptions(descriptions: string[], howMany = 1) {
    return descriptions.slice(0, howMany);
  }
}

