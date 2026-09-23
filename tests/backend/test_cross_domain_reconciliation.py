"""Unit and integration tests for CrossDomainService risk reconciliation and auto-reopen lifecycle."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from models.business import Business
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionItem
from models.user import User
from models.risk_action import RiskAction
from unit_of_work import SqlAlchemyUnitOfWork
from app.services.cross_domain_service import (
    CrossDomainService,
    RESOLVED_COOLDOWN_HOURS,
    DISMISSED_GRACE_DAYS,
)
from cross_domain_engine import generate_risk_fingerprint


def _seed_business_with_risks(db: Session, name: str = "Reconcile Biz") -> tuple[Business, User, Product, Product]:
    """Helper creating a business, admin user, and two products in high/critical risk states."""
    biz = Business(name=name, industry="Retail")
    db.add(biz)
    db.flush()

    user = User(
        business_id=biz.id,
        email=f"admin_{biz.id}@test.com",
        password_hash="fakehash",
        role="ADMIN",
    )
    db.add(user)
    db.flush()

    now = datetime.now(timezone.utc)

    # Product 1: Critical surge + stockout squeeze (low stock, surging sales)
    p1 = Product(business_id=biz.id, name="Surging Item", category="CatA", sku=f"SKU-1-{biz.id}", unit_price=100.0)
    db.add(p1)
    db.flush()
    db.add(Inventory(product_id=p1.id, quantity=1, reorder_level=20))

    for d in range(7, 0, -1):
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=500.0, transaction_date=now - timedelta(days=d))
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=5, unit_price=100.0))

    # Product 2: Zero stock imminent
    p2 = Product(business_id=biz.id, name="Depleted Item", category="CatB", sku=f"SKU-2-{biz.id}", unit_price=50.0)
    db.add(p2)
    db.flush()
    db.add(Inventory(product_id=p2.id, quantity=0, reorder_level=10))

    db.commit()
    return biz, user, p1, p2


def test_reconciliation_unacted_risks(db_session: Session):
    """Risks with no prior action records default to OPEN with None audit fields."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Unacted Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    priorities = service.get_priorities(business_id=biz.id, days=30)
    assert len(priorities) >= 2
    for p in priorities:
        assert p.current_state == "OPEN"
        assert p.last_actioned_at is None
        assert p.last_actioned_by is None
        assert p.last_action_note is None
        assert len(p.risk_fingerprint) == 64


def test_reconciliation_acknowledged_risk(db_session: Session):
    """An ACKNOWLEDGED risk remains active in the queue with actor audit metadata attached."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Ack Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    # Calculate fingerprint for p1's surge squeeze
    fp1 = generate_risk_fingerprint(biz.id, "SURGE_STOCKOUT_SQUEEZE", p1.id)

    # Operator acknowledges p1
    action = uow.risk_actions.create(
        business_id=biz.id,
        risk_fingerprint=fp1,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="ACKNOWLEDGED",
        metrics_snapshot={"qty": 1},
        user_id=user.id,
        product_id=p1.id,
        action_note="Supplier contacted; awaiting PO response.",
    )
    uow.commit()

    priorities = service.get_priorities(business_id=biz.id, days=30)
    ack_item = next((p for p in priorities if p.risk_fingerprint == fp1), None)
    assert ack_item is not None
    assert ack_item.current_state == "ACKNOWLEDGED"
    assert ack_item.last_actioned_by == user.id
    assert ack_item.last_action_note == "Supplier contacted; awaiting PO response."
    assert ack_item.last_actioned_at is not None


def test_reconciliation_resolved_cooldown_active(db_session: Session):
    """A RESOLVED risk within the 24h cooldown is suppressed unless include_resolved is True."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Resolved Cooldown Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp1 = generate_risk_fingerprint(biz.id, "SURGE_STOCKOUT_SQUEEZE", p1.id)

    # Operator resolved 2 hours ago (< 24h cooldown)
    created_at = datetime.now(timezone.utc) - timedelta(hours=2)
    action = RiskAction(
        business_id=biz.id,
        risk_fingerprint=fp1,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="RESOLVED",
        metrics_snapshot={"qty": 1},
        user_id=user.id,
        product_id=p1.id,
        action_note="Purchase order #1234 placed.",
        created_at=created_at,
    )
    db_session.add(action)
    db_session.commit()

    # 1. Default (include_resolved=False): p1 is suppressed from active priority queue
    active_priorities = service.get_priorities(business_id=biz.id, days=30, include_resolved=False)
    assert all(p.risk_fingerprint != fp1 for p in active_priorities)

    # 2. Explicit include_resolved=True: p1 is included with RESOLVED state
    all_priorities = service.get_priorities(business_id=biz.id, days=30, include_resolved=True)
    resolved_item = next((p for p in all_priorities if p.risk_fingerprint == fp1), None)
    assert resolved_item is not None
    assert resolved_item.current_state == "RESOLVED"
    assert resolved_item.last_actioned_by == user.id
    assert resolved_item.last_action_note == "Purchase order #1234 placed."


def test_reconciliation_resolved_cooldown_expired_auto_reopen(db_session: Session):
    """A RESOLVED risk whose 24h cooldown expired while still detected is auto-reopened with an audit row."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Expired Cooldown Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp1 = generate_risk_fingerprint(biz.id, "SURGE_STOCKOUT_SQUEEZE", p1.id)

    # Operator resolved 26 hours ago (cooldown expired)
    resolved_time = datetime.now(timezone.utc) - timedelta(hours=26)
    action = RiskAction(
        business_id=biz.id,
        risk_fingerprint=fp1,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="RESOLVED",
        metrics_snapshot={"qty": 1},
        user_id=user.id,
        product_id=p1.id,
        action_note="Old resolution note",
        created_at=resolved_time,
    )
    db_session.add(action)
    db_session.commit()

    # Initial action count
    initial_actions = uow.risk_actions.get_all_for_business(biz.id)
    assert len(initial_actions) == 1

    # Poll priorities: should trigger auto-reopen
    priorities = service.get_priorities(business_id=biz.id, days=30, include_resolved=False)
    reopened_item = next((p for p in priorities if p.risk_fingerprint == fp1), None)
    assert reopened_item is not None
    assert reopened_item.current_state == "OPEN"
    assert reopened_item.last_action_note == "auto-reopened: cooldown expired"
    assert reopened_item.last_actioned_by is None
    assert reopened_item.last_actioned_at is not None

    # Verify a new system audit row was committed into the database
    updated_actions = uow.risk_actions.get_all_for_business(biz.id)
    assert len(updated_actions) == 2
    latest_db_action = uow.risk_actions.get_latest_action_for_fingerprint(biz.id, fp1)
    assert latest_db_action is not None
    assert latest_db_action.state == "OPEN"
    assert latest_db_action.user_id is None
    assert latest_db_action.action_note == "auto-reopened: cooldown expired"


def test_reconciliation_dismissed_grace_active(db_session: Session):
    """A DISMISSED risk within the 7-day grace period is suppressed unless include_resolved is True."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Dismissed Grace Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp2 = generate_risk_fingerprint(biz.id, "STOCKOUT_IMMINENT", p2.id)

    # Dismissed 3 days ago (< 7d grace)
    dismissed_time = datetime.now(timezone.utc) - timedelta(days=3)
    action = RiskAction(
        business_id=biz.id,
        risk_fingerprint=fp2,
        risk_category="STOCKOUT_IMMINENT",
        state="DISMISSED",
        metrics_snapshot={"qty": 0},
        user_id=user.id,
        product_id=p2.id,
        action_note="Product being phased out.",
        created_at=dismissed_time,
    )
    db_session.add(action)
    db_session.commit()

    # Active priorities should suppress fp2
    active = service.get_priorities(business_id=biz.id, days=30, include_resolved=False)
    assert all(p.risk_fingerprint != fp2 for p in active)

    # include_resolved=True should reveal fp2 with DISMISSED state
    all_items = service.get_priorities(business_id=biz.id, days=30, include_resolved=True)
    dismissed_item = next((p for p in all_items if p.risk_fingerprint == fp2), None)
    assert dismissed_item is not None
    assert dismissed_item.current_state == "DISMISSED"
    assert dismissed_item.last_action_note == "Product being phased out."


def test_reconciliation_dismissed_grace_expired_auto_reopen(db_session: Session):
    """A DISMISSED risk whose 7-day grace expired while still detected is auto-reopened."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Expired Dismiss Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp2 = generate_risk_fingerprint(biz.id, "STOCKOUT_IMMINENT", p2.id)

    # Dismissed 8 days ago (grace period expired)
    dismissed_time = datetime.now(timezone.utc) - timedelta(days=8)
    action = RiskAction(
        business_id=biz.id,
        risk_fingerprint=fp2,
        risk_category="STOCKOUT_IMMINENT",
        state="DISMISSED",
        metrics_snapshot={"qty": 0},
        user_id=user.id,
        product_id=p2.id,
        action_note="Phasing out",
        created_at=dismissed_time,
    )
    db_session.add(action)
    db_session.commit()

    # Querying priorities should auto-reopen fp2
    priorities = service.get_priorities(business_id=biz.id, days=30, include_resolved=False)
    reopened_item = next((p for p in priorities if p.risk_fingerprint == fp2), None)
    assert reopened_item is not None
    assert reopened_item.current_state == "OPEN"
    assert reopened_item.last_action_note == "auto-reopened: cooldown expired"
    assert reopened_item.last_actioned_by is None


def test_reconciliation_contiguous_rank_reindexing(db_session: Session):
    """Filtering suppressed risks must produce contiguous priority_rank values (1, 2, 3...)."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Ranking Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp1 = generate_risk_fingerprint(biz.id, "SURGE_STOCKOUT_SQUEEZE", p1.id)

    # Mark the #1 risk as RESOLVED within active cooldown
    action = RiskAction(
        business_id=biz.id,
        risk_fingerprint=fp1,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="RESOLVED",
        metrics_snapshot={},
        user_id=user.id,
        product_id=p1.id,
        action_note="Handled",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(action)
    db_session.commit()

    active = service.get_priorities(business_id=biz.id, days=30, include_resolved=False)
    assert len(active) >= 1
    # Check that remaining ranks start at 1 and increment contiguously
    expected_ranks = list(range(1, len(active) + 1))
    actual_ranks = [item.priority_rank for item in active]
    assert actual_ranks == expected_ranks


def test_reconciliation_tenant_isolation(db_session: Session):
    """Actions recorded for Tenant A must never affect Tenant B's risk states."""
    biz_a, user_a, p1_a, _ = _seed_business_with_risks(db_session, "Tenant A")
    biz_b, user_b, p1_b, _ = _seed_business_with_risks(db_session, "Tenant B")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp_a = generate_risk_fingerprint(biz_a.id, "SURGE_STOCKOUT_SQUEEZE", p1_a.id)
    fp_b = generate_risk_fingerprint(biz_b.id, "SURGE_STOCKOUT_SQUEEZE", p1_b.id)

    # Resolve Tenant A's risk
    action_a = RiskAction(
        business_id=biz_a.id,
        risk_fingerprint=fp_a,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="RESOLVED",
        metrics_snapshot={},
        user_id=user_a.id,
        product_id=p1_a.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(action_a)
    db_session.commit()

    # Tenant A sees resolved risk filtered out
    active_a = service.get_priorities(biz_a.id, days=30, include_resolved=False)
    assert all(p.risk_fingerprint != fp_a for p in active_a)

    # Tenant B still sees their risk in OPEN state
    active_b = service.get_priorities(biz_b.id, days=30, include_resolved=False)
    item_b = next((p for p in active_b if p.risk_fingerprint == fp_b), None)
    assert item_b is not None
    assert item_b.current_state == "OPEN"
    assert item_b.last_actioned_at is None


def test_reconciliation_summary_endpoint(db_session: Session):
    """CrossDomainService.get_summary incorporates reconciled priorities."""
    biz, user, p1, p2 = _seed_business_with_risks(db_session, "Summary Biz")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    fp1 = generate_risk_fingerprint(biz.id, "SURGE_STOCKOUT_SQUEEZE", p1.id)
    action = RiskAction(
        business_id=biz.id,
        risk_fingerprint=fp1,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="ACKNOWLEDGED",
        metrics_snapshot={},
        user_id=user.id,
        product_id=p1.id,
        action_note="Awaiting restock",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(action)
    db_session.commit()

    summary = service.get_summary(biz.id, days=30)
    ack_item = next((p for p in summary.prioritized_queue if p.risk_fingerprint == fp1), None)
    assert ack_item is not None
    assert ack_item.current_state == "ACKNOWLEDGED"
    assert ack_item.last_action_note == "Awaiting restock"
