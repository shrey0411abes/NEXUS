"""Cross-Domain Intelligence Application Service — tenant-isolated risk correlation, prioritization, and lifecycle reconciliation."""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import HTTPException, status
from unit_of_work import AbstractUnitOfWork
from correlation_models import (
    CrossDomainRiskCorrelation,
    PrioritizedRiskAction,
    CrossDomainAnalysisResult,
)
from cross_domain_engine import CrossDomainEngine
from models.risk_action import RiskAction
from schemas.risk_action import RiskActionCreate

# Immutable operational reconciliation policies
RESOLVED_COOLDOWN_HOURS: int = 24
DISMISSED_GRACE_DAYS: int = 7


class CrossDomainService:
    """Orchestrates deterministic cross-domain intelligence, operational risk ranking, and state reconciliation."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_risks(self, business_id: int, days: int = 30) -> List[CrossDomainRiskCorrelation]:
        """
        Phase 3A: Retrieve verified cross-domain risk correlations for the authenticated tenant.
        """
        safe_days = min(max(1, days), 365)
        engine = CrossDomainEngine(self.uow.db)
        return engine.analyze_cross_domain_risks(business_id=business_id, days=safe_days)

    def reconcile_priorities(
        self,
        business_id: int,
        actions: List[PrioritizedRiskAction],
        include_resolved: bool = False,
        now: Optional[datetime] = None,
    ) -> List[PrioritizedRiskAction]:
        """
        Reconcile ephemeral risk calculations with persistent RiskAction audit history.

        Rules:
        1. Batch lookup latest action state per fingerprint using get_latest_actions_for_business().
        2. Risks without prior action stay in OPEN state.
        3. ACKNOWLEDGED risks remain active in queue with audit metadata attached.
        4. RESOLVED risks:
           - Within 24h cooldown: marked RESOLVED (filtered out unless include_resolved is True).
           - Expired (>= 24h) and still detected: auto-reopened via new system audit row
             (user_id=None, state=OPEN, action_note="auto-reopened: cooldown expired").
        5. DISMISSED risks:
           - Within 7-day grace: marked DISMISSED (filtered out unless include_resolved is True).
           - Expired (>= 7 days) and still detected: auto-reopened via new system audit row
             (user_id=None, state=OPEN, action_note="auto-reopened: cooldown expired").
        6. Re-indexes contiguous priority ranks (1..N) after filtering.
        """
        if not actions:
            return []

        fingerprints = [a.risk_fingerprint for a in actions if a.risk_fingerprint]
        latest_map = self.uow.risk_actions.get_latest_actions_for_business(
            business_id=business_id,
            risk_fingerprints=fingerprints,
        )

        current_time = now if now is not None else datetime.now(timezone.utc)
        auto_reopened_any = False

        for action in actions:
            persisted = latest_map.get(action.risk_fingerprint)
            if not persisted:
                action.current_state = "OPEN"
                continue

            # Populate latest audit fields
            action.last_actioned_at = persisted.created_at
            action.last_actioned_by = persisted.user_id
            action.last_action_note = persisted.action_note

            if persisted.state == "OPEN":
                action.current_state = "OPEN"
            elif persisted.state == "ACKNOWLEDGED":
                action.current_state = "ACKNOWLEDGED"
            elif persisted.state == "RESOLVED":
                created = persisted.created_at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                elapsed = current_time - created

                if elapsed < timedelta(hours=RESOLVED_COOLDOWN_HOURS):
                    action.current_state = "RESOLVED"
                else:
                    # Cooldown expired, risk still detected -> insert auto-reopen system audit record
                    new_action = self.uow.risk_actions.create(
                        business_id=business_id,
                        risk_fingerprint=action.risk_fingerprint,
                        risk_category=action.risk_category,
                        state="OPEN",
                        metrics_snapshot={
                            "priority_score": action.priority_score,
                            "severity": action.severity,
                            "supporting_facts": action.supporting_facts,
                        },
                        user_id=None,
                        product_id=action.product_id,
                        action_note="auto-reopened: cooldown expired",
                    )
                    auto_reopened_any = True
                    action.current_state = "OPEN"
                    action.last_actioned_at = new_action.created_at
                    action.last_actioned_by = None
                    action.last_action_note = new_action.action_note

            elif persisted.state == "DISMISSED":
                created = persisted.created_at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                elapsed = current_time - created

                if elapsed < timedelta(days=DISMISSED_GRACE_DAYS):
                    action.current_state = "DISMISSED"
                else:
                    # Grace period expired, risk still detected -> insert auto-reopen system audit record
                    new_action = self.uow.risk_actions.create(
                        business_id=business_id,
                        risk_fingerprint=action.risk_fingerprint,
                        risk_category=action.risk_category,
                        state="OPEN",
                        metrics_snapshot={
                            "priority_score": action.priority_score,
                            "severity": action.severity,
                            "supporting_facts": action.supporting_facts,
                        },
                        user_id=None,
                        product_id=action.product_id,
                        action_note="auto-reopened: cooldown expired",
                    )
                    auto_reopened_any = True
                    action.current_state = "OPEN"
                    action.last_actioned_at = new_action.created_at
                    action.last_actioned_by = None
                    action.last_action_note = new_action.action_note

        if auto_reopened_any:
            self.uow.commit()

        # Filter suppressed risks unless caller explicitly requested resolved
        if not include_resolved:
            reconciled = [a for a in actions if a.current_state not in ("RESOLVED", "DISMISSED")]
        else:
            reconciled = actions

        # Deterministic sequential priority rank assignment
        for idx, item in enumerate(reconciled, start=1):
            item.priority_rank = idx

        return reconciled

    def get_priorities(
        self,
        business_id: int,
        days: int = 30,
        include_resolved: bool = False,
        now: Optional[datetime] = None,
    ) -> List[PrioritizedRiskAction]:
        """
        Phase 3B: Retrieve prioritized operational risk queue for the authenticated tenant,
        reconciled with persisted lifecycle actions.
        """
        safe_days = min(max(1, days), 365)
        engine = CrossDomainEngine(self.uow.db)
        raw_priorities = engine.prioritize_operational_risks(business_id=business_id, days=safe_days)
        return self.reconcile_priorities(
            business_id=business_id,
            actions=raw_priorities,
            include_resolved=include_resolved,
            now=now,
        )

    def get_summary(
        self,
        business_id: int,
        days: int = 30,
        include_resolved: bool = False,
        now: Optional[datetime] = None,
    ) -> CrossDomainAnalysisResult:
        """
        Phase 3A/3B: Complete cross-domain analysis for the authenticated tenant.
        """
        safe_days = min(max(1, days), 365)
        engine = CrossDomainEngine(self.uow.db)
        correlations = engine.analyze_cross_domain_risks(business_id=business_id, days=safe_days)
        prioritized_queue = self.get_priorities(
            business_id=business_id,
            days=safe_days,
            include_resolved=include_resolved,
            now=now,
        )

        critical_count = sum(1 for c in correlations if c.severity == "CRITICAL")

        return CrossDomainAnalysisResult(
            business_id=business_id,
            observation_days=safe_days,
            correlations_count=len(correlations),
            critical_risks_count=critical_count,
            correlations=correlations,
            prioritized_queue=prioritized_queue,
        )

    def record_action(
        self,
        business_id: int,
        user_id: int,
        action_in: RiskActionCreate,
    ) -> RiskAction:
        """
        Record an immutable operational risk action transition for the tenant.
        Enforces tenant isolation on referenced product_id.
        """
        if action_in.product_id is not None:
            product = self.uow.products.get_for_business(action_in.product_id, business_id)
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {action_in.product_id} not found",
                )

        with self.uow:
            action = self.uow.risk_actions.create(
                business_id=business_id,
                risk_fingerprint=action_in.risk_fingerprint,
                risk_category=action_in.risk_category,
                state=action_in.state.value,
                metrics_snapshot=action_in.metrics_snapshot,
                user_id=user_id,
                product_id=action_in.product_id,
                action_note=action_in.action_note,
            )
            self.uow.commit()
            return action

    def get_actions(
        self,
        business_id: int,
        state: Optional[str] = None,
        product_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[RiskAction]:
        """Retrieve audit history of risk action transitions for the authenticated tenant."""
        safe_limit = min(max(1, limit), 1000)
        safe_offset = max(0, offset)
        return self.uow.risk_actions.get_all_for_business(
            business_id=business_id,
            state=state,
            product_id=product_id,
            limit=safe_limit,
            offset=safe_offset,
        )


