"""
Verification script for SQLite Query Plans before and after indexing.
"""
import sqlite3

def run_query_plan_analysis():
    con = sqlite3.connect(":memory:")
    cur = con.cursor()

    # Create tables matching current baseline
    cur.execute("""
    CREATE TABLE businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100) NOT NULL,
        created_at DATETIME NOT NULL
    );
    """)
    cur.execute("""
    CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        unit_price FLOAT NOT NULL,
        created_at DATETIME NOT NULL,
        CONSTRAINT uq_business_sku UNIQUE (business_id, sku)
    );
    """)
    cur.execute("CREATE INDEX ix_products_business_id ON products (business_id);")
    cur.execute("CREATE INDEX ix_products_sku ON products (sku);")

    cur.execute("""
    CREATE TABLE inventories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL UNIQUE,
        quantity INTEGER NOT NULL,
        reorder_level INTEGER NOT NULL,
        updated_at DATETIME NOT NULL
    );
    """)
    cur.execute("CREATE UNIQUE INDEX ix_inventories_product_id ON inventories (product_id);")

    cur.execute("""
    CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        total_amount FLOAT NOT NULL,
        transaction_date DATETIME NOT NULL,
        created_at DATETIME NOT NULL
    );
    """)
    cur.execute("CREATE INDEX ix_transactions_business_id ON transactions (business_id);")

    cur.execute("""
    CREATE TABLE transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price FLOAT NOT NULL
    );
    """)
    cur.execute("CREATE INDEX ix_transaction_items_transaction_id ON transaction_items (transaction_id);")
    cur.execute("CREATE INDEX ix_transaction_items_product_id ON transaction_items (product_id);")

    print("=== BEFORE COMPOSITE INDEX ===")
    print("1. Business KPI Query (WHERE business_id = ? AND transaction_date >= ? AND transaction_type = 'sale'):")
    for row in cur.execute("EXPLAIN QUERY PLAN SELECT count(id), sum(total_amount) FROM transactions WHERE business_id = 1 AND transaction_date >= datetime('now', '-30 days') AND transaction_type = 'sale';"):
        print("  Plan:", row[3])

    print("2. Units Sold Join Query (JOIN on transaction_id WHERE business_id = ? AND transaction_date >= ?):")
    for row in cur.execute("EXPLAIN QUERY PLAN SELECT sum(ti.quantity) FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id WHERE t.business_id = 1 AND t.transaction_date >= datetime('now', '-30 days') AND t.transaction_type = 'sale';"):
        print("  Plan:", row[3])

    print("3. Product Sales Velocity Query (JOIN ON transaction_id WHERE product_id = ? AND transaction_date >= ?):")
    for row in cur.execute("EXPLAIN QUERY PLAN SELECT sum(ti.quantity) FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id WHERE ti.product_id = 1 AND t.transaction_date >= datetime('now', '-30 days') AND t.transaction_type = 'sale';"):
        print("  Plan:", row[3])

    # Add justified composite indexes:
    # A. transactions(business_id, transaction_date, transaction_type)
    cur.execute("CREATE INDEX ix_transactions_business_date_type ON transactions (business_id, transaction_date, transaction_type);")

    print("\n=== AFTER COMPOSITE INDEX ix_transactions_business_date_type ===")
    print("1. Business KPI Query:")
    for row in cur.execute("EXPLAIN QUERY PLAN SELECT count(id), sum(total_amount) FROM transactions WHERE business_id = 1 AND transaction_date >= datetime('now', '-30 days') AND transaction_type = 'sale';"):
        print("  Plan:", row[3])

    print("2. Units Sold Join Query:")
    for row in cur.execute("EXPLAIN QUERY PLAN SELECT sum(ti.quantity) FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id WHERE t.business_id = 1 AND t.transaction_date >= datetime('now', '-30 days') AND t.transaction_type = 'sale';"):
        print("  Plan:", row[3])

    print("3. Product Sales Velocity Query:")
    for row in cur.execute("EXPLAIN QUERY PLAN SELECT sum(ti.quantity) FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id WHERE ti.product_id = 1 AND t.transaction_date >= datetime('now', '-30 days') AND t.transaction_type = 'sale';"):
        print("  Plan:", row[3])

if __name__ == "__main__":
    run_query_plan_analysis()
