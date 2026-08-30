"""Tests for AI prompt context grounding with verified cross-domain correlations and operational priority queue."""
# pyrefly: ignore [missing-import]
from ai_context.business_context import build_business_context_prompt
# pyrefly: ignore [missing-import]
from correlation_models import CrossDomainRiskCorrelation, PrioritizedRiskAction


def test_cross_domain_and_priority_context_grounding():
    """Verify that correlations and prioritized actions are accurately formatted into prompt context."""
    corr = CrossDomainRiskCorrelation(
        correlation_id="CORR-1-1-SURGE",
        business_id=1,
        product_id=10,
        product_name="Gaming Mouse",
        sku="GM-001",
        correlation_type="SURGE_STOCKOUT_SQUEEZE",
        severity="CRITICAL",
        affected_domains=["INVENTORY", "DEMAND", "REVENUE"],
        supporting_metrics={"current_quantity": 2, "days_of_inventory": 0.5},
        supporting_facts=["On-hand quantity: 2 units | Coverage: 0.5 days"],
        deterministic_reason="Accelerating demand is colliding with critical stock depletion.",
    )

    p_action = PrioritizedRiskAction(
        priority_rank=1,
        priority_score=95.0,
        business_id=1,
        product_id=10,
        product_name="Gaming Mouse",
        sku="GM-001",
        risk_category="SURGE_STOCKOUT_SQUEEZE",
        severity="CRITICAL",
        affected_domains=["INVENTORY", "DEMAND"],
        supporting_facts=["On-hand quantity: 2 units | Coverage: 0.5 days"],
        impact_summary="Immediate risk of lost revenue and stockout.",
        recommended_action="Issue an expedited replenishment order.",
        source_status="VERIFIED_FACT",
    )

    prompts = build_business_context_prompt(
        business_name="Apex Tech",
        business_industry="Electronics",
        kpis=None,
        risk_indicators=[],
        trends=[],
        recommendations=[],
        question="What is my biggest operational risk?",
        days=30,
        correlations=[corr],
        priorities=[p_action],
    )

    system_prompt = prompts["system_prompt"]
    user_prompt = prompts["user_prompt"]

    # Verify anti-hallucination constraints in system prompt
    assert "ANTI-HALLUCINATION CONTRACT" in system_prompt
    assert "DO NOT invent" in system_prompt

    # Verify factual sections in user prompt
    assert "### OPERATIONAL RISK PRIORITIZATION QUEUE (DETERMINISTIC RANKINGS)" in user_prompt
    assert "[Rank 1 | Score 95.0/100 | CRITICAL] Gaming Mouse (SURGE_STOCKOUT_SQUEEZE)" in user_prompt
    assert "### VERIFIED CROSS-DOMAIN RISK CORRELATIONS" in user_prompt
    assert "[CRITICAL] Gaming Mouse (SURGE_STOCKOUT_SQUEEZE)" in user_prompt
    assert "What is my biggest operational risk?" in user_prompt
