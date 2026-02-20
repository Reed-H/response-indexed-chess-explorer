import { PositionNode } from './node.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

export class TreeManager {
    constructor(startFen) {
        this.root = new PositionNode({ fen: startFen });
        this.currentNode = this.root;
        this.nodeIndex = new Map(); // For quick lookup by FEN
        this.nodeIndex.set(startFen, this.root);
    }

    /**
     * Create a new node from current position after a move
     * Groups by white response for the response-indexed concept
     */
    createChildNode(moveSan, whiteResponse = null) {
        const game = new Chess(this.currentNode.fen);
        const move = game.move(moveSan);
        
        if (!move) return null;

        const newFen = game.fen();
        
        // Check if node already exists (avoid duplicates)
        if (this.nodeIndex.has(newFen)) {
            return this.nodeIndex.get(newFen);
        }

        // Create new node
        const newNode = new PositionNode({
            fen: newFen,
            move: { san: moveSan, ...move },
            parent: this.currentNode,
            whiteResponse: whiteResponse // Track white's grouped response
        });

        this.currentNode.addChild(newNode);
        this.nodeIndex.set(newFen, newNode);

        return newNode;
    }

    /**
     * Navigate to an existing node
     */
    navigateToNode(node) {
        this.currentNode = node;
        return node.fen;
    }

    /**
     * Navigate by move from current position
     */
    navigateByMove(moveSan) {
        const childNode = this.currentNode.children.find(
            child => child.move.san === moveSan
        );
        
        if (childNode) {
            this.currentNode = childNode;
            return childNode;
        }
        return null;
    }

    /**
     * Get all child nodes grouped by white response
     * This is key for your response-indexed visualization
     */
    getChildrenGroupedByResponse() {
        const groups = {};
        
        this.currentNode.children.forEach(child => {
            const responseKey = child.whiteResponse || 'ungrouped';
            if (!groups[responseKey]) {
                groups[responseKey] = [];
            }
            groups[responseKey].push(child);
        });

        return groups;
    }

    /**
     * Get path from root to current node
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
     * Export tree structure for saving
     */
    exportTree() {
        return {
            root: this._serializeNode(this.root)
        };
    }

    _serializeNode(node) {
        return {
            fen: node.fen,
            move: node.move,
            eval: node.eval,
            whiteResponse: node.whiteResponse,
            children: node.children.map(child => this._serializeNode(child))
        };
    }
}