"""NEXUS Recommendation & Deterministic Analytics Engine Package."""
from analytics_models import (
    BusinessKPIs,
    ProductSalesMetrics,
    InventoryMetrics,
    StockRiskIndicator,
    DemandTrend,
    DailySalesAnomaly,
    Recommendation,
)
from calculators import (
    calculate_average_transaction_value,
    calculate_inventory_health_counts,
    calculate_sales_velocity,
    calculate_average_daily_revenue,
    calculate_days_of_inventory,
    classify_inventory_status,
    evaluate_stockout_risk,
)
from analyzers import (
    SalesAnalyzer,
    InventoryAnalyzer,
    TrendAnalyzer,
)
from engine import RecommendationEngine

__version__ = "0.2.0"

__all__ = [
    "BusinessKPIs",
    "ProductSalesMetrics",
    "InventoryMetrics",
    "StockRiskIndicator",
    "DemandTrend",
    "DailySalesAnomaly",
    "Recommendation",
    "calculate_average_transaction_value",
    "calculate_inventory_health_counts",
    "calculate_sales_velocity",
    "calculate_average_daily_revenue",
    "calculate_days_of_inventory",
    "classify_inventory_status",
    "evaluate_stockout_risk",
    "SalesAnalyzer",
    "InventoryAnalyzer",
    "TrendAnalyzer",
    "RecommendationEngine",
    "CrossDomainEngine",
    "CrossDomainRiskCorrelation",
    "PrioritizedRiskAction",
    "CrossDomainAnalysisResult",
    "generate_risk_fingerprint",
    "SKUFinancialImpact",
    "BusinessFinancialSummary",
    "FinancialAnalyzer",
]

from correlation_models import (
    CrossDomainRiskCorrelation,
    PrioritizedRiskAction,
    CrossDomainAnalysisResult,
)
from financial_models import (
    SKUFinancialImpact,
    BusinessFinancialSummary,
)
from cross_domain_engine import CrossDomainEngine, generate_risk_fingerprint
from analyzers.financial_analyzer import FinancialAnalyzer
