"""Add artikel_nr to projects and relax au_nr uniqueness

Revision ID: 004_add_project_artikel_nr
Revises: 003_add_boms_and_article_bom_possub
Create Date: 2026-01-18 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "004_add_project_artikel_nr"
down_revision = "003_add_boms_and_article_bom_possub"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add artikel_nr column (nullable for backfill)
    op.add_column("projects", sa.Column("artikel_nr", sa.String(length=100), nullable=True))

    # Drop unique index on au_nr, recreate non-unique
    op.drop_index("ix_projects_au_nr", table_name="projects")
    op.create_index("ix_projects_au_nr", "projects", ["au_nr"], unique=False)

    bind = op.get_bind()

    # 1) Backfill from first BOM (hugwawi_articlenumber)
    bind.execute(
        sa.text(
            """
            UPDATE projects p
            SET artikel_nr = (
                SELECT b.hugwawi_articlenumber
                FROM boms b
                WHERE b.project_id = p.id
                  AND b.hugwawi_articlenumber IS NOT NULL
                  AND b.hugwawi_articlenumber <> ''
                ORDER BY b.id ASC
                LIMIT 1
            )
            WHERE p.artikel_nr IS NULL OR p.artikel_nr = ''
            """
        )
    )

    # 2) Fallback from first article (hg_artikelnummer)
    bind.execute(
        sa.text(
            """
            UPDATE projects p
            SET artikel_nr = (
                SELECT a.hg_artikelnummer
                FROM articles a
                WHERE a.project_id = p.id
                  AND a.hg_artikelnummer IS NOT NULL
                  AND a.hg_artikelnummer <> ''
                ORDER BY a.id ASC
                LIMIT 1
            )
            WHERE p.artikel_nr IS NULL OR p.artikel_nr = ''
            """
        )
    )

    # 3) Ensure non-null with unique legacy fallback
    bind.execute(
        sa.text(
            """
            UPDATE projects
            SET artikel_nr = CONCAT('LEGACY_', id)
            WHERE artikel_nr IS NULL OR artikel_nr = ''
            """
        )
    )

    # Make artikel_nr non-nullable and unique
    op.alter_column("projects", "artikel_nr", existing_type=sa.String(length=100), nullable=False)
    op.create_index("ix_projects_artikel_nr", "projects", ["artikel_nr"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_projects_artikel_nr", table_name="projects")
    op.alter_column("projects", "artikel_nr", existing_type=sa.String(length=100), nullable=True)
    op.drop_column("projects", "artikel_nr")

    # Restore unique index on au_nr
    op.drop_index("ix_projects_au_nr", table_name="projects")
    op.create_index("ix_projects_au_nr", "projects", ["au_nr"], unique=True)
