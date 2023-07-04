import type { Permanent } from "./permanent.js";
import type { TurnManagerClass } from "./turn.js";
import type { StackManagerClass } from "./stack.js";

export let Battlefield: Permanent[];

export let TurnManager: TurnManagerClass;

export let StackManager: StackManagerClass;

export function UpdateGlobals(bf: Permanent[] = [], tm?: TurnManagerClass, sm?: StackManagerClass) {
    Battlefield = bf;
    TurnManager = tm;
    StackManager = sm;
}

export let Settings = {
  slugcatMana: true,    // boolean  Whether to use slugcats in place of certain symbols.
  highestSymbol: 6,     // number   When to start using text as a fallback in place of missing generic mana images.
  maxRepeats: 100       // number   The max number of times the stack can be repeatedly resolved.
};