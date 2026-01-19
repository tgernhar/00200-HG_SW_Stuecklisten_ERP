"""Add sw_origin to articles

Revision ID: 005_add_article_sw_origin
Revises: 004_add_project_artikel_nr
Create Date: 2026-01-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "005_add_article_sw_origin"
down_revision = "004_add_project_artikel_nr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    col_exists = bind.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'articles'
              AND COLUMN_NAME = 'sw_origin'
            """
        )
    ).scalar()
    if not col_exists:
        op.add_column(
            "articles",
            sa.Column("sw_origin", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )

    # Ensure existing rows are backfilled deterministically
    bind.execute(sa.text("UPDATE articles SET sw_origin = 0 WHERE sw_origin IS NULL"))

    # Backfill for existing SOLIDWORKS-imported rows (legacy heuristic: path fields present).
    # Keep Bestellartikel (pos_sub>0) as sw_origin=0.
    bind.execute(
        sa.text(
            """
            UPDATE articles
            SET sw_origin = 1
            WHERE sw_origin = 0
              AND IFNULL(pos_sub, 0) = 0
              AND (
                (sldasm_sldprt_pfad IS NOT NULL AND sldasm_sldprt_pfad <> '')
                OR (slddrw_pfad IS NOT NULL AND slddrw_pfad <> '')
                OR (pfad IS NOT NULL AND pfad <> '')
              )
            """
        )
    )
    op.alter_column("articles", "sw_origin", existing_type=sa.Boolean(), nullable=False, server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    col_exists = bind.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'articles'
              AND COLUMN_NAME = 'sw_origin'
            """
        )
    ).scalar()
    if col_exists:
        op.drop_column("articles", "sw_origin")

