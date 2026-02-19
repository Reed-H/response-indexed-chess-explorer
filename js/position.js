import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

export function getFenAfterMove(fen, sanMove) {
    const game = new Chess(fen);
    const result = game.move(sanMove);
    if (!result) return null;
    return game.fen();
}
