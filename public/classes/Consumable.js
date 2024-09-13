export class Consumable {
    constructor(id, x, z) {
        this.id = id;
        this.position = { x, z };  // Only track position, no mesh
    }
}
