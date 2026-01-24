"""Add PPS tables for production planning

Revision ID: 009
Revises: 008_add_hierarchy_remarks
Create Date: 2026-01-24

Tables:
- pps_todos: Main planning units (operations/containers)
- pps_todo_segments: Splits for todos
- pps_todo_dependencies: Task dependencies
- pps_resource_cache: Cached resources from HUGWAWI
- pps_conflicts: Detected conflicts
- pps_audit_log: Change tracking

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009_add_pps_tables'
down_revision = '008_add_hierarchy_remarks'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create pps_resource_cache table first (referenced by pps_todos)
    op.create_table(
        'pps_resource_cache',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('resource_type', sa.String(20), nullable=False),  # 'department', 'machine', 'employee'
        sa.Column('erp_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False, default=1),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('calendar_json', sa.JSON(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_resource_type_erp', 'pps_resource_cache', ['resource_type', 'erp_id'], unique=True)
    op.create_index('idx_resource_active', 'pps_resource_cache', ['is_active'])
    
    # 2. Create pps_todos table
    op.create_table(
        'pps_todos',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        # ERP references
        sa.Column('erp_order_id', sa.Integer(), nullable=True),
        sa.Column('erp_order_article_id', sa.Integer(), nullable=True),
        sa.Column('erp_workplan_detail_id', sa.Integer(), nullable=True),
        # Hierarchy
        sa.Column('parent_todo_id', sa.Integer(), nullable=True),
        sa.Column('todo_type', sa.String(20), nullable=False),  # 'container_order', 'container_article', 'operation'
        # Basic info
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False, default=1),
        # Time calculations
        sa.Column('setup_time_minutes', sa.Integer(), nullable=True),
        sa.Column('run_time_minutes', sa.Integer(), nullable=True),
        sa.Column('total_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('is_duration_manual', sa.Boolean(), nullable=False, default=False),
        # Planning
        sa.Column('planned_start', sa.DateTime(), nullable=True),
        sa.Column('planned_end', sa.DateTime(), nullable=True),
        sa.Column('actual_start', sa.DateTime(), nullable=True),
        sa.Column('actual_end', sa.DateTime(), nullable=True),
        # Status
        sa.Column('status', sa.String(20), nullable=False, default='new'),  # 'new', 'planned', 'in_progress', 'completed', 'blocked'
        sa.Column('block_reason', sa.String(500), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, default=0),
        sa.Column('delivery_date', sa.Date(), nullable=True),
        # Resource assignment
        sa.Column('assigned_department_id', sa.Integer(), nullable=True),
        sa.Column('assigned_machine_id', sa.Integer(), nullable=True),
        sa.Column('assigned_employee_id', sa.Integer(), nullable=True),
        # Optimistic locking
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['parent_todo_id'], ['pps_todos.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_department_id'], ['pps_resource_cache.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_machine_id'], ['pps_resource_cache.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_employee_id'], ['pps_resource_cache.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_todo_erp_order', 'pps_todos', ['erp_order_id'])
    op.create_index('idx_todo_status', 'pps_todos', ['status'])
    op.create_index('idx_todo_planned_dates', 'pps_todos', ['planned_start', 'planned_end'])
    op.create_index('idx_todo_delivery', 'pps_todos', ['delivery_date'])
    op.create_index('idx_todo_type', 'pps_todos', ['todo_type'])
    
    # 3. Create pps_todo_segments table (for splits)
    op.create_table(
        'pps_todo_segments',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('todo_id', sa.Integer(), nullable=False),
        sa.Column('segment_index', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('assigned_machine_id', sa.Integer(), nullable=True),
        sa.Column('assigned_employee_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['todo_id'], ['pps_todos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assigned_machine_id'], ['pps_resource_cache.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_employee_id'], ['pps_resource_cache.id'], ondelete='SET NULL'),
    )
    op.create_index('idx_segment_todo', 'pps_todo_segments', ['todo_id'])
    op.create_index('idx_segment_times', 'pps_todo_segments', ['start_time', 'end_time'])
    
    # 4. Create pps_todo_dependencies table
    op.create_table(
        'pps_todo_dependencies',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('predecessor_id', sa.Integer(), nullable=False),
        sa.Column('successor_id', sa.Integer(), nullable=False),
        sa.Column('dependency_type', sa.String(20), nullable=False, default='finish_to_start'),  # 'finish_to_start', 'start_to_start', 'finish_to_finish'
        sa.Column('lag_minutes', sa.Integer(), nullable=False, default=0),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['predecessor_id'], ['pps_todos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['successor_id'], ['pps_todos.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_dep_predecessor', 'pps_todo_dependencies', ['predecessor_id'])
    op.create_index('idx_dep_successor', 'pps_todo_dependencies', ['successor_id'])
    op.create_index('idx_dep_unique', 'pps_todo_dependencies', ['predecessor_id', 'successor_id'], unique=True)
    
    # 5. Create pps_conflicts table
    op.create_table(
        'pps_conflicts',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('conflict_type', sa.String(30), nullable=False),  # 'resource_overlap', 'calendar', 'dependency', 'delivery_date', 'qualification'
        sa.Column('todo_id', sa.Integer(), nullable=False),
        sa.Column('related_todo_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(10), nullable=False, default='warning'),  # 'warning', 'error'
        sa.Column('resolved', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['todo_id'], ['pps_todos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['related_todo_id'], ['pps_todos.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_conflict_todo', 'pps_conflicts', ['todo_id'])
    op.create_index('idx_conflict_unresolved', 'pps_conflicts', ['resolved'])
    op.create_index('idx_conflict_type', 'pps_conflicts', ['conflict_type'])
    
    # 6. Create pps_audit_log table
    op.create_table(
        'pps_audit_log',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('todo_id', sa.Integer(), nullable=True),  # nullable if todo was deleted
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('user_name', sa.String(50), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),  # 'create', 'update', 'delete', 'move', 'split', 'status_change'
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_audit_todo', 'pps_audit_log', ['todo_id'])
    op.create_index('idx_audit_action', 'pps_audit_log', ['action'])
    op.create_index('idx_audit_date', 'pps_audit_log', ['created_at'])


def downgrade():
    # Drop in reverse order
    op.drop_index('idx_audit_date', table_name='pps_audit_log')
    op.drop_index('idx_audit_action', table_name='pps_audit_log')
    op.drop_index('idx_audit_todo', table_name='pps_audit_log')
    op.drop_table('pps_audit_log')
    
    op.drop_index('idx_conflict_type', table_name='pps_conflicts')
    op.drop_index('idx_conflict_unresolved', table_name='pps_conflicts')
    op.drop_index('idx_conflict_todo', table_name='pps_conflicts')
    op.drop_table('pps_conflicts')
    
    op.drop_index('idx_dep_unique', table_name='pps_todo_dependencies')
    op.drop_index('idx_dep_successor', table_name='pps_todo_dependencies')
    op.drop_index('idx_dep_predecessor', table_name='pps_todo_dependencies')
    op.drop_table('pps_todo_dependencies')
    
    op.drop_index('idx_segment_times', table_name='pps_todo_segments')
    op.drop_index('idx_segment_todo', table_name='pps_todo_segments')
    op.drop_table('pps_todo_segments')
    
    op.drop_index('idx_todo_type', table_name='pps_todos')
    op.drop_index('idx_todo_delivery', table_name='pps_todos')
    op.drop_index('idx_todo_planned_dates', table_name='pps_todos')
    op.drop_index('idx_todo_status', table_name='pps_todos')
    op.drop_index('idx_todo_erp_order', table_name='pps_todos')
    op.drop_table('pps_todos')
    
    op.drop_index('idx_resource_active', table_name='pps_resource_cache')
    op.drop_index('idx_resource_type_erp', table_name='pps_resource_cache')
    op.drop_table('pps_resource_cache')
