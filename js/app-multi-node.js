import { Engine } from './engine.js';
import { TreeManager } from './tree-manager.js';
import { START_FEN } from './data.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const engine = new Engine();
const treeManager = new TreeManager(START_FEN);

// DOM Elements
const board = Chessboard("board", { position: START_FEN, draggable: false });
const evalBar = document.getElementById('eval-bar');
const variationsContainer = document.getElementById('variations-container');
const breadcrumb = document.getElementById('breadcrumb');
const moveSelect = document.getElementById('move-select');
const whiteResponseInput = document.getElementById('white-response-input');
const addVariationBtn = document.getElementById('add-variation-btn');
const backBtn = document.getElementById('back-btn');
const exportBtn = document.getElementById('export-btn');
const statusMessage = document.getElementById('status-message');
const moveSelectLabel = document.querySelector('label[for="move-select"]'); // Get the label element

// Normalize evaluation for side to move
function normalizeEval(score, fen) {
    const sideToMove = fen.split(' ')[1];
    return sideToMove === 'w' ? score : -score;
}

// Determine whose turn it is
function getSideToMoveName(fen) {
    const sideToMove = fen.split(' ')[1];
    return sideToMove === 'w' ? "White's Move" : "Black's Move";
}

// Update eval bar
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

// Update board display
function updateBoard(fen) {
    board.position(fen);
}

// Render breadcrumb navigation
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

// Evaluate node if not already evaluated
function evaluateNode(node) {
    return new Promise(resolve => {
        if (node.eval !== null) {
            resolve(node.eval);
            return;
        }

        console.log('Evaluating position:', node.fen);
        engine.evaluate(node.fen, 15, (score) => {
            const normalized = normalizeEval(score, node.fen);
            console.log('Evaluation result:', normalized);
            node.setEval(normalized);
            resolve(normalized);
        });
    });
}

// Populate move selector with legal moves
function updateMoveSelector() {
    moveSelect.innerHTML = '<option value="">-- Select Move --</option>';
    const legalMoves = treeManager.getLegalMoves();
    const sideToMoveName = getSideToMoveName(treeManager.currentNode.fen);
    
    // Update the label to show whose turn it is
    if (moveSelectLabel) {
        moveSelectLabel.textContent = sideToMoveName + ':';
    }
    
    legalMoves.forEach(move => {
        const option = document.createElement('option');
        option.value = move.san;
        option.textContent = move.san;
        moveSelect.appendChild(option);
    });
    
    console.log(`${sideToMoveName} - ${legalMoves.length} legal moves available`);
}

// Render variations grouped by white response (WITHOUT recursive call)
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

    // Auto-evaluate all children WITHOUT re-rendering after
    const unevaluatedChildren = children.filter(child => child.eval === null);
    
    if (unevaluatedChildren.length > 0) {
        console.log(`Evaluating ${unevaluatedChildren.length} child nodes...`);
        for (const child of unevaluatedChildren) {
            await evaluateNode(child);
        }
        // Only refresh the display, don't recursively render variations
        refreshVariationEvals();
    }
}

// Refresh just the evaluation displays without re-rendering everything
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

// Navigate to a node
async function navigateToNode(node) {
    console.log('Navigating to:', node.move.san, node.fen);
    
    treeManager.navigateToNode(node);
    updateBoard(node.fen);
    renderBreadcrumb();
    
    await evaluateNode(node);
    renderEvalBar(node.eval);
    
    updateMoveSelector();
    await renderVariations();
    
    showStatus(`Navigated to ${node.move.san}`);
}

// Add a new variation
async function addVariation() {
    console.log('Adding variation...');
    
    const moveSan = moveSelect.value;
    const whiteResponse = whiteResponseInput.value.trim();

    console.log('Move:', moveSan, 'Response:', whiteResponse);

    if (!moveSan) {
        showStatus('Please select a move', 'error');
        return;
    }

    if (!whiteResponse) {
        showStatus('Please enter a white strategy label', 'error');
        return;
    }

    console.log('Creating child node...');
    const newNode = treeManager.createChildNode(moveSan, whiteResponse);
    
    if (!newNode) {
        showStatus('Invalid move', 'error');
        console.error('Failed to create node for move:', moveSan);
        return;
    }

    console.log('Evaluating new node...');
    // Evaluate the new node
    await evaluateNode(newNode);

    console.log('Updating UI...');
    // Reset inputs
    moveSelect.value = '';
    whiteResponseInput.value = '';

    // Update display
    updateMoveSelector();
    await renderVariations();
    
    showStatus(`Added variation: ${moveSan} (${whiteResponse})`);
    console.log('Variation added successfully');
}

// Go back to parent
async function goBack() {
    const parent = treeManager.goBack();
    
    if (!parent) {
        showStatus('Already at root', 'info');
        return;
    }

    updateBoard(parent.fen);
    renderBreadcrumb();
    renderEvalBar(parent.eval || 0);
    updateMoveSelector();
    await renderVariations();
    
    showStatus('Went back one move');
}

// Export tree as JSON
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

// Show status message
function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message status-${type}`;
    
    setTimeout(() => {
        statusMessage.textContent = '';
        statusMessage.className = 'status-message';
    }, 3000);
}

// Event Listeners
addVariationBtn.addEventListener('click', addVariation);
backBtn.addEventListener('click', goBack);
exportBtn.addEventListener('click', exportTree);

moveSelect.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addVariation();
});

whiteResponseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addVariation();
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing tree explorer...');
    await evaluateNode(treeManager.root);
    renderBreadcrumb();
    updateMoveSelector();
    await renderVariations();
    
    showStatus('Tree explorer ready!');
    console.log('Initialization complete');
});

// Expose to global for debugging
window.treeManager = treeManager;
window.app = { navigateToNode, addVariation, goBack };