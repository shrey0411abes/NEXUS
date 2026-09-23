"""Financial Intelligence Application Service — tenant-isolated revenue exposure analysis."""
from typing import List
from unit_of_work import AbstractUnitOfWork
from financial_models import SKUFinancialImpact, BusinessFinancialSummary
from analyzers.financial_analyzer import FinancialAnalyzer


class FinancialService:
    """Orchestrates deterministic financial intelligence and revenue exposure calculations."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_sku_impacts(self, business_id: int, days: int = 30) -> List[SKUFinancialImpact]:
        """
        Phase 4A: Retrieve deterministic financial impact metrics for all catalog SKUs.
        """
        safe_days = min(max(1, days), 365)
        analyzer = FinancialAnalyzer(self.uow.db)
        return analyzer.get_all_sku_financial_impacts(business_id=business_id, days=safe_days)

    def get_summary(self, business_id: int, days: int = 30) -> BusinessFinancialSummary:
        """
        Phase 4A: Retrieve aggregated business-level revenue exposure and retail valuation summary.
        """
        safe_days = min(max(1, days), 365)
        analyzer = FinancialAnalyzer(self.uow.db)
        return analyzer.get_business_financial_summary(business_id=business_id, days=safe_days)
