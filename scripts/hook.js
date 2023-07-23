import { Battlefield } from "./globals.js";
import { Ability, ComputedAbility, ReachAbility } from "./ability.js";
/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`. Pass `this` to the parameter `that`.
*/
export function ApplyHooks(hook, orig, that, ...args) {
    for (let c of Battlefield) {
        for (let a of c.abilities) {
            if (a instanceof hook) {
                orig = a.apply(c, orig);
            }
        }
    }
    return orig(that, ...args);
}
export class Hook extends Ability {
    // "Hooks" a method to modify it.
    apply;
    constructor(apply) {
        super();
        this.apply = (me, orig) => (that, ...args) => apply(me, orig, that, ...args);
    }
}
export class DestroyPermanentHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class BeginStepHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class PlayCardHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class StatsHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class HasValidTargetsHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class CheckTargetsHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class ProtectionAbility extends ComputedAbility {
    constructor(applicable) {
        super(card => [
            new HasValidTargetsHook((me, orig, that, field) => {
                return orig(that, field.filter(x => x != card || !applicable(that || that.card)));
            }),
            new CheckTargetsHook((me, orig, that, field) => {
                return orig(that, field.filter(x => x != card || !applicable(that || that.card)));
            })
        ]);
    }
}
export class MarkAsBlockerHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class FlyingAbility extends MarkAsBlockerHook {
    constructor() {
        super((me, orig, that, card, blocking, real) => {
            if (me.is(blocking) && !card.hasAbility(ReachAbility) && !card.hasAbility(FlyingAbility))
                return false;
            return orig(that, card, blocking, real);
        });
    }
}
export class SelectTargetsHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class HeroicAbility extends SelectTargetsHook {
    constructor(effect) {
        super((me, orig, that, casting, validate, possible, message, continuation, limitOne) => {
            return orig(that, casting, validate, possible, message, result => {
                continuation(result);
                if (result.includes(me))
                    effect(me, casting, result);
            }, limitOne);
        });
    }
}
