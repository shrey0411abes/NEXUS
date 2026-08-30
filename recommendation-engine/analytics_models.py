"""Domain models for deterministic business intelligence, analytics, and recommendations."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, ConfigDict, Field


class BusinessKPIs(BaseModel):
    """Aggregated core KPIs for a business over an observation window."""
    business_id: int = Field(..., description="ID of the business")
    observation_period_days: int = Field(..., ge=1, description="Number of days evaluated")
    total_revenue: float = Field(..., ge=0.0, description="Total sales revenue within the period")
    total_transactions: int = Field(..., ge=0, description="Total number of transactions completed")
    total_units_sold: int = Field(..., ge=0, description="Total quantity of item units sold")
    average_transaction_value: float = Field(..., ge=0.0, description="Average revenue per transaction")
    active_products_count: int = Field(..., ge=0, description="Total number of active catalog products")
    low_stock_products_count: int = Field(..., ge=0, description="Number of products at or below reorder level")
    out_of_stock_products_count: int = Field(..., ge=0, description="Number of products with 0 stock")

    model_config = ConfigDict(from_attributes=True)


class ProductSalesMetrics(BaseModel):
    """Sales velocity and volume metrics for an individual product."""
    product_id: int
    product_name: str
    sku: str
    observation_period_days: int
    total_units_sold: int
    total_revenue: float
    sales_velocity: float = Field(..., description="Average units sold per day (units / days)")
    average_daily_revenue: float = Field(..., description="Average revenue generated per day")

    model_config = ConfigDict(from_attributes=True)


class InventoryMetrics(BaseModel):
    """Inventory health and coverage metrics for an individual product."""
    product_id: int
    product_name: str
    sku: str
    current_quantity: int
    reorder_level: int
    sales_velocity: float
    days_of_inventory: Optional[float] = Field(
        None,
        description="Estimated days until stockout. None if sales velocity is zero."
    )
    is_low_stock: bool
    is_out_of_stock: bool
    stock_status: str = Field(
        ...,
        description="Classification: OUT_OF_STOCK, LOW_STOCK, NORMAL, or OVERSTOCKED"
    )

    model_config = ConfigDict(from_attributes=True)


class StockRiskIndicator(BaseModel):
    """Deterministic stockout risk assessment for a product."""
    product_id: int
    product_name: str
    sku: str
    risk_level: str = Field(
        ...,
        description="Deterministic level: CRITICAL, HIGH, MEDIUM, LOW, or INSUFFICIENT_DATA"
    )
    current_quantity: int
    reorder_level: int
    days_of_inventory: Optional[float]
    risk_reasons: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DemandTrend(BaseModel):
    """Demand trend comparing recent vs prior equal observation periods."""
    product_id: int
    product_name: str
    sku: str
    window_days: int
    recent_avg_daily_sales: float
    prior_avg_daily_sales: float
    percentage_change: Optional[float] = None
    trend_direction: str = Field(
        ...,
        description="Classification: INCREASING, STABLE, DECREASING, or INSUFFICIENT_DATA"
    )

    model_config = ConfigDict(from_attributes=True)


class DailySalesAnomaly(BaseModel):
    """Deterministic anomaly indicator for daily sales volume."""
    product_id: Optional[int]
    date: str
    units_sold: int
    mean_daily_units: float
    std_dev: float
    z_score: Optional[float]
    anomaly_type: str = Field(
        ...,
        description="Classification: SPIKE, DROP, NORMAL, or INSUFFICIENT_DATA"
    )

    model_config = ConfigDict(from_attributes=True)


class Recommendation(BaseModel):
    """Structured, deterministic business recommendation."""
    recommendation_type: str = Field(
        ...,
        description="Type: REORDER_URGENT, REORDER_SOON, DEAD_STOCK_WARNING, DEMAND_SURGE_OPPORTUNITY"
    )
    priority: str = Field(
        ...,
        description="Severity: CRITICAL, HIGH, MEDIUM, LOW"
    )
    business_id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    title: str
    reason: str
    supporting_metrics: Dict[str, Any] = Field(default_factory=dict)
    action_summary: str

    model_config = ConfigDict(from_attributes=True)
