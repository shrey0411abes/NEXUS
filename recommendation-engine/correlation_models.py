"""Domain models for deterministic cross-domain risk correlations and operational risk prioritization."""
from datetime import datetime
from typing import Dict, List, Optional, Any
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, Field


class CrossDomainRiskCorrelation(BaseModel):
    """
    Deterministic correlation across multiple business domains (Inventory, Sales/Demand, Revenue).
    """
    correlation_id: str = Field(..., description="Deterministic unique identifier for correlation")
    business_id: int = Field(..., description="Target business identifier")
    product_id: Optional[int] = Field(None, description="Affected product ID if product-specific")
    product_name: Optional[str] = Field(None, description="Product catalog name")
    sku: Optional[str] = Field(None, description="Stock Keeping Unit")
    correlation_type: str = Field(
        ...,
        description="Classification: SURGE_STOCKOUT_SQUEEZE, ACCELERATING_DEPLETION, STOCKOUT_IMMINENT, DEAD_STOCK_CAPITAL_TRAP, UNPROTECTED_DEMAND_SPIKE, STABLE_HEALTHY"
    )
    severity: str = Field(
        ...,
        description="Severity classification: CRITICAL, HIGH, MEDIUM, LOW, HEALTHY"
    )
    affected_domains: List[str] = Field(
        default_factory=list,
        description="Impacted operational domains, e.g. ['INVENTORY', 'DEMAND', 'REVENUE']"
    )
    supporting_metrics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Exact numerical factual metrics supporting the correlation"
    )
    supporting_facts: List[str] = Field(
        default_factory=list,
        description="Human-readable verified factual statements"
    )
    deterministic_reason: str = Field(..., description="Deterministic logic reasoning for correlation")

    model_config = ConfigDict(from_attributes=True)


class PrioritizedRiskAction(BaseModel):
    """
    Actionable, prioritized operational risk item answering 'What requires attention now, and why?'.
    """
    priority_rank: int = Field(..., ge=1, description="Deterministic priority ranking (1 = highest urgency)")
    priority_score: float = Field(..., ge=0.0, le=100.0, description="Deterministic composite risk score [0-100]")
    business_id: int = Field(..., description="Target business identifier")
    risk_fingerprint: str = Field(default="", description="Deterministic natural key identifying the risk entity across polls")
    current_state: str = Field(default="OPEN", description="Operational lifecycle state: OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED")
    product_id: Optional[int] = Field(None, description="Affected product ID if product-specific")
    product_name: Optional[str] = Field(None, description="Product catalog name")
    sku: Optional[str] = Field(None, description="Stock Keeping Unit")
    risk_category: str = Field(..., description="Operational risk category")
    severity: str = Field(..., description="Severity classification: CRITICAL, HIGH, MEDIUM, LOW")
    affected_domains: List[str] = Field(default_factory=list, description="Impacted operational domains")
    supporting_facts: List[str] = Field(default_factory=list, description="Factual metrics verified in SQLite")
    impact_summary: str = Field(..., description="Business impact explanation grounded in facts")
    recommended_action: str = Field(..., description="Deterministic recommended operational action")
    source_status: str = Field(default="VERIFIED_FACT", description="Source data status")
    last_actioned_at: Optional[datetime] = Field(None, description="Timestamp of the most recent lifecycle transition")
    last_actioned_by: Optional[int] = Field(None, description="User ID of the actor who performed the transition, or None if system")
    last_action_note: Optional[str] = Field(None, description="Context note from the latest action")

    model_config = ConfigDict(from_attributes=True)


class CrossDomainAnalysisResult(BaseModel):
    """
    Complete cross-domain analysis result containing verified correlations and prioritized action queue.
    """
    business_id: int
    observation_days: int
    correlations_count: int
    critical_risks_count: int
    correlations: List[CrossDomainRiskCorrelation] = Field(default_factory=list)
    prioritized_queue: List[PrioritizedRiskAction] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
