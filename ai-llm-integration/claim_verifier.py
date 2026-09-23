"""
M3-S4 — Deterministic Factual Claim Verifier.

Verifies numerical claims in LLM-generated investigation responses against
deterministic verified business facts already produced by the analytics pipeline.

Design invariants:
  - No LLM calls.
  - No database queries.
  - No external dependencies beyond the Python standard library.
  - Conservative: when mapping is ambiguous, classify as UNVERIFIED, never VERIFIED.
  - Fails closed: exceptions during verification produce UNVERIFIED, not VERIFIED.
  - Facts used for verification originate only from the already-authenticated investigation context.
"""
import re
import logging
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Claim status enum
# ---------------------------------------------------------------------------

class ClaimStatus(str, Enum):
    VERIFIED = "VERIFIED"
    CONFLICTING = "CONFLICTING"
    UNVERIFIED = "UNVERIFIED"


# ---------------------------------------------------------------------------
# Tolerance for floating-point / Decimal comparisons (1 % relative tolerance)
# ---------------------------------------------------------------------------

_RELATIVE_TOLERANCE = 0.01  # 1 %


def _values_match(expected: float, actual: float, rel_tol: float = _RELATIVE_TOLERANCE) -> bool:
    """Return True when actual is within rel_tol * expected of expected."""
    if expected == 0.0 and actual == 0.0:
        return True
    if expected == 0.0:
        # expected is 0 but actual is non-zero — treat as mismatch
        return False
    return abs(actual - expected) / abs(expected) <= rel_tol


# ---------------------------------------------------------------------------
# Verification context — built from already-computed deterministic facts
# ---------------------------------------------------------------------------

@dataclass
class VerificationContext:
    """
    Flat mapping of deterministic business facts extracted from the analytics pipeline.

    Built by build_verification_context(); never extended by LLM data.

    Keys are canonical fact identifiers (strings); values are floats for
    uniform numeric comparison.  Only additive numeric facts are included;
    identifiers (business_id, product_id) are excluded to prevent confusion.
    """
    facts: Dict[str, float] = field(default_factory=dict)

    def has_facts(self) -> bool:
        return bool(self.facts)


def build_verification_context(
    kpis: Optional[Any] = None,
    financial_summary: Optional[Any] = None,
) -> VerificationContext:
    """
    Construct a VerificationContext from already-computed deterministic analytics.

    Accepts BusinessKPIs and BusinessFinancialSummary (or None).
    Only the fields that can be reliably matched against numeric claims are included.

    Does NOT make any database calls.
    Does NOT call any LLM.
    """
    facts: Dict[str, float] = {}

    # ------------------------------------------------------------------
    # KPI facts
    # ------------------------------------------------------------------
    if kpis is not None:
        _safe_add(facts, "total_revenue", getattr(kpis, "total_revenue", None))
        _safe_add(facts, "total_transactions", getattr(kpis, "total_transactions", None))
        _safe_add(facts, "total_units_sold", getattr(kpis, "total_units_sold", None))
        _safe_add(facts, "average_transaction_value", getattr(kpis, "average_transaction_value", None))
        _safe_add(facts, "active_products_count", getattr(kpis, "active_products_count", None))
        _safe_add(facts, "low_stock_products_count", getattr(kpis, "low_stock_products_count", None))
        _safe_add(facts, "out_of_stock_products_count", getattr(kpis, "out_of_stock_products_count", None))

    # ------------------------------------------------------------------
    # Financial summary facts
    # ------------------------------------------------------------------
    if financial_summary is not None:
        _safe_add(facts, "total_daily_revenue_exposure",
                  getattr(financial_summary, "total_daily_revenue_exposure", None))
        _safe_add(facts, "projected_7d_revenue_exposure",
                  getattr(financial_summary, "projected_7d_revenue_exposure", None))
        _safe_add(facts, "projected_30d_revenue_exposure",
                  getattr(financial_summary, "projected_30d_revenue_exposure", None))
        _safe_add(facts, "total_trapped_retail_inventory_value",
                  getattr(financial_summary, "total_trapped_retail_inventory_value", None))
        _safe_add(facts, "total_retail_inventory_value_on_hand",
                  getattr(financial_summary, "total_retail_inventory_value_on_hand", None))
        _safe_add(facts, "financially_exposed_sku_count",
                  getattr(financial_summary, "financially_exposed_sku_count", None))
        _safe_add(facts, "stagnant_sku_count",
                  getattr(financial_summary, "stagnant_sku_count", None))
        _safe_add(facts, "total_active_sku_count",
                  getattr(financial_summary, "total_active_sku_count", None))

    return VerificationContext(facts=facts)


def _safe_add(facts: Dict[str, float], key: str, value: Any) -> None:
    """Convert a Decimal/int/float value to float and store, skipping None."""
    if value is None:
        return
    try:
        facts[key] = float(value)
    except (TypeError, ValueError):
        pass


# ---------------------------------------------------------------------------
# Individual claim verdict
# ---------------------------------------------------------------------------

@dataclass
class ClaimVerdict:
    """Result of verifying a single numeric claim extracted from generated text."""
    raw_text: str
    extracted_value: float
    matched_fact: Optional[str]        # canonical fact key, or None
    status: ClaimStatus
    reason: str


# ---------------------------------------------------------------------------
# Aggregate verification result
# ---------------------------------------------------------------------------

@dataclass
class VerificationResult:
    """Aggregate result for an entire InvestigationResponse."""
    verdicts: List[ClaimVerdict] = field(default_factory=list)
    has_conflict: bool = False
    all_unverified: bool = True  # True when no claim was positively VERIFIED

    def summary_status(self) -> ClaimStatus:
        """
        Single status representing the worst-case finding:
          CONFLICTING  > UNVERIFIED > VERIFIED
        """
        if self.has_conflict:
            return ClaimStatus.CONFLICTING
        if self.all_unverified:
            return ClaimStatus.UNVERIFIED
        return ClaimStatus.VERIFIED

    def conflict_count(self) -> int:
        return sum(1 for v in self.verdicts if v.status == ClaimStatus.CONFLICTING)

    def verified_count(self) -> int:
        return sum(1 for v in self.verdicts if v.status == ClaimStatus.VERIFIED)


# ---------------------------------------------------------------------------
# Number extraction
# ---------------------------------------------------------------------------

# Matches numbers in various business-text formats:
#   $125,000  |  125,000  |  125000  |  1.5  |  $1.5M  (M/K suffixes)
# Intentionally NOT matching bare integers < 4 digits to reduce year/date false-positives.
_NUMBER_PATTERN = re.compile(
    r"""
    \$?              # optional leading dollar sign
    (\d{1,3}         # first group of 1-3 digits
    (?:,\d{3})*      # optional thousands separators
    (?:\.\d+)?       # optional decimal part
    | \d+\.\d+       # pure decimal without thousands separator
    )
    ([KkMm])?        # optional suffix K/M
    """,
    re.VERBOSE,
)

# Minimum magnitude to consider as a potentially meaningful business number.
# This excludes bare years (e.g. 2024), percentages like 5%, small product counts.
_MIN_VERIFIABLE_VALUE = 50.0

# Patterns that are almost certainly NOT business KPI claims:
_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")
_PERCENT_PATTERN = re.compile(r"\d+(?:\.\d+)?\s*%")


def _extract_numbers_from_text(text: str) -> List[float]:
    """
    Extract numeric values from natural-language text.

    Conservative: skips years, standalone percentages, and values below _MIN_VERIFIABLE_VALUE.
    Returns float values only.
    """
    # Remove year-like tokens and percentages before scanning
    cleaned = _YEAR_PATTERN.sub("", text)
    cleaned = _PERCENT_PATTERN.sub("", cleaned)

    results: List[float] = []
    for match in _NUMBER_PATTERN.finditer(cleaned):
        raw_num = match.group(1).replace(",", "")
        suffix = match.group(2) or ""
        try:
            value = float(raw_num)
            if suffix.upper() == "K":
                value *= 1_000
            elif suffix.upper() == "M":
                value *= 1_000_000
            if value >= _MIN_VERIFIABLE_VALUE:
                results.append(value)
        except ValueError:
            continue
    return results


# ---------------------------------------------------------------------------
# Canonical fact metric aliases & matching helpers
# ---------------------------------------------------------------------------

_FACT_ALIASES: Dict[str, List[str]] = {
    "total_revenue": [
        "total revenue",
        "gross revenue",
        "sales revenue",
        "total sales",
        "revenue",
    ],
    "total_transactions": [
        "total transactions",
        "transaction count",
        "completed transactions",
        "transactions",
        "total orders",
        "completed orders",
        "orders",
    ],
    "total_units_sold": [
        "total units sold",
        "units sold",
        "units shipped",
        "quantity sold",
        "items sold",
        "volume sold",
    ],
    "average_transaction_value": [
        "average transaction value",
        "average transaction",
        "average order value",
        "atv",
        "aov",
    ],
    "active_products_count": [
        "active products count",
        "active products",
        "active skus",
        "active catalog items",
    ],
    "low_stock_products_count": [
        "low stock products count",
        "low stock products",
        "low stock skus",
        "low stock items",
    ],
    "out_of_stock_products_count": [
        "out of stock products count",
        "out of stock products",
        "out of stock skus",
        "out of stock items",
    ],
    "total_daily_revenue_exposure": [
        "total daily revenue exposure",
        "daily revenue exposure",
        "daily exposure",
        "daily revenue at risk",
    ],
    "projected_7d_revenue_exposure": [
        "projected 7d revenue exposure",
        "projected 7-day revenue exposure",
        "7-day revenue exposure",
        "7 day revenue exposure",
        "7-day exposure",
        "7 day exposure",
        "7d revenue exposure",
        "7d exposure",
    ],
    "projected_30d_revenue_exposure": [
        "projected 30d revenue exposure",
        "projected 30-day revenue exposure",
        "30-day revenue exposure",
        "30 day revenue exposure",
        "30-day exposure",
        "30 day exposure",
        "30d revenue exposure",
        "30d exposure",
    ],
    "total_trapped_retail_inventory_value": [
        "total trapped retail inventory value",
        "trapped retail inventory value",
        "trapped inventory value",
        "trapped inventory",
    ],
    "total_retail_inventory_value_on_hand": [
        "total retail inventory value on hand",
        "retail inventory value on hand",
        "inventory value on hand",
        "inventory value",
    ],
    "financially_exposed_sku_count": [
        "financially exposed sku count",
        "financially exposed skus",
        "financially exposed sku",
        "financially exposed products",
        "exposed sku count",
        "exposed skus",
    ],
    "stagnant_sku_count": [
        "stagnant sku count",
        "stagnant skus",
        "stagnant sku",
        "stagnant products",
    ],
    "total_active_sku_count": [
        "total active sku count",
        "active sku count",
        "total active skus",
    ],
}


def _aliases_match(claim_text: str, aliases: List[str]) -> bool:
    """
    Return True if any alias in aliases appears in claim_text as a distinct token/phrase.

    Case-insensitive, word-boundary safe to prevent substring false-positives
    (e.g., 'orders' will not match 'disorders' or 'borders').
    """
    if not claim_text or not aliases:
        return False

    normalized_text = claim_text.lower()
    for alias in aliases:
        if not alias:
            continue
        pattern = r"\b" + re.escape(alias.lower()) + r"\b"
        if re.search(pattern, normalized_text):
            return True
    return False


def _split_into_sentences(text: str) -> List[str]:
    """
    Split text into distinct sentences/statements to prevent cross-metric association.
    Preserves numbers with decimals (e.g. $125.50) without splitting mid-number.
    """
    if not text:
        return []
    raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    sentences = [s.strip() for s in raw_sentences if s.strip()]
    return sentences if sentences else [text]


# ---------------------------------------------------------------------------
# Claim matcher
# ---------------------------------------------------------------------------

def _match_value_to_facts(
    arg1: Union[str, float],
    arg2: Union[float, Dict[str, float]],
    arg3: Optional[Union[Dict[str, float], str]] = None,
    claim_text: Optional[str] = None,
) -> Tuple[Optional[str], ClaimStatus, str]:
    """
    Attempt to match a numeric value against known deterministic facts.

    Supports signatures:
      _match_value_to_facts(claim_text: str, value: float, facts: Dict[str, float])
      _match_value_to_facts(value: float, facts: Dict[str, float], claim_text: str = "")

    Returns (matched_key, status, reason).

    Logic:
      1. Determine eligible facts whose aliases appear in the claim text.
         If no eligible facts match -> UNVERIFIED (Case A).
      2. Among eligible facts:
         - Check if any fact is within tolerance (1%) -> VERIFIED.
         - Check if any fact is within 5x magnitude -> CONFLICTING.
         - Otherwise -> UNVERIFIED.
    """
    if isinstance(arg1, str) and isinstance(arg2, (int, float)) and isinstance(arg3, dict):
        text = arg1
        value = float(arg2)
        facts = arg3
    elif isinstance(arg1, (int, float)) and isinstance(arg2, dict):
        value = float(arg1)
        facts = arg2
        text = str(arg3) if isinstance(arg3, str) else (claim_text or "")
    else:
        return None, ClaimStatus.UNVERIFIED, "Invalid arguments to _match_value_to_facts."

    if not facts:
        return None, ClaimStatus.UNVERIFIED, "No deterministic facts available for comparison."

    # Filter to eligible facts whose aliases match the claim text
    eligible_facts: Dict[str, float] = {}
    for key, fact_value in facts.items():
        aliases = _FACT_ALIASES.get(key, [])
        if _aliases_match(text, aliases):
            eligible_facts[key] = fact_value

    # Case A: No canonical metric associated with claim text
    if not eligible_facts:
        return (
            None,
            ClaimStatus.UNVERIFIED,
            f"Extracted value={value:.2f} cannot be verified: no deterministic metric associated with claim text.",
        )

    # Case B & C: Compare only against eligible facts
    best_match_key: Optional[str] = None
    best_ratio: float = float("inf")

    for key, fact_value in eligible_facts.items():
        if fact_value == 0.0 and value == 0.0:
            return key, ClaimStatus.VERIFIED, f"Exact match: {key}=0"
        if fact_value == 0.0:
            continue
        ratio = abs(value - fact_value) / abs(fact_value)
        if ratio < best_ratio:
            best_ratio = ratio
            best_match_key = key

    if best_match_key is None:
        return None, ClaimStatus.UNVERIFIED, "No comparable fact found among eligible metrics."

    best_fact_value = eligible_facts[best_match_key]

    if _values_match(best_fact_value, value):
        return (
            best_match_key,
            ClaimStatus.VERIFIED,
            f"Matches deterministic fact '{best_match_key}'={best_fact_value:.2f} "
            f"within {_RELATIVE_TOLERANCE*100:.0f}% tolerance.",
        )

    if best_ratio < 5.0:
        return (
            best_match_key,
            ClaimStatus.CONFLICTING,
            f"Conflicts with deterministic fact '{best_match_key}'={best_fact_value:.2f}; "
            f"extracted value={value:.2f} differs by {best_ratio*100:.1f}%.",
        )

    return (
        best_match_key,
        ClaimStatus.UNVERIFIED,
        f"Extracted value={value:.2f} differs by {best_ratio*100:.1f}% from eligible fact "
        f"'{best_match_key}'={best_fact_value:.2f} (exceeds conflict threshold).",
    )


# ---------------------------------------------------------------------------
# Public verifier entry point
# ---------------------------------------------------------------------------

def verify_response_claims(
    answer: str,
    supporting_facts: List[str],
    context: VerificationContext,
) -> VerificationResult:
    """
    Verify numerical claims extracted from the LLM-generated answer and
    supporting_facts against the deterministic VerificationContext.

    Parameters
    ----------
    answer:
        The LLM-generated answer string (already sanitized by M3-S3).
    supporting_facts:
        The LLM-generated supporting_facts list (already sanitized by M3-S3).
    context:
        VerificationContext built from deterministic analytics (no LLM data).

    Returns
    -------
    VerificationResult with a verdict for each extracted numeric claim.
    """
    result = VerificationResult()

    try:
        # Combine answer and supporting_facts for claim extraction.
        # supporting_facts receive dedicated extraction so individual conflicting
        # items can be identified clearly.
        texts: List[str] = [answer] + list(supporting_facts)

        for raw_item in texts:
            if not isinstance(raw_item, str):
                continue
            sentences = _split_into_sentences(raw_item)
            for sentence in sentences:
                values = _extract_numbers_from_text(sentence)
                for value in values:
                    matched_key, status, reason = _match_value_to_facts(
                        sentence, value, context.facts
                    )
                    verdict = ClaimVerdict(
                        raw_text=sentence[:120],  # truncate for logging safety
                        extracted_value=value,
                        matched_fact=matched_key,
                        status=status,
                        reason=reason,
                    )
                    result.verdicts.append(verdict)

                    if status == ClaimStatus.CONFLICTING:
                        result.has_conflict = True
                    if status == ClaimStatus.VERIFIED:
                        result.all_unverified = False

    except Exception as exc:  # noqa: BLE001
        # Fail closed: any unexpected error → UNVERIFIED result, no crash
        logger.warning(
            "Claim verification encountered an unexpected error (classified as UNVERIFIED): %s",
            type(exc).__name__,
        )

    return result


# ---------------------------------------------------------------------------
# Confidence downgrade policy (M3-S4)
# ---------------------------------------------------------------------------

CONFLICT_LIMITATION_NOTE = (
    "One or more numerical claims in the AI-generated response could not be "
    "verified against deterministic business data. Confidence has been adjusted accordingly."
)


def apply_verification_policy(
    response_confidence: str,
    verification_result: VerificationResult,
    existing_limitations: List[str],
) -> Tuple[str, List[str]]:
    """
    Apply M3-S4 confidence downgrade policy based on verification result.

    Rules:
      - Conflicting claim → confidence must not be 'HIGH'; downgrade to 'MEDIUM' if needed.
      - CONFLICT_LIMITATION_NOTE appended once if any conflict found.
      - UNVERIFIED with no conflict → no change to confidence or limitations.

    Returns (new_confidence, new_limitations).
    """
    confidence = response_confidence
    limitations = list(existing_limitations)

    if verification_result.has_conflict:
        if confidence == "HIGH":
            confidence = "MEDIUM"
        if CONFLICT_LIMITATION_NOTE not in limitations:
            limitations.append(CONFLICT_LIMITATION_NOTE)

    return confidence, limitations
