// Stands in for the `ws` package inside the Edge Function bundle. viem reaches for it
// only in WebSocket transports; the agent uses HTTP alone, so nothing here ever runs.
export default class WebSocketUnavailable {
	constructor() {
		throw new Error("WebSocket transports are not bundled into the agent's Edge Function");
	}
}
