import { TurnManager, Settings } from "./globals.js";
function isCard(item) {
    return 'card' in item;
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
        if (isCard(next)) {
            if (next.card.owner)
                next.card.owner.resolve(next.card, next.targets);
        }
        else
            next.effect.resolve(next.permanent);
    }
    get ready() {
        return (TurnManager.passedPriority || TurnManager.endedPhase || TurnManager.endedTurn) && !TurnManager.ongoingSelection && !TurnManager.choosing;
    }
    resolveIfReady(counter = 0) {
        if (!this.ready)
            return;
        this.resolveNext();
        TurnManager.passedPriority = false;
        if (this.stack.length && counter < Settings.maxRepeats)
            this.resolveIfReady();
    }
}
