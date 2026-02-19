export class Engine {
    constructor(stockfishPath = './js/stockfish.js') {
        this.worker = new Worker(stockfishPath);
    }

    evaluate(fen, depth = 15, callback) {
        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage('go depth ' + depth);

        this.worker.onmessage = (e) => {
            const msg = e.data;

            if (msg.startsWith('info') && msg.includes('score cp')) {
                const match = msg.match(/score cp (-?\d+)/);
                if (match) {
                    const score = parseInt(match[1], 10);
                    callback(score / 100); // convert centipawns to pawns
                }
            }

            if (msg.startsWith('bestmove')) {
                this.worker.postMessage('stop');
            }
        };
    }
}
