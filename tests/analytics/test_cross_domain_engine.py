"""Tests for deterministic CrossDomainEngine (Phase 3A & Phase 3B)."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy.orm import Session

from models import Business, Product, Inventory, Transaction, TransactionItem
from cross_domain_engine import CrossDomainEngine
from correlation_models import CrossDomainRiskCorrelation, PrioritizedRiskAction


def seed_test_scenario(db: Session) -> Business:
    """Helper to create a business with diverse cross-domain test products."""
    biz = Business(name="Nexus Test Corp", industry="Retail")
    db.add(biz)
    db.flush()

    now = datetime.now(timezone.utc)

    # Product 1: Surge + Critical Stockout Squeeze (low stock, surging sales)
    p1 = Product(business_id=biz.id, name="Surging Widget", category="Widgets", sku="SKU-SURGE-1", unit_price=100.0)
    db.add(p1)
    db.flush()
    db.add(Inventory(product_id=p1.id, quantity=2, reorder_level=20))

    # Surging transactions: 1/day in prior window, 5/day in recent window
    for d in range(14, 7, -1):
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=100.0, transaction_date=now - timedelta(days=d))
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=1, unit_price=100.0))

    for d in range(7, 0, -1):
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=500.0, transaction_date=now - timedelta(days=d))
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=5, unit_price=100.0))

    # Product 2: Out of Stock Imminent (0 stock)
    p2 = Product(business_id=biz.id, name="Zero Stock Gadget", category="Gadgets", sku="SKU-ZERO-2", unit_price=50.0)
    db.add(p2)
    db.flush()
    db.add(Inventory(product_id=p2.id, quantity=0, reorder_level=10))

    # Product 3: Dead Stock Capital Trap (100 units, 0 sales)
    p3 = Product(business_id=biz.id, name="Dead Stock Item", category="Accessories", sku="SKU-DEAD-3", unit_price=20.0)
    db.add(p3)
    db.flush()
    db.add(Inventory(product_id=p3.id, quantity=100, reorder_level=10))

    # Product 4: Healthy Stable Product (80 units, 1 sale every 3 days)
    p4 = Product(business_id=biz.id, name="Healthy Staple", category="Staples", sku="SKU-HEALTHY-4", unit_price=10.0)
    db.add(p4)
    db.flush()
    db.add(Inventory(product_id=p4.id, quantity=80, reorder_level=15))
    for d in [20, 15, 10, 5]:
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=10.0, transaction_date=now - timedelta(days=d))
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p4.id, quantity=1, unit_price=10.0))

    db.commit()
    return biz


def test_cross_domain_correlations_detection(db_session: Session):
    """Test deterministic detection of all major cross-domain correlation types."""
    biz = seed_test_scenario(db_session)
    engine = CrossDomainEngine(db_session)

    correlations = engine.analyze_cross_domain_risks(business_id=biz.id, days=30)
    assert len(correlations) == 4

    corr_types = {c.product_name: c.correlation_type for c in correlations}
    assert corr_types["Surging Widget"] == "SURGE_STOCKOUT_SQUEEZE"
    assert corr_types["Zero Stock Gadget"] == "STOCKOUT_IMMINENT"
    assert corr_types["Dead Stock Item"] == "DEAD_STOCK_CAPITAL_TRAP"
    assert corr_types["Healthy Staple"] == "STABLE_HEALTHY"

    # Verify severity ordering
    severities = [c.severity for c in correlations]
    assert severities[0] == "CRITICAL"
    assert severities[-1] == "HEALTHY"


def test_prioritized_operational_risk_queue(db_session: Session):
    """Test Phase 3B operational risk prioritization ranking and score computation."""
    biz = seed_test_scenario(db_session)
    engine = CrossDomainEngine(db_session)

    queue = engine.prioritize_operational_risks(business_id=biz.id, days=30)
    
    # Healthy item should be excluded from active priority action queue
    assert len(queue) == 3

    # Ranks must be sequential 1..N
    assert [q.priority_rank for q in queue] == [1, 2, 3]

    # Scores must be strictly descending
    assert queue[0].priority_score >= queue[1].priority_score >= queue[2].priority_score

    # Top risk should be Surging Widget or Zero Stock with score > 70
    assert queue[0].priority_score >= 70.0
    assert queue[0].source_status == "VERIFIED_FACT"
    assert len(queue[0].supporting_facts) > 0
    assert queue[0].recommended_action != ""

    # Augmented Phase 2 fields: 64-character SHA-256 fingerprint, default OPEN state, None audit fields
    for item in queue:
        assert len(item.risk_fingerprint) == 64
        assert item.current_state == "OPEN"
        assert item.last_actioned_at is None
        assert item.last_actioned_by is None
        assert item.last_action_note is None


def test_deterministic_reproducibility(db_session: Session):
    """Test that identical inputs produce 100% identical correlation and priority outputs."""
    biz = seed_test_scenario(db_session)
    engine = CrossDomainEngine(db_session)

    res1 = engine.get_complete_analysis(business_id=biz.id, days=30)
    res2 = engine.get_complete_analysis(business_id=biz.id, days=30)

    assert res1.model_dump() == res2.model_dump()


def test_empty_business_cross_domain(db_session: Session):
    """Test handling of business with zero products/transactions."""
    biz = Business(name="Empty Corp", industry="Retail")
    db_session.add(biz)
    db_session.commit()

    engine = CrossDomainEngine(db_session)
    correlations = engine.analyze_cross_domain_risks(business_id=biz.id, days=30)
    priorities = engine.prioritize_operational_risks(business_id=biz.id, days=30)

    assert correlations == []
    assert priorities == []


def test_multi_business_isolation(db_session: Session):
    """Verify that cross-domain correlations strictly isolate data by business_id."""
    biz1 = seed_test_scenario(db_session)
    biz2 = Business(name="Second Business", industry="Food")
    db_session.add(biz2)
    db_session.flush()

    p_biz2 = Product(business_id=biz2.id, name="Biz2 Apple", category="Fruit", sku="FRUIT-01", unit_price=1.0)
    db_session.add(p_biz2)
    db_session.flush()
    db_session.add(Inventory(product_id=p_biz2.id, quantity=50, reorder_level=10))
    db_session.commit()

    engine = CrossDomainEngine(db_session)
    biz1_corrs = engine.analyze_cross_domain_risks(business_id=biz1.id, days=30)
    biz2_corrs = engine.analyze_cross_domain_risks(business_id=biz2.id, days=30)

    assert len(biz1_corrs) == 4
    assert len(biz2_corrs) == 1
    assert biz2_corrs[0].product_name == "Biz2 Apple"
    assert all(c.business_id == biz1.id for c in biz1_corrs)
    assert all(c.business_id == biz2.id for c in biz2_corrs)


def test_cross_domain_accelerating_depletion(db_session: Session):
    """Test detection of ACCELERATING_DEPLETION when sales velocity steadily drains stock below reorder level."""
    biz = Business(name="Depletion Test Corp", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(business_id=biz.id, name="Steady Draining SKU", category="Goods", sku="DRAIN-01", unit_price=40.0)
    db_session.add(prod)
    db_session.flush()
    # Quantity 8 <= Reorder Level 10, coverage = 8 / 2 = 4 days
    db_session.add(Inventory(product_id=prod.id, quantity=8, reorder_level=10))

    now = datetime.now(timezone.utc)
    for d in range(14):
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=80.0, transaction_date=now - timedelta(days=d, hours=1))
        db_session.add(tx)
        db_session.flush()
        db_session.add(TransactionItem(transaction_id=tx.id, product_id=prod.id, quantity=2, unit_price=40.0))
    db_session.commit()

    engine = CrossDomainEngine(db_session)
    correlations = engine.analyze_cross_domain_risks(business_id=biz.id, days=14)
    assert len(correlations) == 1
    assert correlations[0].correlation_type in ["ACCELERATING_DEPLETION", "SURGE_STOCKOUT_SQUEEZE"]
    assert correlations[0].severity in ["CRITICAL", "HIGH"]


def test_generate_risk_fingerprint_deterministic_properties():
    """Verify deterministic SHA-256 fingerprint generation across tenants, categories, and products."""
    from cross_domain_engine import generate_risk_fingerprint

    fp1 = generate_risk_fingerprint(1, "SURGE_STOCKOUT_SQUEEZE", 10)
    fp2 = generate_risk_fingerprint(1, "SURGE_STOCKOUT_SQUEEZE", 10)
    assert fp1 == fp2
    assert len(fp1) == 64

    # Product ID difference alters fingerprint
    fp_diff_prod = generate_risk_fingerprint(1, "SURGE_STOCKOUT_SQUEEZE", 11)
    assert fp1 != fp_diff_prod

    # Business ID difference alters fingerprint
    fp_diff_biz = generate_risk_fingerprint(2, "SURGE_STOCKOUT_SQUEEZE", 10)
    assert fp1 != fp_diff_biz

    # Risk category difference alters fingerprint
    fp_diff_cat = generate_risk_fingerprint(1, "STOCKOUT_IMMINENT", 10)
    assert fp1 != fp_diff_cat

    # None product_id (global/unassigned risk) returns valid 64-char hash
    fp_none = generate_risk_fingerprint(1, "GLOBAL_SUPPLY_CHAIN_RISK", None)
    assert len(fp_none) == 64
    assert fp_none != fp1



