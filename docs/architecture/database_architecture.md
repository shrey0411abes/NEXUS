# NEXUS Database Architecture & Schema Specification

## 1. Executive Summary

The NEXUS persistence foundation is built on **SQLAlchemy 2.0** and **SQLite** for rapid iteration, zero infrastructure overhead, and deterministic unit testing during the 48-hour BuildSprint. The data model is normalized to Third Normal Form (3NF) and designed with clean repository boundaries to allow seamless migration to PostgreSQL in subsequent production phases.

---

## 2. Entity-Relationship Model (ERD)

```
┌────────────────────────┐
│       businesses       │
├────────────────────────┤
│ PK  id                 │
│     name               │
│     industry           │
│     created_at         │
└───────────┬────────────┘
            │ 1
            ├─────────────────────────────────────────┐
            │ N                                       │ N
┌───────────▼────────────┐               ┌────────────▼───────────┐
│        products        │               │      transactions      │
├────────────────────────┤               ├────────────────────────┤
│ PK  id                 │               │ PK  id                 │
│ FK  business_id        │               │ FK  business_id        │
│     name               │               │     transaction_type   │
│     category           │               │     total_amount       │
│     sku                │               │     transaction_date   │
│     unit_price         │               │     created_at         │
│     created_at         │               └────────────┬───────────┘
└───────────┬────────────┘                            │ 1
            │ 1                                       │
            │                                         │ N
            │ 1                                       │
┌───────────▼────────────┐               ┌────────────▼───────────┐
│      inventories       │               │   transaction_items    │
├────────────────────────┤               ├────────────────────────┤
│ PK  id                 │               │ PK  id                 │
│ FK  product_id (UNIQUE)│◄──────────────┤ FK  product_id         │
│     quantity           │ 1           N │ FK  transaction_id     │
│     reorder_level      │               │     quantity           │
│     updated_at         │               │     unit_price         │
└────────────────────────┘               └────────────────────────┘
```

---

## 3. Entity Definitions & Schemas

### 3.1 `businesses` Table
Represents an enterprise, retail store, or merchant registered in NEXUS.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique business identifier |
| `name` | `VARCHAR(255)` | `NOT NULL` | Registered trading name |
| `industry` | `VARCHAR(100)` | `NOT NULL` | Business category / vertical |
| `created_at` | `DATETIME` | `NOT NULL` | UTC creation timestamp |

### 3.2 `products` Table
Represents catalog items/SKUs belonging to a business.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique product identifier |
| `business_id` | `INTEGER` | `NOT NULL`, `FOREIGN KEY (businesses.id) ON DELETE CASCADE`, `INDEX` | Owning business |
| `name` | `VARCHAR(255)` | `NOT NULL` | Item display name |
| `category` | `VARCHAR(100)` | `NOT NULL` | Product department/category |
| `sku` | `VARCHAR(100)` | `NOT NULL`, `INDEX` | Stock Keeping Unit |
| `unit_price` | `FLOAT` | `NOT NULL` | Current selling price |
| `created_at` | `DATETIME` | `NOT NULL` | UTC creation timestamp |

**Unique Constraint**: `(business_id, sku)` ensures SKUs are strictly unique per business tenant.

### 3.3 `inventories` Table
Tracks real-time stock levels and threshold alerts for a product.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique inventory identifier |
| `product_id` | `INTEGER` | `NOT NULL`, `UNIQUE`, `FOREIGN KEY (products.id) ON DELETE CASCADE`, `INDEX` | 1-to-1 product linkage |
| `quantity` | `INTEGER` | `NOT NULL`, `DEFAULT 0` | Current on-hand stock count |
| `reorder_level`| `INTEGER` | `NOT NULL`, `DEFAULT 10` | Minimum threshold triggering reorder alert |
| `updated_at` | `DATETIME` | `NOT NULL` | Timestamp of last stock adjustment |

### 3.4 `transactions` Table
Records financial operations (sales, purchases, refunds) executed by a business.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique transaction identifier |
| `business_id` | `INTEGER` | `NOT NULL`, `FOREIGN KEY (businesses.id) ON DELETE CASCADE`, `INDEX` | Business executing transaction |
| `transaction_type` | `VARCHAR(50)` | `NOT NULL` | Transaction type (`sale`, `purchase`, `refund`) |
| `total_amount` | `FLOAT` | `NOT NULL` | Total transaction value |
| `transaction_date` | `DATETIME` | `NOT NULL` | Point-in-time timestamp of transaction |
| `created_at` | `DATETIME` | `NOT NULL` | Ingestion timestamp |

### 3.5 `transaction_items` Table
Line-item detail linking individual products to a transaction.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Unique line-item identifier |
| `transaction_id` | `INTEGER` | `NOT NULL`, `FOREIGN KEY (transactions.id) ON DELETE CASCADE`, `INDEX` | Owning transaction |
| `product_id` | `INTEGER` | `NOT NULL`, `FOREIGN KEY (products.id) ON DELETE RESTRICT`, `INDEX` | Referenced product SKU |
| `quantity` | `INTEGER` | `NOT NULL` | Units bought or sold |
| `unit_price` | `FLOAT` | `NOT NULL` | Price per unit at time of sale |

---

## 4. Key Architectural Decisions & Rationale

### 4.1 Why `TransactionItem` Exists (Normalization)
If product details and quantities were embedded directly in `transactions` (such as a serialized JSON array or flattened columns), querying product sales velocity, calculating category revenue, or performing basket analysis would require expensive string parsing and table scans. `transaction_items` normalizes the relationship into First Normal Form (1NF), enabling indexed aggregations (e.g., `SUM(quantity) GROUP BY product_id`).

### 4.2 Why `Inventory` is Separated from `Product`
A product definition represents static catalog metadata (`name`, `category`, `sku`), whereas inventory represents dynamic, high-frequency transactional state (`quantity`, `updated_at`, `reorder_level`). Separating them ensures:
1. High-frequency inventory writes (stock decrements on sales) do not take lock contention on product catalog rows.
2. Future multi-warehouse support (1 Product → N Inventory locations) can be achieved with zero breaking changes to the `Product` entity.

### 4.3 Why `business_id` Exists on Core Tables (Tenant Isolation)
`business_id` is present on `products` and `transactions` to provide clean multi-tenant scoping. Queries can filter strictly by business without traversing multi-hop joins across tables, enabling efficient tenant data isolation.

### 4.4 Referential Integrity & Deletion Rules
- **Business Deletion (`CASCADE`)**: Removing a business cleans up all corresponding products, inventory, and transactions.
- **Transaction Line Items (`ON DELETE RESTRICT` for `product_id`)**: If a historical transaction exists referencing a product, that product cannot be deleted without preserving audit integrity.
- **SQLite Foreign Key Pragma**: By default, SQLite does not enforce foreign keys unless `PRAGMA foreign_keys = ON` is executed on connection. NEXUS configures an automated SQLAlchemy engine listener to enforce foreign key constraints across all connections and tests.

### 4.5 Indexing Strategy
Indexes are placed on:
- All foreign key columns (`business_id`, `product_id`, `transaction_id`) to accelerate `JOIN` execution.
- `sku` to enable constant-time catalog barcode/SKU lookups.
