import { Engine } from './engine.js';
import { getFenAfterMove } from './position.js';
import { START_FEN } from './data.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const game = new Chess(START_FEN);
const engine = new Engine();

const boardEl = document.getElementById('board');
const evalBar = document.getElementById('eval-bar');
const moveSelector = document.getElementById('white-move-select');

// Initialize Chessboard.js (global)
const board = Chessboard("board", {
  position: START_FEN,
  draggable: true
});


// Normalize evaluation for side to move
function normalizeEval(score, fen) {
    return fen.split(' ')[1] === 'b' ? -score : score;
}

// Render vertical eval bar
function renderEvalBar(score) {
    const clamped = Math.max(-5, Math.min(5, score));
    const percent = 50 + clamped * 10;
    evalBar.style.height = percent + '%';
}

// Evaluate a specific white move
function evaluateWhiteMove(moveSan) {
    const fenAfter = getFenAfterMove(game.fen(), moveSan);
    if (!fenAfter) return;

    engine.evaluate(fenAfter, 15, (rawScore) => {
        const score = normalizeEval(rawScore, fenAfter);
        renderEvalBar(score);
        board.position(fenAfter);
    });
}

// Populate dropdown with top N white moves
async function populateWhiteMoves(limit = 5) {
    moveSelector.innerHTML = '';

    const moves = game.moves({ verbose: true }).filter(m => m.color === 'w');
    const evaluations = [];

    for (const move of moves) {
        await new Promise(resolve => {
            const fenAfter = getFenAfterMove(game.fen(), move.san);
            engine.evaluate(fenAfter, 10, (score) => {
                evaluations.push({ san: move.san, score });
                resolve();
            });
        });
    }

    evaluations.sort((a, b) => b.score - a.score);
    const topMoves = evaluations.slice(0, limit);

    topMoves.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.san;
        opt.textContent = m.san;
        moveSelector.appendChild(opt);
    });

    if (topMoves.length > 0) evaluateWhiteMove(topMoves[0].san);
}

// Event listener
moveSelector.addEventListener('change', (e) => {
    evaluateWhiteMove(e.target.value);
});

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    populateWhiteMoves();
});
