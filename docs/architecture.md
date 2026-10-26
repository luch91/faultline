# Architecture

The browser sends workflow text to the Cloudflare Worker. Only the Worker has the Meta key. The extractor converts a Meta JSON response into a versioned graph and rejects evidence strings absent from the original text. The pure simulator evaluates that graph without an API key. The browser can edit observations and execution gates, then request reevaluation. The budget ledger is a SQLite-backed Durable Object used before each Meta request.

The current investigation endpoint asks Meta for one `run_counterfactual` call, executes that request in the simulator, and verifies an implicated missing gate. The result includes the actual call ID and deterministic results. A longer multi-tool loop is planned but not claimed here.
