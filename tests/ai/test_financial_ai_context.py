"""Tests for AI prompt context grounding with Phase 4A verified financial metrics."""
from ai_context.business_context import build_business_context_prompt
from financial_models import BusinessFinancialSummary, SKUFinancialImpact


def test_financial_context_grounding():
    """Verify that financial summary and impacted SKUs are accurately injected into prompt context."""
    sku = SKUFinancialImpact(
        product_id=1,
        product_name="Mechanical Keyboard",
        sku="KB-001",
        category="Peripherals",
        unit_price=89.99,
        current_quantity=0,
        days_of_inventory=0.0,
        sales_velocity=2.5,
        risk_severity="CRITICAL",
        is_stockout_risk=True,
        is_stagnant=False,
        daily_revenue_exposure=224.98,
        projected_7d_revenue_exposure=1574.86,
        projected_30d_revenue_exposure=6749.40,
        retail_value_on_hand=0.0,
        trapped_retail_inventory_value=0.0,
        supporting_facts=["Catalog Unit Price: $89.99 | On-Hand Quantity: 0 units"],
        recommended_action="Expedite replenishment immediately.",
        source_status="VERIFIED_FACT",
    )

    fin_summary = BusinessFinancialSummary(
        business_id=1,
        observation_days=30,
        total_daily_revenue_exposure=224.98,
        projected_7d_revenue_exposure=1574.86,
        projected_30d_revenue_exposure=6749.40,
        total_trapped_retail_inventory_value=1200.00,
        total_retail_inventory_value_on_hand=8500.00,
        financially_exposed_sku_count=1,
        stagnant_sku_count=1,
        total_active_sku_count=5,
        impacted_skus=[sku],
    )

    prompts = build_business_context_prompt(
        business_name="Apex Electronics",
        business_industry="Electronics",
        kpis=None,
        risk_indicators=[],
        trends=[],
        recommendations=[],
        question="What is my total daily revenue exposure from stockouts?",
        days=30,
        financial_summary=fin_summary,
    )

    system_prompt = prompts["system_prompt"]
    user_prompt = prompts["user_prompt"]

    # Verify anti-hallucination constraint
    assert "ANTI-HALLUCINATION CONTRACT" in system_prompt
    assert "Supplier lead times, unit costs, gross margins, or procurement terms" in system_prompt

    # Verify financial factual sections
    assert "### VERIFIED FINANCIAL IMPACT (REVENUE EXPOSURE & RETAIL VALUATION)" in user_prompt
    assert "Total Daily Revenue Exposure: $224.98/day" in user_prompt
    assert "7-Day Projected Revenue Exposure: $1,574.86" in user_prompt
    assert "30-Day Projected Revenue Exposure: $6,749.40" in user_prompt
    assert "Trapped Retail Inventory Value: $1,200.00" in user_prompt
    assert "Mechanical Keyboard (SKU: KB-001) | Daily Exposure: $224.98/day" in user_prompt
