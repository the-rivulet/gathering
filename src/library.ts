import { TypeList, PermanentCard, CreatureCard, AuraCard, SpellCard, SimpleSpellCard, SplitSpellCard, UntargetedSpellCard } from "./card.js";
import { SimpleActivatedAbility, TargetedActivatedAbility, FirstStrikeAbility, VigilanceAbility, TrampleAbility, DoubleStrikeAbility, HasteAbility } from "./ability.js";
import { MultipleEffect, AddManaEffect, CreateTokenEffect, AddCounterEffect, ApplyAbilityEffect, SetStatsEffect, SetTypesEffect, DelayedEffect, MoveCardsEffect, QueueCardsEffect } from "./effect.js";
import { SacrificeSelfCost, TapCost } from "./cost.js";
import { ManaCost, ManaPool, Color } from "./mana.js";
import { PlayCardHook, BeginStepHook, StatsHook, ProtectionAbility, FlyingAbility, HeroicAbility, ResolveCardHook, IndestructibleAbility, TypesHook, AbilitiesHook, MenaceAbility, TakeDamageHook, CardClickHook, SelectTargetsHook, WardAbility, FinishedResolvingSpellHook, LifelinkAbility } from "./hook.js";
import { Creature, Planeswalker, Permanent } from "./permanent.js";
import { Player } from "./player.js";
import { Battlefield, TurnManager } from "./globals.js";
import { Step } from "./turn.js";
import { Zone } from "./zone.js";

/**
 * Make sure you specify the right types here, no type checking on the parameter!
 */
let typePredicate = function <T>(validate: (x) => boolean) {
  return function (x): x is T {
    return validate(x);
  };
};

class TreasureTokenCard extends PermanentCard {
  constructor() {
    super(
      "Treasure Token",
      ["Artifact", "Token", "Treasure"],
      "Sacrifice {CARDNAME}: Add one mana of any color to your mana pool.",
      undefined,
      new SimpleActivatedAbility(
        new SacrificeSelfCost(),
        card => card.controller.getColor("Choose a color", result => new AddManaEffect({ [result]: 1 }).resolve(card))
      )
    );
  }
  makeEquivalentCopy = () => new TreasureTokenCard();
}

export class BasicLandCard extends PermanentCard {
  color: Color;
  constructor(name: string, color: Color) {
    super(
      name,
      ["Basic", "Land", name],
      "{A1}{T}{EC1}Add {" + (color == Color.blue ? "U" : color[0].toUpperCase()) + "}.{EA1}",
      undefined,
      new SimpleActivatedAbility(new TapCost(), card => new AddManaEffect({ [color]: 1 }).resolve(card))
    );
    this.color = color;
  }
}

export class LlanowarElvesCard extends CreatureCard {
  constructor() {
    super(
      "Llanowar Elves",
      ["Creature", "Elf", "Druid"],
      "{A1}{T}{EC1}Add {G}.{EA1}",
      1, 1,
      //new ManaCost({ green: 1 }),
      new ManaCost({ green: 1 }),
      new SimpleActivatedAbility(new TapCost(), card => new AddManaEffect({ green: 1 }).resolve(card))
    );
  }
  makeEquivalentCopy = () => new LlanowarElvesCard();
}

export class GiantGrowthCard extends SimpleSpellCard<Creature> {
  constructor() {
    super(
      "Giant Growth",
      ["Instant"],
      "Target creature gets +3/+3 until end of turn.",
      typePredicate(x => x instanceof Creature),
      (self, target) => {
        new ApplyAbilityEffect(new StatsHook((me, orig, that, stat) => {
          if (!me.is(that)) return orig(that, stat);
          return orig(that, stat) + 3;
        })).resolve(target);
      },
      new ManaCost({ green: 1 })
    );
  }
}

export class ForcedAdaptationCard extends AuraCard {
  constructor() {
    super(
      "Forced Adaptation",
      "At the beginning of your upkeep, put a +1/+1 counter on enchanted creature.",
      x => x instanceof Creature,
      new ManaCost({ green: 1 }),
      new BeginStepHook((me, orig, that) => {
        orig(that);
        if (that.step == Step.upkeep && that.currentPlayer.is(me.controller)) {
          new AddCounterEffect("+1/+1").resolve(this.attached as Creature);
        }
      })
    );
  }
  makeEquivalentCopy = () => new ForcedAdaptationCard();
}

// Random legendary creatures (probably don't need to export these)
class KarnLegacyReforgedCard extends CreatureCard {
  constructor() {
    super(
      "Karn, Legacy Reforged",
      ["Creature", "Artifact", "Legendary", "Golem"],
      `{CARDNAME}'s power and toughness are each equal to the greatest mana value among artifacts you control.
        At the beginning of your upkeep, add {C} for each artifact you control.
        This mana can't be spent to cast nonartifact spells.
        Until end of turn, you don't lose this mana as steps and phases end.`,
      card =>
        Math.max(
          ...Battlefield.filter(
            x => x.controller.is(card.controller) && x.hasType('Artifact')
          ).map(x => (x.representedCard.manaCost || new ManaCost()).value)
        ),
      card =>
        Math.max(
          ...Battlefield.filter(
            x => x.controller.is(card.controller) && x.hasType('Artifact')
          ).map(x => (x.representedCard.manaCost || new ManaCost()).value)
        ),
      new ManaCost({ generic: 5 }),
      new BeginStepHook((me, orig, that) => {
        orig(that);
        if (that.step == Step.upkeep && this.representedPermanent) {
          new AddManaEffect(
            new ManaPool({
              colorless: 1, canPayFor: payFor => payFor.hasType("Artifact"), keep: true
            })
          ).resolve(this.representedPermanent);
        }
      })
    );
  }
  makeEquivalentCopy = () => new KarnLegacyReforgedCard();
}

// The boros rokiric deck
export class FigureOfDestinyCard extends CreatureCard {
  constructor() {
    super(
      "Figure of Destiny",
      ["Creature", "Kithkin"],
      `{A1}({R}/{W}){EC1}{CARDNAME} becomes a 2/2 Kithkin Spirit.{EA1}<br/>
        {A2}3 x ({R}/{W}){EC2}If {CARDNAME} is a Spirit, it becomes a 4/4 Kithkin Spirit Warrior.{EA2}<br/>
        {A3}6 x ({R}/{W}){EC3}If {CARDNAME} is a Warrior, it becomes a 8/8 Kithkin Spirit Warrior Avatar with flying and first strike.{EA3}`,
      1, 1,
      new ManaCost({ choices: [[{ red: 1 }, { white: 1 }]] }),
      [
        new SimpleActivatedAbility<Creature>(new ManaCost({ choices: [[{ red: 1, white: 1 }]] }), card => {
          new MultipleEffect(
            new SetStatsEffect(2, 2),
            new SetTypesEffect(["Kithkin", "Spirit"])
          ).queue(card);
        }),
        new SimpleActivatedAbility<Creature>(new ManaCost({ choices: [[{ red: 3, white: 3 }]] }), card => {
          if (!card.hasType("Spirit")) return;
          new MultipleEffect(
            new SetStatsEffect(4, 4),
            new SetTypesEffect(["Kithkin", "Spirit", "Warrior"])
          ).queue(card);
        }),
        new SimpleActivatedAbility<Creature>(new ManaCost({ choices: [[{ red: 6, white: 6 }]] }), card => {
          if (!card.hasType("Warrior")) return;
          new MultipleEffect(
            new SetStatsEffect(8, 8),
            new SetTypesEffect(["Kithkin", "Spirit", "Warrior", "Avatar"]),
            new ApplyAbilityEffect(new FlyingAbility()),
            new ApplyAbilityEffect(new FirstStrikeAbility())
          ).queue(card);
        })
      ]
    );
  }
  makeEquivalentCopy = () => new FigureOfDestinyCard();
}

export class GeneralFerrousRokiricCard extends CreatureCard {
  constructor() {
    super(
      "General Ferrous Rokiric",
      ["Creature", "Legendary", "Human", "Soldier"],
      "Protection from monocolored. Whenever you cast a multicolored spell, create a 4/4 red and white Golem token.",
      3, 1,
      new ManaCost({ red: 1, white: 1, generic: 1 }),
      [
        new ProtectionAbility(source => source.colors.length == 1),
        new PlayCardHook((me, orig, that, card, free, auto) => {
          if (!(card.hasType("Land")) && card.colors.length >= 2) {
            new CreateTokenEffect(new CreatureCard("Golem Token", ["Creature", "Token", "Golem"], "", 4, 4)).queue(this.representedPermanent);
          }
          return orig(that, card, free, auto);
        }),
      ]
    );
  }
  makeEquivalentCopy = () => new GeneralFerrousRokiricCard();
}

export class AnaxAndCymedeCard extends CreatureCard {
  constructor() {
    super(
      "Anax and Cymede",
      ["Creature", "Legendary", "Human", "Soldier"],
      `First strike, vigilance.<br/>
      Whenever you cast a spell that targets {CARDNAME},<br/>
      creatures you control get +1/+1 and gain trample until end of turn.`,
      3, 2,
      new ManaCost({ red: 1, white: 1, generic: 1 }),
      [
        new FirstStrikeAbility(),
        new VigilanceAbility(),
        new HeroicAbility((me, casting, targets) => {
          for (let i of Battlefield.filter(x => x.controller.is(me.controller))) {
            if (i instanceof Creature) {
              new MultipleEffect(
                new ApplyAbilityEffect(new StatsHook((me, orig, that, stat) => {
                  if (!me.is(that)) return orig(that, stat);
                  return orig(that, stat) + 3;
                })),
                new ApplyAbilityEffect(new TrampleAbility())
              ).queue(i);
            }
          }
        })
      ]
    );
  }
  makeEquivalentCopy = () => new AnaxAndCymedeCard();
}

export class FeatherTheRedeemedCard extends CreatureCard {
  constructor() {
    super(
      "Feather, the Redeemed",
      ["Creature", "Legendary", "Angel"],
      `Flying.
      Whenever you cast a spell that targets a creature you control,<br/>
      exile that card instead of putting it into your graveyard as it resolves.<br/>
      If you do, return it to your hand at the beginning of the next end step.`,
      3, 4,
      new ManaCost({ red: 1, white: 2 }),
      new FinishedResolvingSpellHook((me, orig, card, player, targets) => {
        if (player.is(card.controller) && targets.filter(x => x instanceof Creature && x.controller.is(me.controller)).length) {
          new DelayedEffect(new MoveCardsEffect(Zone.hand, card), Step.end).queue(me);
          return Zone.exile;
        } else orig(card, player, targets);
      })
    );
  }
  makeEquivalentCopy = () => new FeatherTheRedeemedCard();
}

export class IroasGodOfVictoryCard extends CreatureCard {
  constructor() {
    super(
      "Iroas, God of Victory",
      ["Creature", "Enchantment", "Legendary", "God"],
      `Indestructible. As long as your devotion to red and white is less than seven, {CARDNAME} isn't a creature.<br/>
      Creatures you control have menace.<br/>
      Prevent all damage that would be dealt to attacking creatures you control.`,
      7, 4,
      new ManaCost({ red: 1, white: 1, generic: 2 }),
      [
        new IndestructibleAbility(),
        new TypesHook((me, orig, that) => {
          if (!me.is(that) || that.controller.devotionTo(Color.red, Color.white) >= 7) return orig(that);
          return new TypeList(orig(that).list.filter(x => x != "Creature"));
        }),
        new AbilitiesHook((me, orig, that) => {
          if (!that.controller.is(me.controller)) return orig(that);
          return [...orig(that), new MenaceAbility()];
        }),
        new TakeDamageHook((me, orig, that, source, amount, combat, destroy) => {
          if (!(that instanceof Creature) || !that.controller.is(me.controller) || !that.attacking) return orig(that, source, amount, combat, destroy);
        })
      ]
    );
  }
  makeEquivalentCopy = () => new IroasGodOfVictoryCard();
}

export class RadiantScrollwielderCard extends CreatureCard {
  constructor() {
    super(
      "Radiant Scrollwielder",
      ["Creature", "Dwarf", "Cleric"],
      `Instant and sorcery spells you control have lifelink.<br/>
      At the beginning of your upkeep, exile a random instant or sorcery card from your graveyard.<br/>
      You may cast it this turn.<br/>
      If a spell cast this way would be put into your graveyard, exile it instead.`,
      2, 4,
      new ManaCost({ red: 1, white: 1, generic: 2 }),
      [
        new TakeDamageHook((me, orig, that, source, amount, combat, destroy) => {
          orig(that, source, amount, combat, destroy);
          if (source instanceof SpellCard && source.controller.is(me.controller)) me.controller.gainLife(source, amount);
        }),
        new BeginStepHook((me, orig, that) => {
          orig(that);
          if (that.step == Step.upkeep && that.currentPlayer.is(me.controller)) {
            let spells = me.controller.zones.graveyard.filter(x => x.hasType("Instant") || x.hasType("Sorcery"));
            if (!spells.length) return;
            let spell = spells[Math.floor(Math.random() * spells.length)];
            new ApplyAbilityEffect(new CardClickHook((me2, orig2, that2) => {
              if (!that2.is(spell) || TurnManager.ongoingSelection) return orig2(that2);
              new ApplyAbilityEffect(new FinishedResolvingSpellHook((me3, orig3, that3, player, targets) => {
                if (!that3.is(spell)) return orig3(that3, player, targets);
                return Zone.exile;
              })).resolve(me2);
              that2.play();
            })).queue(me);
          }
        })
      ]
    );
  }
  makeEquivalentCopy = () => new RadiantScrollwielderCard();
}

export class ZadaHedronGrinderCard extends CreatureCard {
  constructor() {
    super(
      "Zada, Hedron Grinder",
      ["Creature", "Legendary", "Goblin", "Ally"],
      `Whenever you cast an instant or sorcery spell that targets only {CARDNAME},<br/>
      copy that spell for each other creature you control that the spell could target.<br/>
      Each copy targets a different one of those creatures.`,
      3, 3,
      new ManaCost({ red: 1, generic: 3 }),
      new SelectTargetsHook((me, orig, that, casting, validate, possible, message, continuation, limitOne) => {
        return orig(that, casting, validate, possible, message, result => {
          continuation(result);
          if (casting instanceof SpellCard && result.length == 1 && result[0].is(me)) {
            for (let i of Battlefield.filter(x => !x.is(me) && validate([x]))) {
              new QueueCardsEffect({ card: casting, targets: [i] }).queue(me);
            }
          }
        }, limitOne);
      })
    );
  }
  makeEquivalentCopy = () => new ZadaHedronGrinderCard();
}

export class FloweringOfTheWhiteTreeCard extends PermanentCard {
  constructor() {
    super(
      "Flowering of the White Tree",
      ["Legendary", "Enchantment"],
      `Legendary creatures you control get +2/+1 and have ward {1}.<br/>
      Nonlegendary creatures you control get +1/+1.`,
      new ManaCost({ white: 2 }),
      [
        new StatsHook((me, orig, that, stat) => {
          return orig(that, stat) + ((that.hasType("Legendary") && stat == "power") ? 2 : 1);
        }),
        new AbilitiesHook((me, orig, that) => {
          if (that.hasType("Legendary")) return [...orig(that), new WardAbility(new ManaCost({ generic: 1 }))];
          return orig(that);
        })
      ]
    );
  }
  makeEquivalentCopy = () => new FloweringOfTheWhiteTreeCard();
}

export class LightningBoltCard extends SimpleSpellCard<Creature | Player | Planeswalker> {
  constructor() {
    super(
      "Lightning Bolt",
      ["Instant"],
      "{CARDNAME} deals 3 damage to any target.",
      typePredicate(x => x instanceof Creature || x instanceof Player || x instanceof Planeswalker),
      (self, target) => { target.takeDamage(self, 3); },
      new ManaCost({ red: 1 })
    );
  }
  makeEquivalentCopy = () => new LightningBoltCard();
}

export class RecklessRageCard extends SpellCard {
  constructor() {
    super(
      "Reckless Rage",
      ["Instant"],
      "{CARDNAME} deals 4 damage to target creature you don't control and 2 damage to target creature you control.",
      (self, targets) => targets.length == 2 && targets[0] instanceof Creature && !targets[0].controller.is(self.controller) && targets[1] instanceof Creature && targets[1].controller.is(self.controller),
      (self, field) => field.filter(x => x instanceof Creature && !x.controller.is(self.owner)).length > 0 && field.filter(x => x instanceof Creature && x.controller.is(self.owner)).length > 0,
      (self, targets) => {
        targets[0].takeDamage(self, 4);
        targets[1].takeDamage(self, 2);
      },
      new ManaCost({ red: 1 })
    );
  }
  makeEquivalentCopy = () => new RecklessRageCard();
}

export class BorosCharmCard extends SpellCard {
  constructor() {
    super(
      "Boros Charm",
      ["Instant"],
      `Choose one:<br/>
      * 4 damage to target player or planeswalker.<br/>
      * Permanents you control gain indestructible until end of turn.<br/>
      * Target creature gains double strike until end of turn.`,
      (self, targets) => targets.length == 0,
      (self, field) => true,
      (self, targets) => {
        let hasCreature = self.controller.zones.battlefield.filter(x => x instanceof CreatureCard).length > 0;
        self.controller.chooseOptions(["4 damage to target player or planeswalker", "Permanents you control gain insdestructible until end of turn", ...(hasCreature ? ["Target creature gains double strike until end of turn"] : [])], 1, "Choose an option.", choices => {
          let c = choices[0];
          if (c == 0) {
            self.controller.selectSingleTarget<Player | Planeswalker>(undefined, t => true, () => true, "Choose something to deal 4 damage to", result => {
              result.takeDamage(self, 4);
            });
          } else if (c == 1) {
            for (let i of Battlefield.filter(x => x.controller.is(self.controller))) {
              new ApplyAbilityEffect(new IndestructibleAbility()).resolve(i);
            }
          } else {
            self.controller.selectSingleTarget<Creature>(undefined, t => true, () => true, "Choose something to give double strike", result => {
              new ApplyAbilityEffect(new DoubleStrikeAbility()).resolve(result);
            });
          }
        });
      },
      new ManaCost({ red: 1, white: 1 })
    );
  }
  makeEquivalentCopy = () => new BorosCharmCard();
}

export class LightningHelixCard extends SimpleSpellCard<Creature | Player | Planeswalker> {
  constructor() {
    super(
      "Lightning Helix",
      ["Instant"],
      "{CARDNAME} deals 3 damage to any target and you gain 3 life.",
      typePredicate(x => x instanceof Creature || x instanceof Player || x instanceof Planeswalker),
      (self, target) => { target.takeDamage(self, 3); self.controller.gainLife(self, 3); },
      new ManaCost({ red: 1, white: 1 })
    );
  }
  makeEquivalentCopy = () => new LightningHelixCard();
}

// No need to export the halves
class IntegrityCard extends SimpleSpellCard<Creature> {
  constructor() {
    super(
      "Integrity",
      ["Instant"],
      "Target creature gets +2/+2 until end of turn.",
      typePredicate(x => x instanceof Creature),
      (self, target) => {
        new ApplyAbilityEffect(new StatsHook((me, orig, that, stat) => {
          if (!me.is(that)) return orig(that, stat);
          return orig(that, stat) + 2;
        })).resolve(target);
      },
      new ManaCost({ choices: [[{ red: 1 }, { white: 1 }]] })
    );
  }
  makeEquivalentCopy = () => new IntegrityCard();
}

class InterventionCard extends SimpleSpellCard<Creature | Player | Planeswalker> {
  constructor() {
    super(
      "Intervention",
      ["Instant"],
      "{CARDNAME} deals 3 damage to any target and you gain 3 life.",
      typePredicate(x => x instanceof Creature || x instanceof Player || x instanceof Planeswalker),
      (self, target) => { target.takeDamage(self, 3); self.controller.gainLife(self, 3); },
      new ManaCost({ red: 1, white: 1, generic: 2 })
    );
  }
  makeEquivalentCopy = () => new InterventionCard();
}

export class IntegrityInterventionCard extends SplitSpellCard {
  constructor() {
    super(false, new IntegrityCard(), new InterventionCard());
  }
}

export class RipApartCard extends SpellCard {
  constructor() {
    super(
      "Rip Apart",
      ["Sorcery"],
      `Choose one:<br/>
      * 3 damage to target creature or planeswalker.<br/>
      * Destroy target artifact or enchantment`,
      (self, targets) => targets.length == 1 && targets[0] instanceof Creature || targets[0] instanceof Planeswalker || (targets[0] instanceof Permanent && (targets[0].hasType("Artifact") || targets[0].hasType("Enchantment"))),
      (self, field) => field.filter(x => x instanceof Creature || x instanceof Planeswalker || x.hasType("Artifact") || x.hasType("Enchantment")).length > 0,
      (self, targets) => {
        let t = targets[0];
        if (t instanceof Permanent && (t.hasType("Artifact") || t.hasType("Enchantment"))) t.destroy();
        else if (t instanceof Creature || t instanceof Planeswalker) t.takeDamage(self, 3);
      },
      new ManaCost({ red: 1, white: 1 })
    );
  }
  makeEquivalentCopy = () => new BorosCharmCard();
}

export class ThrillingDiscoveryCard extends UntargetedSpellCard {
  constructor() {
    super(
      "Thrilling Discovery",
      ["Sorcery"],
      `You gain 2 life. Then you may discard 2 cards to draw 3 cards.`,
      (self) => {
        let c = self.controller;
        c.gainLife(self, 2);
        if (c.zones.hand.length >= 2) {
          c.getConfirmation("Do you want to discard 2 cards to draw 3 cards?", result => {
            if (!result) return;
            c.selectTargets(undefined, t => t.length == 2 && t.filter(x => x.owner.is(c) && x.zone == Zone.hand).length == 2, () => c.zones.hand.length >= 2, "Select 2 cards to discard", result2 => {
              for (let i of result2) {
                c.moveCardTo(i, Zone.graveyard);
              }
              c.drawCard(3);
            });
          });
        }
      },
      new ManaCost({ red: 1, white: 1 })
    );
  }
  makeEquivalentCopy = () => new ThrillingDiscoveryCard();
}

export class AngelfireIgnitionCard extends SimpleSpellCard<Creature> {
  constructor() {
    super(
      "Angelfire Ignition",
      ["Sorcery"],
      `Put two +1/+1 counters on target creature.<br/>
      It gains vigilance, trample, lifelink, haste, and indestructible this turn.`,
      typePredicate(x => x instanceof Creature),
      (self, target) => {
        target.addCounter("+1/+1", 2);
        new ApplyAbilityEffect(new VigilanceAbility()).resolve(target);
        new ApplyAbilityEffect(new TrampleAbility()).resolve(target);
        new ApplyAbilityEffect(new LifelinkAbility()).resolve(target);
        new ApplyAbilityEffect(new HasteAbility()).resolve(target);
        new ApplyAbilityEffect(new IndestructibleAbility()).resolve(target);
      },
      new ManaCost({ white: 1, red: 1, generic: 1 })
    );
  }
  makeEquivalentCopy = () => new AngelfireIgnitionCard();
}

// TODO: rest of deck