import { TurnManager } from "./globals.js";
export class StackCard {
    card;
    targets;
    constructor(card, targets = []) {
        this.card = card;
        this.targets = targets;
    }
}
export class StackEffect {
    effect;
    permanent;
    constructor(effect, perm) {
        this.effect = effect;
        this.permanent = perm;
    }
}
export class StackActivation {
    abil;
    permanent;
    targets;
    constructor(abil, permanent, forceTargets) {
        this.abil = abil;
        this.permanent = permanent;
        this.targets = forceTargets;
    }
}
export class StackManagerClass {
    stack = [];
    constructor() { }
    add(what) {
        this.stack.push(what);
    }
    async resolveNext() {
        let next = this.stack.pop();
        if (!next)
            return;
        if (next instanceof StackCard) {
            if (next.card.owner)
                next.card.owner.resolve(next.card, next.targets);
        }
        else if (next instanceof StackEffect) {
            await next.effect.resolve(next.permanent);
        }
        else {
            next.abil.effect.forEach(i => i.resolve(next.permanent));
        }
    }
    get ready() {
        return !TurnManager.playerList.filter(x => (!x.endedTurn && !x.endedPhase && !x.passedPriority) || x.selectionData).length;
    }
    resolveIfReady() {
        if (!this.ready)
            return;
        this.resolveNext();
        for (let i of TurnManager.playerList) {
            if (i.passedPriority) {
                i.passedPriority = false;
            }
        }
        if (this.stack.length)
            setTimeout(this.resolveIfReady, 200);
    }
}
