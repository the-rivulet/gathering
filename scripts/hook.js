import { Permanent, Creature } from "./permanent.js";
import { Step } from "./turn.js";
import { Battlefield, TurnManager } from "./globals.js";
import { Ability, ComputedAbility, ReachAbility } from "./ability.js";
/**
* `orig` should be a function that takes `that:` (whatever `this`'s type is) plus the method's parameters, and returns the method's return type.
* It should use the `that` argument passed to it instead of `this`. Pass `this` to the parameter `that`.
*/
export function ApplyHooks(hook, orig, that, ...args) {
    for (let c of Battlefield) {
        for (let a of (hook instanceof AbilitiesHook ? c.abilities : [...c.tempAbilities, ...c.eternalAbilities, ...c.baseAbilities].map(x => x instanceof ComputedAbility ? x.evaluate(c) : x).flat())) {
            if (a instanceof hook) {
                orig = a.apply(c, orig);
            }
        }
    }
    return orig(that, ...args);
}
export class Hook extends Ability {
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
export class IndestructibleAbility extends DestroyPermanentHook {
    constructor() {
        // Do nothing.
        super((me, orig, that) => { });
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
                return orig(that, field.filter(x => !x.is(me) || !applicable(that || that.card)));
            }),
            new CheckTargetsHook((me, orig, that, field) => {
                return orig(that, field.filter(x => !x.is(me) || !applicable(that || that.card)));
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
export class ResolveCardHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class TypesHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class AbilitiesHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class ValidStateHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class MenaceAbility extends ValidStateHook {
    constructor() {
        super((me, orig, that) => {
            if (that.step == Step.declare_blockers && me instanceof Creature && me.blockedBy.length == 1)
                return false;
            else
                return orig(that);
        });
    }
}
export class TakeDamageHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class LifelinkAbility extends TakeDamageHook {
    constructor() {
        super((me, orig, that, source, amount, combat, destroy) => {
            orig(that, source, amount, combat, destroy);
            if (that instanceof Permanent && that.is(me))
                that.controller.gainLife(that, amount);
        });
    }
}
export class CardClickHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class SubmitSelectionHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
export class WardAbility extends ComputedAbility {
    cost;
    constructor(cost) {
        super(card => [
            new CardClickHook((me, orig, that) => {
                if (!that.is(me.representedCard) || !TurnManager.ongoingSelection || !that.is(me.representedCard))
                    return orig(that);
                if (!cost.payPlayer(TurnManager.selectingPlayer, false))
                    return;
                orig(that);
            }),
            new SubmitSelectionHook((me, orig, that, selection) => {
                if (selection.filter(x => x.item instanceof Permanent && x.item.is(me)).length)
                    cost.payPlayer(that, true);
                orig(that, selection);
            })
        ]);
        this.cost = cost;
    }
}
export class FinishedResolvingSpellHook extends Hook {
    constructor(apply) {
        super(apply);
    }
}
