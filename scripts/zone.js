export var Zone;
(function (Zone) {
    Zone["library"] = "library";
    Zone["hand"] = "hand";
    Zone["graveyard"] = "graveyard";
    Zone["exile"] = "exile";
    Zone["battlefield"] = "battlefield";
    Zone["limbo"] = "limbo";
    Zone["stack"] = "stack";
})(Zone || (Zone = {}));
export class ZoneManager {
    // A helper to manage players' zones.
    library = [];
    hand = [];
    graveyard = [];
    exile = [];
    battlefield = [];
    limbo = [];
    get all() {
        return [...this.battlefield, ...this.exile, ...this.graveyard, ...this.hand, ...this.library, ...this.limbo];
    }
}
