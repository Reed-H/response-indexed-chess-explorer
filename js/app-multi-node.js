import { Engine } from './engine.js';
import { TreeManager } from './tree-manager.js';
import { START_FEN } from './data.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const engine = new Engine();
const treeManager = new TreeManager(START_FEN);

const boardElement = document.getElementById('board');
const evalBar = document.getElementById('eval-bar');
const variationsContainer = document.getElementById('variations-container');
const treeJsonContainer = document.getElementById('tree-json-container');
const breadcrumb = document.getElementById('breadcrumb');
const groupingToggle = document.getElementById('grouping-toggle');
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
    evalBar.style.height = `${percent}%`;
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

function onDragStart(source) {
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

    if (selectedSourceSquare && previewMove(selectedSourceSquare, clickedSquare)) {
        return;
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

function renderMoveCluster(title, nodes) {
    const group = document.createElement('div');
    group.className = 'variation-group';

    const label = document.createElement('h4');
    label.textContent = title;
    group.appendChild(label);

    const list = document.createElement('div');
    list.className = 'variation-cluster';

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
        list.appendChild(nodeBtn);
    }

    group.appendChild(list);
    return group;
}

async function renderVariations() {
    variationsContainer.innerHTML = '';
    const children = treeManager.currentNode.children;

    if (children.length === 0) {
        variationsContainer.innerHTML = '<p><em>No variations added yet. Use the controls below.</em></p>';
        return;
    }

    const shouldGroup = Boolean(groupingToggle?.checked);
    const groupsToRender = shouldGroup
        ? Object.entries(treeManager.getChildrenGroupedByResponse())
        : [['All Responses', children]];

    for (const [response, nodes] of groupsToRender) {
        variationsContainer.appendChild(renderMoveCluster(response, nodes));
    }

    const unevaluatedChildren = children.filter(child => child.eval === null);
    for (const child of unevaluatedChildren) {
        await evaluateNode(child);
    }

    if (unevaluatedChildren.length > 0) {
        await renderVariations();
    }
}

function renderTreeNodeFromJson(jsonNode, depth = 0) {
    const row = document.createElement('div');
    row.className = 'tree-node-row';
    row.style.paddingLeft = `${depth * 14}px`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree-node-button';

    const moveLabel = jsonNode.move?.san || 'Start';
    const evalLabel = typeof jsonNode.eval === 'number' ? ` (${jsonNode.eval.toFixed(2)})` : '';
    const groupLabel = jsonNode.whiteResponse ? ` · ${jsonNode.whiteResponse}` : '';
    button.textContent = `${moveLabel}${evalLabel}${groupLabel}`;

    if (jsonNode.fen === treeManager.currentNode.fen) {
        button.classList.add('active');
    }

    button.addEventListener('click', () => {
        const node = treeManager.getNodeByFen(jsonNode.fen);
        if (node) {
            navigateToNode(node);
        }
    });

    row.appendChild(button);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(row);

    if (jsonNode.children.length > 0) {
        const shouldGroup = groupingToggle.checked;
        const orderedChildren = shouldGroup
            ? groupChildrenJson(jsonNode.children)
            : jsonNode.children;

        for (const child of orderedChildren) {
            fragment.appendChild(renderTreeNodeFromJson(child, depth + 1));
        }
    }

    return fragment;
}

function groupChildrenJson(children) {
    const buckets = new Map();
    for (const child of children) {
        const key = child.whiteResponse || 'Ungrouped';
        if (!buckets.has(key)) {
            buckets.set(key, []);
        }
        buckets.get(key).push(child);
    }

    const ordered = [];
    for (const bucket of buckets.values()) {
        ordered.push(...bucket);
    }
    return ordered;
}

function renderTreeJsonView() {
    treeJsonContainer.innerHTML = '';
    const treeJson = treeManager.exportTree();
    treeJsonContainer.appendChild(renderTreeNodeFromJson(treeJson.root));
}

async function navigateToNode(node) {
    treeManager.navigateToNode(node);
    clearMoveSelection();
    renderBreadcrumb();

    await evaluateNode(node);
    renderEvalBar(node.eval || 0);

    await renderVariations();
    renderTreeJsonView();

    showStatus(node.move ? `Navigated to ${node.move.san}` : 'Navigated to start');
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
    renderTreeJsonView();

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
    renderTreeJsonView();

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
if (groupingToggle) {
    groupingToggle.addEventListener('change', () => {
        renderVariations();
        renderTreeJsonView();
    });
}

if (boardElement) {
    boardElement.addEventListener('click', handleBoardClick);
}

whiteResponseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addVariation();
});

document.addEventListener('DOMContentLoaded', async () => {
    await evaluateNode(treeManager.root);
    renderBreadcrumb();
    renderEvalBar(treeManager.root.eval || 0);
    clearMoveSelection();
    await renderVariations();
    renderTreeJsonView();

    showStatus('Tree explorer ready! Select a move by dragging or clicking a piece.');
});

window.treeManager = treeManager;
window.app = { navigateToNode, addVariation, goBack };
