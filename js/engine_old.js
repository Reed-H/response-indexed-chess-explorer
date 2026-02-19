export class Engine {
	constructor() {
		this.engine = new Worker(new URL("./stockfish.js", import.meta.url))
		this.cache = new Map()   // FEN → eval
	}

	async evaluatePosition(fen, depth = 18) {

		// Cache hit
		if (this.cache.has(fen)) {
			return this.cache.get(fen)
		}

		const score = await new Promise(resolve => {

			const handleMessage = (event) => {
				const line = event.data

				if (line.includes("score cp")) {
					const match = line.match(/score cp (-?\d+)/)
					if (match) {
						const value = parseInt(match[1]) / 100
						resolve(value)
						this.worker.removeEventListener("message", handleMessage)
					}
				}

				if (line.includes("score mate")) {
					const match = line.match(/score mate (-?\d+)/)
					if (match) {
						const mate = parseInt(match[1])
						resolve(mate > 0 ? 100 : -100)
						this.worker.removeEventListener("message", handleMessage)
					}
				}
			}

			this.worker.addEventListener("message", handleMessage)

			this.worker.postMessage("position fen " + fen)
			this.worker.postMessage("go depth " + depth)
		})

		this.cache.set(fen, score)

		return score
	}
}
