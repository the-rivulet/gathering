import { Battlefield } from "./globals.js";
import { Ability } from "./ability.js";
/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`.
*/
export function ApplyHooks(isHook, orig, that, ...args) {
    for (let c of Battlefield) {
        for (let a of c.abilities) {
            if (isHook(a)) {
                orig = a.apply(orig);
            }
        }
    }
    return orig(that, ...args);
}
export class Hook extends Ability {
}
export class DestroyPermanentHook extends Hook {
    apply;
    constructor(apply) {
        super();
        this.apply = apply;
    }
}
export class BeginStepHook extends Hook {
    apply;
    constructor(apply) {
        super();
        this.apply = apply;
    }
}
export class PlayCardHook extends Hook {
    apply;
    constructor(apply) {
        super();
        this.apply = apply;
    }
}
export class StatsHook extends Hook {
    apply;
    constructor(apply) {
        super();
        this.apply = apply;
    }
}
