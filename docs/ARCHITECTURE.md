# Architecture

Lumberjacks Marketplace has three explicit layers. `assets/core.js` contains deterministic catalog, filtering, and total rules. `assets/app.js` owns routes, dialogs, cart state, accessibility, and static-host fallback. `server.js` owns authentication, inventory, saved carts, checkout, order history, operations metrics, audit events, and static delivery.

```text
Browser -> REST service -> versioned 36-product catalog
                     \-> ignored runtime carts, inventory, orders, audit
```

The Pages build loads the catalog directly and keeps a guest basket in localStorage. Account, order, and operations actions activate only when the local service is reachable. The JSON persistence is intentionally reviewable; a production service would use password hashing, database transactions, durable sessions, rate limiting, and a payment provider.
