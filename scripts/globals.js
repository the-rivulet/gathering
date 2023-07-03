export let Battlefield;
export let TurnManager;
export let StackManager;
export function UpdateGlobals(bf = [], tm, sm) {
    Battlefield = bf;
    TurnManager = tm;
    StackManager = sm;
}
export let Settings = {
    slugcatMana: true,
    highestSymbol: 6
};
