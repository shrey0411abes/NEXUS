"""Investigation Application Service — tenant-isolated natural-language business investigation."""
import logging
import time
import unicodedata
from typing import Optional, Union, List
from unit_of_work import AbstractUnitOfWork
from models.business import Business
from models.user import User
from models.investigation import Investigation
from ai_schemas.response import InvestigationResponse
from ai_providers.base import LLMProvider
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.trend_analyzer import TrendAnalyzer
from analyzers.financial_analyzer import FinancialAnalyzer
from engine import RecommendationEngine
from cross_domain_engine import CrossDomainEngine
from ai_context.business_context import build_business_context_prompt
from client import invoke_investigation
from claim_verifier import (
    build_verification_context,
    verify_response_claims,
    apply_verification_policy,
)
from exceptions import MissingConfigurationError

logger = logging.getLogger(__name__)

CONFIDENCE_RANK = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
}


def determine_confidence_ceiling(kpis: Optional[object]) -> str:
    """
    Determine the maximum allowable confidence based on deterministic KPIs.
    - If kpis is None: maximum is 'LOW'
    - If total_transactions is None, non-integer, <= 0: maximum is 'MEDIUM'
    - Otherwise (positive integer total_transactions > 0): maximum is 'HIGH'
    """
    if kpis is None:
        return "LOW"
    total_tx = getattr(kpis, "total_transactions", 0)
    if not isinstance(total_tx, int) or isinstance(total_tx, bool) or total_tx <= 0:
        return "MEDIUM"
    return "HIGH"


def calibrate_confidence(reported_confidence: str, ceiling: str) -> tuple[str, bool]:
    """
    Cap reported confidence to allowable ceiling.
    Returns (calibrated_confidence, was_capped).
    """
    reported_rank = CONFIDENCE_RANK.get(str(reported_confidence).upper(), 1)
    ceiling_rank = CONFIDENCE_RANK.get(str(ceiling).upper(), 3)
    if reported_rank > ceiling_rank:
        return ceiling, True
    return reported_confidence, False


def _resolve_provider_name(provider: object) -> str:
    """Resolve a clean name for logging the LLM provider."""
    if hasattr(provider, "provider_name") and isinstance(getattr(provider, "provider_name"), str):
        return provider.provider_name
    cls_name = type(provider).__name__
    if cls_name == "MockLLMProvider":
        return "mock"
    if cls_name == "GeminiProvider":
        return "gemini"
    return cls_name


def validate_investigation_question(question: Optional[str]) -> str:
    """
    Validate and normalize the investigation question input.
    Enforces minimum length (3), maximum length (2000), whitespace stripping,
    and rejection of disallowed Unicode control characters.
    """
    if question is None:
        raise ValueError("Question cannot be None")
    if not isinstance(question, str):
        raise ValueError("Question must be a string")
    stripped = question.strip()
    if len(stripped) < 3:
        raise ValueError("Question must contain at least 3 non-whitespace characters")
    if len(stripped) > 2000:
        raise ValueError("Question must not exceed 2000 characters")

    for char in stripped:
        if unicodedata.category(char) == "Cc" and char not in ("\t", "\n", "\r"):
            raise ValueError("Question contains disallowed control characters")

    return stripped



class InvestigationService:
    """
    Orchestrates natural-language business investigation for the authenticated tenant.

    Follows the deterministic-first invariant:
      Database -> Deterministic Analytics -> Verified Facts -> AI Interpretation

    The LLM interprets deterministic business facts — it never invents or overrides them.
    """

    def __init__(
        self,
        uow: AbstractUnitOfWork,
        provider: Optional[LLMProvider] = None,
    ) -> None:
        self.uow = uow
        self.provider = provider

    async def investigate(
        self,
        business: Optional[Union[Business, int]] = None,
        question: Optional[str] = None,
        days: int = 30,
        provider: Optional[LLMProvider] = None,
        user: Optional[Union[User, int]] = None,
        *,
        business_id: Optional[int] = None,
        business_name: Optional[str] = None,
        business_industry: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> InvestigationResponse:
        """
        Execute the natural-language business investigation pipeline for the authoritative tenant.

        Parameters:
            business: Authoritative Business entity (or business_id integer).
            question: Natural language question from the user.
            days: Observation period window in days.
            provider: Optional LLMProvider override; defaults to self.provider.
            user: Authoritative User entity (or user_id integer).
            business_id: Keyword-only fallback for tenant ID.
            business_name: Keyword-only fallback for business name.
            business_industry: Keyword-only fallback for industry.
            user_id: Keyword-only fallback for user ID.
        """
        start_time = time.perf_counter()
        active_provider = provider or self.provider
        if active_provider is None:
            raise MissingConfigurationError(
                "AI investigation service is not available. LLM provider is not configured."
            )

        provider_name = _resolve_provider_name(active_provider)
        target_business_id: Optional[int] = None
        target_user_id: Optional[int] = None

        try:
            # Resolve authoritative user identity if provided
            if isinstance(user, User):
                target_user_id = user.id
            elif isinstance(user, int):
                target_user_id = user
            elif user_id is not None:
                target_user_id = user_id

            # Resolve authoritative tenant identity
            target_business_name: str
            target_business_industry: str

            if isinstance(business, Business):
                target_business_id = business.id
                target_business_name = business.name
                target_business_industry = business.industry or "General"
            elif isinstance(business, int):
                target_business_id = business
                target_business_name = business_name or "Business"
                target_business_industry = business_industry or "General"
            elif business_id is not None:
                target_business_id = business_id
                target_business_name = business_name or "Business"
                target_business_industry = business_industry or "General"
            else:
                raise ValueError("Authoritative business context must be provided.")

            # Validate and normalize untrusted user question (service-level defense in depth)
            safe_question = validate_investigation_question(question)

            safe_days = min(max(1, days), 365)
            trend_days = max(7, safe_days // 2)

            # Step 1: Retrieve verified deterministic analytics (source of truth is DB session via UoW)
            db = self.uow.db
            kpis = SalesAnalyzer(db).get_business_kpis(business_id=target_business_id, days=safe_days)
            risk_indicators = InventoryAnalyzer(db).get_stock_risk_indicators(business_id=target_business_id, days=safe_days)
            trends = TrendAnalyzer(db).get_demand_trends(business_id=target_business_id, window_days=trend_days)
            recommendations = RecommendationEngine(db).generate_recommendations(business_id=target_business_id, days=safe_days)

            cross_engine = CrossDomainEngine(db)
            correlations = cross_engine.analyze_cross_domain_risks(business_id=target_business_id, days=safe_days)
            priorities = cross_engine.prioritize_operational_risks(business_id=target_business_id, days=safe_days)

            financial_summary = FinancialAnalyzer(db).get_business_financial_summary(business_id=target_business_id, days=safe_days)

            logger.info(
                "Investigation deterministic analytics retrieved for business_id=%s | kpis=%s | risks=%d | trends=%d | recs=%d | corrs=%d | priorities=%d | fin_exposure=%s",
                target_business_id,
                "available" if kpis else "none",
                len(risk_indicators),
                len(trends),
                len(recommendations),
                len(correlations),
                len(priorities),
                "present" if financial_summary.total_daily_revenue_exposure > 0 else "none",
            )

            # Step 2: Build grounded AI context prompt
            prompts = build_business_context_prompt(
                business_name=target_business_name,
                business_industry=target_business_industry,
                kpis=kpis,
                risk_indicators=risk_indicators,
                trends=trends,
                recommendations=recommendations,
                question=safe_question,
                days=safe_days,
                correlations=correlations,
                priorities=priorities,
                financial_summary=financial_summary,
            )

            # Step 3: Invoke provider and validate structured output
            response = await invoke_investigation(
                provider=active_provider,
                system_prompt=prompts["system_prompt"],
                user_prompt=prompts["user_prompt"],
            )

            # Enforce authoritative question binding
            response.question = safe_question

            # M3-S3: Deterministic confidence calibration against factual data reality
            ceiling = determine_confidence_ceiling(kpis)
            calibrated_conf, was_capped = calibrate_confidence(response.confidence, ceiling)
            if was_capped:
                response.confidence = calibrated_conf
                cap_limitation = "Confidence was limited by the completeness of the available deterministic business data."
                if cap_limitation not in response.limitations:
                    response.limitations.append(cap_limitation)

            # M3-S4: Deterministic factual claim verification
            verification_ctx = build_verification_context(
                kpis=kpis,
                financial_summary=financial_summary,
            )
            verification_result = verify_response_claims(
                answer=response.answer,
                supporting_facts=response.supporting_facts,
                context=verification_ctx,
            )
            verified_confidence, verified_limitations = apply_verification_policy(
                response_confidence=response.confidence,
                verification_result=verification_result,
                existing_limitations=response.limitations,
            )
            response.confidence = verified_confidence
            response.limitations = verified_limitations

            if verification_result.has_conflict:
                logger.warning(
                    "Claim verification found conflicts: business_id=%s | conflicts=%d | verified=%d",
                    target_business_id,
                    verification_result.conflict_count(),
                    verification_result.verified_count(),
                )

            duration_ms = (time.perf_counter() - start_time) * 1000

            # M3-S5: Durable audit persistence of completed investigation
            snapshot = {
                "facts": verification_ctx.facts,
                "verdicts": [
                    {
                        "raw_text": v.raw_text,
                        "extracted_value": v.extracted_value,
                        "matched_fact": v.matched_fact,
                        "status": v.status.value if hasattr(v.status, "value") else str(v.status),
                        "reason": v.reason,
                    }
                    for v in verification_result.verdicts
                ],
                "limitations": list(response.limitations),
                "days": safe_days,
            }

            try:
                self.uow.investigations.create(
                    business_id=target_business_id,
                    user_id=target_user_id,
                    question=safe_question,
                    answer=response.answer,
                    confidence=response.confidence,
                    verification_status=verification_result.summary_status().value,
                    context_snapshot=snapshot,
                    provider=provider_name,
                    execution_duration_ms=duration_ms,
                )
                self.uow.commit()
            except Exception:
                self.uow.rollback()
                raise

            logger.info(
                "Investigation completed successfully: business_id=%s | provider=%s | confidence=%s | duration_ms=%.1f",
                target_business_id,
                provider_name,
                response.confidence,
                duration_ms,
            )
            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                "Investigation failed: business_id=%s | provider=%s | error=%s | duration_ms=%.1f",
                target_business_id if target_business_id is not None else "unknown",
                provider_name,
                str(exc) or type(exc).__name__,
                duration_ms,
            )
            raise

    def get_investigations(
        self,
        business_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Investigation]:
        """
        Retrieve read-only audit history of investigations strictly scoped to the authenticated tenant.
        Applies defensive bounding on pagination parameters.
        """
        safe_limit = min(max(1, limit), 100)
        safe_offset = max(0, offset)
        return self.uow.investigations.get_all_for_business(
            business_id=business_id,
            limit=safe_limit,
            offset=safe_offset,
        )

    def get_investigation_by_id(
        self,
        business_id: int,
        investigation_id: int,
    ) -> Optional[Investigation]:
        """
        Retrieve an investigation audit record by ID strictly scoped to the authenticated tenant.
        Returns None if record does not exist or belongs to another tenant.
        Framework-independent; API layer translates None to HTTP 404.
        """
        return self.uow.investigations.get_for_business(
            investigation_id=investigation_id,
            business_id=business_id,
        )

