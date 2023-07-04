import { StackActivation } from "./stack.js";
import { StackManager } from "./globals.js";
import { UI } from "./ui.js";
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
    baseCost;
    effect;
    constructor(cost, effect) {
        super(); // Pointless lol
        this.baseCost = cost;
        this.effect = Array.isArray(effect) ? effect : [effect];
    }
    get manaAbility() {
        return this.effect.filter(x => x.manaEffect).length == this.effect.length;
    }
    getCost(me) {
        return this.baseCost;
        // For hooks.
    }
    activate(card) {
        //if (Battlefield.filter(x => x.abilities.filter(y => y instanceof PreventActivationAbility && y.req(x, card, this)).length).length) return false;
        if (!this.getCost(card).pay(card, true))
            return false;
        if (this.manaAbility) {
            this.effect.forEach(i => i.resolve(card)); // If mana ability, no need to stack it
            UI.renderBattlefield();
        }
        else
            StackManager.add(new StackActivation(this, card));
        return true;
    }
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
