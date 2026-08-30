"""
Deterministic BuildSprint 2026 Demo Data Seed Utility for NEXUS.

Usage:
    python scripts/seed_demo_data.py
    python scripts/seed_demo_data.py --reset

Creates a comprehensive, realistic retail scenario for NEXUS demonstrations:
- Business: "Apex Tech & Electronics" (Consumer Tech & Peripherals)
- 7 realistic catalog SKUs exercising all deterministic engines:
  1. Pro 4K Ultra-HD Webcam (CAM-4K-PRO)
     - High demand surge + depleted stock buffer (4 units left)
     - Triggers: SURGE_STOCKOUT_SQUEEZE (CRITICAL correlation, Priority Rank #1, high daily revenue exposure)
  2. Braided USB-C Fast-Charging Cable (2m) (CBL-USBC-2M)
     - High constant velocity, stock drained below reorder threshold (12 units left)
     - Triggers: ACCELERATING_DEPLETION (HIGH correlation, non-zero daily revenue exposure)
  3. Ultra-Lightweight Wireless Gaming Mouse (MS-WIRELESS-PRO)
     - Depleted stockout (0 units left) with past sales history
     - Triggers: CRITICAL Stockout, Stockout Revenue Exposure
  4. Studio Noise-Canceling Headphones (AUD-ANC-PRO)
     - Recent demand surge momentum with abundant stock buffer (65 units)
     - Triggers: Demand Surge (+100%), healthy buffer, 0 exposure
  5. Legacy VGA to HDMI Display Adapter (ADP-VGA-HDMI)
     - 140 units on hand with zero sales velocity in 30 days
     - Triggers: DEAD_STOCK_CAPITAL_TRAP (Trapped Retail Value: $3,498.60)
  6. RGB Mechanical Gaming Keyboard (KB-MECH-RGB)
     - Steady baseline performer (50 units on hand, 0.5 units/day)
     - Triggers: STABLE_HEALTHY baseline
  7. Heavy-Duty Aluminum Laptop Stand (ACC-LAPTOP-STD)
     - Steady baseline accessory (45 units on hand, 1.0 unit/day)
     - Triggers: STABLE_HEALTHY baseline
- 130 realistic transactions distributed across 30 days.
"""
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Ensure data-layer, recommendation-engine, and backend paths are available
root_dir = Path(__file__).resolve().parent.parent
for p in [str(root_dir / "data-layer"), str(root_dir / "recommendation-engine"), str(root_dir / "backend")]:
    if p not in sys.path:
        sys.path.insert(0, p)

from sqlalchemy import create_engine, select, delete
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Business, Product, Inventory, Transaction, TransactionItem


DEMO_BUSINESS_NAME = "Apex Tech & Electronics"
DEMO_INDUSTRY = "Consumer Tech & Electronics"

DEMO_PRODUCTS = [
    {
        "name": "Pro 4K Ultra-HD Webcam",
        "category": "Video & Streaming",
        "sku": "CAM-4K-PRO",
        "unit_price": 129.99,
        "quantity": 4,
        "reorder_level": 20,
    },
    {
        "name": "Braided USB-C Fast-Charging Cable (2m)",
        "category": "Cables & Power",
        "sku": "CBL-USBC-2M",
        "unit_price": 19.99,
        "quantity": 12,
        "reorder_level": 35,
    },
    {
        "name": "Ultra-Lightweight Wireless Gaming Mouse",
        "category": "Peripherals",
        "sku": "MS-WIRELESS-PRO",
        "unit_price": 59.99,
        "quantity": 0,
        "reorder_level": 25,
    },
    {
        "name": "Studio Noise-Canceling Headphones",
        "category": "Audio",
        "sku": "AUD-ANC-PRO",
        "unit_price": 199.99,
        "quantity": 65,
        "reorder_level": 15,
    },
    {
        "name": "Legacy VGA to HDMI Display Adapter",
        "category": "Adapters",
        "sku": "ADP-VGA-HDMI",
        "unit_price": 24.99,
        "quantity": 140,
        "reorder_level": 20,
    },
    {
        "name": "RGB Mechanical Gaming Keyboard",
        "category": "Peripherals",
        "sku": "KB-MECH-RGB",
        "unit_price": 99.99,
        "quantity": 50,
        "reorder_level": 15,
    },
    {
        "name": "Heavy-Duty Aluminum Laptop Stand",
        "category": "Accessories",
        "sku": "ACC-LAPTOP-STD",
        "unit_price": 34.99,
        "quantity": 45,
        "reorder_level": 10,
    },
]


def seed_database_instance(db_path_or_url: str, force_reset: bool = True):
    """Seed a specific SQLite database instance with the demo dataset."""
    print(f"\n[*] Target Database: {db_path_or_url}")
    
    if db_path_or_url.startswith("sqlite:///"):
        url = db_path_or_url
    else:
        url = f"sqlite:///{db_path_or_url}"

    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = Session()

    try:
        # Check for existing demo business
        existing_businesses = db.query(Business).filter(
            Business.name.in_([DEMO_BUSINESS_NAME, "Apex Electronics", "Smoke Test Co"])
        ).all()

        if existing_businesses:
            if not force_reset:
                print(f"[INFO] Demo business already exists in {db_path_or_url}. Use --reset to overwrite.")
                return existing_businesses[0].id
            
            print(f"[*] Removing previous demo data for clean repeatable seed...")
            for b in existing_businesses:
                # Clean up existing transactions & items for this business
                tx_ids = [tx.id for tx in db.query(Transaction.id).filter(Transaction.business_id == b.id).all()]
                if tx_ids:
                    db.query(TransactionItem).filter(TransactionItem.transaction_id.in_(tx_ids)).delete(synchronize_session=False)
                    db.query(Transaction).filter(Transaction.business_id == b.id).delete(synchronize_session=False)
                
                # Clean up inventory & products
                p_ids = [p.id for p in db.query(Product.id).filter(Product.business_id == b.id).all()]
                if p_ids:
                    db.query(Inventory).filter(Inventory.product_id.in_(p_ids)).delete(synchronize_session=False)
                    db.query(Product).filter(Product.business_id == b.id).delete(synchronize_session=False)
                
                db.delete(b)
            db.commit()

        # 1. Create Business
        print(f"[*] Creating Business entity: '{DEMO_BUSINESS_NAME}'...")
        biz = Business(name=DEMO_BUSINESS_NAME, industry=DEMO_INDUSTRY)
        db.add(biz)
        db.flush()

        # 2. Create Products and Inventory
        print(f"[*] Seeding {len(DEMO_PRODUCTS)} catalog SKUs and inventory records...")
        prod_map = {}
        for p_info in DEMO_PRODUCTS:
            product = Product(
                business_id=biz.id,
                name=p_info["name"],
                category=p_info["category"],
                sku=p_info["sku"],
                unit_price=p_info["unit_price"],
            )
            db.add(product)
            db.flush()

            inventory = Inventory(
                product_id=product.id,
                quantity=p_info["quantity"],
                reorder_level=p_info["reorder_level"],
            )
            db.add(inventory)
            prod_map[p_info["sku"]] = product

        # 3. Create 30-Day Historical Transactions
        print("[*] Generating 30-day multi-transaction historical stream...")
        now = datetime.now(timezone.utc)
        tx_count = 0

        for day_offset in range(30, 0, -1):
            tx_date = now - timedelta(days=day_offset, hours=10)

            # A. Webcam (CAM-4K-PRO): steady 1/day prior (days 15-30), surges to 3/day recent (days 1-14)
            webcam_qty = 3 if day_offset <= 14 else 1
            w_prod = prod_map["CAM-4K-PRO"]
            w_tx = Transaction(
                business_id=biz.id,
                transaction_type="sale",
                total_amount=w_prod.unit_price * webcam_qty,
                transaction_date=tx_date + timedelta(hours=1),
            )
            db.add(w_tx)
            db.flush()
            db.add(TransactionItem(transaction_id=w_tx.id, product_id=w_prod.id, quantity=webcam_qty, unit_price=w_prod.unit_price))
            tx_count += 1

            # B. Cable (CBL-USBC-2M): steady high velocity ~3.3 units/day across all 30 days
            cable_qty = 4 if day_offset % 3 == 0 else 3
            c_prod = prod_map["CBL-USBC-2M"]
            c_tx = Transaction(
                business_id=biz.id,
                transaction_type="sale",
                total_amount=c_prod.unit_price * cable_qty,
                transaction_date=tx_date + timedelta(hours=2),
            )
            db.add(c_tx)
            db.flush()
            db.add(TransactionItem(transaction_id=c_tx.id, product_id=c_prod.id, quantity=cable_qty, unit_price=c_prod.unit_price))
            tx_count += 1

            # C. Mouse (MS-WIRELESS-PRO): active 2/day in days 15-30, then 0 in days 1-14 (sold out)
            if day_offset > 14:
                m_prod = prod_map["MS-WIRELESS-PRO"]
                m_tx = Transaction(
                    business_id=biz.id,
                    transaction_type="sale",
                    total_amount=m_prod.unit_price * 2,
                    transaction_date=tx_date + timedelta(hours=3),
                )
                db.add(m_tx)
                db.flush()
                db.add(TransactionItem(transaction_id=m_tx.id, product_id=m_prod.id, quantity=2, unit_price=m_prod.unit_price))
                tx_count += 1

            # D. Headphones (AUD-ANC-PRO): 0 in days 15-30, then 2/day in days 1-14 (demand surge)
            if day_offset <= 14:
                h_prod = prod_map["AUD-ANC-PRO"]
                h_tx = Transaction(
                    business_id=biz.id,
                    transaction_type="sale",
                    total_amount=h_prod.unit_price * 2,
                    transaction_date=tx_date + timedelta(hours=4),
                )
                db.add(h_tx)
                db.flush()
                db.add(TransactionItem(transaction_id=h_tx.id, product_id=h_prod.id, quantity=2, unit_price=h_prod.unit_price))
                tx_count += 1

            # E. VGA Adapter (ADP-VGA-HDMI): 0 sales across all 30 days (Dead stock / trapped capital)

            # F. Keyboard (KB-MECH-RGB): steady 1 unit every 2 days
            if day_offset % 2 == 0:
                k_prod = prod_map["KB-MECH-RGB"]
                k_tx = Transaction(
                    business_id=biz.id,
                    transaction_type="sale",
                    total_amount=k_prod.unit_price,
                    transaction_date=tx_date + timedelta(hours=5),
                )
                db.add(k_tx)
                db.flush()
                db.add(TransactionItem(transaction_id=k_tx.id, product_id=k_prod.id, quantity=1, unit_price=k_prod.unit_price))
                tx_count += 1

            # G. Laptop Stand (ACC-LAPTOP-STD): steady 1 unit per day
            s_prod = prod_map["ACC-LAPTOP-STD"]
            s_tx = Transaction(
                business_id=biz.id,
                transaction_type="sale",
                total_amount=s_prod.unit_price,
                transaction_date=tx_date + timedelta(hours=6),
            )
            db.add(s_tx)
            db.flush()
            db.add(TransactionItem(transaction_id=s_tx.id, product_id=s_prod.id, quantity=1, unit_price=s_prod.unit_price))
            tx_count += 1

        db.commit()
        print(f"[OK] Seed completed for Business ID {biz.id}: {len(DEMO_PRODUCTS)} SKUs, {tx_count} transactions created.")
        return biz.id

    finally:
        db.close()


def seed_all_known_databases(force_reset: bool = True):
    """Seed both default root and backend database locations to guarantee sync."""
    target_dbs = [
        root_dir / "nexus.db",
        root_dir / "backend" / "nexus.db",
    ]
    
    seeded_ids = []
    for db_path in target_dbs:
        biz_id = seed_database_instance(str(db_path), force_reset=force_reset)
        seeded_ids.append(biz_id)
    
    print("\n" + "=" * 70)
    print(f" NEXUS DEMO DATASET READY — Business ID: {seeded_ids[0]}")
    print("=" * 70)
    print(" Operational Scenarios Configured:")
    print("  1. Pro 4K Webcam (CAM-4K-PRO)        -> SURGE_STOCKOUT_SQUEEZE (Rank #1, CRITICAL)")
    print("  2. USB-C Cable (CBL-USBC-2M)         -> ACCELERATING_DEPLETION (Rank #2, HIGH)")
    print("  3. Wireless Mouse (MS-WIRELESS-PRO)  -> STOCKOUT_IMMINENT (0 units on hand, CRITICAL)")
    print("  4. Studio Headphones (AUD-ANC-PRO)   -> DEMAND SURGE (+100% surge, healthy stock buffer)")
    print("  5. VGA Adapter (ADP-VGA-HDMI)        -> DEAD STOCK CAPITAL TRAP ($3,498.60 trapped value)")
    print("  6. RGB Keyboard (KB-MECH-RGB)        -> HEALTHY BASELINE (50 units, steady demand)")
    print("  7. Laptop Stand (ACC-LAPTOP-STD)     -> HEALTHY BASELINE (45 units, steady demand)")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed NEXUS with BuildSprint 2026 realistic demo data.")
    parser.add_argument("--reset", action="store_true", default=True, help="Force reset existing demo data")
    args = parser.parse_args()
    seed_all_known_databases(force_reset=args.reset)
