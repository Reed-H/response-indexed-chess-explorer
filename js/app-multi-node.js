import { Engine } from './engine.js';
import { TreeManager } from './tree-manager.js';
import { START_FEN } from './data.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const engine = new Engine();
const treeManager = new TreeManager(START_FEN);

// DOM Elements
const boardElement = document.getElementById('board');
const evalBar = document.getElementById('eval-bar');
const variationsContainer = document.getElementById('variations-container');
const breadcrumb = document.getElementById('breadcrumb');
const selectedMoveDisplay = document.getElementById('selected-move-display');
const whiteResponseInput = document.getElementById('white-response-input');
const addVariationBtn = document.getElementById('add-variation-btn');
const undoMoveBtn = document.getElementById('undo-move-btn');
const backBtn = document.getElementById('back-btn');
const exportBtn = document.getElementById('export-btn');
const statusMessage = document.getElementById('status-message');

let selectedMove = null;
let selectedSourceSquare = null;

const board = Chessboard('board', {
    position: START_FEN,
    draggable: true,
    onDragStart,
    onDrop,
    onSnapEnd
});

function getCurrentPositionGame() {
    return new Chess(treeManager.currentNode.fen);
}

function getLegalMoves() {
    return treeManager.getLegalMoves();
}

function getDisplayFen() {
    return selectedMove ? selectedMove.fen : treeManager.currentNode.fen;
}

function normalizeEval(score, fen) {
    const sideToMove = fen.split(' ')[1];
    return sideToMove === 'w' ? score : -score;
}

function renderEvalBar(score) {
    const clamped = Math.max(-5, Math.min(5, score));
    const percent = 50 + clamped * 10;
    evalBar.style.height = percent + '%';

    if (score > 0.5) {
        evalBar.classList.add('white-advantage');
        evalBar.classList.remove('black-advantage', 'equal');
    } else if (score < -0.5) {
        evalBar.classList.add('black-advantage');
        evalBar.classList.remove('white-advantage', 'equal');
    } else {
        evalBar.classList.add('equal');
        evalBar.classList.remove('white-advantage', 'black-advantage');
    }
}

function updateBoard() {
    board.position(getDisplayFen());
}

function renderBreadcrumb() {
    const path = treeManager.getCurrentPath();
    const breadcrumbHtml = path.map((node, idx) => {
        if (idx === 0) return '<span class="breadcrumb-item">Start</span>';
        const evalStr = node.eval !== null ? ` (${node.eval.toFixed(2)})` : '';
        const responseStr = node.whiteResponse ? ` | ${node.whiteResponse}` : '';
        return `<span class="breadcrumb-item"> > ${node.move.san}${evalStr}${responseStr}</span>`;
    }).join('');
    breadcrumb.innerHTML = breadcrumbHtml;
}

function evaluateNode(node) {
    return new Promise(resolve => {
        if (node.eval !== null) {
            resolve(node.eval);
            return;
        }

        engine.evaluate(node.fen, 15, (score) => {
            const normalized = normalizeEval(score, node.fen);
            node.setEval(normalized);
            resolve(normalized);
        });
    });
}

function clearMoveSelection() {
    selectedMove = null;
    selectedSourceSquare = null;
    clearHighlights();
    selectedMoveDisplay.textContent = 'None';
    undoMoveBtn.disabled = true;
    updateBoard();
}

function setSelectedMove(move) {
    selectedMove = move;
    selectedSourceSquare = null;
    clearHighlights();
    selectedMoveDisplay.textContent = move.san;
    undoMoveBtn.disabled = false;
    updateBoard();
}

function clearHighlights() {
    boardElement.querySelectorAll('.square-55d63').forEach(squareEl => {
        squareEl.classList.remove('move-source', 'move-target');
    });
}

function highlightMovesFrom(sourceSquare) {
    clearHighlights();
    const legalMovesFromSource = getLegalMoves().filter(move => move.from === sourceSquare);

    if (legalMovesFromSource.length === 0) {
        return;
    }

    const sourceEl = boardElement.querySelector(`[data-square="${sourceSquare}"]`);
    if (sourceEl) {
        sourceEl.classList.add('move-source');
    }

    legalMovesFromSource.forEach(move => {
        const targetEl = boardElement.querySelector(`[data-square="${move.to}"]`);
        if (targetEl) {
            targetEl.classList.add('move-target');
        }
    });
}

function findLegalMove(source, target) {
    return getLegalMoves().find(move => move.from === source && move.to === target) || null;
}

function previewMove(source, target) {
    const move = findLegalMove(source, target);
    if (!move) {
        return false;
    }

    const game = getCurrentPositionGame();
    const playedMove = game.move({ from: source, to: target, promotion: 'q' });
    if (!playedMove) {
        return false;
    }

    setSelectedMove({ ...move, san: playedMove.san, fen: game.fen() });
    return true;
}

function onDragStart(source, piece) {
    const game = getCurrentPositionGame();
    const pieceData = game.get(source);

    if (!pieceData || pieceData.color !== game.turn()) {
        return false;
    }

    const hasLegalMove = getLegalMoves().some(move => move.from === source);
    if (!hasLegalMove) {
        return false;
    }

    highlightMovesFrom(source);
    return true;
}

function onDrop(source, target) {
    if (!previewMove(source, target)) {
        clearHighlights();
        return 'snapback';
    }

    return 'drop';
}

function onSnapEnd() {
    updateBoard();
}

function handleBoardClick(event) {
    const squareElement = event.target.closest('.square-55d63');
    if (!squareElement || !boardElement.contains(squareElement)) {
        return;
    }

    const clickedSquare = squareElement.getAttribute('data-square');
    if (!clickedSquare) {
        return;
    }

    const game = getCurrentPositionGame();

    if (selectedSourceSquare) {
        if (previewMove(selectedSourceSquare, clickedSquare)) {
            return;
        }
    }

    const piece = game.get(clickedSquare);
    if (piece && piece.color === game.turn()) {
        selectedSourceSquare = clickedSquare;
        highlightMovesFrom(clickedSquare);
        return;
    }

    selectedSourceSquare = null;
    clearHighlights();
}

async function renderVariations() {
    variationsContainer.innerHTML = '';
    const children = treeManager.currentNode.children;

    if (children.length === 0) {
        variationsContainer.innerHTML = '<p><em>No variations added yet. Use the controls below.</em></p>';
        return;
    }

    const grouped = treeManager.getChildrenGroupedByResponse();

    for (const [whiteResponse, nodes] of Object.entries(grouped)) {
        const group = document.createElement('div');
        group.className = 'variation-group';

        const title = document.createElement('h4');
        title.textContent = whiteResponse;
        group.appendChild(title);

        for (const node of nodes) {
            const nodeBtn = document.createElement('button');
            nodeBtn.className = 'node-button';

            let displayText = node.move.san;
            if (node.eval !== null) {
                displayText += ` (${node.eval.toFixed(2)})`;
            } else {
                displayText += ' (?)';
            }

            nodeBtn.textContent = displayText;
            nodeBtn.onclick = () => navigateToNode(node);

            group.appendChild(nodeBtn);
        }

        variationsContainer.appendChild(group);
    }

    const unevaluatedChildren = children.filter(child => child.eval === null);

    if (unevaluatedChildren.length > 0) {
        for (const child of unevaluatedChildren) {
            await evaluateNode(child);
        }
        refreshVariationEvals();
    }
}

function refreshVariationEvals() {
    const children = treeManager.currentNode.children;
    const buttons = variationsContainer.querySelectorAll('.node-button');

    buttons.forEach((btn, idx) => {
        if (idx < children.length) {
            const child = children[idx];
            let displayText = child.move.san;
            if (child.eval !== null) {
                displayText += ` (${child.eval.toFixed(2)})`;
            }
            btn.textContent = displayText;
        }
    });
}

async function navigateToNode(node) {
    treeManager.navigateToNode(node);
    clearMoveSelection();
    renderBreadcrumb();

    await evaluateNode(node);
    renderEvalBar(node.eval);

    await renderVariations();

    showStatus(`Navigated to ${node.move.san}`);
}

async function addVariation() {
    const whiteResponse = whiteResponseInput.value.trim();

    if (!selectedMove) {
        showStatus('Select a move on the board first', 'error');
        return;
    }

    if (!whiteResponse) {
        showStatus('Please enter a white strategy label', 'error');
        return;
    }

    const newNode = treeManager.createChildNode(selectedMove.san, whiteResponse);

    if (!newNode) {
        showStatus('Invalid move', 'error');
        return;
    }

    await evaluateNode(newNode);

    whiteResponseInput.value = '';
    const addedMoveSan = selectedMove.san;
    clearMoveSelection();
    await renderVariations();

    showStatus(`Added variation: ${addedMoveSan} (${whiteResponse})`);
}

async function goBack() {
    const parent = treeManager.goBack();

    if (!parent) {
        showStatus('Already at root', 'info');
        return;
    }

    clearMoveSelection();
    renderBreadcrumb();
    renderEvalBar(parent.eval || 0);
    await renderVariations();

    showStatus('Went back one move');
}

function exportTree() {
    const treeData = treeManager.exportTree();
    const json = JSON.stringify(treeData, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `opening-tree-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatus('Tree exported successfully');
}

function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;

    setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    }, 3000);
}

addVariationBtn.addEventListener('click', addVariation);
undoMoveBtn.addEventListener('click', () => {
    clearMoveSelection();
    showStatus('Move selection undone', 'info');
});
backBtn.addEventListener('click', goBack);
exportBtn.addEventListener('click', exportTree);

boardElement.addEventListener('click', handleBoardClick);

whiteResponseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addVariation();
});

document.addEventListener('DOMContentLoaded', async () => {
    await evaluateNode(treeManager.root);
    renderBreadcrumb();
    renderEvalBar(treeManager.root.eval || 0);
    clearMoveSelection();
    await renderVariations();

    showStatus('Tree explorer ready! Select a move by dragging or clicking a piece.');
});

window.treeManager = treeManager;
window.app = { navigateToNode, addVariation, goBack };
