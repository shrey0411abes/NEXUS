"""Pydantic schemas for Business entity."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class BusinessBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Business name")
    industry: str = Field(..., min_length=1, max_length=100, description="Industry sector")


class BusinessCreate(BusinessBase):
    pass


class BusinessResponse(BusinessBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
