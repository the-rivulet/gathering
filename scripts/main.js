import { Player } from "./player.js";
import { TurnManager, UpdateGlobals, Battlefield, StackManager } from "./globals.js";
import { StackManagerClass } from "./stack.js";
import { TurnManagerClass, Step } from "./turn.js";
import { ForestCard, LlanowarElvesCard, ForcedAdaptationCard, GiantGrowthCard } from "./library.js";
import { Zone } from "./zone.js";
import { UI } from "./ui.js";
let getPlayer = () => {
    let p = new Player("unnamed", [new ForestCard(), new LlanowarElvesCard(), new ForcedAdaptationCard(), new GiantGrowthCard()]);
    p.name = "Player" + p.uuid.toString().slice(2, 5);
    return p;
};
export function Initialize(...plist) {
    // Re-initialize all global variables.
    UpdateGlobals([], new TurnManagerClass(...plist), new StackManagerClass());
    // Draw some cards
    for (let i of TurnManager.playerList)
        i.drawCard(1);
    // Set proper phase
    TurnManager.advanceIfReady();
    // Render
    UI.renderBattlefield();
    UI.renderStack();
}
export function StartGame() {
    Initialize(getPlayer(), getPlayer());
}
export function RunTests() {
    let checkEqual = (v1, v2, msg) => {
        if (v1 == v2) {
            console.log("Assertion '" + msg + "' passed: Both values equal " + v1 + ".");
        }
        else {
            console.warn("Assertion '" + msg + "' failed: " + v1 + " does not equal " + v2 + ".");
        }
    };
    console.log("Beginning tests.");
    let p1 = getPlayer();
    let p2 = getPlayer();
    Initialize(p1, p2);
    TurnManager.advance();
    TurnManager.advance();
    TurnManager.advance();
    checkEqual(TurnManager.step, Step.precombat_main, "In 1st main");
    p1.play(p1.zones.hand[0]);
    let forest = Battlefield[0];
    checkEqual(forest.name, "Forest", "Forest on battlefield");
    let abil = forest.abilities[0];
    abil.activate(forest);
    StackManager.resolveNext();
    p1.play(p1.zones.hand[0]);
    StackManager.resolveNext();
    let elves = Battlefield[1];
    checkEqual(elves.name, "Llanowar Elves", "Elves on battlefield");
    TurnManager.advance(Step.untap);
    TurnManager.advance(Step.untap);
    checkEqual(elves.summoningSickness, false, "Elves no summoning sickness");
    TurnManager.advance(Step.declare_attackers);
    p1.markAsAttacker(elves);
    checkEqual(elves.attacking, true, "Elves attacking");
    TurnManager.advance(Step.deal_damage);
    checkEqual(p2.lifeTotal, 19, "p2 took damage");
    checkEqual(p1.zones.hand[0].name, "Forced Adaptation", "Adap in hand");
    abil.activate(forest);
    p1.play(p1.zones.hand[0], false, false, [elves]);
    StackManager.resolveNext();
    let adap = Battlefield[2];
    checkEqual(adap.name, "Forced Adaptation", "Adap on battlefield");
    let adapCard = adap.representedCard;
    checkEqual(adapCard.attached.name, elves.name, "Adap attached to elves");
    TurnManager.advance(Step.untap);
    p2.play(p2.zones.hand[0]);
    let forest2 = Battlefield[3];
    checkEqual(forest2.name, "Forest", "Other forest on battlefield");
    let abil2 = forest2.abilities[0];
    abil2.activate(forest2);
    StackManager.resolveNext();
    p2.play(p2.zones.hand[0]);
    StackManager.resolveNext();
    let elves2 = Battlefield[4];
    let elves2card = elves2.representedCard;
    checkEqual(elves2.name, "Llanowar Elves", "Other elves on battlefield");
    TurnManager.advance(Step.untap);
    TurnManager.advance();
    StackManager.resolveNext();
    checkEqual(elves.power, 2, "Buffed it up");
    TurnManager.advance(Step.declare_attackers);
    p1.markAsAttacker(elves);
    checkEqual(elves.attacking, true, "Elves attacking");
    TurnManager.advance();
    p2.markAsBlocker(elves2, elves);
    TurnManager.advance(Step.end);
    checkEqual(p2.lifeTotal, 19, "p2 took no damage");
    checkEqual(elves2card.zone, Zone.graveyard, "Blocker died");
    let gg = p1.zones.hand[0];
    p1.play(gg);
}
