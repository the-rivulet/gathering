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
        { "G": "saint", "W": "gourmand", "U": "rivulet", "R": "artificer", "B": "nightcat" } :
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
function renderRow(cards, offset) {
    for (let card of cards) {
        let i = cards.indexOf(card);
        let tt = document.createElement("span");
        tt.setAttribute("card_uuid", card.uuid.toString());
        tt.innerHTML = card.name.slice(0);
        tt.classList.add("tt", "card");
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
        tx.innerHTML = `
    ${card.manaCost ? "(" + card.manaCost.asHTML + ") " : ""}${card.name}<br/>
      ${card.supertypes.join(" ")} ${card.majorTypes.join(" ")} - ${card.subtypes.join(" ")}<br/>
      ${textAsHTML(card.text.replaceAll("{CARDNAME", card.name))}`;
        if (card instanceof CreatureCard) {
            if (card.representedPermanent) {
                tx.innerHTML += `<br/>${card.representedPermanent.power}/${card.representedPermanent.toughness}`;
            }
            else {
                tx.innerHTML += `<br/>${card.power}/${card.toughness} (base)`;
            }
        }
        let tapped = card instanceof PermanentCard && card.representedPermanent?.tapped;
        let ss = card instanceof CreatureCard && card.representedPermanent?.summoningSickness;
        let attacking = card instanceof CreatureCard && card.representedPermanent?.attacking;
        let blocking = card instanceof CreatureCard && card.representedPermanent?.blocking;
        if (tapped || ss || attacking || blocking?.length) {
            tx.innerHTML += `<br/>${tapped ? "Tapped" : ""}${tapped && ss ? ", " : ""}${ss ? "Summoning sickness" : ""}${ss && (attacking || blocking) ? ", " : ""}${attacking ? "Attacking" : blocking.length ? "Blocking " + blocking.map(x => x.name).join(", ") : ""}`;
        }
        tx.innerHTML += "<hline></hline>";
        if (card.landPlayable(card.owner)) {
            tx.innerHTML += "Click to play this land.";
        }
        else if (card.castable(card.owner)) {
            if (card instanceof AuraCard && !card.possible(card, Battlefield)) {
                tx.innerHTML += "This aura has nothing to enchant.";
            }
            else if (card instanceof SpellCard && !card.possible(card, Battlefield)) {
                tx.innerHTML += "This spell has no valid targets.";
            }
            else {
                tx.innerHTML += "Click to cast this card for " + card.manaCost.asHTML + ".";
            }
        }
        else if (card.castable(card.owner, false, true)) {
            tx.innerHTML += "You cannot pay " + card.manaCost.asHTML + " right now (you have " + card.owner.manaPool.asHTML + ").";
        }
        else if (card.zone == Zone.hand) {
            tx.innerHTML += "This card is not playable right now.";
        }
        tx.classList.add("tx");
        tt.appendChild(tx);
        if (card.zone == "battlefield" && card instanceof PermanentCard && card.representedPermanent) {
            let c = card.representedPermanent;
            if (c.tapped)
                tt.classList.add("tapped");
            else
                tt.classList.remove("tapped");
            let canAttack = false, canBlock = false, attacking = false, blocking = [];
            if (card instanceof CreatureCard) {
                let creature = card.representedPermanent;
                canAttack = creature.controller.markAsAttacker(creature, false);
                canBlock = creature.controller.markAsBlocker(creature);
                attacking = creature.attacking;
                blocking = creature.blocking;
                if (canAttack) {
                    tx.innerHTML += "Click to mark this creature as an attacker.";
                }
                else if (attacking) {
                    tx.innerHTML += "Click to unmark this creature as an attacker.";
                }
                else if (canBlock) {
                    tx.innerHTML += "Click to mark this creature as a blocker.";
                }
                else if (blocking.length) {
                    tx.innerHTML += "Click to unmark this creature as a blocker.";
                }
            }
            if (!canAttack && !canBlock && !attacking && !blocking.length && c.abilities.filter(x => x instanceof ActivatedAbility).length) {
                let a = c.abilities.filter(x => x instanceof ActivatedAbility)[0];
                if (a.getCost(c).pay(c, false)) {
                    tx.innerHTML += "Click to activate " + (card.hasAbilityMarker(1) ? ' " ' + textAsHTML(card.getAbilityInfo(1)) + ' "' : "this card's ability.");
                }
                else {
                    tx.innerHTML += "You cannot " + (card.hasAbilityMarker(1) ? '" ' + textAsHTML(card.getAbilityInfo(1, "effect")) + ' " because you cannot pay " ' + textAsHTML(card.getAbilityInfo(1, "cost")) + ' "' : "pay this ability's cost") + " right now.";
                }
            }
        }
        // Click to play it or activate it
        tt.onclick = function (e) {
            if (TurnManager.playerList.filter(x => x.selectionData).length) {
                let player = TurnManager.playerList.filter(x => x.selectionData)[0];
                if (card instanceof PermanentCard && card.representedPermanent) {
                    if (selection.map(x => x.item).includes(card.representedPermanent)) {
                        selection.splice(selection.map(x => x.item).indexOf(card.representedPermanent), 1);
                    }
                    else {
                        selection.push(new PermanentSelection(card.representedPermanent));
                    }
                }
                updateSelection(player);
            }
            else if (card.zone == "hand")
                card.owner.play(card);
            else if (card.zone == "battlefield" && card instanceof PermanentCard && card.representedPermanent) {
                let c = card.representedPermanent;
                let canAttack = false, canBlock = false, attacking = false, blocking = [];
                if (card instanceof CreatureCard) {
                    let creature = card.representedPermanent;
                    canAttack = creature.controller.markAsAttacker(creature, false);
                    canBlock = creature.controller.markAsBlocker(creature);
                    attacking = creature.attacking;
                    blocking = creature.blocking;
                    if (canAttack) {
                        creature.controller.markAsAttacker(creature);
                    }
                    else if (attacking) {
                        creature.controller.unmarkAsAttacker(creature);
                    }
                    else if (canBlock) {
                        // TODO: Make a select targets thingy for blocking
                    }
                    else if (blocking.length) {
                        for (let attacker of blocking) {
                            creature.controller.unmarkAsBlocker(creature, attacker);
                        }
                    }
                }
                if (!canAttack && !canBlock && !attacking && !blocking.length && c.abilities.filter(x => x).length) {
                    let a = c.abilities.filter(x => x)[0];
                    a.activate(c);
                }
            }
            // This will (probably) be needed, why not?
            renderBattlefield();
            renderStack();
        };
        // Append
        getId("field").appendChild(tt);
        card.uiElement = tt;
    }
    mouse();
}
function renderBattlefield() {
    getId("field").innerHTML = ""; // Clear out
    for (let p of TurnManager.playerList) {
        let pi = TurnManager.playerList.indexOf(p), h = pi == 0 ? -1 : pi == 1 ? 1 : 0;
        let nl = p.zones.battlefield.filter(x => !x.types.includes("Land"));
        renderRow(nl, 15 * h);
        let lands = p.zones.battlefield.filter(x => x.types.includes("Land"));
        renderRow(lands, 25 * h);
        let hand = p.zones.hand;
        renderRow(hand, 40 * h);
        // Do the thingies
        if (p.passedPriority || p.endedPhase || p.endedTurn || !StackManager.stack.length)
            getId("pass" + pi).classList.add("pushed");
        else
            getId("pass" + pi).classList.remove("pushed");
        if (p.endedPhase || p.endedTurn)
            getId("endphase" + pi).classList.add("pushed");
        else
            getId("endphase" + pi).classList.remove("pushed");
        if (p.endedTurn)
            getId("endturn" + pi).classList.add("pushed");
        else
            getId("endturn" + pi).classList.remove("pushed");
    }
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
            // TODO
        }
    }
    // ADD the selected class to the selected elements
    for (let i of selection) {
        if (i instanceof PermanentSelection) {
            i.item.representedCard.uiElement.classList.add("selected");
        }
        else if (i instanceof PlayerSelection) {
            let x = i.item;
            // TODO
        }
    }
}
/**
 * Use `Player.selectTargets` rather than calling this directly.
 */
async function selectTargets(player) {
    let data = player.selectionData;
    if (!data || !data.possible(Battlefield))
        return;
    //getId("cover").style.opacity = "10%";
    // Change the button
    for (let i = 0; i < TurnManager.playerList.length; i++) {
        getId("endturn" + i).style.display = "none";
        getId("endphase" + i).style.display = "none";
        getId("pass" + i).style.display = "none";
    }
    getId("confirm").style.display = "block";
    getId("confirm").classList.add("pushed");
    getId("targetinfo").textContent = data.message + (data.card ? " (" + data.card.name + ")" : "");
    getId("targetinfo").style.opacity = "100%";
    updateSelection(player);
    // Borders for valid cards
    for (let card of Battlefield) {
        let uiel = card.representedCard.uiElement;
        if (data.validate([card])) {
            uiel.classList.add("valid");
        }
    }
}
function submitSelection() {
    let player = TurnManager.playerList.filter(x => x.selectionData)[0];
    let data = player.selectionData;
    let things = selection.map(x => x.item);
    if (!data || !data.validate(things))
        return;
    player.selectionData.continuation(things);
    // Stop selecting
    selection = [];
    updateSelection(player);
    player.selectionData = undefined;
    getId("confirm").style.display = "none";
    getId("targetinfo").style.opacity = "0%";
    for (let i = 0; i < TurnManager.playerList.length; i++) {
        getId("endturn" + i).style.display = "block";
        getId("endphase" + i).style.display = "block";
        getId("pass" + i).style.display = "block";
    }
    renderBattlefield();
}
function passPriority(ind) {
    let player = TurnManager.playerList[ind];
    if (player.selectionData || player.endedTurn)
        return;
    player.passedPriority = !player.passedPriority;
    StackManager.resolveIfReady();
    renderBattlefield();
    renderStack();
}
function endPhase(ind) {
    let player = TurnManager.playerList[ind];
    if (player.selectionData)
        return;
    player.endedPhase = !player.endedPhase;
    player.passedPriority = false;
    StackManager.resolveIfReady();
    TurnManager.advanceIfReady();
    renderBattlefield();
    renderStack();
}
function endTurn(ind) {
    let player = TurnManager.playerList[ind];
    if (player.selectionData)
        return;
    player.endedTurn = !player.endedTurn;
    player.endedPhase = false;
    player.passedPriority = false;
    StackManager.resolveIfReady();
    TurnManager.advanceIfReady();
    renderBattlefield();
    renderStack();
}
export let UI = {
    getId: getId,
    textAsHTML: textAsHTML,
    selectTargets: selectTargets,
    renderBattlefield: renderBattlefield,
    renderStack: renderStack,
    updateSelection: updateSelection,
    selection: selection,
    submitSelection: submitSelection,
    passPriority: passPriority,
    endPhase: endPhase,
    endTurn: endTurn
};
