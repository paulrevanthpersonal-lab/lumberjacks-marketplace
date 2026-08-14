# API contract

- `GET /api/products` searches, filters, and sorts the current 36-item inventory.
- `GET /api/products/:id` returns one complete product record.
- `POST /api/auth/login` creates a local reviewer bearer session.
- `GET /api/cart` and `PUT /api/cart` read or replace the signed-in basket.
- `POST /api/orders` validates the basket and stock, persists an order, and decrements inventory.
- `GET /api/orders` returns the signed-in account's order history.
- `GET /api/operations` returns order, revenue, inventory, low-stock, and audit summaries.

Mutable state is stored in ignored `data/runtime.json`. No payment information is accepted or stored.
