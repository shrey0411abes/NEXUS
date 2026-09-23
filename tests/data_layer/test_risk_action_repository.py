"""Tests for RiskAction domain model, constraints, and repository operations."""
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.business import Business
from models.user import User
from models.product import Product
from models.risk_action import RiskAction
from repositories.risk_action_repository import RiskActionRepository
from unit_of_work import SqlAlchemyUnitOfWork


def test_create_risk_action_with_user_actor(db_session: Session):
    """Verify recording a risk action transition with an authenticated actor."""
    biz = Business(name="Risk Tenant A", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    user = User(
        business_id=biz.id,
        email="admin@tenant-a.com",
        password_hash="fakehash",
        role="ADMIN",
    )
    db_session.add(user)
    db_session.flush()

    repo = RiskActionRepository(db_session)
    action = repo.create(
        business_id=biz.id,
        user_id=user.id,
        risk_fingerprint="risk_1_10_surge_stockout",
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="ACKNOWLEDGED",
        action_note="Manager notified; evaluating supplier lead times.",
        metrics_snapshot={"current_quantity": 3, "doi": 1.5, "velocity": 2.0},
    )
    db_session.commit()

    assert action.id is not None
    assert action.business_id == biz.id
    assert action.user_id == user.id
    assert action.state == "ACKNOWLEDGED"
    assert action.risk_fingerprint == "risk_1_10_surge_stockout"
    assert action.metrics_snapshot["current_quantity"] == 3


def test_create_system_generated_risk_action(db_session: Session):
    """Verify auto-reopen system transitions where user_id is NULL."""
    biz = Business(name="Risk Tenant System", industry="Electronics")
    db_session.add(biz)
    db_session.flush()

    repo = RiskActionRepository(db_session)
    action = repo.create(
        business_id=biz.id,
        user_id=None,
        risk_fingerprint="risk_2_5_stockout_imminent",
        risk_category="STOCKOUT_IMMINENT",
        state="OPEN",
        action_note="auto-reopened: cooldown expired",
        metrics_snapshot={"current_quantity": 0, "doi": 0.0},
    )
    db_session.commit()

    assert action.id is not None
    assert action.user_id is None
    assert action.state == "OPEN"
    assert action.action_note == "auto-reopened: cooldown expired"


def test_risk_action_state_check_constraint(db_session: Session):
    """Verify state CheckConstraint rejects invalid state values."""
    biz = Business(name="Check Biz", industry="Grocery")
    db_session.add(biz)
    db_session.flush()

    repo = RiskActionRepository(db_session)
    with pytest.raises(IntegrityError):
        repo.create(
            business_id=biz.id,
            risk_fingerprint="risk_fp_invalid",
            risk_category="INVALID_TYPE",
            state="NOT_A_VALID_STATE",
            metrics_snapshot={},
        )
        db_session.commit()
    db_session.rollback()


def test_get_latest_action_for_fingerprint_sequence(db_session: Session):
    """Verify chronological resolution returns the newest transition state."""
    biz = Business(name="Sequence Biz", industry="Apparel")
    db_session.add(biz)
    db_session.flush()

    repo = RiskActionRepository(db_session)
    fp = "risk_seq_1"

    # 1. First state: ACKNOWLEDGED
    repo.create(
        business_id=biz.id,
        risk_fingerprint=fp,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="ACKNOWLEDGED",
        metrics_snapshot={"step": 1},
    )
    db_session.flush()

    # 2. Second state: RESOLVED
    repo.create(
        business_id=biz.id,
        risk_fingerprint=fp,
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="RESOLVED",
        action_note="Restock batch completed",
        metrics_snapshot={"step": 2},
    )
    db_session.commit()

    latest = repo.get_latest_action_for_fingerprint(biz.id, fp)
    assert latest is not None
    assert latest.state == "RESOLVED"
    assert latest.metrics_snapshot["step"] == 2


def test_get_latest_actions_for_business_batch(db_session: Session):
    """Verify batch retrieval returns the latest state mapped across multiple fingerprints."""
    biz = Business(name="Batch Biz", industry="Automotive")
    db_session.add(biz)
    db_session.flush()

    repo = RiskActionRepository(db_session)

    # FP 1: Two transitions -> final RESOLVED
    repo.create(biz.id, "fp_1", "SURGE_STOCKOUT_SQUEEZE", "ACKNOWLEDGED", {})
    repo.create(biz.id, "fp_1", "SURGE_STOCKOUT_SQUEEZE", "RESOLVED", {})

    # FP 2: One transition -> DISMISSED
    repo.create(biz.id, "fp_2", "DEAD_STOCK_CAPITAL_TRAP", "DISMISSED", {})

    # FP 3: One transition -> OPEN
    repo.create(biz.id, "fp_3", "ACCELERATING_DEPLETION", "OPEN", {})
    db_session.commit()

    latest_map = repo.get_latest_actions_for_business(biz.id, ["fp_1", "fp_2", "fp_3"])
    assert len(latest_map) == 3
    assert latest_map["fp_1"].state == "RESOLVED"
    assert latest_map["fp_2"].state == "DISMISSED"
    assert latest_map["fp_3"].state == "OPEN"

    # Filtered to subset
    subset_map = repo.get_latest_actions_for_business(biz.id, ["fp_1"])
    assert len(subset_map) == 1
    assert subset_map["fp_1"].state == "RESOLVED"


def test_tenant_isolation_risk_actions(db_session: Session):
    """Verify Tenant B cannot access or list RiskActions belonging to Tenant A."""
    biz_a = Business(name="Tenant A", industry="Retail")
    biz_b = Business(name="Tenant B", industry="Retail")
    db_session.add_all([biz_a, biz_b])
    db_session.flush()

    repo = RiskActionRepository(db_session)
    action_a = repo.create(
        business_id=biz_a.id,
        risk_fingerprint="fp_tenant_a",
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="ACKNOWLEDGED",
        metrics_snapshot={},
    )
    db_session.commit()

    # Tenant B tries to query Tenant A's action ID
    cross_tenant = repo.get_by_id(action_a.id, business_id=biz_b.id)
    assert cross_tenant is None

    # Tenant B lists all actions
    tenant_b_actions = repo.get_all_for_business(business_id=biz_b.id)
    assert len(tenant_b_actions) == 0

    # Tenant B gets latest actions by fingerprint
    tenant_b_latest = repo.get_latest_action_for_fingerprint(biz_b.id, "fp_tenant_a")
    assert tenant_b_latest is None


def test_unit_of_work_risk_actions(db_session: Session):
    """Verify risk_actions repository operates properly within SqlAlchemyUnitOfWork."""
    biz = Business(name="UoW Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    with SqlAlchemyUnitOfWork(db_session) as uow:
        uow.risk_actions.create(
            business_id=biz.id,
            risk_fingerprint="fp_uow",
            risk_category="STOCKOUT_IMMINENT",
            state="RESOLVED",
            metrics_snapshot={},
        )
        uow.commit()

    with SqlAlchemyUnitOfWork(db_session) as uow:
        action = uow.risk_actions.get_latest_action_for_fingerprint(biz.id, "fp_uow")
        assert action is not None
        assert action.state == "RESOLVED"


def test_cascade_delete_risk_actions_on_business_deletion(db_session: Session):
    """Verify deleting a Business entity cascades and deletes its RiskAction records."""
    biz = Business(name="Cascade Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    repo = RiskActionRepository(db_session)
    action = repo.create(
        business_id=biz.id,
        risk_fingerprint="fp_cascade",
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        state="RESOLVED",
        metrics_snapshot={},
    )
    db_session.commit()
    action_id = action.id

    # Delete business
    db_session.delete(biz)
    db_session.commit()

    deleted_action = db_session.get(RiskAction, action_id)
    assert deleted_action is None
