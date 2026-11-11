"""Authentication and user schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import APIModel, ORMModel


class UserOut(ORMModel):
    id: str
    email: str
    full_name: str
    phone: str | None = None
    avatar_url: str | None = None
    is_active: bool
    is_superadmin: bool
    last_login_at: datetime | None = None
    created_at: datetime


class OrganizationSummary(ORMModel):
    id: str
    name: str
    slug: str


class MeResponse(BaseModel):
    user: UserOut | None = None
    organization: OrganizationSummary | None = None
    role: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RegisterRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=160)
    organization_name: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=32)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        """Reject trivially weak passwords before hashing."""
        if value.lower() == value or value.upper() == value:
            raise ValueError("password must mix upper and lower case characters")
        if not any(char.isdigit() for char in value):
            raise ValueError("password must contain at least one digit")
        return value


class LoginRequest(APIModel):
    email: EmailStr
    password: str
    organization_id: str | None = Field(
        default=None, description="Optional tenant selection for multi-org users"
    )


class RefreshRequest(APIModel):
    refresh_token: str


class LogoutRequest(APIModel):
    refresh_token: str | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
    organization: OrganizationSummary | None = None
    role: str | None = None


class ChangePasswordRequest(APIModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UpdateProfileRequest(APIModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    avatar_url: str | None = Field(default=None, max_length=512)
