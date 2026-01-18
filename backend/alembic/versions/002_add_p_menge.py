"""Add p_menge to articles

Revision ID: 002_add_p_menge
Revises: 001_initial
Create Date: 2026-01-18
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "002_add_p_menge"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("p_menge", sa.Integer(), nullable=True, server_default="1"),
    )
    # Backfill existing rows: use imported SOLIDWORKS menge as initial production quantity
    try:
        op.execute("UPDATE articles SET p_menge = menge WHERE p_menge IS NULL")
    except Exception:
        # best effort; DB specifics may vary
        pass


def downgrade() -> None:
    op.drop_column("articles", "p_menge")

