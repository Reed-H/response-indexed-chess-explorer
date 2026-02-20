export class Engine {
    constructor(stockfishPath = './js/stockfish.js') {
        this.worker = new Worker(stockfishPath);
    }

    evaluate(fen, depth = 15, callback) {
        let lastScore = null;

        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage('go depth ' + depth);

        this.worker.onmessage = (e) => {
            const msg = e.data;

            if (msg.startsWith('info') && msg.includes('score cp')) {
                const match = msg.match(/score cp (-?\d+)/);
                if (match) {
                    lastScore = parseInt(match[1], 10) / 100;
                }
            }

            if (msg.startsWith('bestmove')) {
                const isWhiteToMove = fen.includes(' w ');
                const normalized = isWhiteToMove ? lastScore : -lastScore;
                callback(normalized);
            }

        };
    }

}
