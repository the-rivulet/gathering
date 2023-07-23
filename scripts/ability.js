export class Ability {
}
export class ComputedAbility extends Ability {
    evaluate;
    constructor(e) {
        super();
        this.evaluate = e;
    }
}
export class ActivatedAbility extends Ability {
}
export class SimpleActivatedAbility extends ActivatedAbility {
    cost;
    effect;
    manaAbility;
    constructor(cost, effect, isManaAbility = false) {
        super(); // Pointless lol
        this.cost = cost;
        this.effect = effect;
        this.manaAbility = isManaAbility;
    }
    activate(card) {
        //if (Battlefield.filter(x => x.abilities.filter(y => y instanceof PreventActivationAbility && y.req(x, card, this)).length).length) return false;
        if (!this.cost.pay(card, true))
            return false;
        this.effect(card);
        return true;
    }
}
export class TargetedActivatedAbility extends ActivatedAbility {
    validate;
    possible;
    effect;
    limitOne;
    constructor(validate, possible, effect, limitOne = false) {
        super();
        this.validate = validate;
        this.possible = possible;
        this.effect = effect;
        this.limitOne = limitOne;
    }
    ;
    activate(card) {
        return card.controller.selectTargets(undefined, this.validate(card), this.possible(card), "Select some targets", result => this.effect(card, result), this.limitOne);
    }
}
export class EmptyAbility extends Ability {
}
export class ReachAbility extends EmptyAbility {
    constructor() { super(); }
}
export class FirstStrikeAbility extends EmptyAbility {
    constructor() { super(); }
}
export class DoubleStrikeAbility extends EmptyAbility {
    constructor() { super(); }
}
export class VigilanceAbility extends EmptyAbility {
    constructor() { super(); }
}
export class TrampleAbility extends EmptyAbility {
    constructor() { super(); }
}
