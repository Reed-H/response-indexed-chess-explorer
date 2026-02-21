import { PositionNode } from './node.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

export class TreeManager {
    constructor(startFen) {
        this.root = new PositionNode({ fen: startFen });
        this.currentNode = this.root;
        this.nodeIndex = new Map();
        this.nodeIndex.set(startFen, this.root);
    }

    /**
     * Get all legal moves from current position
     */
    getLegalMoves() {
        const game = new Chess(this.currentNode.fen);
        return game.moves({ verbose: true }).map(m => ({
            san: m.san,
            from: m.from,
            to: m.to
        }));
    }

    /**
     * Create a new child node from current position after a move
     * @param {string} moveSan - Standard algebraic notation move
     * @param {string} whiteResponse - Label for grouping (e.g., "Solid Defense")
     * @returns {PositionNode|null} The created node or null if move is invalid
     */
    createChildNode(moveSan, whiteResponse = null) {
        const game = new Chess(this.currentNode.fen);
        const move = game.move(moveSan);
        
        if (!move) return null;

        const newFen = game.fen();
        
        // Check if node already exists (transposition - same position from different path)
        if (this.nodeIndex.has(newFen)) {
            const existingNode = this.nodeIndex.get(newFen);
            // Add to current node's children if not already there
            if (!this.currentNode.children.includes(existingNode)) {
                this.currentNode.addChild(existingNode);
            }
            return existingNode;
        }

        // Create new node
        const newNode = new PositionNode({
            fen: newFen,
            move: { san: moveSan, ...move },
            parent: this.currentNode,
            whiteResponse: whiteResponse
        });

        this.currentNode.addChild(newNode);
        this.nodeIndex.set(newFen, newNode);

        return newNode;
    }


    /**
     * Fetch a node by FEN from the index
     */
    getNodeByFen(fen) {
        return this.nodeIndex.get(fen) || null;
    }

    /**
     * Navigate to an existing node and update current position
     */
    navigateToNode(node) {
        if (!this.nodeIndex.has(node.fen)) {
            console.warn('Node not in tree');
            return null;
        }
        this.currentNode = node;
        return node.fen;
    }

    /**
     * Navigate by move (SAN) from current position
     */
    navigateByMove(moveSan) {
        const childNode = this.currentNode.children.find(
            child => child.move && child.move.san === moveSan
        );
        
        if (childNode) {
            this.currentNode = childNode;
            return childNode;
        }
        return null;
    }

    /**
     * Go back to parent node
     */
    goBack() {
        if (this.currentNode.parent) {
            this.currentNode = this.currentNode.parent;
            return this.currentNode;
        }
        return null;
    }

    /**
     * Get child nodes grouped by white response
     * Key for response-indexed visualization
     */
    getChildrenGroupedByResponse() {
        const groups = {};
        
        this.currentNode.children.forEach(child => {
            const responseKey = child.whiteResponse || 'Ungrouped';
            if (!groups[responseKey]) {
                groups[responseKey] = [];
            }
            groups[responseKey].push(child);
        });

        return groups;
    }

    /**
     * Get the path from root to current node
     */
    getCurrentPath() {
        const path = [];
        let node = this.currentNode;
        
        while (node.parent) {
            path.unshift(node);
            node = node.parent;
        }
        path.unshift(this.root);
        
        return path;
    }

    /**
     * Get depth of current node from root
     */
    getCurrentDepth() {
        let depth = 0;
        let node = this.currentNode;
        while (node.parent) {
            depth++;
            node = node.parent;
        }
        return depth;
    }

    /**
     * Get all nodes in tree (for analysis, export, etc.)
     */
    getAllNodes(node = this.root) {
        const nodes = [node];
        for (const child of node.children) {
            nodes.push(...this.getAllNodes(child));
        }
        return nodes;
    }

    /**
     * Export tree structure as JSON
     */
    exportTree() {
        return {
            root: this._serializeNode(this.root)
        };
    }

    _serializeNode(node) {
        return {
            fen: node.fen,
            move: node.move ? { san: node.move.san } : null,
            eval: node.eval,
            whiteResponse: node.whiteResponse,
            children: node.children.map(child => this._serializeNode(child))
        };
    }
}