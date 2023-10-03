import { Card, PermanentCard, CreatureCard, AuraCard, SpellCard, SplitSpellCard } from "./card.js";
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
    constructor(name, deck, life = 20, shuffleDeck = true) {
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
    moveCardTo(card, to, render = true) {
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
        if (render)
            UI.renderBattlefield();
        return true;
    }
    get uiElement() {
        return UI.getId("playerinfo" + TurnManager.playerList.indexOf(this));
    }
    /**
     * feel free to pass `undefined` to `casting` if you aren't casting a card, idk why I put it as the first argument lol
     */
    selectTargets(casting, validate, possible, message, continuation) {
        return ApplyHooks(SelectTargetsHook, (that, casting, validate, possible, message, continuation, limitOne) => {
            if (!possible())
                return false;
            that.selectionData = new SelectionData(casting, validate, possible, message, continuation, limitOne);
            UI.selectTargets(that);
            return true;
        }, this, casting, validate, possible, message, continuation, false);
    }
    selectSingleTarget(casting, validate, possible, message, continuation) {
        let targetType;
        let v = targets => targets.length == 1 && targets[0] instanceof targetType && validate(targets[0]);
        let c = result => continuation(result[0]);
        return ApplyHooks(SelectTargetsHook, (that, casting, validate, possible, message, continuation, limitOne) => {
            if (!possible())
                return false;
            that.selectionData = new SelectionData(casting, validate, possible, message, continuation, limitOne);
            UI.selectTargets(that);
            return true;
        }, this, casting, v, possible, message, c, true);
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
        StackManager.add({ card: card });
        this.moveCardTo(card, Zone.stack);
        UI.renderStack();
        return true;
    }
    castSpell(card, free = false, auto = false) {
        if (!card.castable(this, auto, free) || !card.possible(card, Battlefield))
            return false;
        let doIt = (targets) => {
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
        if (!free)
            this.manaPool.pay(card, this);
        this.moveCardTo(card, (card.partOf ? Zone.limbo : Zone.stack));
        this.selectTargets(card, t => card.validate(card, t), () => card.possible(card, Battlefield), "Select the spell's targets", doIt);
        return true;
    }
    castAura(card, free = false, auto = false) {
        if (!card.castable(this, auto, free) || !card.possible(card, Battlefield))
            return false;
        let doIt = (target) => {
            if (!card.validate(card, target)) {
                this.moveCardTo(card, Zone.graveyard);
                return false;
            }
            StackManager.add({ card: card, targets: [target] });
            this.moveCardTo(card, Zone.stack);
            UI.renderStack();
            return true;
        };
        if (!free)
            this.manaPool.pay(card, this);
        this.moveCardTo(card, Zone.stack);
        this.selectSingleTarget(card, t => card.validate(card, t), () => card.possible(card, Battlefield), "Select the aura's targets", doIt);
        return true;
    }
    castSplitSpell(card, free = false, auto = false) {
        if (!card.castable(this, auto, free))
            return false;
        let wm = card.parts.filter((x, i) => card.partIsCastable(i, this, auto, free));
        if (!wm.length)
            return false;
        let doIt = (modes) => {
            let cards = modes.map(x => card.parts[x]);
            if (cards.filter((x, i) => !(card.partIsCastable(i, this, auto, free) && x.possible(x, Battlefield))).length)
                return false;
            card.cardsToCast = modes;
            let targets = [];
            let select = function (i, pl) {
                let c = cards[i];
                alert("Paying mana: " + c.manaCost.asString);
                if (!free)
                    pl.manaPool.pay(c, pl);
                pl.selectTargets(undefined, t => c.validate(c, t), () => c.possible(c, Battlefield), "Select targets for mode: " + c.name, function (result) {
                    if (i + 1 == modes.length) {
                        alert("Selected targets for all modes.");
                        // Add it to the targets list
                        targets.push(result);
                        // That was the last card, now play it for real
                        StackManager.add({ card: card, targets: targets });
                        pl.moveCardTo(card, Zone.stack);
                        UI.renderStack();
                    }
                    else {
                        alert("Finished selection for card " + (i + 1) + " / " + modes.length);
                        // Add it to the targets list
                        targets.push(result);
                        // Continue the selection
                        select(i + 1, pl);
                    }
                });
            };
            select(0, this);
            return true;
        };
        this.chooseOptions(card.parts.filter(x => wm.includes(x)).map(x => x.name), (card.fuse ? x => x >= 1 : 1), "Choose a part to cast", doIt);
        return true;
    }
    play(card, free = false, auto = false) {
        ApplyHooks(PlayCardHook, (that, card, free, auto) => {
            if (card.hasType("Land") && card instanceof PermanentCard)
                return that.playLand(card, free, auto);
            else if (card instanceof AuraCard)
                return that.castAura(card, free, auto);
            else if (card instanceof PermanentCard)
                return that.castPermanent(card, free, auto);
            else if (card instanceof SplitSpellCard)
                return that.castSplitSpell(card, free, auto);
            else if (card instanceof SpellCard)
                return that.castSpell(card, free, auto);
            return false;
        }, this, card, free, auto);
    }
    createToken(card) {
        // Cannot just create the card on the battlefield, it needs to trigger move effects
        this.createNewCard(card);
        this.moveCardTo(card, Zone.battlefield);
    }
    resolve(card, targets = []) {
        ApplyHooks(ResolveCardHook, (that, card, targets) => {
            alert("Card is resolving");
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
            else if (card instanceof SplitSpellCard) {
                alert("SSC is resolving with CTC=" + card.cardsToCast);
                for (let i of card.cardsToCast) {
                    alert(card.parts[i].name);
                    // TODO: Why did this do "undefined"?
                    alert("Resolving mode #" + i + " (" + card.parts[i].name + ") with targets " + targets[i].map(x => x instanceof Card ? x.name : x));
                    card.parts[i].resolve(card.parts[i], targets[i]);
                    alert("Done.");
                }
                that.moveCardTo(card, card.zoneWhenFinished(that, targets.flat()));
            }
            else if (card instanceof SpellCard) {
                card.resolve(card, targets);
                that.moveCardTo(card, card.zoneWhenFinished(that, targets));
            }
        }, this, card, targets);
    }
    markAsAttacker(card, attacking, real = true) {
        if (!card.controller.is(this) || TurnManager.step != Step.declare_attackers || !TurnManager.currentPlayer.is(this) || card.attacking || !new TapCost().pay(card, false))
            return false;
        if (real)
            card.attacking = attacking;
        return true;
    }
    unmarkAsAttacker(card, real = true) {
        if (!card.controller.is(this) || TurnManager.step != Step.declare_attackers || !TurnManager.currentPlayer.is(this) || !card.attacking)
            return false;
        if (real)
            card.attacking = undefined;
        return true;
    }
    get attackers() {
        return Battlefield.filter(x => x instanceof Creature && x.attacking && this.is(x.controller));
    }
    markAsBlocker(card, blocking, real = true) {
        return ApplyHooks(MarkAsBlockerHook, (that, card, blocking, real) => {
            if ((blocking && (that.is(blocking.controller) || !blocking.attacking || card.blocking.includes(blocking))) || !card.controller.is(that) || TurnManager.step != Step.declare_blockers || !blocking.defendingPlayer.is(that) || card.tapped || card.blocking.length)
                return false;
            if (blocking && real)
                card.blocking.push(blocking);
            return true;
        }, this, card, blocking, real);
    }
    unmarkAsBlocker(card, blocking, real = true) {
        if ((blocking && (this.is(blocking.controller) || !blocking.attacking || !card.blocking.includes(blocking))) || !card.controller.is(this) || TurnManager.step != Step.declare_blockers || !blocking.defendingPlayer.is(this))
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
            that.lifeTotal -= a;
        }, this, source, amount, combat, false);
    }
    drawCard(amount = 1) {
        if (!amount)
            return true;
        for (let i = 0; i < amount; i++) {
            if (!this.zones.library.length)
                return false;
            this.moveCardTo(this.zones.library[0], Zone.hand, false);
        }
        UI.renderBattlefield();
        return true;
    }
    getConfirmation(message, continuation) {
        UI.chooseOptions(this, ["Yes", "No"], 1, message, result => continuation(result[0] == 0));
    }
    getColor(message, continuation) {
        UI.chooseOptions(this, Object.keys(Color).map(x => new ManaPool({ [x]: 1 }).asHTML + " " + x), 1, message, result => continuation(Color[result[0]]));
    }
    chooseOptions(descriptions, howMany, message, continuation) {
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
        this.lifeTotal += a;
    }
}
