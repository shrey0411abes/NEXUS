"""Repository for RiskAction audit and lifecycle persistence operations."""
from typing import Dict, List, Optional, Any
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from models.risk_action import RiskAction


class RiskActionRepository:
    """Encapsulates database operations for RiskAction audit entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, action_id: int, business_id: int) -> Optional[RiskAction]:
        """Retrieve a single risk action record strictly scoped to the tenant."""
        stmt = select(RiskAction).where(
            RiskAction.id == action_id,
            RiskAction.business_id == business_id,
        )
        return self.db.scalars(stmt).first()

    def get_all_for_business(
        self,
        business_id: int,
        state: Optional[str] = None,
        product_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[RiskAction]:
        """Retrieve risk action records strictly scoped to the tenant with optional filtering."""
        stmt = select(RiskAction).where(RiskAction.business_id == business_id)
        if state is not None:
            stmt = stmt.where(RiskAction.state == state)
        if product_id is not None:
            stmt = stmt.where(RiskAction.product_id == product_id)

        stmt = stmt.order_by(RiskAction.created_at.desc(), RiskAction.id.desc()).offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_latest_action_for_fingerprint(
        self,
        business_id: int,
        risk_fingerprint: str,
    ) -> Optional[RiskAction]:
        """Retrieve the newest risk action record for a given fingerprint within a business."""
        stmt = (
            select(RiskAction)
            .where(
                RiskAction.business_id == business_id,
                RiskAction.risk_fingerprint == risk_fingerprint,
            )
            .order_by(RiskAction.created_at.desc(), RiskAction.id.desc())
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def get_latest_actions_for_business(
        self,
        business_id: int,
        risk_fingerprints: Optional[List[str]] = None,
    ) -> Dict[str, RiskAction]:
        """
        Efficiently retrieve the single most recent RiskAction for each risk fingerprint in a tenant.

        Used by the CrossDomainService reconciliation engine to correlate ephemeral calculations
        with persisted operational states in a single batch query.
        """
        subquery = select(
            RiskAction.risk_fingerprint,
            func.max(RiskAction.id).label("max_id"),
        ).where(RiskAction.business_id == business_id)

        if risk_fingerprints:
            subquery = subquery.where(RiskAction.risk_fingerprint.in_(risk_fingerprints))

        subquery = subquery.group_by(RiskAction.risk_fingerprint).subquery()

        stmt = select(RiskAction).join(subquery, RiskAction.id == subquery.c.max_id)
        actions = self.db.scalars(stmt).all()
        return {action.risk_fingerprint: action for action in actions}

    def create(
        self,
        business_id: int,
        risk_fingerprint: str,
        risk_category: str,
        state: str,
        metrics_snapshot: Dict[str, Any],
        user_id: Optional[int] = None,
        product_id: Optional[int] = None,
        action_note: Optional[str] = None,
    ) -> RiskAction:
        """Stage and persist a new immutable risk action transition record."""
        action = RiskAction(
            business_id=business_id,
            user_id=user_id,
            product_id=product_id,
            risk_fingerprint=risk_fingerprint,
            risk_category=risk_category,
            state=state,
            action_note=action_note,
            metrics_snapshot=metrics_snapshot,
        )
        self.db.add(action)
        self.db.flush()
        self.db.refresh(action)
        return action
