import { PermanentCard, CreatureCard, AuraCard, SpellCard } from "./card.js";
import { SimpleActivatedAbility, FirstStrikeAbility, VigilanceAbility, TrampleAbility } from "./ability.js";
import { MultipleEffect, AddManaEffect, CreateTokenEffect, AddCounterEffect, ApplyAbilityEffect, SetStatsEffect, SetTypesEffect, DelayedEffect, MoveCardsEffect } from "./effect.js";
import { SacrificeSelfCost, TapCost } from "./cost.js";
import { ManaCost, ManaPool } from "./mana.js";
import { PlayCardHook, BeginStepHook, StatsHook, ProtectionAbility, FlyingAbility, HeroicAbility, ResolveCardHook } from "./hook.js";
import { Creature } from "./permanent.js";
import { Battlefield } from "./globals.js";
import { Step } from "./turn.js";
import { Zone } from "./zone.js";
class TreasureTokenCard extends PermanentCard {
    constructor() {
        super('Treasure Token', ['Artifact', 'Token', 'Treasure'], 'Sacrifice {CARDNAME}: Add one mana of any color to your mana pool.', undefined, new SimpleActivatedAbility(new SacrificeSelfCost(), card => card.controller.getColor("Choose a color", result => new AddManaEffect({ [result]: 1 }).resolve(card))));
    }
    makeEquivalentCopy = () => new TreasureTokenCard();
}
export class ForestCard extends PermanentCard {
    constructor() {
        super('Forest', ['Land', 'Basic', 'Forest'], '{A1}{T}{EC1}Add {G}.{EA1}', undefined, new SimpleActivatedAbility(new TapCost(), card => new AddManaEffect({ green: 1 }).resolve(card)));
    }
    makeEquivalentCopy = () => new ForestCard();
}
export class LlanowarElvesCard extends CreatureCard {
    constructor() {
        super('Llanowar Elves', ['Creature', 'Elf', 'Druid'], '{A1}{T}{EC1}Add {G}.{EA1}', 1, 1, 
        //new ManaCost({ green: 1 }),
        new ManaCost({ green: 1 }), new SimpleActivatedAbility(new TapCost(), card => new AddManaEffect({ green: 1 }).resolve(card)));
    }
    makeEquivalentCopy = () => new LlanowarElvesCard();
}
export class GiantGrowthCard extends SpellCard {
    constructor() {
        super('Giant Growth', ['Instant'], 'Target creature gets +3/+3 until end of turn.', target => target.length == 1 && target[0] instanceof Creature, (p, s) => Battlefield.filter(x => x instanceof Creature).length > 0, (self, targets) => {
            let target = targets[0];
            new ApplyAbilityEffect(new StatsHook((me, orig, that, stat) => {
                if (!me.is(that))
                    return orig(that, stat);
                return orig(that, stat) + 3;
            })).resolve(target);
        }, new ManaCost({ green: 1 }));
    }
}
export class ForcedAdaptationCard extends AuraCard {
    constructor() {
        super('Forced Adaptation', 'At the beginning of your upkeep, put a +1/+1 counter on enchanted creature.', x => x instanceof Creature, new ManaCost({ green: 1 }), new BeginStepHook((me, orig, that) => {
            orig(that);
            if (that.step == Step.upkeep && that.currentPlayer.is(this.attached.controller)) {
                new AddCounterEffect('+1/+1').resolve(this.attached);
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
        Until end of turn, you don't lose this mana as steps and phases end.`, card => Math.max(...Battlefield.filter(x => x.controller.is(card.controller) && x.hasType('Artifact')).map(x => (x.representedCard.manaCost || new ManaCost()).value)), card => Math.max(...Battlefield.filter(x => x.controller.is(card.controller) && x.hasType('Artifact')).map(x => (x.representedCard.manaCost || new ManaCost()).value)), new ManaCost({ generic: 5 }), new BeginStepHook((me, orig, that) => {
            orig(that);
            if (that.step == Step.upkeep && this.representedPermanent) {
                new AddManaEffect(new ManaPool({ colorless: 1, canPayFor: payFor => payFor.hasType('Artifact'), keep: true })).resolve(this.representedPermanent);
            }
        }));
    }
    makeEquivalentCopy = () => new KarnLegacyReforgedCard();
}
// The boros rokiric deck
class FigureOfDestinyCard extends CreatureCard {
    constructor() {
        super('Figure of Destiny', ['Creature', 'Kithkin'], `{R/W}: {CARDNAME} becomes a 2/2 Kithkin Spirit.
        3 x {R/W} If {CARDNAME} is a Spirit, it becomes a 4/4 Kithkin Spirit Warrior.
        6 x {R/W}: If {CARDNAME} is a Warrior, it becomes a 8/8 Kithkin Spirit Warrior Avatar with flying and first strike.`, 1, 1, new ManaCost({ choices: [[{ red: 1 }, { white: 1 }]] }), [
            new SimpleActivatedAbility(new ManaCost({ choices: [[{ red: 1, white: 1 }]] }), card => {
                new MultipleEffect(new SetStatsEffect(2, 2), new SetTypesEffect(["Kithkin", "Spirit"])).queue(card);
            }),
            new SimpleActivatedAbility(new ManaCost({ choices: [[{ red: 3, white: 3 }]] }), card => {
                if (!card.hasType("Spirit"))
                    return;
                new MultipleEffect(new SetStatsEffect(4, 4), new SetTypesEffect(["Kithkin", "Spirit", "Warrior"])).queue(card);
            }),
            new SimpleActivatedAbility(new ManaCost({ choices: [[{ red: 6, white: 6 }]] }), card => {
                if (!card.hasType("Warrior"))
                    return;
                new MultipleEffect(new SetStatsEffect(8, 8), new SetTypesEffect(["Kithkin", "Spirit", "Warrior", "Avatar"]), new ApplyAbilityEffect(new FlyingAbility()), new ApplyAbilityEffect(new FirstStrikeAbility())).queue(card);
            })
        ]);
    }
    makeEquivalentCopy = () => new FigureOfDestinyCard();
}
class GeneralFerrousRokiricCard extends CreatureCard {
    constructor() {
        super('General Ferrous Rokiric', ['Creature', 'Legendary', 'Human', 'Soldier'], 'Protection from monocolored. Whenever you cast a multicolored spell, create a 4/4 red and white Golem token.', 3, 1, new ManaCost({ red: 1, white: 1, colorless: 1 }), [
            new ProtectionAbility(source => source.colors.length == 1),
            new PlayCardHook((me, orig, that, card, free, noCheck, force) => {
                if (!(card.hasType("Land")) && card.colors.length >= 2) {
                    new CreateTokenEffect(new CreatureCard("Golem Token", ["Creature", "Token", "Golem"], "", 4, 4)).queue(this.representedPermanent);
                }
                return orig(that, card, free, noCheck, force);
            }),
        ]);
    }
    makeEquivalentCopy = () => new GeneralFerrousRokiricCard();
}
class AnaxAndCymedeCard extends CreatureCard {
    constructor() {
        super('Anax and Cymede', ['Creature', 'Legendary', 'Human', 'Soldier'], 'First strike, vigilance. Heroic ~ Creatures you control get +1/+1 and gain trample until end of turn.', 3, 2, new ManaCost({ red: 1, white: 1, colorless: 1 }), [
            new FirstStrikeAbility(),
            new VigilanceAbility(),
            new HeroicAbility((me, casting, targets) => {
                for (let i of Battlefield.filter(x => x.controller.is(me.controller))) {
                    if (i instanceof Creature) {
                        new MultipleEffect(new ApplyAbilityEffect(new StatsHook((me, orig, that, stat) => {
                            if (!me.is(that))
                                return orig(that, stat);
                            return orig(that, stat) + 3;
                        })), new ApplyAbilityEffect(new TrampleAbility())).queue(i);
                    }
                }
            })
        ]);
    }
}
class FeatherTheRedeemedCard extends CreatureCard {
    constructor() {
        super('Feather, the Redeemed', ['Creature', 'Legendary', 'Angel'], `Flying
      Whenever you cast a spell that targets a creature you control,
      exile that card instead of putting it into your graveyard as it resolves.
      If you do, return it to your hand at the beginning of the next end step.`, 3, 4, new ManaCost({ red: 1, white: 2 }), new ResolveCardHook((me, orig, that, card, targets) => {
            if (card instanceof SpellCard && that.is(card.controller) && targets.filter(x => x instanceof Creature && x.controller.is(me.controller)).length) {
                card.resolve(card, targets);
                that.moveCardTo(card, Zone.exile);
                new DelayedEffect(new MoveCardsEffect(Zone.hand, card), Step.end).queue(me);
            }
            else
                orig(that, card, targets);
        }));
    }
}
// TODO: rest of deck
