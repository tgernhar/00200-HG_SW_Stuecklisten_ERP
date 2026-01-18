"""Add BOMs table and bind articles to BOM

Revision ID: 003_add_boms_and_article_bom_possub
Revises: 002_add_p_menge
Create Date: 2026-01-18
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "003_add_boms_and_article_bom_possub"
down_revision = "002_add_p_menge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- boms ---
    op.create_table(
        "boms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("hugwawi_order_id", sa.Integer(), nullable=True),
        sa.Column("hugwawi_order_name", sa.String(length=100), nullable=True),
        sa.Column("hugwawi_order_article_id", sa.Integer(), nullable=True),
        sa.Column("hugwawi_article_id", sa.Integer(), nullable=True),
        sa.Column("hugwawi_articlenumber", sa.String(length=70), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint(
            "project_id",
            "hugwawi_order_id",
            "hugwawi_order_article_id",
            name="uq_boms_project_order_orderarticle",
        ),
    )
    op.create_index(op.f("ix_boms_id"), "boms", ["id"], unique=False)
    op.create_index(op.f("ix_boms_project_id"), "boms", ["project_id"], unique=False)

    # --- articles additions ---
    op.add_column("articles", sa.Column("bom_id", sa.Integer(), nullable=True))
    op.add_column("articles", sa.Column("pos_sub", sa.Integer(), nullable=False, server_default="0"))
    op.create_index(op.f("ix_articles_bom_id"), "articles", ["bom_id"], unique=False)
    op.create_foreign_key("fk_articles_bom_id", "articles", "boms", ["bom_id"], ["id"])

    # --- Backfill: create one legacy BOM per project and attach existing articles ---
    # 1) Create one BOM per project (legacy: only hugwawi_order_name from project.au_nr)
    op.execute(
        """
        INSERT INTO boms (project_id, hugwawi_order_name, created_at)
        SELECT p.id, p.au_nr, NOW()
        FROM projects p
        """
    )
    # 2) Set articles.bom_id to that legacy BOM
    op.execute(
        """
        UPDATE articles a
        INNER JOIN boms b ON b.project_id = a.project_id
        SET a.bom_id = b.id
        WHERE a.bom_id IS NULL
        """
    )

    # Make bom_id non-null going forward
    try:
        op.alter_column("articles", "bom_id", existing_type=sa.Integer(), nullable=False)
    except Exception:
        # best effort; some DBs may require separate steps
        pass


def downgrade() -> None:
    # drop FK/index/cols first
    try:
        op.drop_constraint("fk_articles_bom_id", "articles", type_="foreignkey")
    except Exception:
        pass
    try:
        op.drop_index(op.f("ix_articles_bom_id"), table_name="articles")
    except Exception:
        pass
    try:
        op.drop_column("articles", "pos_sub")
    except Exception:
        pass
    try:
        op.drop_column("articles", "bom_id")
    except Exception:
        pass

    op.drop_index(op.f("ix_boms_project_id"), table_name="boms")
    op.drop_index(op.f("ix_boms_id"), table_name="boms")
    op.drop_table("boms")

