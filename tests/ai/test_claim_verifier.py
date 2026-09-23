"""
Milestone 3-S4: Deterministic Factual Claim Verification & Grounded Response Integrity.

Verifies:
 1.  Correct numerical claim   → VERIFIED
 2.  Conflicting numerical claim → CONFLICTING + confidence not HIGH
 3.  Unknown / unrelated claim  → UNVERIFIED
 4.  Monetary claim (exact match and conflict)
 5.  Percentage claim handling (do not match unrelated percentages)
 6.  Multiple mixed claims in one response
 7.  No deterministic facts → no claim VERIFIED
 8.  LLM-declared HIGH confidence overridden when conflict found
 9.  Tenant isolation — verifier uses only authenticated context facts
10.  Regression — all M3-S1/S2/S3 tests continue to pass (exercised by the
     combined pytest runs, not duplicated here)
"""
import sys
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

# Ensure ai-llm-integration is importable
root_dir = Path(__file__).resolve().parent.parent.parent
ai_llm_dir = root_dir / "ai-llm-integration"
for p in [str(ai_llm_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from claim_verifier import (
    ClaimStatus,
    VerificationContext,
    VerificationResult,
    build_verification_context,
    verify_response_claims,
    apply_verification_policy,
    CONFLICT_LIMITATION_NOTE,
    _extract_numbers_from_text,
)


# ---------------------------------------------------------------------------
# Helpers — minimal deterministic fact stubs
# ---------------------------------------------------------------------------

def _make_kpis(
    total_transactions: int = 250,
    total_revenue: float = 125_000.0,
    total_units_sold: int = 300,
    average_transaction_value: float = 500.0,
    active_products_count: int = 40,
    low_stock_products_count: int = 5,
    out_of_stock_products_count: int = 2,
):
    """Return a minimal object that quacks like BusinessKPIs for verification."""
    obj = MagicMock()
    obj.total_transactions = total_transactions
    obj.total_revenue = Decimal(str(total_revenue))
    obj.total_units_sold = total_units_sold
    obj.average_transaction_value = Decimal(str(average_transaction_value))
    obj.active_products_count = active_products_count
    obj.low_stock_products_count = low_stock_products_count
    obj.out_of_stock_products_count = out_of_stock_products_count
    return obj


def _make_financial_summary(
    total_daily_revenue_exposure: float = 4_200.0,
    projected_7d_revenue_exposure: float = 29_400.0,
    projected_30d_revenue_exposure: float = 126_000.0,
    total_trapped_retail_inventory_value: float = 8_500.0,
    total_retail_inventory_value_on_hand: float = 62_000.0,
    financially_exposed_sku_count: int = 6,
    stagnant_sku_count: int = 3,
    total_active_sku_count: int = 40,
):
    obj = MagicMock()
    obj.total_daily_revenue_exposure = Decimal(str(total_daily_revenue_exposure))
    obj.projected_7d_revenue_exposure = Decimal(str(projected_7d_revenue_exposure))
    obj.projected_30d_revenue_exposure = Decimal(str(projected_30d_revenue_exposure))
    obj.total_trapped_retail_inventory_value = Decimal(str(total_trapped_retail_inventory_value))
    obj.total_retail_inventory_value_on_hand = Decimal(str(total_retail_inventory_value_on_hand))
    obj.financially_exposed_sku_count = financially_exposed_sku_count
    obj.stagnant_sku_count = stagnant_sku_count
    obj.total_active_sku_count = total_active_sku_count
    return obj


# ---------------------------------------------------------------------------
# 1. Correct numerical claim → VERIFIED
# ---------------------------------------------------------------------------

class TestVerifiedClaim:
    """Test 1: A claim that exactly matches a deterministic fact is VERIFIED."""

    def test_transaction_count_verified(self):
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="There were 250 transactions recorded in the observation period.",
            supporting_facts=[],
            context=ctx,
        )
        verified = [v for v in result.verdicts if v.status == ClaimStatus.VERIFIED]
        assert len(verified) >= 1, "Expected at least one VERIFIED verdict for '250 transactions'"
        assert not result.has_conflict

    def test_verified_claim_status_not_unverified_only(self):
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="250 transactions processed.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.all_unverified is False, "Should not be all_unverified when a match is found"

    def test_verified_summary_status(self):
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="250 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        # summary status is VERIFIED when no conflicts and at least one match
        assert result.summary_status() == ClaimStatus.VERIFIED


# ---------------------------------------------------------------------------
# 2. Conflicting numerical claim → CONFLICTING
# ---------------------------------------------------------------------------

class TestConflictingClaim:
    """Test 2: A claim that conflicts with a deterministic fact is CONFLICTING."""

    def _ctx_transactions_only(self) -> VerificationContext:
        """Context with only total_transactions=250 so 500 cannot match any other fact."""
        return VerificationContext(facts={"total_transactions": 250.0})

    def test_wrong_transaction_count_is_conflicting(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="There were 500 transactions recorded.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.has_conflict, "Expected has_conflict=True for '500 transactions' vs fact=250"
        conflicting = [v for v in result.verdicts if v.status == ClaimStatus.CONFLICTING]
        assert len(conflicting) >= 1

    def test_conflict_forces_confidence_below_high(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="500 transactions in the period.",
            supporting_facts=[],
            context=ctx,
        )
        new_conf, _ = apply_verification_policy(
            response_confidence="HIGH",
            verification_result=result,
            existing_limitations=[],
        )
        assert new_conf != "HIGH", "Conflicting claim must prevent HIGH confidence"
        assert new_conf == "MEDIUM"

    def test_conflict_appends_limitation_note(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="500 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        _, limitations = apply_verification_policy(
            response_confidence="HIGH",
            verification_result=result,
            existing_limitations=[],
        )
        assert CONFLICT_LIMITATION_NOTE in limitations

    def test_conflict_limitation_note_not_duplicated(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="500 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        existing = [CONFLICT_LIMITATION_NOTE]
        _, limitations = apply_verification_policy(
            response_confidence="MEDIUM",
            verification_result=result,
            existing_limitations=existing,
        )
        assert limitations.count(CONFLICT_LIMITATION_NOTE) == 1


# ---------------------------------------------------------------------------
# 3. Unknown / unrelated claim → UNVERIFIED
# ---------------------------------------------------------------------------

class TestUnverifiedClaim:
    """Test 3: A number that cannot be mapped to a known fact is UNVERIFIED."""

    def test_unrelated_large_number_is_unverified(self):
        # 50,000,000 is more than 3× away from total_revenue=125,000, so it is UNVERIFIED.
        ctx = build_verification_context(kpis=_make_kpis(total_revenue=125_000.0))
        result = verify_response_claims(
            answer="The industry benchmark is approximately 50,000,000 units globally.",
            supporting_facts=[],
            context=ctx,
        )
        # All verdicts should be UNVERIFIED (none CONFLICTING, none VERIFIED)
        statuses = {v.status for v in result.verdicts}
        assert ClaimStatus.CONFLICTING not in statuses
        assert ClaimStatus.VERIFIED not in statuses

    def test_unverified_does_not_change_confidence(self):
        ctx = build_verification_context(kpis=_make_kpis())
        result = verify_response_claims(
            answer="The industry sees 50,000,000 benchmark transactions globally.",
            supporting_facts=[],
            context=ctx,
        )
        new_conf, limitations = apply_verification_policy(
            response_confidence="MEDIUM",
            verification_result=result,
            existing_limitations=[],
        )
        assert new_conf == "MEDIUM"
        assert CONFLICT_LIMITATION_NOTE not in limitations


# ---------------------------------------------------------------------------
# 4. Monetary claim
# ---------------------------------------------------------------------------

class TestMonetaryClaim:
    """Test 4: Monetary values from the financial summary are verifiable."""

    def test_matching_revenue_verified(self):
        ctx = build_verification_context(kpis=_make_kpis(total_revenue=125_000.0))
        result = verify_response_claims(
            answer="Total revenue was $125,000 over the period.",
            supporting_facts=[],
            context=ctx,
        )
        verified = [v for v in result.verdicts if v.status == ClaimStatus.VERIFIED]
        assert len(verified) >= 1

    def test_conflicting_revenue_is_conflicting(self):
        ctx = build_verification_context(kpis=_make_kpis(total_revenue=125_000.0))
        result = verify_response_claims(
            answer="Revenue reached $500,000 during the period.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.has_conflict

    def test_financial_summary_exposure_verified(self):
        fin = _make_financial_summary(projected_7d_revenue_exposure=29_400.0)
        ctx = build_verification_context(financial_summary=fin)
        result = verify_response_claims(
            answer="The projected 7-day revenue exposure is $29,400.",
            supporting_facts=[],
            context=ctx,
        )
        verified = [v for v in result.verdicts if v.status == ClaimStatus.VERIFIED]
        assert len(verified) >= 1

    def test_conflicting_financial_summary_value(self):
        fin = _make_financial_summary(projected_7d_revenue_exposure=29_400.0)
        ctx = build_verification_context(financial_summary=fin)
        result = verify_response_claims(
            answer="The projected 7-day revenue exposure is approximately $58,000.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.has_conflict


# ---------------------------------------------------------------------------
# 5. Percentage claim handling — do not spuriously match
# ---------------------------------------------------------------------------

class TestPercentageClaim:
    """Test 5: Percentage tokens in prose are not matched against absolute KPI facts."""

    def test_percentage_in_prose_not_matched(self):
        # "20%" should not be extracted and matched against total_transactions=250
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="Sales grew by 20% compared to last period.",
            supporting_facts=[],
            context=ctx,
        )
        # 20 is below _MIN_VERIFIABLE_VALUE and is a percentage — should not appear as CONFLICTING
        assert not result.has_conflict

    def test_percentage_extraction_suppressed(self):
        nums = _extract_numbers_from_text("Revenue increased by 35% and 12% across categories.")
        # percentages should be stripped before extraction
        assert all(n >= 50 for n in nums), f"Unexpected small values extracted: {nums}"


# ---------------------------------------------------------------------------
# 6. Multiple mixed claims in one response
# ---------------------------------------------------------------------------

class TestMixedClaims:
    """Test 6: Response with verified, conflicting, and unverified claims simultaneously."""

    def test_mixed_claim_classification(self):
        # Use an isolated context: only total_transactions=250 and total_revenue=125,000
        # so that:
        #   250 → VERIFIED (exact match total_transactions)
        #   400 → CONFLICTING (within 3× of total_transactions=250, ratio 0.6×)
        #   50,000,000 → UNVERIFIED (> 3× from all known facts)
        ctx = VerificationContext(facts={
            "total_transactions": 250.0,
            "total_revenue": 125_000.0,
        })
        result = verify_response_claims(
            answer=(
                "There were 250 completed transactions. "
                "However, gross orders attempted were 400. "
                "The global market processes 50,000,000 transactions."
            ),
            supporting_facts=[],
            context=ctx,
        )
        statuses = [v.status for v in result.verdicts]
        assert ClaimStatus.VERIFIED in statuses, "250 should be VERIFIED"
        assert ClaimStatus.CONFLICTING in statuses, "400 should be CONFLICTING vs total_transactions=250"
        assert ClaimStatus.UNVERIFIED in statuses, "50,000,000 should be UNVERIFIED"

    def test_conflict_count_correct(self):
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="500 orders and 750 units were shipped.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.conflict_count() >= 1

    def test_verified_count_correct(self):
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="250 transactions processed.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.verified_count() >= 1


# ---------------------------------------------------------------------------
# 7. No deterministic facts → no claim VERIFIED
# ---------------------------------------------------------------------------

class TestNoFacts:
    """Test 7: Empty verification context must never mark any claim VERIFIED."""

    def test_empty_context_no_verified_claims(self):
        ctx = VerificationContext(facts={})
        result = verify_response_claims(
            answer="Revenue was $125,000 across 250 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        verified = [v for v in result.verdicts if v.status == ClaimStatus.VERIFIED]
        assert len(verified) == 0, "No claim should be VERIFIED without deterministic facts"

    def test_empty_context_all_unverified_flag(self):
        ctx = VerificationContext(facts={})
        result = verify_response_claims(
            answer="125,000 revenue across 250 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        assert result.all_unverified is True

    def test_none_kpis_produces_empty_context(self):
        ctx = build_verification_context(kpis=None, financial_summary=None)
        assert not ctx.has_facts()

    def test_no_facts_confidence_unchanged(self):
        ctx = VerificationContext(facts={})
        result = verify_response_claims(
            answer="250 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        new_conf, limitations = apply_verification_policy("HIGH", result, [])
        # no conflict found → confidence unchanged
        assert new_conf == "HIGH"
        assert CONFLICT_LIMITATION_NOTE not in limitations


# ---------------------------------------------------------------------------
# 8. LLM-declared HIGH confidence overridden when conflict found
# ---------------------------------------------------------------------------

class TestConfidenceOverride:
    """Test 8: LLM cannot use its declared confidence to bypass M3-S4 verification."""

    def _ctx_transactions_only(self) -> VerificationContext:
        return VerificationContext(facts={"total_transactions": 250.0})

    def test_high_confidence_downgraded_on_conflict(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="400 transactions.",  # within 3× of 250 → CONFLICTING
            supporting_facts=[],
            context=ctx,
        )
        assert result.has_conflict
        new_conf, _ = apply_verification_policy("HIGH", result, [])
        assert new_conf == "MEDIUM"

    def test_medium_confidence_not_raised_on_verified(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="250 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        new_conf, _ = apply_verification_policy("MEDIUM", result, [])
        # Policy must NEVER raise confidence — only reduce it
        assert new_conf == "MEDIUM"

    def test_low_confidence_not_raised_on_verified(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="250 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        new_conf, _ = apply_verification_policy("LOW", result, [])
        assert new_conf == "LOW"

    def test_medium_stays_medium_on_conflict(self):
        ctx = self._ctx_transactions_only()
        result = verify_response_claims(
            answer="400 transactions.",
            supporting_facts=[],
            context=ctx,
        )
        new_conf, _ = apply_verification_policy("MEDIUM", result, [])
        assert new_conf == "MEDIUM"


# ---------------------------------------------------------------------------
# 9. Tenant isolation
# ---------------------------------------------------------------------------

class TestTenantIsolation:
    """Test 9: Verifier uses only facts supplied from the authenticated context."""

    def test_context_built_from_authenticated_kpis(self):
        """Context must reflect only the supplied kpis — no cross-tenant leakage."""
        tenant_a_kpis = _make_kpis(total_transactions=100)
        tenant_b_kpis = _make_kpis(total_transactions=999)

        ctx_a = build_verification_context(kpis=tenant_a_kpis)
        ctx_b = build_verification_context(kpis=tenant_b_kpis)

        assert ctx_a.facts["total_transactions"] == 100.0
        assert ctx_b.facts["total_transactions"] == 999.0
        # Cross-check: ctx_a does not contain tenant B's fact
        assert ctx_a.facts["total_transactions"] != ctx_b.facts["total_transactions"]

    def test_verifier_does_not_accept_llm_supplied_business_id(self):
        """
        The VerificationContext has no business_id field — it cannot be
        supplied or overridden by LLM-generated content.
        """
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        assert "business_id" not in ctx.facts

    def test_verification_result_only_uses_given_context(self):
        """VERIFIED claim for tenant A must not verify against a different fact value."""
        tenant_a_kpis = _make_kpis(total_transactions=100)
        ctx_a = build_verification_context(kpis=tenant_a_kpis)

        # "250 transactions" should NOT be verified against tenant A's fact of 100
        result = verify_response_claims(
            answer="250 transactions were completed.",
            supporting_facts=[],
            context=ctx_a,
        )
        verified = [v for v in result.verdicts if v.status == ClaimStatus.VERIFIED]
        assert len(verified) == 0, (
            "250 should not be VERIFIED against tenant A's fact of 100"
        )


# ---------------------------------------------------------------------------
# 10. Supporting facts — structured claim verification
# ---------------------------------------------------------------------------

class TestSupportingFactsVerification:
    """Supporting facts receive dedicated extraction and verification."""

    def test_correct_supporting_fact_verified(self):
        ctx = build_verification_context(kpis=_make_kpis(total_transactions=250))
        result = verify_response_claims(
            answer="See supporting facts.",
            supporting_facts=["Total transactions: 250"],
            context=ctx,
        )
        verified = [v for v in result.verdicts if v.status == ClaimStatus.VERIFIED]
        assert len(verified) >= 1

    def test_conflicting_supporting_fact_detected(self):
        # Use isolated context so 400 cannot accidentally match another fact
        ctx = VerificationContext(facts={"total_transactions": 250.0})
        result = verify_response_claims(
            answer="Business performed well.",
            supporting_facts=["Total transactions recorded: 400"],
            context=ctx,
        )
        assert result.has_conflict

    def test_empty_supporting_facts_does_not_crash(self):
        ctx = build_verification_context(kpis=_make_kpis())
        result = verify_response_claims(
            answer="Business performed well.",
            supporting_facts=[],
            context=ctx,
        )
        assert isinstance(result, VerificationResult)


# ---------------------------------------------------------------------------
# 11. Verifier failure safety (fail-closed)
# ---------------------------------------------------------------------------

class TestVerifierFailClosed:
    """Verifier must not raise or mark VERIFIED when it encounters unexpected input."""

    def test_non_string_supporting_fact_does_not_crash(self):
        ctx = build_verification_context(kpis=_make_kpis())
        # Pass a non-string in supporting_facts — verifier should skip it gracefully
        result = verify_response_claims(
            answer="250 transactions.",
            supporting_facts=[None],   # type: ignore[list-item]
            context=ctx,
        )
        assert isinstance(result, VerificationResult)

    def test_empty_answer_does_not_crash(self):
        ctx = build_verification_context(kpis=_make_kpis())
        result = verify_response_claims(
            answer="",
            supporting_facts=[],
            context=ctx,
        )
        assert isinstance(result, VerificationResult)

    def test_very_large_answer_does_not_crash(self):
        ctx = build_verification_context(kpis=_make_kpis())
        long_text = "The revenue was $125,000. " * 500
        result = verify_response_claims(
            answer=long_text,
            supporting_facts=[],
            context=ctx,
        )
        assert isinstance(result, VerificationResult)


# ---------------------------------------------------------------------------
# 12. build_verification_context helpers
# ---------------------------------------------------------------------------

class TestBuildVerificationContext:
    """Unit tests for the context builder."""

    def test_kpis_only(self):
        ctx = build_verification_context(kpis=_make_kpis(
            total_transactions=300,
            total_revenue=90_000.0,
        ))
        assert ctx.facts["total_transactions"] == 300.0
        assert ctx.facts["total_revenue"] == pytest.approx(90_000.0)

    def test_financial_summary_only(self):
        fin = _make_financial_summary(projected_30d_revenue_exposure=126_000.0)
        ctx = build_verification_context(financial_summary=fin)
        assert ctx.facts["projected_30d_revenue_exposure"] == pytest.approx(126_000.0)

    def test_both_kpis_and_financial_summary(self):
        ctx = build_verification_context(
            kpis=_make_kpis(total_transactions=250),
            financial_summary=_make_financial_summary(financially_exposed_sku_count=6),
        )
        assert "total_transactions" in ctx.facts
        assert "financially_exposed_sku_count" in ctx.facts

    def test_none_inputs_produce_empty_context(self):
        ctx = build_verification_context(kpis=None, financial_summary=None)
        assert ctx.facts == {}
        assert not ctx.has_facts()

    def test_decimal_converted_to_float(self):
        ctx = build_verification_context(kpis=_make_kpis(total_revenue=125_000.0))
        assert isinstance(ctx.facts["total_revenue"], float)

    def test_invalid_attribute_skipped(self):
        """If an attribute is not numeric, it must not crash build_verification_context."""
        obj = MagicMock()
        obj.total_transactions = "not-a-number"
        obj.total_revenue = Decimal("50000.00")
        obj.total_units_sold = 100
        obj.average_transaction_value = Decimal("100.00")
        obj.active_products_count = 10
        obj.low_stock_products_count = 2
        obj.out_of_stock_products_count = 1
        ctx = build_verification_context(kpis=obj)
        # total_transactions was invalid — must be absent
        assert "total_transactions" not in ctx.facts
        # total_revenue must still be present
        assert "total_revenue" in ctx.facts


# ---------------------------------------------------------------------------
# 13. Number extraction unit tests
# ---------------------------------------------------------------------------

class TestNumberExtraction:
    """Unit tests for conservative number extraction."""

    def test_extracts_comma_formatted_number(self):
        nums = _extract_numbers_from_text("Revenue was $125,000.")
        assert 125_000.0 in nums

    def test_extracts_plain_integer(self):
        nums = _extract_numbers_from_text("There were 250 transactions.")
        assert 250.0 in nums

    def test_skips_years(self):
        nums = _extract_numbers_from_text("In 2024, revenue grew significantly.")
        assert 2024.0 not in nums

    def test_skips_percentages(self):
        nums = _extract_numbers_from_text("Grew by 35% this quarter.")
        assert 35.0 not in nums

    def test_skips_small_numbers(self):
        # Values below _MIN_VERIFIABLE_VALUE (50) are excluded
        nums = _extract_numbers_from_text("We had 3 critical products and 12 warnings.")
        assert 3.0 not in nums
        assert 12.0 not in nums

    def test_parses_k_suffix(self):
        nums = _extract_numbers_from_text("Revenue was $125K.")
        assert 125_000.0 in nums

    def test_parses_m_suffix(self):
        nums = _extract_numbers_from_text("Market size is 1.5M units.")
        assert 1_500_000.0 in nums


# ---------------------------------------------------------------------------
# 14. Metric-Aware Matching Regression Tests (M3-S4 Correction)
# ---------------------------------------------------------------------------

class TestMetricAwareMatching:
    """
    Guarantees that a numeric claim must NOT be considered VERIFIED or CONFLICTING
    merely because its numerical value is close to an unrelated deterministic fact.
    """

    def test_unrelated_nearby_metric_is_unverified(self):
        """Case 1: Primary regression test — 510 active products must not conflict with ATV=500."""
        ctx = VerificationContext(facts={"average_transaction_value": 500.0})
        result = verify_response_claims(
            answer="The store had 510 active products.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        verdict = result.verdicts[0]
        assert verdict.status == ClaimStatus.UNVERIFIED
        assert verdict.matched_fact is None
        assert not result.has_conflict

    def test_correct_metric_matching_value_verified(self):
        """Case 2: Correct metric with matching value is VERIFIED."""
        ctx = VerificationContext(facts={"average_transaction_value": 500.0})
        result = verify_response_claims(
            answer="Average transaction value was 500.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        verdict = result.verdicts[0]
        assert verdict.status == ClaimStatus.VERIFIED
        assert verdict.matched_fact == "average_transaction_value"
        assert not result.has_conflict

    def test_correct_metric_conflicting_value(self):
        """Case 3: Correct metric with contradictory value (< 5x) is CONFLICTING."""
        ctx = VerificationContext(facts={"average_transaction_value": 500.0})
        result = verify_response_claims(
            answer="Average transaction value was 750.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        verdict = result.verdicts[0]
        assert verdict.status == ClaimStatus.CONFLICTING
        assert verdict.matched_fact == "average_transaction_value"
        assert result.has_conflict

    def test_unknown_metric_fails_closed_unverified(self):
        """Case 4: Numeric claim for unknown metric when fact does not exist in context."""
        ctx = VerificationContext(facts={
            "total_revenue": 125_000.0,
            "total_transactions": 250.0,
        })
        result = verify_response_claims(
            answer="The store had 510 active products.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        assert result.verdicts[0].status == ClaimStatus.UNVERIFIED
        assert not result.has_conflict

    def test_multiple_close_facts_evaluates_against_explicit_metric(self):
        """
        Case 5: Context has multiple numerically close facts:
          total_transactions = 500.0
          average_transaction_value = 490.0
        A claim about 'Average transaction value was 500.' must evaluate against
        ATV (producing CONFLICTING due to 2% diff), NOT match transactions (500)
        as an exact VERIFIED match via nearest-number.
        """
        ctx = VerificationContext(facts={
            "total_transactions": 500.0,
            "average_transaction_value": 490.0,
        })
        result = verify_response_claims(
            answer="Average transaction value was 500.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        verdict = result.verdicts[0]
        assert verdict.matched_fact == "average_transaction_value"
        assert verdict.status == ClaimStatus.CONFLICTING
        assert result.has_conflict

    def test_substring_safety_does_not_match_partial_words(self):
        """Case 6: Word boundaries prevent false-positive substring matches (e.g. 'disorders')."""
        ctx = VerificationContext(facts={"total_transactions": 250.0})
        result = verify_response_claims(
            answer="There were 250 disorders recorded in the clinical trial.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        assert result.verdicts[0].status == ClaimStatus.UNVERIFIED
        assert not result.has_conflict

    def test_case_insensitive_alias_matching(self):
        """Case 7: Uppercase or mixed-case aliases match properly."""
        ctx = VerificationContext(facts={"average_transaction_value": 500.0})
        result = verify_response_claims(
            answer="AVERAGE TRANSACTION VALUE was 500.",
            supporting_facts=[],
            context=ctx,
        )
        assert len(result.verdicts) == 1
        assert result.verdicts[0].status == ClaimStatus.VERIFIED
        assert result.verdicts[0].matched_fact == "average_transaction_value"

    def test_aliases_match_token_boundary_safety(self):
        """Direct helper test for token boundary and case sensitivity."""
        from claim_verifier import _aliases_match
        aliases = ["orders", "revenue"]
        assert _aliases_match("Received 100 orders today", aliases) is True
        assert _aliases_match("Sorted alphabetically in borders", aliases) is False
        assert _aliases_match("Prevenue growth", aliases) is False
        assert _aliases_match("TOTAL REVENUE was high", aliases) is True

