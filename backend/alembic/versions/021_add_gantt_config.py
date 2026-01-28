"""Add Gantt configuration table for calculation and display settings

This table stores configuration for:
- Duration storage unit (minute)
- Duration display unit (hour)
- Duration display format
- Time step for scheduling (15 minutes)
- Working hours configuration

Revision ID: 021_add_gantt_config
Revises: 020_update_todo_type_templates
Create Date: 2026-01-25
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '021_add_gantt_config'
down_revision = '020_update_todo_type_templates'
branch_labels = None
depends_on = None


def upgrade():
    # Create Gantt configuration table
    op.create_table(
        'pps_gantt_config',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('config_key', sa.String(50), nullable=False, unique=True, comment='Configuration key'),
        sa.Column('config_value', sa.String(200), nullable=False, comment='Configuration value'),
        sa.Column('config_type', sa.String(20), nullable=False, default='string', comment='Value type: string, int, float, bool'),
        sa.Column('description', sa.String(500), nullable=True, comment='German description of the setting'),
        sa.Column('category', sa.String(50), nullable=False, default='general', comment='Category: duration, time, display, colors'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Insert default configurations for duration calculation
    op.execute("""
        INSERT INTO pps_gantt_config (config_key, config_value, config_type, description, category)
        VALUES 
        -- Duration settings
        ('duration_storage_unit', 'minute', 'string', 'Einheit in der die Dauer in der Datenbank gespeichert wird', 'duration'),
        ('duration_display_unit', 'hour', 'string', 'Einheit für die Anzeige der Dauer im Gantt (hour, minute, day)', 'duration'),
        ('duration_display_format', '{value} h', 'string', 'Format für die Daueranzeige ({value} wird ersetzt)', 'duration'),
        ('duration_display_decimals', '1', 'int', 'Anzahl Nachkommastellen für Daueranzeige', 'duration'),
        ('duration_conversion_factor', '60', 'int', 'Umrechnungsfaktor: storage_unit / display_unit (60 = Minuten zu Stunden)', 'duration'),
        
        -- Time step settings
        ('time_step_minutes', '15', 'int', 'Zeitraster für Planung in Minuten', 'time'),
        ('min_duration_minutes', '15', 'int', 'Minimale Dauer eines Tasks in Minuten', 'time'),
        ('duration_step_minutes', '15', 'int', 'Schrittweite für Daueränderungen in Minuten', 'time'),
        
        -- Display settings
        ('date_display_format', 'dd-mm-yy', 'string', 'Format für Datumsanzeige in der Tabelle', 'display'),
        ('decimal_separator', ',', 'string', 'Dezimaltrennzeichen (deutsch: Komma)', 'display'),
        ('row_height', '23', 'int', 'Zeilenhöhe im Gantt in Pixel', 'display'),
        ('task_height', '16', 'int', 'Balkenhöhe im Gantt in Pixel', 'display'),
        ('grid_font_size', '9', 'int', 'Schriftgröße im Grid in Pixel', 'display'),
        
        -- Column widths
        ('column_width_task', '340', 'int', 'Spaltenbreite für Aufgabe in Pixel', 'display'),
        ('column_width_start', '70', 'int', 'Spaltenbreite für Startdatum in Pixel', 'display'),
        ('column_width_duration', '70', 'int', 'Spaltenbreite für Dauer in Pixel', 'display'),
        ('column_width_priority', '40', 'int', 'Spaltenbreite für Priorität in Pixel', 'display'),
        ('column_width_progress', '50', 'int', 'Spaltenbreite für Fortschritt in Pixel', 'display')
    """)


def downgrade():
    op.drop_table('pps_gantt_config')
