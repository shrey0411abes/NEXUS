# NEXUS — API Specification & Guidelines

## Overview
NEXUS exposes a RESTful JSON API managed by FastAPI. Interactive documentation is available at:
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

## API Conventions
- **Versioning**: All API routes are prefixed with `/api/v1`.
- **Request / Response Formats**: Standard JSON payloads validated using Pydantic schemas.
- **Error Codes**:
  - `400 Bad Request`: Validation failures
  - `404 Not Found`: Resource does not exist
  - `409 Conflict`: Unique constraint violation (e.g. duplicate SKU)
  - `422 Unprocessable Entity`: Query parameter or schema type error
  - `502 Bad Gateway`: Malformed or unparseable output from external LLM provider
  - `503 Service Unavailable`: AI provider timeout, outage, or missing configuration
  - `500 Internal Server Error`: Unhandled server exceptions

---

## Endpoint Catalog

### System
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Application health and status check | **Implemented (Phase 0)** |

### Businesses (`/api/v1/businesses`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/businesses` | List registered businesses | **Implemented (Phase 1A)** |
| `POST` | `/api/v1/businesses` | Register a new business | **Implemented (Phase 1A)** |
| `GET` | `/api/v1/businesses/{business_id}` | Retrieve business details by ID | **Implemented (Phase 1A)** |

### Products (`/api/v1/products`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/products` | List products (filterable by `business_id`) | **Implemented (Phase 1A)** |
| `POST` | `/api/v1/products` | Create product SKU and initialize inventory | **Implemented (Phase 1A)** |
| `GET` | `/api/v1/products/{product_id}` | Retrieve product details by ID | **Implemented (Phase 1A)** |

### Inventory (`/api/v1/inventory`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/inventory` | List stock records (filterable by `business_id`)| **Implemented (Phase 1A)** |
| `GET` | `/api/v1/inventory/{product_id}` | Retrieve inventory for a product | **Implemented (Phase 1A)** |
| `PATCH`| `/api/v1/inventory/{product_id}` | Update stock quantity or reorder level | **Implemented (Phase 1A)** |

### Transactions (`/api/v1/transactions`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/transactions` | List transactions (filterable by `business_id`)| **Implemented (Phase 1A)** |
| `POST` | `/api/v1/transactions` | Record a transaction with line items | **Implemented (Phase 1A)** |
| `GET` | `/api/v1/transactions/{transaction_id}`| Retrieve transaction details with line items | **Implemented (Phase 1A)** |

### Analytics & Intelligence (`/api/v1/analytics`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/analytics/kpis` | Core business KPIs (Revenue, ATV, stock health)| **Implemented (Phase 1B)** |
| `GET` | `/api/v1/analytics/products/{id}` | Product-level sales velocity & daily revenue | **Implemented (Phase 1B)** |
| `GET` | `/api/v1/analytics/inventory-risk`| Real-time stockout risk & coverage days | **Implemented (Phase 1B)** |
| `GET` | `/api/v1/analytics/trends` | Time-window demand momentum classification | **Implemented (Phase 1B)** |
| `GET` | `/api/v1/analytics/anomalies` | Daily sales volume anomaly flags (z-score) | **Implemented (Phase 1B)** |

### Recommendations (`/api/v1/recommendations`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/recommendations` | Prioritized rule-based business recommendations| **Implemented (Phase 1B)** |

### Cross-Domain Intelligence (`/api/v1/cross-domain`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/cross-domain/risks` | Multi-signal inventory/demand risk collisions | **Implemented (Phase 3A)** |
| `GET` | `/api/v1/cross-domain/priorities` | Deterministic operational risk priority queue [1..N] | **Implemented (Phase 3B)** |
| `GET` | `/api/v1/cross-domain/summary` | Complete cross-domain analysis result payload | **Implemented (Phase 3A & 3B)** |

### Financial Intelligence (`/api/v1/financial`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/financial/impact` | SKU-level daily revenue exposure and trapped retail value | **Implemented (Phase 4A)** |
| `GET` | `/api/v1/financial/summary` | Aggregated business-level revenue exposure and 7d/30d projections | **Implemented (Phase 4A)** |

### AI Business Investigation (`/api/v1/investigations`)
| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/investigations` | Grounded natural-language business Q&A | **Implemented (Phase 2)** |

#### Request Example (`POST /api/v1/investigations`)
```json
{
  "business_id": 1,
  "question": "What should I reorder this week?",
  "days": 30
}
```

#### Response Example
```json
{
  "question": "What should I reorder this week?",
  "answer": "Based on verified analytics, your primary replenishment priority is 'Cold Brew Can' with only 1.7 days of inventory remaining.",
  "key_findings": [
    "Revenue for the 30-day window is $14,250.00 across 120 transactions",
    "2 products currently have low stock alerts"
  ],
  "recommendations": [
    "Place urgent purchase order for SKU-CB-001 to restore safety buffer",
    "Review replenishment cycle for growing demand items"
  ],
  "supporting_facts": [
    "Product 'Cold Brew Can' (SKU-CB-001): current qty 5, sales velocity 3.0 units/day, coverage 1.7 days",
    "Reorder level: 15 units"
  ],
  "confidence": "HIGH",
  "limitations": [
    "Analysis is based on transaction data within the past 30 days"
  ]
}
```
