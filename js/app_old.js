
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js"
import { Engine } from "./engine.js"
import { PositionNode } from "./node.js"
import { getFenAfterMove } from "./position.js"
import { START_FEN } from "./data.js"

document.addEventListener("DOMContentLoaded", () => {

	const engine = new Engine()

	let currentFen = START_FEN

	console.log("Starting FEN:", currentFen)

	// Example move just to prove wiring works
	const testMove = "d4"   // legal in your START_FEN position
	const newFen = getFenAfterMove(Chess, currentFen, testMove)

	console.log("After move:", newFen)

})

// import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js"
// import { Engine } from "./engine.js"
// import { getFenAfterMove } from "./position.js"
// import { PositionNode } from "./node.js"
// import { START_FEN } from "./data.js"


// // Run after DOM is ready
// document.addEventListener("DOMContentLoaded", async () => {
// 	console.log("🚀 DOM ready, app.js running")

// 	const engine = new Engine()
// 	const game = new Chess(START_FEN)
// 	const rootNode = new PositionNode({ fen: START_FEN })

// 	const evalBar = document.getElementById("eval-bar")
// 	const container = document.getElementById("ideas")

// 	// Normalize evaluation to White's POV
// 	function normalizeEval(score, fen) {
// 		const sideToMove = fen.split(" ")[1]
// 		return sideToMove === "b" ? -score : score
// 	}

// 	// Render vertical evaluation bar
// 	function renderEvalBar(score) {
// 		if (!evalBar) return
// 		const clamped = Math.max(-5, Math.min(5, score))
// 		const percent = 50 + clamped * 10 // 0-100%
// 		evalBar.style.height = percent + "%"
// 	}

// 	// Generate top N white ideas for a given node
// 	async function generateTopWhiteIdeas(node, limit = 5) {
// 		const game = new Chess(node.fen)
// 		const moves = game.moves({ verbose: true })
// 		const evaluations = []

// 		for (const move of moves) {
// 			if (move.color !== "w") continue
// 			const fenAfter = getFenAfterMove(node.fen, move.san)
// 			const rawScore = await engine.evaluatePosition(fenAfter)
// 			const score = normalizeEval(rawScore, fenAfter)
// 			evaluations.push({ move: move.san, fen: fenAfter, score })
// 		}

// 		evaluations.sort((a, b) => b.score - a.score)
// 		return evaluations.slice(0, limit)
// 	}

// 	// Expand a node and show buttons for top white ideas
// 	async function expandNode(node) {
// 		if (node.children.length > 0) return renderNodeChildren(node)

// 		const ideas = await generateTopWhiteIdeas(node)

// 		for (const idea of ideas) {
// 			const child = new PositionNode({ fen: idea.fen, move: idea.move, parent: node })
// 			child.setEval(idea.score)
// 			node.addChild(child)
// 		}

// 		renderNodeChildren(node)
// 	}

// 	// Render buttons for each child idea
// 	function renderNodeChildren(node) {
// 		container.innerHTML = ""
// 		node.children.forEach(child => {
// 			const btn = document.createElement("button")
// 			btn.textContent = `${child.move} (${child.eval.toFixed(2)})`
// 			btn.onclick = () => {
// 				renderEvalBar(child.eval)
// 				expandNode(child)
// 			}
// 			container.appendChild(btn)
// 		})
// 	}

// 	// Initial expansion from root node
// 	await expandNode(rootNode)
// })
