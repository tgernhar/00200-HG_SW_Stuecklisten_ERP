"""Update todo type title templates to match naming conventions

Naming conventions:
- Ebene 1 (Aufträge): ordertable.name (e.g. "AU-2026-00011")
- Ebene 2 (Auftragsartikel): article.articlenumber (e.g. "904135-12321452445")
- Ebene 3 (Stücklistenartikel): article.articlenumber (e.g. "904135-123445454_elox")
- Ebene 4 (Arbeitsgänge): qualificationitem.name (e.g. "DMU50")

Revision ID: 020_update_todo_type_templates
Revises: 019_add_pps_todo_type_config
Create Date: 2026-01-25
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '020_update_todo_type_templates'
down_revision = '019_add_pps_todo_type_config'
branch_labels = None
depends_on = None


def upgrade():
    # Update templates to match naming conventions (no prefixes, just the key data)
    # 1. Ebene - Aufträge: only the order name (e.g. "AU-2026-00011")
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = '', 
            title_template = '{name}'
        WHERE todo_type = 'container_order'
    """)
    
    # 2. Ebene - Auftragsartikel: only the article number (e.g. "904135-12321452445")
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = '', 
            title_template = '{articlenumber}'
        WHERE todo_type = 'container_article'
    """)
    
    # 3. Ebene - Stücklistenartikel: only the article number (e.g. "904135-123445454_elox")
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = '', 
            title_template = '{articlenumber}'
        WHERE todo_type = 'bom_item'
    """)
    
    # 4. Ebene - Arbeitsgänge: only the qualification/machine name (e.g. "DMU50")
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = '', 
            title_template = '{workstep_name}'
        WHERE todo_type = 'operation'
    """)


def downgrade():
    # Restore previous templates
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = '', 
            title_template = '{name}'
        WHERE todo_type = 'container_order'
    """)
    
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = 'Pos ', 
            title_template = '{prefix}{position}: {articlenumber}'
        WHERE todo_type = 'container_article'
    """)
    
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = 'SL-Pos ', 
            title_template = '{prefix}{pos}: {articlenumber}'
        WHERE todo_type = 'bom_item'
    """)
    
    op.execute("""
        UPDATE pps_todo_type_config 
        SET title_prefix = 'AG ', 
            title_template = '{prefix}{pos}: {workstep_name}'
        WHERE todo_type = 'operation'
    """)
