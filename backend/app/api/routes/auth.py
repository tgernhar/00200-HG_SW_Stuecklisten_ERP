"""
Authentication Routes
Handles login, logout, and token management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json

from app.core.database import get_db
from app.services import auth_service

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Pydantic Models
class LoginRequest(BaseModel):
    """Login request body"""
    loginname: str
    password: str


class LoginResponse(BaseModel):
    """Login response body"""
    access_token: str
    token_type: str = "bearer"
    user: dict
    roles: List[dict]
    log_id: int


class UserResponse(BaseModel):
    """Current user response"""
    id: int
    loginname: str
    vorname: Optional[str]
    nachname: Optional[str]
    email: Optional[str]
    roles: List[dict]


class RefreshResponse(BaseModel):
    """Token refresh response"""
    access_token: str
    token_type: str = "bearer"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Dependency to get the current authenticated user from JWT token.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nicht authentifiziert",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = auth_service.decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ungültig oder abgelaufen",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user against HUGWAWI database.
    
    - Validates credentials against hugwawi.userlogin
    - Loads user roles from hugwawi.userroles
    - Creates JWT token with 45 min expiry
    - Logs login to local userlogin_log table
    """
    # Validate credentials
    user = auth_service.validate_credentials(
        login_data.loginname,
        login_data.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Benutzername oder Passwort",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Load user roles
    roles = auth_service.get_user_roles(user['id'])
    
    # Extract role names for token
    role_names = [r.get('name', '') for r in roles if r.get('name')]
    
    # Get client info
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    # Log login
    log_id = auth_service.log_login(
        db=db,
        hugwawi_user_id=user['id'],
        loginname=user['loginname'],
        vorname=user.get('vorname'),
        nachname=user.get('nachname'),
        roles=roles,
        ip_address=client_ip,
        user_agent=user_agent
    )
    
    # Create access token
    token_data = {
        "sub": user['loginname'],
        "user_id": user['id'],
        "roles": role_names,
        "log_id": log_id
    }
    access_token = auth_service.create_access_token(token_data)
    
    return LoginResponse(
        access_token=access_token,
        user=user,
        roles=roles,
        log_id=log_id
    )


@router.post("/auth/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user and update login log.
    """
    log_id = current_user.get('log_id')
    
    if log_id:
        auth_service.log_logout(db, log_id)
    
    return {"message": "Erfolgreich abgemeldet"}


@router.get("/auth/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current authenticated user information.
    """
    # Reload fresh user data and roles from HUGWAWI
    user_id = current_user.get('user_id')
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Benutzer-ID nicht im Token gefunden"
        )
    
    # Get roles from HUGWAWI
    roles = auth_service.get_user_roles(user_id)
    
    return UserResponse(
        id=user_id,
        loginname=current_user.get('sub', ''),
        vorname=None,  # Not stored in token, would need DB lookup
        nachname=None,
        email=None,
        roles=roles
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
async def refresh_token(
    current_user: dict = Depends(get_current_user)
):
    """
    Refresh the access token (extends expiry by 45 minutes).
    """
    # Create new token with same data
    token_data = {
        "sub": current_user.get('sub'),
        "user_id": current_user.get('user_id'),
        "roles": current_user.get('roles', []),
        "log_id": current_user.get('log_id')
    }
    
    new_token = auth_service.create_access_token(token_data)
    
    return RefreshResponse(access_token=new_token)


@router.patch("/auth/activity")
async def update_activity(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update last activity timestamp for the current session.
    Called periodically by frontend to track activity.
    """
    log_id = current_user.get('log_id')
    
    if log_id:
        auth_service.update_activity(db, log_id)
    
    return {"message": "Aktivität aktualisiert"}
