class ResponseIndexer {
    constructor() {
        this.index = new Map();
    }

    add(move, fen, whiteCandidates) {
        if (!this.index.has(move)) {
            this.index.set(move, []);
        }
        this.index.get(move).push({
            fen: fen,
            candidates: whiteCandidates
        });
    }
 
    getMoves() {
        return Array.from(this.index.keys());
    }

    getPositions(move) {
        return this.index.get(move) || [];
    }
}
