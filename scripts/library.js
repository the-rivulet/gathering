import { PermanentCard, CreatureCard, AuraCard, SpellCard } from "./card.js";
import { ActivatedAbility } from "./ability.js";
import { AddManaEffect, CreateTokenEffect, AddCounterOnSelfEffect, ApplyAbilityOnSelfEffect } from "./effect.js";
import { SacrificeSelfCost, TapCost } from "./cost.js";
import { Mana, ManaCost } from "./mana.js";
import { PlayCardHook, BeginStepHook, StatsHook, ProtectionAbility } from "./hook.js";
import { Creature } from "./permanent.js";
import { Battlefield } from "./globals.js";
import { Step } from "./turn.js";
class TreasureTokenCard extends PermanentCard {
    constructor() {
        super('Treasure', ['Artifact', 'Token', 'Treasure'], 'Sacrifice {CARDNAME}: Add one mana of any color to your mana pool.', undefined, new ActivatedAbility(new SacrificeSelfCost(), new AddManaEffect({ any: 1 })));
    }
    makeEquivalentCopy = () => new TreasureTokenCard();
}
export class ForestCard extends PermanentCard {
    constructor() {
        super('Forest', ['Land', 'Basic', 'Forest'], '{A1}{T}{EC1}Add {G}.{EA1}', undefined, new ActivatedAbility(new TapCost(), new AddManaEffect({ green: 1 })));
    }
    makeEquivalentCopy = () => new ForestCard();
}
export class LlanowarElvesCard extends CreatureCard {
    constructor() {
        super('Llanowar Elves', ['Creature', 'Elf', 'Druid'], '{A1}{T}{EC1}Add {G}.{EA1}', 1, 1, new ManaCost({ green: 1 }), new ActivatedAbility(new TapCost(), new AddManaEffect({ green: 1 })));
    }
    makeEquivalentCopy = () => new LlanowarElvesCard();
}
export class GiantGrowthCard extends SpellCard {
    constructor() {
        super('Giant Growth', ['Instant'], 'Target creature gets +3/+3 until end of turn.', target => target.length == 1 && target[0] instanceof Creature, (p, s) => Battlefield.filter(x => x instanceof Creature).length > 0, (self, targets) => {
            let target = targets[0];
            new ApplyAbilityOnSelfEffect(new StatsHook(orig => (that, stat) => {
                return orig(that, stat) + 3;
            })).resolve(target);
        }, new ManaCost({ green: 1 }));
    }
}
class FerrousRokiricCard extends CreatureCard {
    constructor() {
        super('General Ferrous Rokiric', ['Creature', 'Legendary', 'Human', 'Soldier'], 'Protection from monocolored. Whenever you cast a multicolored spell, create a 4/4 red and white Golem token.', 3, 1, new ManaCost({ red: 1, white: 1, colorless: 1 }), [
            new ProtectionAbility(source => source.colors.length == 1),
            new PlayCardHook(orig => (that, card, free, noCheck, force) => {
                if (!(card.types.includes("Land")) && card.colors.length >= 2 && this.representedPermanent) {
                    new CreateTokenEffect(new CreatureCard("Golem Token", ["Creature", "Token", "Golem"], "", 4, 4)).resolve(this.representedPermanent);
                }
                return orig(that, card, free, noCheck, force);
            }),
        ]);
    }
    makeEquivalentCopy = () => new FerrousRokiricCard();
}
export class ForcedAdaptationCard extends AuraCard {
    constructor() {
        super('Forced Adaptation', 'At the beginning of your upkeep, put a +1/+1 counter on enchanted creature.', x => x instanceof Creature, new ManaCost({ green: 1 }), new BeginStepHook(orig => that => {
            orig(that);
            if (that.step == Step.upkeep && that.currentPlayer == this.attached.controller) {
                new AddCounterOnSelfEffect('+1/+1').resolve(this.attached);
            }
        }));
    }
    makeEquivalentCopy = () => new ForcedAdaptationCard();
}
// Now for the REAL challenge... Random legendary creatures.
class KarnLegacyReforgedCard extends CreatureCard {
    constructor() {
        super('Karn, Legacy Reforged', ['Creature', 'Artifact', 'Legendary', 'Golem'], `{CARDNAME}'s power and toughness are each equal to the greatest mana value among artifacts you control.
        At the beginning of your upkeep, add {C} for each artifact you control.
        This mana can't be spent to cast nonartifact spells.
        Until end of turn, you don't lose this mana as steps and phases end.`, card => Math.max(...Battlefield.filter(x => x.controller == card.controller && x.types.includes('Artifact')).map(x => (x.representedCard.manaCost || new ManaCost(new Mana())).mana.value)), card => Math.max(...Battlefield.filter(x => x.controller == card.controller && x.types.includes('Artifact')).map(x => (x.representedCard.manaCost || new ManaCost(new Mana())).mana.value)), new ManaCost({ colorless: 5 }), new BeginStepHook(orig => that => {
            orig(that);
            if (that.step == Step.upkeep && this.representedPermanent) {
                new AddManaEffect(new Mana({ colorless: 1 }, payFor => payFor.types.includes('Artifact'), true)).resolve(this.representedPermanent);
            }
        }));
    }
    makeEquivalentCopy = () => new KarnLegacyReforgedCard();
}
