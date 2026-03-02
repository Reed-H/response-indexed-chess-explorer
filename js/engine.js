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

    evaluateTopLines(fen, depth = 13, multiPv = 3, callback) {
        const lines = new Map();
        this.worker.postMessage('ucinewgame');
        this.worker.postMessage('setoption name MultiPV value ' + multiPv);
        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage('go depth ' + depth);

        this.worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.startsWith('info') && msg.includes(' pv ') && msg.includes(' multipv ')) {
                const mpv = msg.match(/multipv (\d+)/);
                const cp = msg.match(/score cp (-?\d+)/);
                const mate = msg.match(/score mate (-?\d+)/);
                const pv = msg.match(/ pv (.+)$/);
                if (mpv && pv) {
                    const score = cp ? parseInt(cp[1], 10) / 100 : (mate ? `#${mate[1]}` : null);
                    lines.set(Number(mpv[1]), { score, pv: pv[1] });
                }
            }

            if (msg.startsWith('bestmove')) {
                callback([...lines.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([, v]) => v)
                    .slice(0, multiPv));
            }
        };
    }
}
