import { PermanentCard, CreatureCard, AuraCard, SpellCard } from "./card.js";
import { Mana } from "./mana.js";
import { Creature, Permanent } from "./permanent.js";
import { Battlefield, TurnManager, StackManager } from "./globals.js";
import { StackCard } from "./stack.js";
import { ApplyHooks, PlayCardHook } from "./hook.js";
import { TapCost } from "./cost.js";
import { ZoneManager, Zone } from "./zone.js";
import { Step } from "./turn.js";
import { UI } from "./ui.js";
export class SelectionData {
    card;
    validate;
    possible;
    message;
    continuation;
    constructor(card, validate, possible, message, continuation) {
        this.card = card;
        this.validate = validate;
        this.possible = possible;
        this.message = message;
        this.continuation = continuation;
    }
}
export class Player {
    uuid = Math.random();
    name;
    manaPool = new Mana();
    deck = [];
    zones = new ZoneManager();
    landPlays = 1;
    lifeTotal = 20;
    timesTempted = 0;
    ringBearer;
    selectionData;
    passedPriority = false;
    endedPhase = false;
    endedTurn = false;
    constructor(name, deck, life) {
        this.name = name;
        this.deck = deck;
        for (let i of deck) {
            this.createNewCard(i, Zone.library);
        }
        if (life)
            this.lifeTotal = life;
    }
    createNewCard(c, zone = Zone.limbo, clone = false) {
        let card = clone ? c.makeEquivalentCopy() : c;
        this.zones[zone].push(card);
        card.zone = zone;
        card.owner = this;
        return card;
    }
    moveCardTo(card, to) {
        if (card.zone == to)
            return false;
        if (card.owner != this)
            return false;
        if (this.zones[card.zone] && !this.zones[card.zone].includes(card))
            throw new Error('Card is not in expected zone!');
        this.zones[card.zone]?.splice(this.zones[card.zone].indexOf(card), 1);
        this.zones[to]?.push(card);
        card.zone = to;
        if (card instanceof PermanentCard) {
            if (card.representedPermanent && to != Zone.battlefield)
                card.representedPermanent.destroy();
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
    selectTargets(card = undefined, validate, possible, message, continuation) {
        if (!possible())
            return;
        this.selectionData = new SelectionData(card, validate, possible, message, continuation);
        UI.selectTargets(this);
    }
    playLand(card, free = false, auto = false) {
        if (!card.landPlayable(this, auto, free))
            return false;
        if (!free)
            this.landPlays--;
        this.moveCardTo(card, Zone.battlefield);
        return true;
    }
    castPermanent(card, free = false, auto = false) {
        if (!card.castable(this, auto, free))
            return false;
        if (!free)
            this.manaPool.pay(card);
        //TriggerEffects(Events.onCardCast, { player: this, card: card });
        StackManager.add(new StackCard(card));
        this.moveCardTo(card, Zone.stack);
        return true;
    }
    async castSpell(card, forceTargets, free = false, auto = false) {
        if (!card.castable(this, auto, free))
            return false;
        if (!card.possible(this, card))
            return false;
        let doIt = (targets) => {
            if (!card.castable(this, auto, free) || !card.validate(targets))
                return false;
            if (!free)
                this.manaPool.pay(card);
            card.controller = this;
            //TriggerEffects(Events.onCardCast, { player: this, card: card });
            StackManager.add(new StackCard(card, targets));
            this.moveCardTo(card, Zone.stack);
            return true;
        };
        if (forceTargets)
            return doIt(forceTargets);
        else {
            this.selectTargets(card, card.validate, () => card.possible(this, card), "Select the spell's targets", doIt);
            return true;
        }
    }
    async castAura(card, forceTarget, free = false, auto = false) {
        if (!card.castable(this, auto, free) || !card.possible())
            return false;
        let doIt = (targets) => {
            if (!card.castable(this, auto, free) || !card.validate(targets[0]))
                return false;
            if (!free)
                this.manaPool.pay(card);
            StackManager.add(new StackCard(card, targets));
            return true;
        };
        if (forceTarget)
            return doIt([forceTarget]);
        else {
            this.selectTargets(card, t => t.length == 1 && card.validate(t[0]), card.possible, "Select the aura's targets", doIt);
            return true;
        }
    }
    async play(card, free = false, noCheck = false, forceTargets) {
        ApplyHooks(x => x instanceof PlayCardHook, (that, card, free, noCheck, forceTargets) => {
            console.log("Playing " + card.name + ".");
            if (card.types.includes('Land'))
                return that.playLand(card, free, noCheck);
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
    createToken(card) {
        // Cannot just create the card on the battlefield, it needs to trigger move effects
        this.createNewCard(card);
        this.moveCardTo(card, Zone.battlefield);
    }
    resolve(card, targets = []) {
        if (card instanceof AuraCard) {
            if (targets.length == 1 && card.validate(targets[0])) {
                card.attached = targets[0];
                this.moveCardTo(card, Zone.battlefield);
            }
            else {
                this.moveCardTo(card, Zone.graveyard); // fizzle
            }
        }
        else if (card instanceof PermanentCard) {
            this.moveCardTo(card, Zone.battlefield);
        }
        else if (card instanceof SpellCard) {
            card.resolve(card, targets);
            this.moveCardTo(card, Zone.graveyard);
        }
    }
    markAsAttacker(card) {
        if (card.controller != this || TurnManager.step != Step.declare_attackers || TurnManager.currentPlayer != this || card.attacking)
            return false;
        if (!new TapCost().pay(card, false))
            return false;
        card.attacking = true;
        return true;
    }
    unmarkAsAttacker(card) {
        if (card.controller != this || TurnManager.step != Step.declare_attackers || TurnManager.currentPlayer != this || !card.attacking)
            return false;
        card.attacking = false;
        return true;
    }
    get attackers() {
        return Battlefield.filter(x => x instanceof Creature && x.attacking && x.controller == this);
    }
    markAsBlocker(card, blocking) {
        if (blocking.controller == this || card.controller != this || TurnManager.step != Step.declare_blockers || TurnManager.defendingPlayer != this || !blocking.attacking || card.tapped)
            return false;
        if (card.blocking.length)
            return false;
        card.blocking.push(blocking);
        return true;
    }
    unmarkAsBlocker(card, blocking) {
        if (blocking.controller == this || card.controller != this || TurnManager.step != Step.declare_blockers || TurnManager.defendingPlayer != this || !card.blocking.includes(blocking))
            return false;
        card.blocking.splice(card.blocking.indexOf(blocking), 1);
        return true;
    }
    takeDamage(source, amount, combat = false) {
        let a = typeof amount == 'number' ? amount : amount();
        this.lifeTotal -= a;
    }
    drawCard(amount = 1) {
        for (let i = 0; i < amount; i++) {
            if (!this.zones.library.length)
                return false;
            this.moveCardTo(this.zones.library[0], Zone.hand);
        }
        return true;
    }
    async getColor() {
        return 'white';
    }
    async chooseOptions(descriptions, howMany = 1) {
        return descriptions.slice(0, howMany);
    }
}
