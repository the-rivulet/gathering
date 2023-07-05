//import type { ActivatedAbility } from "./ability.js";
import { Player } from "./player.js";
import { TurnManager, UpdateGlobals, Battlefield, StackManager } from "./globals.js";
import { StackManagerClass } from "./stack.js";
import { TurnManagerClass, Step } from "./turn.js";
import { ForestCard, LlanowarElvesCard, ForcedAdaptationCard, GiantGrowthCard } from "./library.js";
//import { Creature } from "./permanent.js";
//import { Zone } from "./zone.js";
import { UI } from "./ui.js";
import { AddManaEffect } from "./effect.js";

let getPlayer = () => {
  let p = new Player("unnamed", [new ForestCard(), new LlanowarElvesCard(), new ForcedAdaptationCard(), new GiantGrowthCard()]);
  p.name = "Player" + p.uuid.toString().slice(2, 5);
  return p;
}

export function Initialize(...plist: Player[]) {
  // Re-initialize all global variables.
  UpdateGlobals([], new TurnManagerClass(...plist), new StackManagerClass());
  // Draw some cards
  for(let i of TurnManager.playerList) i.drawCard(1);
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
  let checkEqual = (v1: any, v2: any, msg: string) => {
    if (v1 == v2) {
      console.log("Assertion '" + msg + "' passed: Both values equal " + v1 + ".");
    } else {
      console.warn("Assertion '" + msg + "' failed: " + v1 + " does not equal " + v2 + ".");
    }
  }
  console.log("Beginning tests.")
  let p1 = getPlayer();
  let p2 = getPlayer();
  Initialize(p1, p2);
}