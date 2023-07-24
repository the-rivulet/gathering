import { TypeList, PermanentCard, CreatureCard, AuraCard, SpellCard, SimpleSpellCard, SplitSpellCard } from "./card.js";
import { SimpleActivatedAbility, FirstStrikeAbility, VigilanceAbility, TrampleAbility, DoubleStrikeAbility } from "./ability.js";
import { MultipleEffect, AddManaEffect, CreateTokenEffect, AddCounterEffect, ApplyAbilityEffect, SetStatsEffect, SetTypesEffect, DelayedEffect, MoveCardsEffect, QueueCardsEffect } from "./effect.js";
import { SacrificeSelfCost, TapCost } from "./cost.js";
import { ManaCost, ManaPool, Color } from "./mana.js";
import { PlayCardHook, BeginStepHook, StatsHook, ProtectionAbility, FlyingAbility, HeroicAbility, ResolveCardHook, IndestructibleAbility, TypesHook, AbilitiesHook, MenaceAbility, TakeDamageHook, CardClickHook, SelectTargetsHook, WardAbility } from "./hook.js";
import { Creature } from "./permanent.js";
import { Battlefield, TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { Zone } from "./zone.js";
class TreasureTokenCard extends PermanentCard {
    constructor() {
        super("Treasure Token", ["Artifact", "Token", "Treasure"], "Sacrifice {CARDNAME}: Add one mana of any color to your mana pool.", undefined, new SimpleActivatedAbility(new SacrificeSelfCost(), card => card.controller.getColor("Choose a color", result => new AddManaEffect({ [result]: 1 }).resolve(card))));
    }
    makeEquivalentCopy = () => new TreasureTokenCard();
}
export class BasicLandCard extends PermanentCard {
    constructor(name, color) {
        super(name, ["Basic", "Land", name], "{A1}{T}{EC1}Add {" + Color[color] + "}.{EA1}", undefined, new SimpleActivatedAbility(new TapCost(), card => new AddManaEffect({ [color]: 1 }).resolve(card)));
    }
}
export class LlanowarElvesCard extends CreatureCard {
    constructor() {
        super("Llanowar Elves", ["Creature", "Elf", "Druid"], "{A1}{T}{EC1}Add {G}.{EA1}", 1, 1, 
        //new ManaCost({ green: 1 }),
        new ManaCost({ green: 1 }), new SimpleActivatedAbility(new TapCost(), card => new AddManaEffect({ green: 1 }).resolve(card)));
    }
    makeEquivalentCopy = () => new LlanowarElvesCard();
}
export class GiantGrowthCard extends SimpleSpellCard {
    constructor() {
        super("Giant Growth", ["Instant"], "Target creature gets +3/+3 until end of turn.", (self, target) => {
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
        super("Forced Adaptation", "At the beginning of your upkeep, put a +1/+1 counter on enchanted creature.", x => x instanceof Creature, new ManaCost({ green: 1 }), new BeginStepHook((me, orig, that) => {
            orig(that);
            if (that.step == Step.upkeep && that.currentPlayer.is(me.controller)) {
                new AddCounterEffect("+1/+1").resolve(this.attached);
            }
        }));
    }
    makeEquivalentCopy = () => new ForcedAdaptationCard();
}
// Random legendary creatures (probably don't need to export these)
class KarnLegacyReforgedCard extends CreatureCard {
    constructor() {
        super("Karn, Legacy Reforged", ["Creature", "Artifact", "Legendary", "Golem"], `{CARDNAME}'s power and toughness are each equal to the greatest mana value among artifacts you control.
        At the beginning of your upkeep, add {C} for each artifact you control.
        This mana can't be spent to cast nonartifact spells.
        Until end of turn, you don't lose this mana as steps and phases end.`, card => Math.max(...Battlefield.filter(x => x.controller.is(card.controller) && x.hasType('Artifact')).map(x => (x.representedCard.manaCost || new ManaCost()).value)), card => Math.max(...Battlefield.filter(x => x.controller.is(card.controller) && x.hasType('Artifact')).map(x => (x.representedCard.manaCost || new ManaCost()).value)), new ManaCost({ generic: 5 }), new BeginStepHook((me, orig, that) => {
            orig(that);
            if (that.step == Step.upkeep && this.representedPermanent) {
                new AddManaEffect(new ManaPool({
                    colorless: 1, canPayFor: payFor => payFor.hasType("Artifact"), keep: true
                })).resolve(this.representedPermanent);
            }
        }));
    }
    makeEquivalentCopy = () => new KarnLegacyReforgedCard();
}
// The boros rokiric deck
export class FigureOfDestinyCard extends CreatureCard {
    constructor() {
        super("Figure of Destiny", ["Creature", "Kithkin"], `{R/W}: {CARDNAME} becomes a 2/2 Kithkin Spirit.
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
export class GeneralFerrousRokiricCard extends CreatureCard {
    constructor() {
        super("General Ferrous Rokiric", ["Creature", "Legendary", "Human", "Soldier"], "Protection from monocolored. Whenever you cast a multicolored spell, create a 4/4 red and white Golem token.", 3, 1, new ManaCost({ red: 1, white: 1, colorless: 1 }), [
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
export class AnaxAndCymedeCard extends CreatureCard {
    constructor() {
        super("Anax and Cymede", ["Creature", "Legendary", "Human", "Soldier"], "First strike, vigilance. Heroic ~ Creatures you control get +1/+1 and gain trample until end of turn.", 3, 2, new ManaCost({ red: 1, white: 1, colorless: 1 }), [
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
export class FeatherTheRedeemedCard extends CreatureCard {
    constructor() {
        super("Feather, the Redeemed", ["Creature", "Legendary", "Angel"], `Flying.
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
export class IroasGodOfVictoryCard extends CreatureCard {
    constructor() {
        super("Iroas, God of Victory", ["Creature", "Enchantment", "Legendary", "God"], `Indestructible. As long as your devotion to red and white is less than seven, {CARDNAME} isn't a creature.
      Creatures you control have menace.
      Prevent all damage that would be dealt to attacking creatures you control.`, 7, 4, new ManaCost({ red: 1, white: 1, generic: 2 }), [
            new IndestructibleAbility(),
            new TypesHook((me, orig, that) => {
                if (!me.is(that) || that.controller.devotionTo(Color.red, Color.white) >= 7)
                    return orig(that);
                return new TypeList(orig(that).list.filter(x => x != "Creature"));
            }),
            new AbilitiesHook((me, orig, that) => {
                if (!that.controller.is(me.controller))
                    return orig(that);
                return [...orig(that), new MenaceAbility()];
            }),
            new TakeDamageHook((me, orig, that, source, amount, combat, destroy) => {
                if (!(that instanceof Creature) || !that.controller.is(me.controller) || !that.attacking)
                    return orig(that, source, amount, combat, destroy);
            })
        ]);
    }
}
export class RadiantScrollwielderCard extends CreatureCard {
    constructor() {
        super("Radiant Scrollwielder", ["Creature", "Dwarf", "Cleric"], `Instant and sorcery spells you control have lifelink.
      At the beginning of your upkeep, exile a random instant or sorcery card from your graveyard.
      You may cast it this turn.
      If a spell cast this way would be put into your graveyard, exile it instead.`, 2, 4, new ManaCost({ red: 1, white: 1, generic: 2 }), [
            new TakeDamageHook((me, orig, that, source, amount, combat, destroy) => {
                orig(that, source, amount, combat, destroy);
                if (source instanceof SpellCard && source.controller.is(me.controller))
                    me.controller.gainLife(source, amount);
            }),
            new BeginStepHook((me, orig, that) => {
                orig(that);
                if (that.step == Step.upkeep && that.currentPlayer.is(me.controller)) {
                    let spells = me.controller.zones.graveyard.filter(x => x.hasType("Instant") || x.hasType("Sorcery"));
                    if (!spells.length)
                        return;
                    let spell = spells[Math.floor(Math.random() * spells.length)];
                    new ApplyAbilityEffect(new CardClickHook((me2, orig2, that2) => {
                        if (!that2.is(spell) || TurnManager.ongoingSelection)
                            return orig2(that2);
                        new ApplyAbilityEffect(new ResolveCardHook((me3, orig3, that3, card, targets) => {
                            if (card.is(spell) && card instanceof SpellCard) {
                                card.resolve(card, targets);
                                that3.moveCardTo(card, Zone.exile);
                            }
                            else
                                orig3(that3, card, targets);
                        })).resolve(me2);
                        that2.play();
                    })).queue(me);
                }
            })
        ]);
    }
}
export class ZadaHedronGrinderCard extends CreatureCard {
    constructor() {
        super("Zada, Hedron Grinder", ["Creature", "Legendary", "Goblin", "Ally"], `Whenever you cast an instant or sorcery spell that targets only {CARDNAME},
      copy that spell for each other creature you control that the spell could target.
      Each copy targets a different one of those creatures.`, 3, 3, new ManaCost({ red: 1, generic: 3 }), new SelectTargetsHook((me, orig, that, casting, validate, possible, message, continuation, limitOne) => {
            return orig(that, casting, validate, possible, message, result => {
                continuation(result);
                if (casting instanceof SpellCard && result.length == 1 && result[0].is(me)) {
                    for (let i of Battlefield.filter(x => !x.is(me) && validate([x]))) {
                        new QueueCardsEffect({ card: casting, targets: [i] }).queue(me);
                    }
                }
            }, limitOne);
        }));
    }
}
export class FloweringOfTheWhiteTreeCard extends PermanentCard {
    constructor() {
        super("Flowering of the White Tree", ["Legendary", "Enchantment"], `Legendary creatures you control get +2/+1 and have ward {1}.
      Nonlegendary creatures you control get +1/+1.`, new ManaCost({ white: 2 }), [
            new StatsHook((me, orig, that, stat) => {
                return orig(that, stat) + ((that.hasType("Legendary") && stat == "power") ? 2 : 1);
            }),
            new AbilitiesHook((me, orig, that) => {
                if (that.hasType("Legendary"))
                    return [...orig(that), new WardAbility(new ManaCost({ generic: 1 }))];
                return orig(that);
            })
        ]);
    }
}
export class LightningBoltCard extends SimpleSpellCard {
    constructor() {
        super("Lightning Bolt", ["Instant"], "{CARDNAME} deals 3 damage to any target.", (self, target) => { target.takeDamage(self, 3); }, new ManaCost({ red: 1 }));
    }
}
export class RecklessRageCard extends SpellCard {
    constructor() {
        super("Reckless Rage", ["Instant"], "{CARDNAME} deals 4 damage to target creature you don't control and 2 damage to target creature you control.", (self, targets) => targets.length == 2 && targets[0] instanceof Creature && !targets[0].controller.is(self.controller) && targets[1] instanceof Creature && targets[1].controller.is(self.controller), (self, field) => field.filter(x => x instanceof Creature && !x.controller.is(self.controller)).length > 0 && field.filter(x => x instanceof Creature && x.controller.is(self.controller)).length > 0, (self, targets) => {
            targets[0].takeDamage(self, 4);
            targets[1].takeDamage(self, 2);
        });
    }
}
export class BorosCharmCard extends SpellCard {
    constructor() {
        super("Boros Charm", ["Instant"], `Choose one:
      * 4 damage to target player or planeswalker.
      * Permanents you control gain indestructible until end of turn.
      * Target creature gains double strike until end of turn.`, (self, targets) => targets.length == 0, (self, field) => true, (self, targets) => {
            let hasCreature = self.controller.zones.battlefield.filter(x => x instanceof CreatureCard).length > 0;
            self.controller.chooseOptions(["4 damage to target player or planeswalker", "Permanents you control gain insdestructible until end of turn", ...(hasCreature ? ["Target creature gains double strike until end of turn"] : [])], 1, "Choose an option.", choices => {
                let c = choices[0];
                if (c == 0) {
                    self.controller.selectSingleTarget(undefined, t => true, () => true, "Choose something to deal 4 damage to", result => {
                        result.takeDamage(self, 4);
                    });
                }
                else if (c == 1) {
                    for (let i of Battlefield.filter(x => x.controller.is(self.controller))) {
                        new ApplyAbilityEffect(new IndestructibleAbility()).resolve(i);
                    }
                }
                else {
                    self.controller.selectSingleTarget(undefined, t => true, () => true, "Choose something to give double strike", result => {
                        new ApplyAbilityEffect(new DoubleStrikeAbility()).resolve(result);
                    });
                }
            });
        });
    }
}
export class LightningHelixCard extends SimpleSpellCard {
    constructor() {
        super("Lightning Helix", ["Instant"], "{CARDNAME} deals 3 damage to any target and you gain 3 life.", (self, target) => { target.takeDamage(self, 3); self.controller.gainLife(self, 3); }, new ManaCost({ red: 1, white: 1 }));
    }
}
// No need to export the halves
class IntegrityCard extends SimpleSpellCard {
    constructor() {
        super("Integrity", ["Instant"], "Target creature gets +2/+2 until end of turn.", (self, target) => {
            new ApplyAbilityEffect(new StatsHook((me, orig, that, stat) => {
                if (!me.is(that))
                    return orig(that, stat);
                return orig(that, stat) + 2;
            })).resolve(target);
        }, new ManaCost({ choices: [[{ red: 1 }, { white: 1 }]] }));
    }
}
export class InterventionCard extends SimpleSpellCard {
    constructor() {
        super("Intervention", ["Instant"], "{CARDNAME} deals 3 damage to any target and you gain 3 life.", (self, target) => { target.takeDamage(self, 3); self.controller.gainLife(self, 3); }, new ManaCost({ red: 1, white: 1 }));
    }
}
export class IntegrityInterventionCard extends SplitSpellCard {
    constructor() {
        super(new IntegrityCard(), new InterventionCard());
    }
}
// TODO: rest of deck
