import { Battlefield } from "./globals.js";
import { Ability, ComputedAbility } from "./ability.js";
/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`. Pass `this` to the parameter `that`.
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
export class HasValidTargetsHook extends Hook {
    apply;
    constructor(apply) {
        super();
        this.apply = apply;
    }
}
export class CheckTargetsHook extends Hook {
    apply;
    constructor(apply) {
        super();
        this.apply = apply;
    }
}
export class ProtectionAbility extends ComputedAbility {
    constructor(applicable) {
        super(card => [
            new HasValidTargetsHook(orig => (that, field) => {
                return orig(that, field.filter(x => x != card || !applicable(that || that.card)));
            }),
            new CheckTargetsHook(orig => (that, field) => {
                return orig(that, field.filter(x => x != card || !applicable(that || that.card)));
            })
        ]);
    }
}
