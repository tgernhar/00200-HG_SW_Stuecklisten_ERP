"""Add import_jobs table

Revision ID: 006_add_import_jobs
Revises: 005_add_article_sw_origin
Create Date: 2026-01-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "006_add_import_jobs"
down_revision = "005_add_article_sw_origin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'import_jobs'
            """
        )
    ).scalar()
    if table_exists:
        return

    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("bom_id", sa.Integer(), sa.ForeignKey("boms.id"), nullable=False, index=True),
        sa.Column("assembly_filepath", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
        sa.Column("step", sa.String(length=50), nullable=True),
        sa.Column("percent", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Basic indexes
    op.create_index("ix_import_jobs_project_id", "import_jobs", ["project_id"])
    op.create_index("ix_import_jobs_bom_id", "import_jobs", ["bom_id"])
    op.create_index("ix_import_jobs_status", "import_jobs", ["status"])

    op.alter_column("import_jobs", "status", existing_type=sa.String(length=20), nullable=False, server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'import_jobs'
            """
        )
    ).scalar()
    if table_exists:
        op.drop_index("ix_import_jobs_status", table_name="import_jobs")
        op.drop_index("ix_import_jobs_bom_id", table_name="import_jobs")
        op.drop_index("ix_import_jobs_project_id", table_name="import_jobs")
        op.drop_table("import_jobs")

