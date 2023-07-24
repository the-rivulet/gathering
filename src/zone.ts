import type { Card } from "./card.js";

export enum Zone {
  library = "library",
  hand = "hand",
  graveyard = "graveyard",
  exile = "exile",
  battlefield = "battlefield",
  limbo = "limbo",
  stack = "stack"
}

export class ZoneManager {
  // A helper to manage players' zones.
  library: Card[] = [];
  hand: Card[] = [];
  graveyard: Card[] = [];
  exile: Card[] = [];
  battlefield: Card[] = [];
  limbo: Card[] = [];
  get all() {
    return [...this.battlefield, ...this.exile, ...this.graveyard, ...this.hand, ...this.library, ...this.limbo];
  }
}