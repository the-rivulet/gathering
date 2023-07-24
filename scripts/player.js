import { PermanentCard, CreatureCard, AuraCard, SpellCard } from "./card.js";
import { ManaPool, Color } from "./mana.js";
import { Creature, Permanent } from "./permanent.js";
import { Battlefield, TurnManager, StackManager } from "./globals.js";
import { ApplyHooks, HasValidTargetsHook, PlayCardHook, CheckTargetsHook, MarkAsBlockerHook, SelectTargetsHook, ResolveCardHook, TakeDamageHook } from "./hook.js";
import { TapCost } from "./cost.js";
import { ZoneManager, Zone } from "./zone.js";
import { Step } from "./turn.js";
import { UI } from "./ui.js";
export class SelectionData {
    card;
    baseValidate;
    basePossible;
    message;
    continuation;
    limitOne;
    constructor(card, validate, possible, message, continuation, limitOne = false) {
        this.card = card;
        this.baseValidate = validate;
        this.basePossible = possible;
        this.message = message;
        this.continuation = continuation;
        this.limitOne = limitOne;
    }
    possible(field) {
        return ApplyHooks(HasValidTargetsHook, function (that, field) {
            return that.basePossible(field);
        }, this, field);
    }
    validate(t) {
        return ApplyHooks(CheckTargetsHook, function (that, t) {
            return that.baseValidate(t);
        }, this, t);
    }
}
export class Player {
    uuid = Math.random();
    name;
    manaPool = new ManaPool();
    deck = [];
    zones = new ZoneManager();
    landPlays = 1;
    startingLifeTotal = 20;
    lifeTotal = 20;
    timesTempted = 0;
    ringBearer;
    selectionData;
    choosing = false;
    constructor(name, deck, life = 20) {
        this.name = name;
        this.deck = deck;
        for (let i of deck) {
            this.createNewCard(i, Zone.library);
        }
        this.startingLifeTotal = life;
        this.lifeTotal = life;
    }
    is(player) {
        return this.uuid == player.uuid;
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
            throw new Error("Card is not in expected zone!");
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
    get uiElement() {
        return UI.getId("playerinfo" + TurnManager.playerList.indexOf(this));
    }
    /**
     * feel free to pass `undefined` to `casting` if you aren't casting a card, idk why I put it as the first argument lol
     */
    selectTargets(casting, validate, possible, message, continuation, limitOne = false) {
        return ApplyHooks(SelectTargetsHook, (that, casting, validate, possible, message, continuation, limitOne) => {
            if (!possible())
                return false;
            that.selectionData = new SelectionData(casting, validate, possible, message, continuation, limitOne);
            UI.selectTargets(that);
            return true;
        }, this, casting, validate, possible, message, continuation, limitOne);
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
            this.manaPool.pay(card, this);
        //TriggerEffects(Events.onCardCast, { player: this, card: card });
        StackManager.add({ card: card });
        this.moveCardTo(card, Zone.stack);
        UI.renderStack();
        return true;
    }
    async castSpell(card, forceTargets, free = false, auto = false) {
        if (!card.castable(this, auto, free))
            return false;
        if (!card.possible(card, Battlefield))
            return false;
        let doIt = (targets) => {
            if (!card.validate(card, targets)) {
                this.moveCardTo(card, Zone.graveyard);
                return false;
            }
            card.controller = this;
            StackManager.add({ card: card, targets: targets });
            UI.renderStack();
            return true;
        };
        if (!free)
            this.manaPool.pay(card, this);
        this.moveCardTo(card, Zone.stack);
        if (forceTargets)
            return doIt(forceTargets);
        else {
            this.selectTargets(card, t => card.validate(card, t), () => card.possible(card, Battlefield), "Select the spell's targets", doIt);
            return true;
        }
    }
    async castAura(card, forceTarget, free = false, auto = false) {
        if (!card.castable(this, auto, free) || !card.possible(card, Battlefield))
            return false;
        let doIt = (targets) => {
            if (!card.validate(card, targets[0])) {
                this.moveCardTo(card, Zone.graveyard);
                return false;
            }
            StackManager.add({ card: card, targets: targets });
            UI.renderStack();
            return true;
        };
        if (!free)
            this.manaPool.pay(card, this);
        this.moveCardTo(card, Zone.stack);
        if (forceTarget)
            return doIt([forceTarget]);
        else {
            this.selectTargets(card, t => t.length == 1 && card.validate(card, t[0]), () => card.possible(card, Battlefield), "Select the aura's targets", doIt, true);
            return true;
        }
    }
    async play(card, free = false, noCheck = false, forceTargets) {
        ApplyHooks(PlayCardHook, (that, card, free, noCheck, forceTargets) => {
            if (card.hasType("Land") && card instanceof PermanentCard)
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
    createToken(card) {
        // Cannot just create the card on the battlefield, it needs to trigger move effects
        this.createNewCard(card);
        this.moveCardTo(card, Zone.battlefield);
    }
    resolve(card, targets = []) {
        ApplyHooks(ResolveCardHook, (that, card, targets) => {
            if (card instanceof AuraCard) {
                if (targets.length == 1 && card.validate(card, targets[0])) {
                    card.attached = targets[0];
                    that.moveCardTo(card, Zone.battlefield);
                }
                else {
                    that.moveCardTo(card, Zone.graveyard); // fizzle
                }
            }
            else if (card instanceof PermanentCard) {
                that.moveCardTo(card, Zone.battlefield);
            }
            else if (card instanceof SpellCard) {
                card.resolve(card, targets);
                that.moveCardTo(card, Zone.graveyard);
            }
        }, this, card, targets);
    }
    markAsAttacker(card, real = true) {
        if (card.controller != this || TurnManager.step != Step.declare_attackers || TurnManager.currentPlayer != this || card.attacking)
            return false;
        if (!new TapCost().pay(card, false))
            return false;
        if (real)
            card.attacking = true;
        return true;
    }
    unmarkAsAttacker(card, real = true) {
        if (card.controller != this || TurnManager.step != Step.declare_attackers || TurnManager.currentPlayer != this || !card.attacking)
            return false;
        if (real)
            card.attacking = false;
        return true;
    }
    get attackers() {
        return Battlefield.filter(x => x instanceof Creature && x.attacking && this.is(x.controller));
    }
    markAsBlocker(card, blocking, real = true) {
        return ApplyHooks(MarkAsBlockerHook, (that, card, blocking, real) => {
            if (blocking && (that.is(blocking.controller) || !blocking.attacking))
                return false;
            if (card.controller != that || TurnManager.step != Step.declare_blockers || TurnManager.defendingPlayer != that || card.tapped)
                return false;
            if (card.blocking.length)
                return false;
            if (blocking && real)
                card.blocking.push(blocking);
            return true;
        }, this, card, blocking, real);
    }
    unmarkAsBlocker(card, blocking, real = true) {
        if (card.controller != this || TurnManager.step != Step.declare_blockers || TurnManager.defendingPlayer != this)
            return false;
        if (!blocking && (this.is(blocking.controller) || !card.blocking.includes(blocking)))
            return false;
        if (blocking && real)
            card.blocking.splice(card.blocking.indexOf(blocking), 1);
        return true;
    }
    takeDamage(source, amount, combat = false) {
        ApplyHooks(TakeDamageHook, (that, source, amount, combat, destroy) => {
            if (!(that instanceof Player))
                return;
            let a = typeof amount == "number" ? amount : amount();
            ;
            that.lifeTotal -= a;
        }, this, source, amount, combat, false);
    }
    drawCard(amount = 1) {
        for (let i = 0; i < amount; i++) {
            if (!this.zones.library.length)
                return false;
            this.moveCardTo(this.zones.library[0], Zone.hand);
        }
        return true;
    }
    getConfirmation(message, continuation) {
        UI.chooseOptions(this, ["Yes", "No"], 1, message, result => continuation(result[0] == 0));
    }
    getColor(message, continuation) {
        UI.chooseOptions(this, Object.keys(Color).map(x => new ManaPool({ [x]: 1 }).asHTML + " " + x), 1, message, result => continuation(Color[result[0]]));
    }
    chooseOptions(descriptions, howMany = 1, message, continuation) {
        UI.chooseOptions(this, descriptions, howMany, message, continuation);
    }
    /**
     * You probably don't need to call this directly, as `ManaPool.pay` will do it for you.
     * Also, keep in mind that this function does not drain the selected mana automatically.
     */
    payComplexCosts(mana, generic, choices, continuation) {
        UI.payComplexCosts(this, mana, generic, choices, continuation);
    }
    devotionTo(...colors) {
        return colors.map(color => this.zones.battlefield.map(x => x.manaCost.simplified[color]).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0);
    }
    gainLife(source, amount) {
        let a = typeof amount == "number" ? amount : amount();
        ;
        this.lifeTotal += a;
    }
}
