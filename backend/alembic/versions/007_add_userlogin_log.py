"""Add userlogin_log table for login tracking

Revision ID: 007_add_userlogin_log
Revises: 006_add_import_jobs
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_userlogin_log'
down_revision = '006_add_import_jobs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create userlogin_log table for tracking user login sessions."""
    op.create_table(
        'userlogin_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('hugwawi_user_id', sa.Integer(), nullable=False),
        sa.Column('loginname', sa.String(50), nullable=False),
        sa.Column('vorname', sa.String(50), nullable=True),
        sa.Column('nachname', sa.String(50), nullable=True),
        sa.Column('roles', sa.Text(), nullable=True),
        sa.Column('login_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('logout_at', sa.DateTime(), nullable=True),
        sa.Column('last_activity', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index(
        'ix_userlogin_log_hugwawi_user_id',
        'userlogin_log',
        ['hugwawi_user_id']
    )
    op.create_index(
        'ix_userlogin_log_loginname',
        'userlogin_log',
        ['loginname']
    )
    op.create_index(
        'ix_userlogin_log_login_at',
        'userlogin_log',
        ['login_at']
    )


def downgrade() -> None:
    """Drop userlogin_log table."""
    op.drop_index('ix_userlogin_log_login_at', table_name='userlogin_log')
    op.drop_index('ix_userlogin_log_loginname', table_name='userlogin_log')
    op.drop_index('ix_userlogin_log_hugwawi_user_id', table_name='userlogin_log')
    op.drop_table('userlogin_log')
