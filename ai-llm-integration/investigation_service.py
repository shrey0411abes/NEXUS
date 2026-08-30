"""
Business Investigation Service.

Orchestrates the full investigation pipeline:
  1. Retrieve verified deterministic analytics (instantiating each analyzer with the db session).
  2. Build a grounded AI context prompt.
  3. Invoke the configured LLM provider.
  4. Return a validated structured response.
"""
import logging
from sqlalchemy.orm import Session
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.trend_analyzer import TrendAnalyzer
from analyzers.financial_analyzer import FinancialAnalyzer
from engine import RecommendationEngine
from cross_domain_engine import CrossDomainEngine
from ai_context.business_context import build_business_context_prompt
from client import invoke_investigation
from ai_schemas.response import InvestigationResponse

logger = logging.getLogger(__name__)


async def run_business_investigation(
    db: Session,
    provider,
    business_id: int,
    business_name: str,
    business_industry: str,
    question: str,
    days: int = 30,
) -> InvestigationResponse:
    """
    Execute the full investigation pipeline for a business question.

    All analyzers and engines are instance-based (require db session), so each is
    instantiated here before calling methods.
    """
    trend_days = max(7, days // 2)

    # --- Step 1: Retrieve verified deterministic analytics ---
    kpis = SalesAnalyzer(db).get_business_kpis(business_id=business_id, days=days)
    risk_indicators = InventoryAnalyzer(db).get_stock_risk_indicators(business_id=business_id, days=days)
    trends = TrendAnalyzer(db).get_demand_trends(business_id=business_id, window_days=trend_days)
    recommendations = RecommendationEngine(db).generate_recommendations(business_id=business_id, days=days)
    
    # Phase 3A & 3B: Deterministic cross-domain correlations and operational priority queue
    cross_engine = CrossDomainEngine(db)
    correlations = cross_engine.analyze_cross_domain_risks(business_id=business_id, days=days)
    priorities = cross_engine.prioritize_operational_risks(business_id=business_id, days=days)

    # Phase 4A: Deterministic financial impact & revenue exposure
    financial_summary = FinancialAnalyzer(db).get_business_financial_summary(business_id=business_id, days=days)

    logger.info(
        "Analytics retrieved for business_id=%s | kpis=%s | risks=%d | trends=%d | recs=%d | corrs=%d | priorities=%d | fin_exp=$%.2f",
        business_id,
        "available" if kpis else "none",
        len(risk_indicators),
        len(trends),
        len(recommendations),
        len(correlations),
        len(priorities),
        financial_summary.total_daily_revenue_exposure,
    )

    # --- Step 2: Build grounded AI context prompt ---
    prompts = build_business_context_prompt(
        business_name=business_name,
        business_industry=business_industry,
        kpis=kpis,
        risk_indicators=risk_indicators,
        trends=trends,
        recommendations=recommendations,
        question=question,
        days=days,
        correlations=correlations,
        priorities=priorities,
        financial_summary=financial_summary,
    )

    # --- Step 3: Invoke provider and validate structured output ---
    return await invoke_investigation(
        provider=provider,
        system_prompt=prompts["system_prompt"],
        user_prompt=prompts["user_prompt"],
    )
