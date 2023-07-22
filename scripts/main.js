import { Player } from "./player.js";
import { TurnManager, UpdateGlobals, Battlefield } from "./globals.js";
import { StackManagerClass } from "./stack.js";
import { TurnManagerClass, Step } from "./turn.js";
import { ForestCard, LlanowarElvesCard, ForcedAdaptationCard, GiantGrowthCard } from "./library.js";
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
    TurnManager.advance(Step.precombat_main);
    p1.play(p1.zones.hand[0]);
    Battlefield[0].abilities[0].activate(Battlefield[0]);
    p1.play(p1.zones.hand[0]);
}
