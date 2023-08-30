import type { ActivatedAbility } from "./ability.js";
import { Player } from "./player.js";
import { TurnManager, UpdateGlobals, Battlefield, StackManager } from "./globals.js";
import { StackManagerClass } from "./stack.js";
import { TurnManagerClass, Step } from "./turn.js";
import { BasicLandCard, FigureOfDestinyCard, AnaxAndCymedeCard, FeatherTheRedeemedCard, GeneralFerrousRokiricCard, IroasGodOfVictoryCard, RadiantScrollwielderCard, ZadaHedronGrinderCard, FloweringOfTheWhiteTreeCard, LightningBoltCard, RecklessRageCard, BorosCharmCard, LightningHelixCard, IntegrityInterventionCard, RipApartCard, ThrillingDiscoveryCard, AngelfireIgnitionCard } from "./library.js";
import { UI } from "./ui.js";
import { Color } from "./mana.js";

let getPlayer = (shuffleDeck = false) => {
  let p = new Player("", [
    new FigureOfDestinyCard(),
    new FigureOfDestinyCard(),
    new FigureOfDestinyCard(),
    new FigureOfDestinyCard(),
    new AnaxAndCymedeCard(),
    new FeatherTheRedeemedCard(),
    new FeatherTheRedeemedCard(),
    new FeatherTheRedeemedCard(),
    new GeneralFerrousRokiricCard(),
    new GeneralFerrousRokiricCard(),
    new GeneralFerrousRokiricCard(),
    new GeneralFerrousRokiricCard(),
    new IroasGodOfVictoryCard(),
    new RadiantScrollwielderCard(),
    new ZadaHedronGrinderCard(),

    new FloweringOfTheWhiteTreeCard(),

    new LightningBoltCard(),
    new LightningBoltCard(),
    new LightningBoltCard(),
    new RecklessRageCard(),
    new BorosCharmCard(),
    new BorosCharmCard(),
    new BorosCharmCard(),
    new BorosCharmCard(),
    new LightningHelixCard(),
    new LightningHelixCard(),
    new LightningHelixCard(),
    new LightningHelixCard(),
    new IntegrityInterventionCard(),
    new IntegrityInterventionCard(),

    new RipApartCard(),
    new ThrillingDiscoveryCard(),
    new AngelfireIgnitionCard(),
    new AngelfireIgnitionCard(),
    new AngelfireIgnitionCard(),
    new AngelfireIgnitionCard(),

    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Plains", Color.white),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red),
    new BasicLandCard("Mountain", Color.red)
  ], 20, shuffleDeck);
  p.name = "Player" + p.uuid.toString().slice(2, 5);
  return p;
};

export function Initialize(...plist: Player[]) {
  // Re-initialize all global variables.
  UpdateGlobals([], new TurnManagerClass(...plist), new StackManagerClass());
  // Draw some cards
  for (let i of TurnManager.playerList) i.drawCard(50);
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
  };
  console.log("Beginning tests.");
  let p1 = getPlayer();
  let p2 = getPlayer();
  Initialize(p1, p2);
  TurnManager.advance(Step.precombat_main);
  p1.landPlays = 999;
}