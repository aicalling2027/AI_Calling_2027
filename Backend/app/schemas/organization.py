"""Organization and team member schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import Role
from app.schemas.auth import UserOut
from app.schemas.common import APIModel, ORMModel


class OrganizationOut(ORMModel):
    id: str
    name: str
    slug: str
    industry: str | None = None
    website: str | None = None
    logo_url: str | None = None
    timezone: str
    currency: str
    is_active: bool
    trial_ends_at: datetime | None = None
    created_at: datetime


class OrganizationUpdate(APIModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    industry: str | None = Field(default=None, max_length=80)
    website: str | None = Field(default=None, max_length=255)
    logo_url: str | None = Field(default=None, max_length=512)
    timezone: str | None = Field(default=None, max_length=64)
    currency: str | None = Field(default=None, max_length=8)


class MemberOut(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    joined_at: datetime | None = None


class MemberInvite(APIModel):
    email: EmailStr
    role: Role = Role.MEMBER
    full_name: str | None = Field(default=None, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class MemberUpdate(APIModel):
    role: Role | None = None
    is_active: bool | None = None


class OrganizationWithMembers(OrganizationOut):
    members: list[MemberOut] = Field(default_factory=list)
    user_count: int = 0


class UserListItem(UserOut):
    role: str | None = None
    organization_id: str | None = None
