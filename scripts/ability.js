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
    // This is so stupid
    constructor() { super(); }
}
// This should use hooking
/*
class TriggeredAbility extends Ability {
  trigger: Trigger[];
  effect: Effect[];
  constructor(trigger: Trigger[] | Trigger, effect: Effect[] | Effect) {
    super(); // Pointless lol
    this.trigger = trigger instanceof Trigger ? [trigger] : trigger;
    this.effect = effect instanceof Effect ? [effect] : effect;
  }
  resolve(event: string, card: Permanent, data: object) {
    let triggered = this.trigger
      .filter(x => x.event == event)
      .filter(x => x.valid(card, data));
    if (triggered.length) {
      for (let i of this.effect) {
        if(!i.resolve(card)) break;
      }
    }
  }
}*/
/*class ProwessAbility extends TriggeredAbility {
  constructor() {
    super(new OnAttackTrigger(), new ApplyModifierOnSelfEffect(new StatsModifier(p => p + 1, t => t + 1)));
  }
}*/
/*abstract class StaticAbility extends Ability {
  // A common parent for static abilities specifically. Does nothing itself.
}

class AddModifiersAbility extends StaticAbility {
  req: (me: Permanent, p: Permanent) => boolean;
  modifiers: Modifier[];
  constructor(
    req: (me: Permanent, p: Permanent) => boolean,
    modifiers: Modifier[] | Modifier
  ) {
    super(); // Pointless lol
    this.req = req;
    this.modifiers = modifiers instanceof Modifier ? [modifiers] : modifiers;
  }
}

class AddAbilitiesAbility extends StaticAbility {
  req: (me: Permanent, p: Permanent) => boolean;
  abilities: Ability[];
  constructor(
    req: (me: Permanent, p: Permanent) => boolean,
    abilities: Ability[] | Ability
  ) {
    super(); // Pointless lol
    this.req = req;
    this.abilities = abilities instanceof Ability ? [abilities] : abilities;
  }
}

class PreventActivationAbility extends StaticAbility {
  req: (me: Permanent, p: Permanent, abil: ActivatedAbility) => boolean;
  constructor(req: (me: Permanent, p: Permanent, abil: ActivatedAbility) => boolean) {
    super(); // Pointless lol
    this.req = req;
  }
}

class ModifyCostsAbility extends StaticAbility {
  req: (me: Permanent, p: Permanent) => boolean;
  mod: (cost: Cost) => Cost;
  constructor(req: (me: Permanent, p: Permanent) => boolean, mod: (cost: Cost) => Cost) {
    super(); // Pointless lol
    this.req = req;
    this.mod = mod;
  }
}

class TrampleAbility extends StaticAbility {}
class IndestructibleAbility extends StaticAbility {}
class HasteAbility extends StaticAbility {}

class MultiblockAbility extends StaticAbility {
  bonus: number;
  constructor(bonus: number = Infinity) {
    super();
    this.bonus = bonus;
  }
}

class ProtectionAbility extends StaticAbility {
  validate: (source: Permanent | Player, me: Permanent) => boolean;
  constructor(validate: (source: Permanent | Player, me: Permanent) => boolean) {
    super();
    this.validate = validate;
  }
}

class WardAbility extends StaticAbility {
  cost: Cost;
  constructor(cost: Cost) {
    super(); this.cost = cost;
  }
}

class UnblockableAbility extends StaticAbility {
  validate: (blocker: Creature, me: Creature) => boolean;
  constructor(validate: (blocker: Creature, me: Creature) => boolean = (b, me) => true) {
    super();
    this.validate = validate;
  }
}
class SkulkAbility extends UnblockableAbility {
  constructor() {
    super((b, me) => b.power > me.power);
  }
}*/
