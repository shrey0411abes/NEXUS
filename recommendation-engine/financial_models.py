"""
Domain models for deterministic financial impact and retail asset intelligence (Phase 4A).
All calculations are strictly grounded in SQLite verified source of truth (unit_price, quantity, velocity).
"""
from typing import List, Optional
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, Field


class SKUFinancialImpact(BaseModel):
    """
    Deterministic financial impact and retail asset valuation for an individual SKU.
    """
    product_id: int = Field(..., description="Target product ID")
    product_name: str = Field(..., description="Product catalog name")
    sku: str = Field(..., description="Stock Keeping Unit")
    category: str = Field(..., description="Product category")
    unit_price: float = Field(..., ge=0.0, description="Verified catalog unit selling price ($)")
    current_quantity: int = Field(..., ge=0, description="Verified on-hand stock count")
    days_of_inventory: Optional[float] = Field(None, description="Estimated days of stock buffer remaining")
    sales_velocity: float = Field(..., ge=0.0, description="Verified average units sold per day")
    risk_severity: str = Field(..., description="Severity classification: CRITICAL, HIGH, MEDIUM, LOW, HEALTHY")
    is_stockout_risk: bool = Field(..., description="True if SKU is at CRITICAL or HIGH stockout risk")
    is_stagnant: bool = Field(..., description="True if SKU has 0 velocity and excess stock")
    daily_revenue_exposure: float = Field(..., ge=0.0, description="Daily revenue run-rate exposed to stockout ($/day)")
    projected_7d_revenue_exposure: float = Field(..., ge=0.0, description="7-day projected revenue exposure ($)")
    projected_30d_revenue_exposure: float = Field(..., ge=0.0, description="30-day projected revenue exposure ($)")
    retail_value_on_hand: float = Field(..., ge=0.0, description="Total retail value of on-hand inventory ($)")
    trapped_retail_inventory_value: float = Field(..., ge=0.0, description="Retail value trapped in stagnant/dead stock ($)")
    supporting_facts: List[str] = Field(default_factory=list, description="Verified factual statements supporting metrics")
    recommended_action: str = Field(..., description="Deterministic recommended operational action")
    source_status: str = Field(default="VERIFIED_FACT", description="Source data status")

    model_config = ConfigDict(from_attributes=True)


class BusinessFinancialSummary(BaseModel):
    """
    Aggregated business-level revenue exposure and retail asset intelligence.
    """
    business_id: int = Field(..., description="Target business identifier")
    observation_days: int = Field(..., ge=1, description="Observation window in days")
    total_daily_revenue_exposure: float = Field(..., ge=0.0, description="Total daily revenue exposed across all at-risk SKUs ($/day)")
    projected_7d_revenue_exposure: float = Field(..., ge=0.0, description="Total 7-day projected revenue exposure ($)")
    projected_30d_revenue_exposure: float = Field(..., ge=0.0, description="Total 30-day projected revenue exposure ($)")
    total_trapped_retail_inventory_value: float = Field(..., ge=0.0, description="Total retail inventory value trapped in stagnant stock ($)")
    total_retail_inventory_value_on_hand: float = Field(..., ge=0.0, description="Total retail valuation of all catalog inventory on hand ($)")
    financially_exposed_sku_count: int = Field(..., ge=0, description="Number of active SKUs with active revenue exposure")
    stagnant_sku_count: int = Field(..., ge=0, description="Number of stagnant SKUs with trapped retail value")
    total_active_sku_count: int = Field(..., ge=0, description="Total catalog SKUs evaluated")
    projection_disclaimer: str = Field(
        default="Projected revenue exposure is a deterministic calculation based on observed sales velocity and does not represent guaranteed future losses.",
        description="Deterministic projection disclaimer"
    )
    cost_basis_disclaimer: str = Field(
        default="Cost-basis margin intelligence unavailable — unit cost is not currently part of the source of truth.",
        description="Data boundary transparency note"
    )
    impacted_skus: List[SKUFinancialImpact] = Field(
        default_factory=list,
        description="List of SKUs with active financial exposure or trapped retail value"
    )

    model_config = ConfigDict(from_attributes=True)
