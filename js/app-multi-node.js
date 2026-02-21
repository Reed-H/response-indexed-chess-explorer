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
const boardTreeViewport = document.getElementById('board-tree-viewport');
const boardTreeCanvas = document.getElementById('board-tree-canvas');
const breadcrumb = document.getElementById('breadcrumb');
const groupingToggle = document.getElementById('grouping-toggle');
const clusterTopNSelect = document.getElementById('cluster-topn');
const blackFilter = document.getElementById('black-filter');
const whiteFilter = document.getElementById('white-filter');
const selectedMoveDisplay = document.getElementById('selected-move-display');
const whiteResponseInput = document.getElementById('white-response-input');
const lineTagInput = document.getElementById('line-tag-input');
const addVariationBtn = document.getElementById('add-variation-btn');
const undoMoveBtn = document.getElementById('undo-move-btn');
const backBtn = document.getElementById('back-btn');
const exportBtn = document.getElementById('export-btn');
const importJsonInput = document.getElementById('import-json-input');
const importJsonBtn = document.getElementById('import-json-btn');
const importLinesBtn = document.getElementById('import-lines-btn');
const centerTreeBtn = document.getElementById('center-tree-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsDialog = document.getElementById('settings-dialog');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeSelect = document.getElementById('theme-select');
const appBgInput = document.getElementById('app-bg-input');
const treeBgInput = document.getElementById('tree-bg-input');
const statusMessage = document.getElementById('status-message');

let selectedMove = null;
let selectedSourceSquare = null;
let treeOffset = { x: 20, y: 20 };
let treeScale = 1;
let isPanning = false;
let panStart = null;
let miniBoardInstances = [];

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

function normalizeEval(score, fen) {
    const sideToMove = fen.split(' ')[1];
    return sideToMove === 'w' ? score : -score;
}

function renderEvalBar(score) {
    const clamped = Math.max(-5, Math.min(5, score));
    evalBar.style.height = `${50 + clamped * 10}%`;
}

function updateBoard() {
    board.position(selectedMove ? selectedMove.fen : treeManager.currentNode.fen);
}

function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    }, 3000);
}

function renderBreadcrumb() {
    const path = treeManager.getCurrentPath();
    breadcrumb.innerHTML = path.map((node, idx) => {
        if (idx === 0) return '<span class="breadcrumb-item">Start</span>';
        const evalText = node.eval !== null ? ` (${node.eval.toFixed(2)})` : '';
        const strategyText = node.whiteResponse ? ` | ${node.whiteResponse}` : '';
        const tagText = node.lineTag ? ` #${node.lineTag}` : '';
        return `<span class="breadcrumb-item"> > ${node.move.san}${evalText}${strategyText}${tagText}</span>`;
    }).join('');
}

function evaluateNode(node) {
    return new Promise(resolve => {
        if (node.eval !== null) return resolve(node.eval);
        engine.evaluate(node.fen, 15, score => {
            const normalized = normalizeEval(score, node.fen);
            node.setEval(normalized);
            resolve(normalized);
        });
    });
}

function clearHighlights() {
    boardElement.querySelectorAll('.square-55d63').forEach(squareEl => {
        squareEl.classList.remove('move-source', 'move-target');
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

function highlightMovesFrom(sourceSquare) {
    clearHighlights();
    const legalMovesFromSource = getLegalMoves().filter(move => move.from === sourceSquare);
    if (legalMovesFromSource.length === 0) return;

    boardElement.querySelector(`[data-square="${sourceSquare}"]`)?.classList.add('move-source');
    legalMovesFromSource.forEach(move => {
        boardElement.querySelector(`[data-square="${move.to}"]`)?.classList.add('move-target');
    });
}

function findLegalMove(source, target) {
    return getLegalMoves().find(move => move.from === source && move.to === target) || null;
}

function previewMove(source, target) {
    const move = findLegalMove(source, target);
    if (!move) return false;

    const game = getCurrentPositionGame();
    const playedMove = game.move({ from: source, to: target, promotion: 'q' });
    if (!playedMove) return false;

    setSelectedMove({ ...move, san: playedMove.san, fen: game.fen() });
    return true;
}

function onDragStart(source) {
    const game = getCurrentPositionGame();
    const pieceData = game.get(source);
    if (!pieceData || pieceData.color !== game.turn()) return false;
    if (!getLegalMoves().some(move => move.from === source)) return false;
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
    if (!squareElement || !boardElement.contains(squareElement)) return;

    const clickedSquare = squareElement.getAttribute('data-square');
    if (!clickedSquare) return;

    const game = getCurrentPositionGame();
    if (selectedSourceSquare && previewMove(selectedSourceSquare, clickedSquare)) return;

    const piece = game.get(clickedSquare);
    if (piece && piece.color === game.turn()) {
        selectedSourceSquare = clickedSquare;
        highlightMovesFrom(clickedSquare);
        return;
    }

    selectedSourceSquare = null;
    clearHighlights();
}

function getTopWhiteMoves(node, topN) {
    return node.children
        .slice()
        .sort((a, b) => (b.eval ?? -999) - (a.eval ?? -999))
        .slice(0, topN)
        .map(child => child.move?.san)
        .filter(Boolean);
}

function clusterBlackResponses(nodes, topN) {
    const clusters = [];

    for (const node of nodes) {
        const nodeSingleWhite = node.children.length === 1 ? node.children[0].move?.san : null;
        const nodeTopMoves = new Set(getTopWhiteMoves(node, topN));

        let cluster = clusters.find(c => {
            if (c.singleWhite && nodeSingleWhite && c.singleWhite === nodeSingleWhite) return true;
            for (const move of nodeTopMoves) {
                if (c.topMoves.has(move)) return true;
            }
            return false;
        });

        if (!cluster) {
            cluster = {
                label: 'Cluster',
                singleWhite: nodeSingleWhite,
                topMoves: new Set(nodeTopMoves),
                nodes: []
            };
            clusters.push(cluster);
        }

        cluster.nodes.push(node);
        if (nodeSingleWhite && !cluster.singleWhite) cluster.singleWhite = nodeSingleWhite;
        nodeTopMoves.forEach(move => cluster.topMoves.add(move));
    }

    return clusters.map((cluster, idx) => ({
        label: cluster.singleWhite ? `Shared white: ${cluster.singleWhite}` : `Cluster ${idx + 1}`,
        nodes: cluster.nodes
    }));
}

function getFilteredChildren() {
    return treeManager.currentNode.children.filter(node => {
        if (blackFilter.value && node.move?.san !== blackFilter.value) return false;
        if (whiteFilter.value && (node.whiteResponse || '') !== whiteFilter.value) return false;
        return true;
    });
}

function renderMoveCluster(title, nodes) {
    const group = document.createElement('div');
    group.className = 'variation-group';

    const label = document.createElement('h4');
    label.textContent = `${title} (${nodes.length})`;
    group.appendChild(label);

    const list = document.createElement('div');
    list.className = 'variation-cluster';

    for (const node of nodes) {
        const nodeBtn = document.createElement('button');
        nodeBtn.className = 'node-button';
        const evalText = node.eval !== null ? ` (${node.eval.toFixed(2)})` : ' (?)';
        const tagText = node.lineTag ? ` #${node.lineTag}` : '';
        nodeBtn.textContent = `${node.move.san}${evalText}${tagText}`;
        nodeBtn.onclick = () => navigateToNode(node);
        list.appendChild(nodeBtn);
    }

    group.appendChild(list);
    return group;
}

function refreshStrategyFilters() {
    const allNodes = treeManager.getAllNodes();
    const blackLabels = [...new Set(allNodes.map(n => n.move?.san).filter(Boolean))].sort();
    const whiteLabels = [...new Set(allNodes.map(n => n.whiteResponse).filter(Boolean))].sort();

    const currentBlack = blackFilter.value;
    const currentWhite = whiteFilter.value;

    blackFilter.innerHTML = '<option value="">All</option>' + blackLabels.map(label => `<option value="${label}">${label}</option>`).join('');
    whiteFilter.innerHTML = '<option value="">All</option>' + whiteLabels.map(label => `<option value="${label}">${label}</option>`).join('');

    blackFilter.value = blackLabels.includes(currentBlack) ? currentBlack : '';
    whiteFilter.value = whiteLabels.includes(currentWhite) ? currentWhite : '';
}

async function renderVariations() {
    variationsContainer.innerHTML = '';
    const children = getFilteredChildren();

    if (children.length === 0) {
        variationsContainer.innerHTML = '<p><em>No matching variations.</em></p>';
        return;
    }

    const topN = Number(clusterTopNSelect.value || 2);
    if (groupingToggle.checked) {
        const grouped = treeManager.getChildrenGroupedByResponse();
        for (const [response, nodes] of Object.entries(grouped)) {
            const filtered = nodes.filter(n => children.includes(n));
            if (filtered.length) variationsContainer.appendChild(renderMoveCluster(response, filtered));
        }
        const clustered = clusterBlackResponses(children, topN);
        clustered.forEach(cluster => variationsContainer.appendChild(renderMoveCluster(cluster.label, cluster.nodes)));
    } else {
        variationsContainer.appendChild(renderMoveCluster('All Responses', children));
    }

    const unevaluatedChildren = children.filter(child => child.eval === null);
    for (const child of unevaluatedChildren) {
        await evaluateNode(child);
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
    const tagLabel = jsonNode.lineTag ? ` #${jsonNode.lineTag}` : '';
    button.textContent = `${moveLabel}${evalLabel}${groupLabel}${tagLabel}`;

    if (jsonNode.fen === treeManager.currentNode.fen) button.classList.add('active');

    button.addEventListener('click', () => {
        const node = treeManager.getNodeByFen(jsonNode.fen);
        if (node) navigateToNode(node);
    });

    row.appendChild(button);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(row);
    for (const child of (jsonNode.children || [])) {
        fragment.appendChild(renderTreeNodeFromJson(child, depth + 1));
    }
    return fragment;
}

function renderTreeJsonView() {
    treeJsonContainer.innerHTML = '';
    treeJsonContainer.appendChild(renderTreeNodeFromJson(treeManager.exportTree().root));
}

function computeTreeLayout() {
    const levels = [];
    const queue = [{ node: treeManager.root, depth: 0 }];
    while (queue.length) {
        const { node, depth } = queue.shift();
        if (!levels[depth]) levels[depth] = [];
        levels[depth].push(node);
        node.children.forEach(child => queue.push({ node: child, depth: depth + 1 }));
    }

    const positions = new Map();
    const spacingX = 170;
    const spacingY = 165;

    levels.forEach((nodes, depth) => {
        nodes.forEach((node, idx) => {
            positions.set(node.fen, {
                x: idx * spacingX,
                y: depth * spacingY
            });
        });
    });

    return { levels, positions, width: (Math.max(...levels.map(l => l.length)) + 1) * 170, height: levels.length * 165 + 40 };
}

function getLineSetForCurrentNode() {
    return new Set(treeManager.getCurrentPath().map(node => node.fen));
}

function clearMiniBoards() {
    miniBoardInstances.forEach(instance => instance.destroy?.());
    miniBoardInstances = [];
}

function applyTreeTransform() {
    boardTreeCanvas.style.transform = `translate(${treeOffset.x}px, ${treeOffset.y}px) scale(${treeScale})`;
}

function renderBoardTree() {
    clearMiniBoards();
    boardTreeCanvas.innerHTML = '';

    const { levels, positions, width, height } = computeTreeLayout();
    boardTreeCanvas.style.width = `${width}px`;
    boardTreeCanvas.style.height = `${height}px`;

    const lineSet = getLineSetForCurrentNode();

    for (const levelNodes of levels) {
        for (const node of levelNodes) {
            const { x, y } = positions.get(node.fen);
            const wrapper = document.createElement('div');
            wrapper.className = 'board-tree-node';
            wrapper.style.left = `${x}px`;
            wrapper.style.top = `${y}px`;
            if (!lineSet.has(node.fen)) wrapper.classList.add('dimmed');
            if (node.fen === treeManager.currentNode.fen) wrapper.classList.add('active');

            const miniBoardEl = document.createElement('div');
            miniBoardEl.className = 'mini-board';
            miniBoardEl.id = `mini-${Math.random().toString(36).slice(2, 10)}`;

            const caption = document.createElement('div');
            caption.className = 'mini-caption';
            const moveLabel = node.move?.san || 'Start';
            const evalText = typeof node.eval === 'number' ? ` ${node.eval.toFixed(2)}` : ' ?';
            caption.textContent = `${moveLabel}${evalText}`;

            wrapper.appendChild(miniBoardEl);
            wrapper.appendChild(caption);
            wrapper.addEventListener('click', () => navigateToNode(node));

            boardTreeCanvas.appendChild(wrapper);
            miniBoardInstances.push(Chessboard(miniBoardEl.id, {
                position: node.fen,
                draggable: false,
                showNotation: false
            }));

            if (node.parent) {
                const parentPos = positions.get(node.parent.fen);
                const edge = document.createElement('div');
                edge.className = 'board-tree-edge';
                if (!lineSet.has(node.fen) || !lineSet.has(node.parent.fen)) edge.classList.add('dimmed');

                const startX = parentPos.x + 58;
                const startY = parentPos.y + 120;
                const endX = x + 58;
                const endY = y;
                const dx = endX - startX;
                const dy = endY - startY;
                const length = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                edge.style.width = `${length}px`;
                edge.style.left = `${startX}px`;
                edge.style.top = `${startY}px`;
                edge.style.transform = `rotate(${angle}deg)`;
                boardTreeCanvas.appendChild(edge);
            }
        }
    }

    applyTreeTransform();
}

async function navigateToNode(node) {
    treeManager.navigateToNode(node);
    clearMoveSelection();
    lineTagInput.value = treeManager.currentNode.lineTag || '';
    renderBreadcrumb();

    await evaluateNode(node);
    renderEvalBar(node.eval || 0);

    refreshStrategyFilters();
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();

    showStatus(node.move ? `Navigated to ${node.move.san}` : 'Navigated to start');
}

async function addVariation() {
    const whiteResponse = whiteResponseInput.value.trim();
    const lineTag = lineTagInput.value.trim() || null;

    if (!selectedMove) {
        showStatus('Select a move on the board first', 'error');
        return;
    }

    const newNode = treeManager.createChildNode(selectedMove.san, whiteResponse || null, lineTag);
    if (!newNode) {
        showStatus('Invalid move', 'error');
        return;
    }

    await evaluateNode(newNode);

    whiteResponseInput.value = '';
    clearMoveSelection();

    refreshStrategyFilters();
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();
    showStatus(`Added variation: ${selectedMove?.san || newNode.move.san}`);
}

async function goBack() {
    const parent = treeManager.goBack();
    if (!parent) {
        showStatus('Already at root', 'info');
        return;
    }
    await navigateToNode(parent);
}

function exportTree() {
    const json = JSON.stringify(treeManager.exportTree(), null, 2);
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

async function importJsonTree() {
    try {
        const parsed = JSON.parse(importJsonInput.value);
        treeManager.importTree(parsed);
        clearMoveSelection();
        await evaluateNode(treeManager.root);
        renderEvalBar(treeManager.root.eval || 0);
        refreshStrategyFilters();
        await renderVariations();
        renderBreadcrumb();
        renderTreeJsonView();
        renderBoardTree();
        showStatus('JSON tree imported');
    } catch (error) {
        showStatus(`Import failed: ${error.message}`, 'error');
    }
}

async function importLines() {
    try {
        const importedCount = treeManager.importLines(importJsonInput.value);
        refreshStrategyFilters();
        await renderVariations();
        renderTreeJsonView();
        renderBoardTree();
        showStatus(`Imported ${importedCount} line(s)`);
    } catch (error) {
        showStatus(`Line import failed: ${error.message}`, 'error');
    }
}

function openSettings() {
    settingsDialog.showModal();
}

function applySettings() {
    document.documentElement.style.setProperty('--app-bg', appBgInput.value);
    document.documentElement.style.setProperty('--tree-bg', treeBgInput.value);
    document.body.classList.toggle('theme-dark', themeSelect.value === 'dark');
}

function setupTreePanZoom() {
    boardTreeViewport.addEventListener('mousedown', (event) => {
        if (event.target.closest('.board-tree-node')) return;
        isPanning = true;
        panStart = { x: event.clientX - treeOffset.x, y: event.clientY - treeOffset.y };
        boardTreeViewport.classList.add('panning');
    });

    window.addEventListener('mousemove', (event) => {
        if (!isPanning) return;
        treeOffset = { x: event.clientX - panStart.x, y: event.clientY - panStart.y };
        applyTreeTransform();
    });

    window.addEventListener('mouseup', () => {
        isPanning = false;
        boardTreeViewport.classList.remove('panning');
    });

    boardTreeViewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        treeScale = Math.max(0.45, Math.min(1.8, treeScale + (event.deltaY < 0 ? 0.08 : -0.08)));
        applyTreeTransform();
    }, { passive: false });
}

function centerTree() {
    treeOffset = { x: 20, y: 20 };
    treeScale = 1;
    applyTreeTransform();
}

addVariationBtn.addEventListener('click', addVariation);
undoMoveBtn.addEventListener('click', () => {
    clearMoveSelection();
    showStatus('Move selection undone', 'info');
});
backBtn.addEventListener('click', goBack);
exportBtn.addEventListener('click', exportTree);
importJsonBtn.addEventListener('click', importJsonTree);
importLinesBtn.addEventListener('click', importLines);
centerTreeBtn.addEventListener('click', centerTree);
boardElement.addEventListener('click', handleBoardClick);

[groupingToggle, clusterTopNSelect, blackFilter, whiteFilter].forEach(control => {
    control.addEventListener('change', async () => {
        await renderVariations();
        renderTreeJsonView();
        renderBoardTree();
    });
});

whiteResponseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addVariation();
});

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', () => settingsDialog.close());
[themeSelect, appBgInput, treeBgInput].forEach(input => input.addEventListener('input', applySettings));

document.addEventListener('DOMContentLoaded', async () => {
    setupTreePanZoom();
    applySettings();
    await evaluateNode(treeManager.root);
    lineTagInput.value = treeManager.root.lineTag || '';
    renderBreadcrumb();
    renderEvalBar(treeManager.root.eval || 0);
    clearMoveSelection();
    refreshStrategyFilters();
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();
    showStatus('Tree explorer ready!');
});

window.treeManager = treeManager;
window.app = { navigateToNode, addVariation, goBack, importJsonTree, importLines };
