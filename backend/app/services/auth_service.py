"""
Authentication Service
Handles user authentication against HUGWAWI database
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import json

from app.core.config import settings
from app.core.database import get_erp_db_connection

# JWT Configuration
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = 45  # 45 minutes inactivity timeout


def validate_credentials(loginname: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Validate user credentials against HUGWAWI userlogin table.
    
    Args:
        loginname: The username to validate
        password: The password to validate
        
    Returns:
        User data dict if valid, None if invalid
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Query user from HUGWAWI
        query = """
            SELECT id, loginname, password, Vorname, Nachname, blocked, email
            FROM userlogin 
            WHERE loginname = %s AND blocked = 0
        """
        cursor.execute(query, (loginname,))
        user = cursor.fetchone()
        cursor.close()
        
        if not user:
            return None
        
        # HUGWAWI stores passwords as MD5 hashes
        import hashlib
        password_hash = hashlib.md5(password.encode('utf-8')).hexdigest()
        
        if user['password'] != password_hash:
            return None
        
        return {
            'id': user['id'],
            'loginname': user['loginname'],
            'vorname': user['Vorname'],
            'nachname': user['Nachname'],
            'email': user.get('email')
        }
        
    except Exception as e:
        print(f"Error validating credentials: {e}")
        return None
    finally:
        if connection:
            connection.close()


def get_user_roles(user_id: int) -> List[Dict[str, Any]]:
    """
    Load user roles from HUGWAWI userlogin_userrole and userroles tables.
    
    Args:
        user_id: The HUGWAWI user ID
        
    Returns:
        List of role dictionaries
    """
    connection = None
    try:
        connection = get_erp_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT 
                ur.id,
                ur.name,
                ur.isAdmin,
                ur.isManagement,
                ur.isFAS,
                ur.isPersonal,
                ur.isVerwaltung,
                ur.showArticleDistributor,
                ur.showArticleStock,
                ur.showArticleAttachments
            FROM userlogin_userrole uur
            JOIN userroles ur ON uur.userrole = ur.id
            WHERE uur.loginid = %s
        """
        cursor.execute(query, (user_id,))
        roles = cursor.fetchall()
        cursor.close()
        
        return roles
        
    except Exception as e:
        print(f"Error loading user roles: {e}")
        return []
    finally:
        if connection:
            connection.close()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: The data to encode in the token
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token.
    
    Args:
        token: The JWT token string
        
    Returns:
        Decoded token data if valid, None if invalid
    """
    # #region agent log
    import json as _json; open('/app/debug.log','a').write(_json.dumps({"location":"auth_service.py:decode_access_token","message":"Decoding token","data":{"token_preview":token[:30]+"..." if token else "NONE","token_length":len(token) if token else 0},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"E"})+"\n")
    # #endregion
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # #region agent log
        open('/app/debug.log','a').write(_json.dumps({"location":"auth_service.py:decode_access_token","message":"Token decoded successfully","data":{"payload_keys":list(payload.keys()) if payload else None},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"E"})+"\n")
        # #endregion
        return payload
    except JWTError as e:
        # #region agent log
        open('/app/debug.log','a').write(_json.dumps({"location":"auth_service.py:decode_access_token","message":"JWT decode FAILED","data":{"error":str(e),"error_type":type(e).__name__},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"E,F,G"})+"\n")
        # #endregion
        print(f"JWT decode error: {e}")
        return None


def log_login(
    db: Session,
    hugwawi_user_id: int,
    loginname: str,
    vorname: Optional[str],
    nachname: Optional[str],
    roles: List[Dict[str, Any]],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> int:
    """
    Log a user login to the local userlogin_log table.
    
    Args:
        db: SQLAlchemy session for local database
        hugwawi_user_id: HUGWAWI user ID
        loginname: Username
        vorname: First name
        nachname: Last name
        roles: List of user roles
        ip_address: Client IP address
        user_agent: Client user agent string
        
    Returns:
        The ID of the created log entry
    """
    from app.models.userlogin_log import UserLoginLog
    
    # Convert roles to JSON-serializable format
    role_names = [r.get('name', '') for r in roles if r.get('name')]
    
    log_entry = UserLoginLog(
        hugwawi_user_id=hugwawi_user_id,
        loginname=loginname,
        vorname=vorname,
        nachname=nachname,
        roles=json.dumps(role_names),
        login_at=datetime.utcnow(),
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    
    return log_entry.id


def log_logout(db: Session, log_id: int) -> bool:
    """
    Update a login log entry with logout time.
    
    Args:
        db: SQLAlchemy session
        log_id: The login log entry ID
        
    Returns:
        True if successful, False otherwise
    """
    from app.models.userlogin_log import UserLoginLog
    
    try:
        log_entry = db.query(UserLoginLog).filter(UserLoginLog.id == log_id).first()
        if log_entry:
            log_entry.logout_at = datetime.utcnow()
            db.commit()
            return True
        return False
    except Exception as e:
        print(f"Error logging logout: {e}")
        return False


def update_activity(db: Session, log_id: int) -> bool:
    """
    Update the last activity timestamp for a login session.
    
    Args:
        db: SQLAlchemy session
        log_id: The login log entry ID
        
    Returns:
        True if successful, False otherwise
    """
    from app.models.userlogin_log import UserLoginLog
    
    try:
        log_entry = db.query(UserLoginLog).filter(UserLoginLog.id == log_id).first()
        if log_entry:
            log_entry.last_activity = datetime.utcnow()
            db.commit()
            return True
        return False
    except Exception as e:
        print(f"Error updating activity: {e}")
        return False
