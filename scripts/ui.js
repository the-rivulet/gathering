import { TurnManager, Battlefield, StackManager, Settings } from "./globals.js";
import { StackCard, StackEffect } from "./stack.js";
import { Zone } from "./zone.js";
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
        let tx = document.createElement("span");
        tx.innerHTML = `
    ${card.manaCost ? "(" + card.manaCost.asHTML + ") " : ""}${card.name}<br/>
      ${card.supertypes.join(" ")} ${card.majorTypes.join(" ")} - ${card.subtypes.join(" ")}<br/>
      ${card.textAsHTML}`;
        if (card.types.includes("Creature") && card.representedPermanent) {
            tx.innerHTML += `<br/>${card.representedPermanent.power}/${card.representedPermanent.toughness}`;
        }
        tx.innerHTML += "<hline></hline>";
        if (card.landPlayable(card.owner)) {
            tx.innerHTML += "Click to play this land.";
        }
        else if (card.castable(card.owner)) {
            let asAura = card;
            let asSpell = card;
            if (asAura && !asAura.possible(Battlefield)) {
                tx.innerHTML += "This aura has nothing to enchant.";
            }
            else if (asSpell && !asSpell.possible(Battlefield)) {
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
        if (card.zone == "battlefield" && card) {
            let c = card.representedPermanent;
            if (c && c.tapped)
                tt.classList.add("tapped");
            else
                tt.classList.remove("tapped");
            if (c && c.abilities.filter(x => x).length) {
                let a = c.abilities.filter(x => x)[0];
                if (a.getCost(c).pay(c, false)) {
                    tx.innerHTML += "Click to activate " + (card.hasAbilityMarker(1) ? ' " ' + textAsHTML(card.getAbilityInfo(1)) + ' "' : "this card's ability.");
                }
                else {
                    tx.innerHTML += "You cannot " + (card.hasAbilityMarker(1) ? 'activate " ' + textAsHTML(card.getAbilityInfo(1, "effect")) + ' " because you cannot pay " ' + textAsHTML(card.getAbilityInfo(1, "cost")) + ' "' : "pay this ability's cost") + " right now.";
                }
            }
        }
        // Click to play it or activate it
        tt.onclick = function (e) {
            if (card.zone == "hand")
                card.owner.play(card);
            else if (card.zone == "battlefield" && card) {
                let c = card.representedPermanent;
                if (c && c.abilities.filter(x => x).length) {
                    let a = c.abilities.filter(x => x)[0];
                    a.activate(c);
                }
            }
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
    type;
    thing;
    constructor(type, thing) {
        this.type = type;
        this.thing = thing;
    }
}
let selection = [];
function updateSelection(player) {
    let data = player.selectionData;
    if (!data)
        return;
    let ind = TurnManager.playerList.indexOf(player);
    if (data.validate(selection.map(x => x.thing))) {
        getId("confirm").classList.remove("pushed");
    }
    else {
        getId("confirm").classList.add("pushed");
    }
    // REMOVE the selected class from all NON-selected elements
    for (let i of Battlefield) {
        if (!selection.filter(x => x.type == "permanent").map(x => x.thing).includes(i)) {
            i.representedCard.uiElement.classList.remove("selected");
        }
    }
    for (let i of TurnManager.playerList) {
        if (!selection.filter(x => x.type == "player").map(x => x.thing).includes(i)) {
            // TODO
        }
    }
    // ADD the selected class to the selected elements
    for (let i of selection) {
        if (i.type == "permanent") {
            let x = i.thing;
            x.representedCard.uiElement.classList.add("selected");
        }
        else if (i.type == "player") {
            let x = i.thing;
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
    let update = () => updateSelection(player);
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
    update();
    // Borders for valid cards
    for (let card of Battlefield) {
        let uiel = card.representedCard.uiElement;
        if (data.validate([card])) {
            uiel.classList.add("valid");
        }
        uiel.onclick = function (e) {
            if (selection.map(x => x.thing).includes(card)) {
                selection.splice(selection.map(x => x.thing).indexOf(card), 1);
            }
            else {
                selection.push(new Selection("permanent", card));
            }
            update();
        };
    }
}
function submitSelection() {
    let player = TurnManager.playerList.filter(x => x.selectionData)[0];
    let data = player.selectionData;
    let things = selection.map(x => x.thing);
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
    UI.renderBattlefield();
    StackManager.resolveIfReady();
}
function endPhase(ind) {
    let player = TurnManager.playerList[ind];
    if (player.selectionData)
        return;
    player.endedPhase = !player.endedPhase;
    player.passedPriority = false;
    UI.renderBattlefield();
    StackManager.resolveIfReady();
    TurnManager.advanceIfReady();
}
function endTurn(ind) {
    let player = TurnManager.playerList[ind];
    if (player.selectionData)
        return;
    player.endedTurn = !player.endedTurn;
    player.endedPhase = false;
    player.passedPriority = false;
    UI.renderBattlefield();
    StackManager.resolveIfReady();
    TurnManager.advanceIfReady();
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
