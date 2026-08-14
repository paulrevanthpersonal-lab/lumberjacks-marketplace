# Lumberjacks Marketplace

A full-stack rebuild of my original ITC505 Lumberjacks Store project. It now includes a 36-item catalog, inventory-aware cart, account session, order history, checkout service, operations view, automated API tests, and a responsive storefront.

**[Open the hosted storefront](https://paulrevanthpersonal-lab.github.io/lumberjacks-marketplace/)**

![Lumberjacks Marketplace catalog](docs/screenshots/editorial-home.png)

## 1. Why I rebuilt it

My original coursework proved the basic interaction model: products, navigation, a cart panel, login UI, and responsive layout. This repository shows how I would take that starting point into a reviewable application with real data boundaries and testable behavior.

## 2. Original project lineage

The name and grocery-market direction come directly from my original **LUMBERJACKS STORE** submission. The code, service architecture, catalog, UI system, validation, and documentation in this repository are the expanded implementation.

[View the preserved coursework source.](https://github.com/MacDevil143/ITC505/tree/f415d5006493f46949c7230174be3ecda8730ce2/WEBSITE%20PAGE)

## 3. Application surface

- Market home and featured products
- Searchable, sortable six-department catalog
- Product detail with origin, stock, pack size, rating, and SKU
- Persistent guest basket and server-saved signed-in basket
- Delivery-slot checkout and confirmed test orders
- Customer order history
- Inventory, revenue, low-stock, and audit operations view

## 4. Catalog depth

`data/products.json` contains 36 complete product records across Produce, Bakery, Dairy, Pantry, Beverages, and Household. Each record has a stable ID and SKU, price, unit, inventory, rating, review count, origin, tags, description, and product photography.

## 5. Backend behavior

The Node.js service owns authentication, catalog queries, cart persistence, inventory validation, order creation, totals, audit events, and static delivery. It deliberately avoids framework abstractions so the HTTP and persistence lifecycle is easy to explain in an interview.

## 6. API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/products` | Search, filter, sort, and return current stock |
| `GET` | `/api/products/:id` | Product detail |
| `POST` | `/api/auth/login` | Create reviewer session |
| `GET/PUT` | `/api/cart` | Read or replace signed-in cart |
| `POST` | `/api/orders` | Validate stock and create order |
| `GET` | `/api/orders` | Customer order history |
| `GET` | `/api/operations` | Inventory and order summary |

## 7. Persistence model

The immutable catalog is versioned in Git. Mutable inventory, carts, orders, and audit records are saved in `data/runtime.json`, which is ignored by Git. Set `LUMBERJACK_DATA_FILE` to isolate test or development environments.

## 8. Checkout boundary

Checkout validates authentication, address, slot, cart contents, quantity constraints, and available stock. It creates a test order and decrements inventory. It intentionally does not collect or process card details.

## 9. Reviewer account

```text
Email: paul@lumberjacks.local
Password: Lumberjack2026!
```

The credentials are seeded specifically for local portfolio review; this is not a production identity system.

## 10. Run locally

```bash
npm start
# open http://localhost:4173
```

## 11. Test and verify

```bash
npm run check
npm test
```

Tests cover catalog completeness, filtering, totals, authentication, server-saved carts, order creation, cart clearing, and rejected unauthenticated checkout.

## 12. Frontend fallback

GitHub Pages serves the catalog and browser cart directly from the versioned JSON file. Account, order, and live operations features require the local Node service; the UI communicates that boundary instead of pretending a static page is the full deployment.

## 13. Accessibility

The application uses semantic landmarks, labeled controls, keyboard-operable dialogs and navigation, visible focus behavior, informative button names, live status messaging, reduced-motion support, and meaningful image alternative text.

## 14. Performance

The browser code has no runtime package dependency. Images use native lazy loading, layout is CSS-driven, and motion is limited to opacity and transforms. Refresh rate depends on the reviewer’s device and browser; the implementation does not make an artificial FPS claim.

## 15. Security considerations

The server constrains payload size, validates IDs and quantities, calculates totals itself, verifies stock again during order creation, keeps mutation routes behind bearer sessions, and prevents path traversal in static delivery. Production work would add password hashing, a durable session store, CSRF strategy, rate limiting, structured logging, and a payment provider.

## 16. Repository map

```text
assets/          browser state, rendering, and visual system
data/            product catalog and ignored mutable runtime state
docs/            architecture, UX notes, screenshots, interview guide
tests/           unit and HTTP integration tests
server.js        REST API, persistence, validation, static server
```

## 17. Interview discussion

Start with the original coursework link, explain why UI-only cart state was insufficient, then trace a checkout from the browser to server validation, inventory mutation, order persistence, and the operations view. See [INTERVIEW_GUIDE.md](docs/INTERVIEW_GUIDE.md).

## 18. License

[MIT](LICENSE)
