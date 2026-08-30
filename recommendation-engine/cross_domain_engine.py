"""
Deterministic Cross-Domain Risk Correlation Engine (Phase 3A)
and Operational Risk Prioritization Engine (Phase 3B).

Preserves the strict data-intelligence hierarchy:
SQLite -> Deterministic Analytics -> Verified Business Facts -> Correlations -> Operational Priority -> AI/LLM.
"""
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.trend_analyzer import TrendAnalyzer
from correlation_models import (
    CrossDomainRiskCorrelation,
    PrioritizedRiskAction,
    CrossDomainAnalysisResult,
)


class CrossDomainEngine:
    """
    Deterministic cross-domain correlation and operational priority engine.
    Correlates factual metrics across Inventory, Sales Velocity, Demand Trends, and Anomalies.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.sales_analyzer = SalesAnalyzer(db)
        self.inventory_analyzer = InventoryAnalyzer(db)
        self.trend_analyzer = TrendAnalyzer(db)

    def analyze_cross_domain_risks(
        self,
        business_id: int,
        days: int = 30,
    ) -> List[CrossDomainRiskCorrelation]:
        """
        Evaluate deterministic cross-domain correlations for all products of a business.
        """
        trend_days = max(7, days // 2)

        # 1. Fetch verified domain metrics
        inv_metrics = self.inventory_analyzer.get_inventory_metrics(business_id, days=days)
        risk_indicators = self.inventory_analyzer.get_stock_risk_indicators(business_id, days=days)
        trends = self.trend_analyzer.get_demand_trends(business_id, window_days=trend_days)
        anomalies = self.trend_analyzer.get_daily_sales_anomalies(business_id, days=days)

        risk_map = {r.product_id: r for r in risk_indicators}
        trend_map = {t.product_id: t for t in trends}
        spike_product_ids = {a.product_id for a in anomalies if a.anomaly_type == "SPIKE" and a.product_id is not None}

        correlations: List[CrossDomainRiskCorrelation] = []

        for inv in inv_metrics:
            p_id = inv.product_id
            risk = risk_map.get(p_id)
            trend = trend_map.get(p_id)
            has_spike = p_id in spike_product_ids

            risk_level = risk.risk_level if risk else "INSUFFICIENT_DATA"
            trend_dir = trend.trend_direction if trend else "INSUFFICIENT_DATA"
            recent_avg = trend.recent_avg_daily_sales if trend else 0.0
            prior_avg = trend.prior_avg_daily_sales if trend else 0.0
            pct_change = trend.percentage_change if trend else None

            supporting_facts: List[str] = []
            supporting_metrics: Dict[str, Any] = {
                "current_quantity": inv.current_quantity,
                "reorder_level": inv.reorder_level,
                "sales_velocity": inv.sales_velocity,
                "days_of_inventory": inv.days_of_inventory,
                "risk_level": risk_level,
                "trend_direction": trend_dir,
                "recent_avg_daily_sales": recent_avg,
                "prior_avg_daily_sales": prior_avg,
                "percentage_change": pct_change,
                "has_demand_spike": has_spike,
            }

            # Facts generation
            cov_text = f"{inv.days_of_inventory:.1f} days" if inv.days_of_inventory is not None else "No Sales Velocity"
            supporting_facts.append(
                f"On-hand quantity: {inv.current_quantity} units | Reorder threshold: {inv.reorder_level} | Coverage: {cov_text}"
            )
            if trend and pct_change is not None:
                pct_str = f"{pct_change * 100:+.1f}%"
                supporting_facts.append(
                    f"Demand trend: {trend_dir} ({pct_str}) | Recent: {recent_avg:.2f}/day vs Prior: {prior_avg:.2f}/day"
                )

            # --- Correlation Rule Evaluation ---
            # Rule 1: SURGE_STOCKOUT_SQUEEZE (CRITICAL)
            if (risk_level in ["CRITICAL", "HIGH"]) and (trend_dir == "INCREASING" or (has_spike and recent_avg > 0)):
                corr_type = "SURGE_STOCKOUT_SQUEEZE"
                severity = "CRITICAL"
                domains = ["INVENTORY", "DEMAND", "REVENUE"]
                reason = (
                    f"Accelerating demand ({trend_dir}) is colliding with critical stock depletion ({inv.current_quantity} units left, "
                    f"{cov_text} coverage), creating an acute stockout squeeze."
                )

            # Rule 2: UNPROTECTED_DEMAND_SPIKE (HIGH)
            elif has_spike and (inv.days_of_inventory is not None and inv.days_of_inventory <= 7.0):
                corr_type = "UNPROTECTED_DEMAND_SPIKE"
                severity = "HIGH"
                domains = ["INVENTORY", "DEMAND"]
                reason = (
                    f"Statistical sales volume spike detected with only {cov_text} of buffer remaining."
                )

            # Rule 3: ACCELERATING_DEPLETION (HIGH)
            elif (risk_level in ["CRITICAL", "HIGH"]) and (inv.sales_velocity > 0 and inv.current_quantity <= inv.reorder_level):
                corr_type = "ACCELERATING_DEPLETION"
                severity = "HIGH"
                domains = ["INVENTORY", "DEMAND"]
                reason = (
                    f"Continuous sales velocity ({inv.sales_velocity:.2f} units/day) is draining stock below safety threshold ({inv.reorder_level} units)."
                )

            # Rule 4: STOCKOUT_IMMINENT (CRITICAL / HIGH)
            elif inv.current_quantity <= 0 or (inv.days_of_inventory is not None and inv.days_of_inventory <= 2.0):
                corr_type = "STOCKOUT_IMMINENT"
                severity = "CRITICAL" if inv.current_quantity <= 0 else "HIGH"
                domains = ["INVENTORY", "REVENUE"]
                reason = (
                    "Inventory is completely exhausted (0 on-hand units)." if inv.current_quantity <= 0
                    else f"Immediate stockout imminent with only {cov_text} of inventory remaining."
                )

            # Rule 5: DEAD_STOCK_CAPITAL_TRAP (MEDIUM / LOW)
            elif inv.sales_velocity == 0.0 and inv.current_quantity > inv.reorder_level:
                corr_type = "DEAD_STOCK_CAPITAL_TRAP"
                severity = "MEDIUM" if inv.current_quantity >= (inv.reorder_level * 2) else "LOW"
                domains = ["INVENTORY", "CAPITAL"]
                reason = (
                    f"Zero sales velocity recorded over {days} days with {inv.current_quantity} units holding working capital."
                )

            # Rule 6: STABLE_HEALTHY (HEALTHY)
            else:
                corr_type = "STABLE_HEALTHY"
                severity = "HEALTHY"
                domains = ["INVENTORY", "DEMAND"]
                reason = "Inventory position and demand momentum are operating within healthy parameters."

            correlations.append(
                CrossDomainRiskCorrelation(
                    correlation_id=f"CORR-{business_id}-{p_id}-{corr_type}",
                    business_id=business_id,
                    product_id=p_id,
                    product_name=inv.product_name,
                    sku=inv.sku,
                    correlation_type=corr_type,
                    severity=severity,
                    affected_domains=domains,
                    supporting_metrics=supporting_metrics,
                    supporting_facts=supporting_facts,
                    deterministic_reason=reason,
                )
            )

        # Sort with highest severity first
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "HEALTHY": 4}
        correlations.sort(key=lambda c: (severity_order.get(c.severity, 99), c.product_id or 0))
        return correlations

    def prioritize_operational_risks(
        self,
        business_id: int,
        days: int = 30,
    ) -> List[PrioritizedRiskAction]:
        """
        Phase 3B: Convert verified cross-domain signals into a strictly prioritized operational queue.
        Answers: 'What should the business investigate first, and why?'
        """
        correlations = self.analyze_cross_domain_risks(business_id=business_id, days=days)

        action_queue: List[PrioritizedRiskAction] = []

        for corr in correlations:
            if corr.severity == "HEALTHY":
                continue  # Exclude healthy items from active action queue

            metrics = corr.supporting_metrics
            qty = metrics.get("current_quantity", 0)
            reorder = metrics.get("reorder_level", 0)
            velocity = metrics.get("sales_velocity", 0.0)
            doi = metrics.get("days_of_inventory")
            trend_dir = metrics.get("trend_direction", "STABLE")
            has_spike = metrics.get("has_demand_spike", False)

            # --- Deterministic Priority Scoring (0 - 100) ---
            # 1. Base score from severity
            base_scores = {"CRITICAL": 50.0, "HIGH": 35.0, "MEDIUM": 20.0, "LOW": 10.0}
            score = base_scores.get(corr.severity, 10.0)

            # 2. Inventory depletion urgency (up to +25)
            if qty <= 0:
                score += 25.0
            elif doi is not None and doi <= 2.0:
                score += 20.0
            elif doi is not None and doi <= 7.0:
                score += 12.0
            elif qty <= reorder:
                score += 8.0

            # 3. Demand momentum pressure (up to +15)
            if trend_dir == "INCREASING":
                score += 15.0
            elif has_spike:
                score += 10.0

            # 4. Dead stock capital factor (up to +10)
            if corr.correlation_type == "DEAD_STOCK_CAPITAL_TRAP":
                score += 10.0

            score = min(100.0, round(score, 1))

            # Action & Impact definition grounded strictly in verified facts
            if corr.correlation_type == "SURGE_STOCKOUT_SQUEEZE":
                impact = (
                    f"Immediate risk of lost revenue and stockout. Sales momentum is increasing while stock ({qty} units) "
                    f"will deplete in {doi:.1f} days." if doi is not None else f"Stockout actively occurring ({qty} units) during surging demand."
                )
                action = f"Issue an expedited replenishment order for '{corr.product_name}' (SKU: {corr.sku}) with increased batch sizing."
            elif corr.correlation_type == "STOCKOUT_IMMINENT":
                impact = f"Stockout imminent or active. Current on-hand quantity ({qty} units) is inadequate for customer orders."
                action = f"Execute immediate restock order for '{corr.product_name}' to restore minimum safety threshold ({reorder} units)."
            elif corr.correlation_type == "ACCELERATING_DEPLETION":
                impact = f"Stock ({qty} units) has breached reorder level ({reorder} units) under active sales velocity ({velocity:.2f}/day)."
                action = f"Initiate standard replenishment cycle for '{corr.product_name}' to prevent stockout breach."
            elif corr.correlation_type == "UNPROTECTED_DEMAND_SPIKE":
                impact = f"Unanticipated sales spike detected. Current inventory ({qty} units) offers under 7 days of protection."
                action = f"Review order frequency and evaluate safety buffer adjustment for '{corr.product_name}'."
            elif corr.correlation_type == "DEAD_STOCK_CAPITAL_TRAP":
                impact = f"Stagnant inventory: {qty} units with zero sales velocity tying up working capital."
                action = f"Execute promotional discounting, bundling, or liquidation strategy for '{corr.product_name}'."
            else:
                impact = f"Operational attention needed for '{corr.product_name}' under {corr.correlation_type}."
                action = f"Inspect inventory position and sales velocity for '{corr.product_name}'."

            action_queue.append(
                PrioritizedRiskAction(
                    priority_rank=1,  # Will be assigned after sorting
                    priority_score=score,
                    business_id=business_id,
                    product_id=corr.product_id,
                    product_name=corr.product_name,
                    sku=corr.sku,
                    risk_category=corr.correlation_type,
                    severity=corr.severity,
                    affected_domains=corr.affected_domains,
                    supporting_facts=corr.supporting_facts,
                    impact_summary=impact,
                    recommended_action=action,
                    source_status="VERIFIED_FACT",
                )
            )

        # Deterministic sorting: highest priority_score first, then product_id ascending
        action_queue.sort(key=lambda a: (-a.priority_score, a.product_id or 0))

        # Assign deterministic priority ranks: 1, 2, 3...
        for idx, item in enumerate(action_queue, start=1):
            item.priority_rank = idx

        return action_queue

    def get_complete_analysis(
        self,
        business_id: int,
        days: int = 30,
    ) -> CrossDomainAnalysisResult:
        """
        Execute full cross-domain analysis returning both correlations and prioritized queue.
        """
        correlations = self.analyze_cross_domain_risks(business_id=business_id, days=days)
        prioritized_queue = self.prioritize_operational_risks(business_id=business_id, days=days)

        critical_count = sum(1 for c in correlations if c.severity == "CRITICAL")

        return CrossDomainAnalysisResult(
            business_id=business_id,
            observation_days=days,
            correlations_count=len(correlations),
            critical_risks_count=critical_count,
            correlations=correlations,
            prioritized_queue=prioritized_queue,
        )
