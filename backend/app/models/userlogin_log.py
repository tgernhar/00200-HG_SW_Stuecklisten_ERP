"""
UserLoginLog Model
Tracks user logins to the system
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class UserLoginLog(Base):
    """
    Model for tracking user login sessions.
    
    Logs when users login/logout and their last activity
    for implementing the 45-minute inactivity timeout.
    """
    __tablename__ = "userlogin_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # HUGWAWI user reference
    hugwawi_user_id = Column(Integer, nullable=False, index=True)
    loginname = Column(String(50), nullable=False, index=True)
    vorname = Column(String(50), nullable=True)
    nachname = Column(String(50), nullable=True)
    
    # Roles as JSON string
    roles = Column(Text, nullable=True)
    
    # Timestamps
    login_at = Column(DateTime, nullable=False, server_default=func.now())
    logout_at = Column(DateTime, nullable=True)
    last_activity = Column(DateTime, nullable=True)
    
    # Client info
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(255), nullable=True)
    
    def __repr__(self):
        return f"<UserLoginLog(id={self.id}, loginname='{self.loginname}', login_at='{self.login_at}')>"
