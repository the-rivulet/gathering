import { ActivatedAbility } from "./ability.js";
import { AuraCard, PermanentCard, SpellCard, CreatureCard } from "./card.js";
import { TurnManager, Battlefield, StackManager, Settings } from "./globals.js";
import { StackCard, StackEffect } from "./stack.js";
import { Zone } from "./zone.js";
import { Step } from "./turn.js";
let getId = (x) => document.getElementById(x);
let textAsHTML = function (text) {
    let t = text
        .replaceAll(new RegExp("{EC[0-9]+}", "g"), ": ")
        .replaceAll(new RegExp("{E?A[0-9]+}", "g"), "")
        .replaceAll("{T}", "<img src='./assets/" + (Settings.slugcatMana ? "slugcats/touchright.png" : "tap.svg") + "' class='" + (Settings.slugcatMana ? "slugcat" : "symbol") + "'>")
        .replaceAll("{Q}", "<img src='./assets/" + (Settings.slugcatMana ? "slugcats/touchleft.png" : "untap.svg") + "' class='" + (Settings.slugcatMana ? "slugcat" : "symbol") + "'>");
    let colorList = (Settings.slugcatMana ?
        { "G": "saint", "W": "gourmand", "U": "rivulet", "R": "hunter", "B": "nightcat" } :
        { "G": "green", "W": "white", "U": "blue", "R": "red", "B": "black" });
    for (let i of Object.keys(colorList)) {
        t = t.replaceAll("{" + i + "}", "<img src='./assets/" + (Settings.slugcatMana ? "slugcats" : "mana") + "/" + colorList[i] + ".png' class='" + (Settings.slugcatMana ? "slugcat" : "symbol") + "'>");
    }
    for (let i = 0; i <= Settings.highestSymbol; i++) {
        t = t.replaceAll("{" + i + "}", "<img src='./assets/mana/" + i + ".svg' class='symbol'>");
    }
    return t;
};
let mousex, mousey;
function mouse(e) {
    if (e) {
        mousex = e.clientX;
        mousey = e.clientY;
    }
    for (let i of document.getElementsByClassName("tx")) {
        let hi = i;
        hi.style.top = Math.min(20 + mousey, window.innerHeight - hi.clientHeight) + "px";
        hi.style.left = Math.min(20 + mousex, window.innerWidth - 20 - hi.clientWidth) + "px";
    }
}
document.onmousemove = e => mouse(e);
function getHoveredUUID() {
    let tip = Array.from(document.getElementsByClassName("tt")).filter(x => x instanceof HTMLElement && Array.from(x.children).filter(y => y.classList.contains("tx") && y.checkVisibility()).length > 0)[0];
    if (!tip)
        return null;
    else
        return tip.getAttribute("card_uuid");
}
function renderRow(cards, offset, valids = []) {
    for (let card of cards) {
        let i = cards.indexOf(card);
        let tt = document.createElement("span");
        tt.setAttribute("card_uuid", card.uuid.toString());
        tt.innerHTML = card.name.slice(0);
        tt.classList.add("tt", "card");
        if (valids.includes(card))
            tt.classList.add("valid");
        tt.style.left = ((i - (0.5 * (cards.length - 1))) * 10 + 50) + "%";
        tt.style.top = "calc(" + (50 + offset) + "% - 35px)";
        let bgc = card.colors.map(x => (x == "white" ? "silver" :
            x == "blue" ? "cyan" :
                x == "black" ? "#666" :
                    x == "red" ? "firebrick" :
                        x == "green" ? "lime" : "white"));
        let bg = bgc.length == 1 ? bgc[0] : bgc.length ? "linear-gradient(" + bgc.join(", ") + ")" : "white";
        tt.style.background = bg;
        let selected = card instanceof PermanentCard && selection.filter(x => x instanceof PermanentSelection && card instanceof PermanentCard && x.item == card.representedPermanent).length;
        if (selected) {
            tt.classList.add("selected");
        }
        else {
            tt.classList.remove("selected");
        }
        let tx = document.createElement("span");
        tx.innerHTML = card.getTooltip(textAsHTML, false);
        if (card instanceof CreatureCard) {
            if (card.representedPermanent) {
                tx.innerHTML += `<br/>${card.representedPermanent.power}/${card.representedPermanent.toughness}${(card.power != card.representedPermanent.power || card.toughness != card.representedPermanent.toughness) ? ` (base ${card.power}/${card.toughness})` : ""}`;
            }
            else {
                tx.innerHTML += `<br/>${card.power}/${card.toughness}`;
            }
        }
        let tapped = card instanceof PermanentCard && card.representedPermanent?.tapped;
        let ss = card instanceof CreatureCard && card.representedPermanent?.summoningSickness;
        let attacking = card instanceof CreatureCard && card.representedPermanent?.attacking;
        let blocking = card instanceof CreatureCard && card.representedPermanent?.blocking;
        if (tapped || ss || attacking || blocking?.length) {
            tx.innerHTML += `<hline></hline>${tapped ? "Tapped" : ""}${tapped && ss ? ", " : ""}${ss ? "Summoning sickness" : ""}${ss && (attacking || blocking.length) ? ", " : ""}${attacking ? "Attacking" : blocking.length ? "Blocking " + blocking.map(x => x.name).join(", ") : ""}`;
        }
        let add = (t) => { tx.innerHTML += (tx.innerHTML.includes("<hline>") ? "<br/>" : "<hline></hline>") + t; };
        if (TurnManager.ongoingSelection) {
            add("Click to add or remove this card as a target.");
        }
        else if (card.landPlayable(card.owner)) {
            add("Click to play this land.");
        }
        else if (card.castable(card.owner)) {
            if (card instanceof AuraCard && !card.possible(card, Battlefield)) {
                add("This aura has nothing to enchant.");
            }
            else if (card instanceof SpellCard && !card.possible(card, Battlefield)) {
                add("This spell has no valid targets.");
            }
            else {
                add("Click to cast this card for " + card.manaCost.asHTML + " (you have " + card.owner.manaPool.asHTML + ").");
            }
        }
        else if (card.castable(card.owner, false, true)) {
            add("You cannot pay " + card.manaCost.asHTML + " right now (you have " + card.owner.manaPool.asHTML + ").");
        }
        else if (card.zone == Zone.hand) {
            add("This card is not playable right now.");
        }
        tx.classList.add("tx");
        tt.appendChild(tx);
        if (card.zone == "battlefield" && card instanceof PermanentCard && card.representedPermanent && !TurnManager.ongoingSelection) {
            let c = card.representedPermanent;
            if (c.tapped)
                tt.classList.add("tapped");
            else
                tt.classList.remove("tapped");
            let canAttack = false, canBlock = false, attacking = false, blocking = [];
            if (card instanceof CreatureCard) {
                let creature = card.representedPermanent;
                canAttack = creature.markAsAttacker(false);
                canBlock = creature.markAsBlocker();
                attacking = creature.attacking;
                blocking = creature.blocking;
                if (canAttack) {
                    add("Click to mark this creature as an attacker.");
                }
                else if (attacking) {
                    add("Click to unmark this creature as an attacker.");
                }
                else if (canBlock) {
                    add("Click to mark this creature as a blocker.");
                }
                else if (blocking.length) {
                    add("Click to unmark this creature as a blocker.");
                }
            }
            if (!canAttack && !canBlock && !attacking && !blocking.length && c.abilities.filter(x => x instanceof ActivatedAbility).length) {
                let a = c.abilities.filter(x => x instanceof ActivatedAbility)[0];
                if (a.getCost(c).pay(c, false)) {
                    add("Click to activate " + (card.hasAbilityMarker(1) ? ' " ' + textAsHTML(card.getAbilityInfo(1)) + ' "' : "this card's ability."));
                }
                else {
                    add("You cannot pay " + (card.hasAbilityMarker(1) ? ('" ' + textAsHTML(card.getAbilityInfo(1, "cost") + ' " to activate " ' + card.getAbilityInfo(1, "effect") + ' "')) : "this ability's cost") + " right now.");
                }
            }
        }
        // Click to play it or activate it
        let onclick = function () {
            if (TurnManager.ongoingSelection) {
                let player = TurnManager.selectingPlayer;
                if (card instanceof PermanentCard && card.representedPermanent) {
                    if (selection.map(x => x.item).includes(card.representedPermanent)) {
                        selection.splice(selection.map(x => x.item).indexOf(card.representedPermanent), 1);
                    }
                    else {
                        if (player.selectionData.limitOne)
                            selection = [];
                        selection.push(new PermanentSelection(card.representedPermanent));
                    }
                }
                updateSelection(player);
            }
            else if (card.zone == "hand")
                card.play();
            else if (card.zone == "battlefield" && card instanceof PermanentCard && card.representedPermanent) {
                let c = card.representedPermanent;
                let canAttack = false, canBlock = false, attacking = false, blocking = [];
                if (card instanceof CreatureCard) {
                    let creature = card.representedPermanent;
                    canAttack = creature.markAsAttacker(false);
                    canBlock = creature.markAsBlocker();
                    attacking = creature.attacking;
                    blocking = creature.blocking;
                    if (canAttack) {
                        creature.markAsAttacker();
                    }
                    else if (attacking) {
                        creature.unmarkAsAttacker();
                    }
                    else if (canBlock) {
                        creature.controller.selectTargets(undefined, t => t.length == 1 && creature.markAsBlocker(t[0], false), () => Battlefield.filter(x => x.representedCard instanceof CreatureCard && creature.markAsBlocker(x, false)).length > 0, "Select something to block", result => {
                            creature.markAsBlocker(result);
                        }, true);
                    }
                    else if (blocking.length) {
                        for (let attacker of blocking) {
                            creature.controller.unmarkAsBlocker(creature, attacker);
                        }
                    }
                }
                if (!canAttack && !canBlock && !attacking && !blocking.length && c.abilities.filter(x => x instanceof ActivatedAbility).length) {
                    let a = c.abilities.filter(x => x instanceof ActivatedAbility)[0];
                    if (a.activate)
                        a.activate(c);
                }
            }
            // This will (probably) be needed, why not?
            renderBattlefield();
            renderStack();
        };
        card.click = onclick;
        tt.onclick = onclick;
        // Append
        getId("field").appendChild(tt);
        card.uiElement = tt;
    }
    mouse();
}
function renderBattlefield() {
    // Before clearing out, we need to get the valid targets so they don't disappear
    let valids = Battlefield.filter(x => x.representedCard.uiElement.classList.contains("valid")).map(x => x.representedCard);
    getId("field").innerHTML = ""; // Clear out
    for (let p of TurnManager.playerList) {
        let pi = TurnManager.playerList.indexOf(p), h = pi == 0 ? -1 : pi == 1 ? 1 : 0;
        let nl = p.zones.battlefield.filter(x => !x.types.includes("Land"));
        renderRow(nl, 10 * h, valids);
        let lands = p.zones.battlefield.filter(x => x.types.includes("Land"));
        renderRow(lands, 25 * h, valids);
        let hand = p.zones.hand;
        renderRow(hand, 40 * h, valids);
    }
    if (TurnManager.passedPriority || TurnManager.endedPhase || TurnManager.endedTurn || !StackManager.stack.length)
        getId("pass").classList.add("pushed");
    else
        getId("pass").classList.remove("pushed");
    if (TurnManager.endedPhase || TurnManager.endedTurn)
        getId("endphase").classList.add("pushed");
    else
        getId("endphase").classList.remove("pushed");
    if (TurnManager.endedTurn)
        getId("endturn").classList.add("pushed");
    else
        getId("endturn").classList.remove("pushed");
    // Now for the players.
    for (let i = 0; i <= 1; i++) {
        let p = TurnManager.playerList[i];
        if (!p)
            continue;
        if (!getId("playerinfo" + i)) {
            // No .playerinfo found, create one
            let info = document.createElement("div");
            info.id = "playerinfo" + i;
            info.classList.add("playerinfo");
            if (i == 0)
                info.style.top = "30px";
            else
                info.style.bottom = "30px";
            document.body.appendChild(info);
        }
        let elem = getId("playerinfo" + i);
        elem.innerHTML = `
    ${p.name}<br/>
    ${TurnManager.defendingPlayer == p && TurnManager.step == Step.declare_blockers && TurnManager.currentPlayer.attackers.length ? "(" + (p.lifeTotal - TurnManager.currentPlayer.attackers.reduce((a, b) => a + b.power, 0)) + " ← ) " : ""}${p.lifeTotal}/${p.startingLifeTotal} life
    `;
        // Click on a playerinfo to add/remove
        elem.onclick = function (e) {
            if (TurnManager.ongoingSelection) {
                let player = TurnManager.selectingPlayer;
                if (selection.map(x => x.item).includes(p)) {
                    selection.splice(selection.map(x => x.item).indexOf(p), 1);
                }
                else {
                    if (player.selectionData.limitOne)
                        selection = [];
                    selection.push(new PlayerSelection(p));
                }
                updateSelection(player);
            }
        };
    }
    // Piles
    for (let p of TurnManager.playerList) {
        let ind = TurnManager.playerList.indexOf(p);
        if (!getId("pile-gy-" + ind)) {
            let newgy = document.createElement("div");
            newgy.classList.add("tt");
            newgy.id = "pile-gy-" + ind;
            if (ind == 0)
                newgy.style.top = "35px";
            else
                newgy.style.bottom = "35px";
            let gytt = document.createElement("span");
            gytt.classList.add("tx");
            gytt.id = "gytt-" + ind;
            let gytxt = document.createElement("span");
            gytxt.id = "gytxt-" + ind;
            newgy.appendChild(gytxt);
            newgy.appendChild(gytt);
            getId("piles").appendChild(newgy);
        }
        let gy = getId("pile-gy-" + ind);
        let gytxt = getId("gytxt-" + ind);
        let gytt = getId("gytt-" + ind);
        if (p.zones.graveyard.length) {
            let card = p.zones.graveyard[p.zones.graveyard.length - 1];
            gytt.innerHTML = card.getTooltip(textAsHTML) + `<hline></hline>Click to toggle graveyard (${p.zones.graveyard.length} cards)`;
            gytxt.textContent = card.name;
            let bgc = card.colors.map(x => (x == "white" ? "silver" :
                x == "blue" ? "cyan" :
                    x == "black" ? "#666" :
                        x == "red" ? "firebrick" :
                            x == "green" ? "lime" : "white"));
            let bg = bgc.length == 1 ? bgc[0] : bgc.length ? "linear-gradient(" + bgc.join(", ") + ")" : "white";
            gy.style.background = bg;
        }
        else {
            gy.style.background = "rgba(255, 255, 255, 0.3)";
            gytxt.textContent = "Grave";
            gytt.textContent = "Graveyard (empty)";
        }
        if (!getId("pile-ex-" + ind)) {
            let newex = document.createElement("div");
            newex.classList.add("tt");
            newex.id = "pile-ex-" + ind;
            if (ind == 0)
                newex.style.top = "125px";
            else
                newex.style.bottom = "125px";
            let extt = document.createElement("span");
            extt.classList.add("tx");
            extt.id = "extt-" + ind;
            let extxt = document.createElement("span");
            extxt.id = "extxt-" + ind;
            newex.appendChild(extxt);
            newex.appendChild(extt);
            getId("piles").appendChild(newex);
        }
        let ex = getId("pile-ex-" + ind);
        let extxt = getId("extxt-" + ind);
        let extt = getId("extt-" + ind);
        if (p.zones.exile.length) {
            let card = p.zones.exile[p.zones.exile.length - 1];
            extt.innerHTML = card.getTooltip(textAsHTML) + `<hline></hline>Click to toggle exile pile (${p.zones.exile.length} cards)`;
            extxt.textContent = card.name;
            let bgc = card.colors.map(x => (x == "white" ? "silver" :
                x == "blue" ? "cyan" :
                    x == "black" ? "#666" :
                        x == "red" ? "firebrick" :
                            x == "green" ? "lime" : "white"));
            let bg = bgc.length == 1 ? bgc[0] : bgc.length ? "linear-gradient(" + bgc.join(", ") + ")" : "white";
            ex.style.background = bg;
        }
        else {
            ex.style.background = "rgba(255, 255, 255, 0.3)";
            extxt.textContent = "Exile";
            extt.textContent = "Exile pile (empty)";
        }
        let expand = (pile) => function (e) {
            let pv = getId("pileviewer");
            let cards = pile == "gy" ? p.zones.graveyard : p.zones.exile;
            if (pv.style.display == "block") {
                pv.style.display = "none";
                for (let card of cards) {
                    card.uiElement = undefined;
                }
            }
            else {
                let name = pile == "gy" ? "Graveyard" : "Exile";
                pv.style.display = "block";
                getId("pv-upper").innerHTML = p.name + "'s " + name + " (" + cards.length + " cards)";
                for (let card of cards) {
                    let tt = document.createElement("span");
                    tt.setAttribute("card_uuid", card.uuid.toString());
                    tt.innerHTML = card.name.slice(0);
                    tt.classList.add("tt", "card", "noabs");
                    let bgc = card.colors.map(x => (x == "white" ? "silver" :
                        x == "blue" ? "cyan" :
                            x == "black" ? "#666" :
                                x == "red" ? "firebrick" :
                                    x == "green" ? "lime" : "white"));
                    let bg = bgc.length == 1 ? bgc[0] : bgc.length ? "linear-gradient(" + bgc.join(", ") + ")" : "white";
                    tt.style.background = bg;
                    let selected = selection.filter(x => x instanceof PermanentSelection && card instanceof PermanentCard && x.item == card.representedPermanent).length;
                    if (selected) {
                        tt.classList.add("selected");
                    }
                    let tx = document.createElement("span");
                    tx.innerHTML = card.getTooltip(textAsHTML);
                    tx.classList.add("tx");
                    tt.appendChild(tx);
                    tt.onclick = function (e) {
                        if (TurnManager.ongoingSelection) {
                            let player = TurnManager.selectingPlayer;
                            if (selection.map(x => x.item).includes(card)) {
                                selection.splice(selection.map(x => x.item).indexOf(card), 1);
                            }
                            else {
                                if (player.selectionData.limitOne)
                                    selection = [];
                                selection.push(new CardSelection(card));
                            }
                            updateSelection(player);
                        }
                    };
                    getId("pv-inner").appendChild(tt);
                    card.uiElement = tt;
                }
            }
        };
        gy.onclick = expand("gy");
        ex.onclick = expand("ex");
    }
    mouse();
}
function renderStack() {
    let s = getId("stack"), m = StackManager;
    s.innerHTML = `${TurnManager.currentPlayer.name}'s ${TurnManager.stepName} step<br/>Stack (${m.stack.length} item${m.stack.length == 1 ? "):" : m.stack.length ? "s):" : "s)"}`;
    for (let i of m.stack) {
        s.innerHTML += "<br/>" + (i instanceof StackEffect ? "Queued effect on " + i.permanent.name :
            i instanceof StackCard ? i.card.name +
                (i.targets.length ? i.targets.map(x => "<br/>↳ " + x.name || typeof x) : "") :
                "Activated ability of " + i.permanent +
                    (i.targets.length ? i.targets.map(x => "<br/>↳ " + x.name || typeof x) : ""));
    }
    mouse();
}
class Selection {
    item;
    constructor(item) {
        this.item = item;
    }
}
class PermanentSelection extends Selection {
    constructor(perm) {
        super(perm);
    }
}
class PlayerSelection extends Selection {
    constructor(player) {
        super(player);
    }
}
class CardSelection extends Selection {
    constructor(card) {
        super(card);
    }
}
let selection = [];
function updateSelection(player) {
    let data = player.selectionData;
    if (!data)
        return;
    if (data.validate(selection.map(x => x.item))) {
        getId("confirm").classList.remove("pushed");
    }
    else {
        getId("confirm").classList.add("pushed");
    }
    // REMOVE the selected class from all NON-selected elements
    for (let i of Battlefield) {
        if (!selection.filter(x => x instanceof PermanentSelection).map(x => x.item).includes(i)) {
            i.representedCard.uiElement.classList.remove("selected");
        }
    }
    for (let i of TurnManager.playerList) {
        if (!selection.filter(x => x instanceof PlayerSelection).map(x => x.item).includes(i)) {
            i.uiElement.classList.remove("selected");
        }
        for (let c of i.zones.graveyard) {
            c.uiElement?.classList.remove("selected");
        }
        for (let c of i.zones.exile) {
            c.uiElement?.classList.remove("selected");
        }
    }
    // ADD the selected class to the selected elements
    for (let i of selection) {
        if (i instanceof PermanentSelection) {
            i.item.representedCard.uiElement.classList.add("selected");
        }
        else if (i instanceof PlayerSelection) {
            i.item.uiElement.classList.add("selected");
        }
        else if (i instanceof CardSelection) {
            i.item.uiElement?.classList.add("selected");
        }
    }
}
/**
 * Use `Player.selectTargets` rather than calling this directly.
 */
function selectTargets(player) {
    let data = player.selectionData;
    if (!data || !data.possible(Battlefield))
        return;
    //getId("cover").style.opacity = "10%";
    // Change the buttons
    getId("endturn").style.display = "none";
    getId("endphase").style.display = "none";
    getId("pass").style.display = "none";
    getId("confirm").style.display = "block";
    getId("confirm").classList.add("pushed");
    getId("targetinfo").textContent = data.message + (data.card ? " (" + data.card.name + ")" : "");
    getId("targetinfo").style.opacity = "100%";
    updateSelection(player);
    for (let card of Battlefield) {
        if (data.validate([card])) {
            card.representedCard.uiElement.classList.add("valid");
        }
    }
    for (let p of TurnManager.playerList) {
        if (data.validate([p])) {
            p.uiElement.classList.add("valid");
        }
    }
}
function submitSelection() {
    let player = TurnManager.selectingPlayer;
    let data = player.selectionData;
    let things = selection.map(x => x.item);
    if (!data || !data.validate(things))
        return;
    player.selectionData.continuation(things);
    // Stop selecting
    for (let c of Battlefield) {
        c.representedCard.uiElement.classList.remove("valid");
    }
    for (let p of TurnManager.playerList) {
        p.uiElement.classList.remove("valid");
    }
    selection = [];
    updateSelection(player);
    player.selectionData = undefined;
    getId("confirm").style.display = "none";
    getId("targetinfo").style.opacity = "0%";
    getId("endturn").style.display = "block";
    getId("endphase").style.display = "block";
    getId("pass").style.display = "block";
    renderBattlefield();
}
let chosenOptions = [];
function chooseOptions(player, descriptions, howMany = 1, message, continuation) {
    getId("endturn").style.display = "none";
    getId("endphase").style.display = "none";
    getId("pass").style.display = "none";
    player.choosing = true;
    getId("optcontainer").style.display = "block";
    getId("optmsg").textContent = message;
    getId("optlist").innerHTML = ""; // Clear
    for (let i of descriptions) {
        let ind = descriptions.indexOf(i);
        let el = document.createElement("div");
        el.innerHTML = i;
        el.onclick = function (e) {
            if (chosenOptions.includes(ind)) {
                chosenOptions.splice(chosenOptions.indexOf(ind), 1);
                el.classList.remove("chosen");
            }
            else {
                chosenOptions.push(ind);
                el.classList.add("chosen");
            }
            // Check the submit button
            if (chosenOptions.length == howMany) {
                getId("optsubmit").classList.add("submittable");
            }
            else {
                getId("optsubmit").classList.remove("submittable");
            }
        };
        getId("optlist").appendChild(el);
    }
    getId("optsubmit").onclick = function (e) {
        if (chosenOptions.length != howMany)
            return;
        // Set display to none
        getId("optcontainer").style.display = "none";
        player.choosing = false;
        continuation(chosenOptions);
        getId("optsubmit").classList.remove("submittable");
        getId("endturn").style.display = "block";
        getId("endphase").style.display = "block";
        getId("pass").style.display = "block";
        chosenOptions = [];
    };
}
function passPriority() {
    if (TurnManager.ongoingSelection || TurnManager.endedPhase || TurnManager.endedTurn)
        return;
    TurnManager.passedPriority = !TurnManager.passedPriority;
    StackManager.resolveIfReady();
    renderBattlefield();
    renderStack();
}
function endPhase() {
    if (TurnManager.ongoingSelection || TurnManager.endedTurn)
        return;
    TurnManager.endedPhase = !TurnManager.endedPhase;
    TurnManager.passedPriority = false;
    StackManager.resolveIfReady();
    TurnManager.advanceIfReady();
    renderBattlefield();
    renderStack();
}
function endTurn() {
    if (TurnManager.ongoingSelection)
        return;
    TurnManager.endedTurn = !TurnManager.endedTurn;
    TurnManager.endedPhase = false;
    TurnManager.passedPriority = false;
    StackManager.resolveIfReady();
    TurnManager.advanceIfReady();
    renderBattlefield();
    renderStack();
}
// KEYBINDS
document.onkeydown = function (e) {
    let k = e.key;
    let card = TurnManager.playerList.map(x => x.zones.all).flat().filter(x => x.uuid.toString() == getHoveredUUID())[0];
    if (k == "e") {
        endTurn();
    }
    else if (k == "n") {
        endPhase();
    }
    else if (k == "s") {
        passPriority();
    }
    else if (parseInt(k) && parseInt(k) >= 1 && parseInt(k) <= 9) {
        if (card) {
            if (card.zone == Zone.battlefield && card instanceof PermanentCard) {
                let a = card.representedPermanent.abilities.filter(x => x instanceof ActivatedAbility)[parseInt(k) - 1];
                if (a.activate)
                    a.activate(card.representedPermanent);
            }
        }
        else if (TurnManager.currentPlayer.zones.hand.length >= parseInt(k)) {
            TurnManager.currentPlayer.zones.hand[parseInt(k) - 1].play();
        }
    }
    else if (k == " ") {
        if (card && card.click) {
            card.click();
        }
        else if (TurnManager.currentPlayer.zones.battlefield.length > 0) {
            let c = TurnManager.currentPlayer.zones.battlefield[0];
            if (c.click)
                c.click();
        }
        e.preventDefault();
    }
};
export let UI = {
    getId: getId,
    textAsHTML: textAsHTML,
    selectTargets: selectTargets,
    renderBattlefield: renderBattlefield,
    renderStack: renderStack,
    updateSelection: updateSelection,
    selection: selection,
    submitSelection: submitSelection,
    chooseOptions: chooseOptions,
    passPriority: passPriority,
    endPhase: endPhase,
    endTurn: endTurn
};
