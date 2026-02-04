// Room class
class Room {
    constructor(gridX, gridY, type = ROOM_TYPES.NORMAL) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.type = type;
        this.cleared = false;
        this.visited = false;
        this.bossRoomUnlocked = false;
        this.miniBossType = null; // For mini-boss rooms
        this.shopInventory = null; // For shop rooms - stores specific items
        this.doors = {
            north: false,
            south: false,
            east: false,
            west: false
        };
        this.enemies = [];
        this.items = [];
    }
}