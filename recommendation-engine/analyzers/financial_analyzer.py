"""
Deterministic Financial Impact & Retail Asset Analyzer (Phase 4A).

Calculates exact revenue exposures and retail asset valuations from verified SQLite records.
Preserves the invariant: SQLite -> Analytics -> Correlations -> Priorities -> Financial Impact -> AI.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Optional
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from models.product import Product
from models.inventory import Inventory
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from calculators.coverage_calculator import calculate_days_of_inventory
from financial_models import SKUFinancialImpact, BusinessFinancialSummary


class FinancialAnalyzer:
    """
    Evaluates verified daily revenue exposures and trapped retail inventory asset valuations.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.sales_analyzer = SalesAnalyzer(db)
        self.inventory_analyzer = InventoryAnalyzer(db)

    def get_all_sku_financial_impacts(
        self,
        business_id: int,
        days: int = 30,
    ) -> List[SKUFinancialImpact]:
        """
        Evaluate deterministic financial impact metrics for all SKUs of a business.
        """
        observation_days = max(1, days)

        # 1. Fetch products & inventory in a single joined query
        stmt = (
            select(Product, Inventory)
            .join(Inventory, Product.id == Inventory.product_id)
            .where(Product.business_id == business_id)
            .order_by(Product.id.asc())
        )
        records = self.db.execute(stmt).all()
        if not records:
            return []

        # 2. Fetch verified velocities and risk indicators
        velocities = self.sales_analyzer.get_all_product_velocities(business_id, days=observation_days)
        risk_indicators = self.inventory_analyzer.get_stock_risk_indicators(business_id, days=observation_days)
        risk_map = {r.product_id: r for r in risk_indicators}

        impact_list: List[SKUFinancialImpact] = []

        for product, inventory in records:
            p_id = product.id
            price = Decimal(str(product.unit_price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            qty = int(inventory.quantity)
            reorder = int(inventory.reorder_level)
            velocity = float(velocities.get(p_id, 0.0))
            coverage = calculate_days_of_inventory(qty, velocity)

            risk = risk_map.get(p_id)
            risk_severity = risk.risk_level if risk else ("CRITICAL" if qty <= 0 else "LOW")

            # Conditions
            is_stockout_risk = risk_severity in ["CRITICAL", "HIGH"]
            is_stagnant = (velocity == 0.0 and qty > reorder)

            # Financial metrics
            retail_on_hand = (Decimal(str(qty)) * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            trapped_retail_value = (Decimal(str(qty)) * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if is_stagnant else Decimal("0.00")

            # Daily Revenue Exposure: applies when product is in stockout/high-risk state with active demand velocity
            if is_stockout_risk and velocity > 0.0:
                vel_dec = Decimal(str(round(velocity, 4)))
                daily_exposure = (vel_dec * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                proj_7d = (daily_exposure * Decimal("7")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                proj_30d = (daily_exposure * Decimal("30")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                daily_exposure = Decimal("0.00")
                proj_7d = Decimal("0.00")
                proj_30d = Decimal("0.00")

            # Factual supporting metrics strings
            supporting_facts: List[str] = [
                f"Catalog Unit Price: ${price:.2f} | On-Hand Quantity: {qty} units (Reorder Level: {reorder})",
                f"Sales Velocity: {velocity:.2f} units/day | Inventory Coverage: {f'{coverage:.1f} days' if coverage is not None else 'No Velocity'}",
                f"Retail Value on Hand: ${retail_on_hand:,.2f}",
            ]

            if daily_exposure > 0:
                supporting_facts.append(
                    f"Projected Daily Revenue Exposure: ${daily_exposure:,.2f}/day (${proj_7d:,.2f} 7-day projection)"
                )
            if is_stagnant:
                supporting_facts.append(
                    f"Trapped Retail Inventory Value: ${trapped_retail_value:,.2f} with 0 sales in past {observation_days} days"
                )

            # Recommended action
            if is_stockout_risk and daily_exposure > 0:
                action = f"Expedite replenishment for '{product.name}' to protect ${daily_exposure:.2f}/day in exposed sales revenue."
            elif qty <= 0:
                action = f"Execute urgent reorder for '{product.name}' to restore zeroed inventory buffer."
            elif is_stagnant:
                action = f"Liquidate or run promotion for '{product.name}' to recover ${trapped_retail_value:,.2f} in stagnant retail inventory."
            else:
                action = f"Maintain standard replenishment cycle for '{product.name}'."

            impact_list.append(
                SKUFinancialImpact(
                    product_id=p_id,
                    product_name=product.name,
                    sku=product.sku,
                    category=product.category,
                    unit_price=price,
                    current_quantity=qty,
                    days_of_inventory=coverage,
                    sales_velocity=velocity,
                    risk_severity=risk_severity,
                    is_stockout_risk=is_stockout_risk,
                    is_stagnant=is_stagnant,
                    daily_revenue_exposure=daily_exposure,
                    projected_7d_revenue_exposure=proj_7d,
                    projected_30d_revenue_exposure=proj_30d,
                    retail_value_on_hand=retail_on_hand,
                    trapped_retail_inventory_value=trapped_retail_value,
                    supporting_facts=supporting_facts,
                    recommended_action=action,
                    source_status="VERIFIED_FACT",
                )
            )

        # Sort: highest daily revenue exposure first, then highest trapped value
        impact_list.sort(key=lambda s: (-s.daily_revenue_exposure, -s.trapped_retail_inventory_value, s.product_id))
        return impact_list

    def get_business_financial_summary(
        self,
        business_id: int,
        days: int = 30,
    ) -> BusinessFinancialSummary:
        """
        Compute aggregated business-level financial exposure summary.
        """
        observation_days = max(1, days)
        all_skus = self.get_all_sku_financial_impacts(business_id=business_id, days=observation_days)

        total_daily_exp = sum((s.daily_revenue_exposure for s in all_skus), Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_7d_exp = sum((s.projected_7d_revenue_exposure for s in all_skus), Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_30d_exp = sum((s.projected_30d_revenue_exposure for s in all_skus), Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_trapped = sum((s.trapped_retail_inventory_value for s in all_skus), Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_on_hand_val = sum((s.retail_value_on_hand for s in all_skus), Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        exposed_count = sum(1 for s in all_skus if s.daily_revenue_exposure > 0)
        stagnant_count = sum(1 for s in all_skus if s.is_stagnant)

        # Filter only impacted SKUs for summary payload
        impacted = [s for s in all_skus if s.daily_revenue_exposure > 0 or s.is_stagnant]

        return BusinessFinancialSummary(
            business_id=business_id,
            observation_days=observation_days,
            total_daily_revenue_exposure=total_daily_exp,
            projected_7d_revenue_exposure=total_7d_exp,
            projected_30d_revenue_exposure=total_30d_exp,
            total_trapped_retail_inventory_value=total_trapped,
            total_retail_inventory_value_on_hand=total_on_hand_val,
            financially_exposed_sku_count=exposed_count,
            stagnant_sku_count=stagnant_count,
            total_active_sku_count=len(all_skus),
            impacted_skus=impacted,
        )

