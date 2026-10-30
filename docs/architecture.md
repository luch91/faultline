# Architecture

The browser sends workflow text to the Cloudflare Worker. Only the Worker has the Meta key. The extractor converts a Meta JSON response into a versioned graph and rejects evidence strings absent from the original text. The pure simulator evaluates that graph without an API key. The browser can edit observations and execution gates, then request reevaluation. The budget ledger is a SQLite-backed Durable Object used before each Meta request.

The current investigation endpoint asks Meta for a `run_counterfactual` call, executes that request in the simulator, replays the result to Meta, then accepts a `propose_safeguard` call. The simulator verifies the proposed gate. The result includes actual call IDs and deterministic results. A broader tool catalogue is planned but not claimed here.
