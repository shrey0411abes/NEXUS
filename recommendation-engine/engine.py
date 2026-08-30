"""Deterministic business recommendation engine."""
from typing import List, Optional
from sqlalchemy.orm import Session

from analytics_models import (
    BusinessKPIs,
    InventoryMetrics,
    StockRiskIndicator,
    DemandTrend,
    Recommendation,
)

from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.trend_analyzer import TrendAnalyzer


class RecommendationEngine:
    """
    Deterministic rule-based decision engine.

    Evaluates verified operational metrics to generate structured, actionable recommendations
    without relying on probabilistic LLM math or hallucinated numbers.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.sales_analyzer = SalesAnalyzer(db)
        self.inventory_analyzer = InventoryAnalyzer(db)
        self.trend_analyzer = TrendAnalyzer(db)

    def generate_recommendations(
        self,
        business_id: int,
        days: int = 30
    ) -> List[Recommendation]:
        """
        Generate prioritized business recommendations for a business.
        """
        recommendations: List[Recommendation] = []

        # 1. Fetch factual domain metrics
        risk_indicators = self.inventory_analyzer.get_stock_risk_indicators(business_id, days=days)
        trends = self.trend_analyzer.get_demand_trends(business_id, window_days=max(7, days // 2))
        trend_map = {t.product_id: t for t in trends}

        # 2. Evaluate Stockout & Inventory Risks
        for risk in risk_indicators:
            if risk.risk_level == "CRITICAL":
                recommendations.append(
                    Recommendation(
                        recommendation_type="REORDER_URGENT",
                        priority="CRITICAL",
                        business_id=business_id,
                        product_id=risk.product_id,
                        product_name=risk.product_name,
                        title=f"Critical Stockout: Reorder '{risk.product_name}' Immediately",
                        reason="; ".join(risk.risk_reasons),
                        supporting_metrics={
                            "current_quantity": risk.current_quantity,
                            "reorder_level": risk.reorder_level,
                            "days_of_inventory": risk.days_of_inventory,
                            "sku": risk.sku,
                        },
                        action_summary="Place an urgent purchase order with your supplier to restore safety buffer.",
                    )
                )
            elif risk.risk_level == "HIGH":
                recommendations.append(
                    Recommendation(
                        recommendation_type="REORDER_SOON",
                        priority="HIGH",
                        business_id=business_id,
                        product_id=risk.product_id,
                        product_name=risk.product_name,
                        title=f"Low Stock Alert: Plan Restock for '{risk.product_name}'",
                        reason="; ".join(risk.risk_reasons),
                        supporting_metrics={
                            "current_quantity": risk.current_quantity,
                            "reorder_level": risk.reorder_level,
                            "days_of_inventory": risk.days_of_inventory,
                            "sku": risk.sku,
                        },
                        action_summary="Initiate standard replenishment cycle before stock hits critical levels.",
                    )
                )

        # 3. Evaluate Demand Surges & Dead Inventory
        for trend in trends:
            if trend.trend_direction == "INCREASING" and trend.recent_avg_daily_sales > 0:
                pct_str = f"+{trend.percentage_change * 100:.1f}%" if trend.percentage_change is not None else "High"
                recommendations.append(
                    Recommendation(
                        recommendation_type="DEMAND_SURGE_OPPORTUNITY",
                        priority="MEDIUM",
                        business_id=business_id,
                        product_id=trend.product_id,
                        product_name=trend.product_name,
                        title=f"Demand Surge Detected: '{trend.product_name}' ({pct_str})",
                        reason=(
                            f"Sales increased from {trend.prior_avg_daily_sales:.2f} to "
                            f"{trend.recent_avg_daily_sales:.2f} units/day over the last {trend.window_days} days."
                        ),
                        supporting_metrics={
                            "recent_avg_daily_sales": trend.recent_avg_daily_sales,
                            "prior_avg_daily_sales": trend.prior_avg_daily_sales,
                            "percentage_change": trend.percentage_change,
                            "window_days": trend.window_days,
                        },
                        action_summary="Consider increasing procurement batch size to support growing sales velocity.",
                    )
                )

        # 4. Check for Dead Stock (High stock but zero sales over observation period)
        inv_metrics = self.inventory_analyzer.get_inventory_metrics(business_id, days=days)
        for inv in inv_metrics:
            if inv.sales_velocity == 0.0 and inv.current_quantity > inv.reorder_level:
                recommendations.append(
                    Recommendation(
                        recommendation_type="DEAD_STOCK_WARNING",
                        priority="LOW",
                        business_id=business_id,
                        product_id=inv.product_id,
                        product_name=inv.product_name,
                        title=f"Stagnant Inventory: '{inv.product_name}' Has Zero Velocity",
                        reason=(
                            f"On-hand stock is {inv.current_quantity} units with 0 sales recorded in the past {days} days."
                        ),
                        supporting_metrics={
                            "current_quantity": inv.current_quantity,
                            "reorder_level": inv.reorder_level,
                            "observation_days": days,
                        },
                        action_summary="Review pricing, run promotional bundles, or discount to free up working capital.",
                    )
                )

        # Sort recommendations by priority
        priority_weights = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        recommendations.sort(key=lambda r: priority_weights.get(r.priority, 99))
        return recommendations
