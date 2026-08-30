"""Tests for sales velocity and daily revenue calculator."""
from calculators.velocity_calculator import (
    calculate_sales_velocity,
    calculate_average_daily_revenue,
)


def test_sales_velocity_standard():
    """Verify velocity with standard period and units."""
    velocity = calculate_sales_velocity(total_units_sold=90, observation_period_days=30)
    assert velocity == 3.0


def test_sales_velocity_zero_units():
    """Verify velocity is 0.0 when no units sold."""
    velocity = calculate_sales_velocity(total_units_sold=0, observation_period_days=30)
    assert velocity == 0.0


def test_sales_velocity_invalid_period_handled():
    """Verify non-positive observation window defaults to 1 day safely."""
    velocity = calculate_sales_velocity(total_units_sold=10, observation_period_days=0)
    assert velocity == 10.0


def test_average_daily_revenue():
    """Verify average daily revenue computation."""
    daily_rev = calculate_average_daily_revenue(total_revenue=3000.0, observation_period_days=30)
    assert daily_rev == 100.0
