"""add_mobile_sensor_columns

Adds mobile idempotency fields to sensor_readings and creates 3 new tables:
  - mobile_gps_sessions
  - mobile_activity_sessions
  - mobile_sensor_features

Revision ID: a1b2c3d4e5f6
Revises: fc02bc217854
Create Date: 2026-09-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fc02bc217854'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add mobile sensor columns to sensor_readings and create 3 new mobile tables."""

    # ── sensor_readings: additive columns for mobile idempotency ──────────────
    with op.batch_alter_table('sensor_readings', schema=None) as batch_op:
        # Idempotency
        batch_op.add_column(sa.Column('device_id', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('source_record_id', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('source_record_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('is_estimated', sa.Boolean(), nullable=False, server_default='false'))
        # Measurement window
        batch_op.add_column(sa.Column('start_time', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('end_time', sa.DateTime(timezone=True), nullable=True))
        # Updated at
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))
        # Indexes
        batch_op.create_index('ix_sensor_device_id', ['device_id'], unique=False)
        batch_op.create_index('ix_sensor_source_record_id', ['source_record_id'], unique=False)
        batch_op.create_index('ix_sensor_source_record_hash', ['source_record_hash'], unique=False)
        batch_op.create_index('ix_sensor_user_timestamp', ['user_id', 'timestamp'], unique=False)
        batch_op.create_index('ix_sensor_user_source', ['user_id', 'data_source'], unique=False)
        # Unique constraint for idempotency
        batch_op.create_unique_constraint('uq_sensor_user_source_record', ['user_id', 'source_record_id'])

    # ── mobile_gps_sessions ──────────────────────────────────────────────────
    op.create_table(
        'mobile_gps_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('device_id', sa.String(length=255), nullable=True, index=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('distance_meters', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('average_speed_ms', sa.Float(), nullable=True),
        sa.Column('max_speed_ms', sa.Float(), nullable=True),
        sa.Column('route_point_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('source_record_id', sa.String(length=255), nullable=True),
        sa.Column('source_record_hash', sa.String(length=64), nullable=True),
        sa.Column('data_source', sa.String(length=50), nullable=False, server_default='gps'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('user_id', 'source_record_id', name='uq_gps_user_source_record'),
    )
    op.create_index('ix_gps_user_start', 'mobile_gps_sessions', ['user_id', 'start_time'], unique=False)

    # ── mobile_activity_sessions ──────────────────────────────────────────────
    op.create_table(
        'mobile_activity_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('device_id', sa.String(length=255), nullable=True, index=True),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('confidence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('steps', sa.Integer(), nullable=True),
        sa.Column('distance_meters', sa.Float(), nullable=True),
        sa.Column('calories', sa.Float(), nullable=True),
        sa.Column('source_record_id', sa.String(length=255), nullable=True),
        sa.Column('source_record_hash', sa.String(length=64), nullable=True),
        sa.Column('data_source', sa.String(length=50), nullable=False, server_default='activity_recognition'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('user_id', 'source_record_id', name='uq_activity_user_source_record'),
    )
    op.create_index('ix_activity_user_start', 'mobile_activity_sessions', ['user_id', 'start_time'], unique=False)

    # ── mobile_sensor_features ────────────────────────────────────────────────
    op.create_table(
        'mobile_sensor_features',
        sa.Column('id', sa.Integer(), primary_key=True, index=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('device_id', sa.String(length=255), nullable=True, index=True),
        sa.Column('sensor_type', sa.String(length=50), nullable=False),
        sa.Column('window_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('window_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('window_size_ms', sa.Integer(), nullable=True),
        sa.Column('mean_x', sa.Float(), nullable=True),
        sa.Column('mean_y', sa.Float(), nullable=True),
        sa.Column('mean_z', sa.Float(), nullable=True),
        sa.Column('std_x', sa.Float(), nullable=True),
        sa.Column('std_y', sa.Float(), nullable=True),
        sa.Column('std_z', sa.Float(), nullable=True),
        sa.Column('magnitude_mean', sa.Float(), nullable=True),
        sa.Column('magnitude_std', sa.Float(), nullable=True),
        sa.Column('movement_intensity', sa.Float(), nullable=True),
        sa.Column('source_record_id', sa.String(length=255), nullable=True),
        sa.Column('source_record_hash', sa.String(length=64), nullable=True),
        sa.Column('data_source', sa.String(length=50), nullable=False, server_default='android_sensor'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('user_id', 'source_record_id', name='uq_features_user_source_record'),
    )
    op.create_index('ix_features_user_window', 'mobile_sensor_features', ['user_id', 'window_start'], unique=False)


def downgrade() -> None:
    """Revert Phase 2 mobile sensor additions."""
    # Drop new tables
    op.drop_table('mobile_sensor_features')
    op.drop_table('mobile_activity_sessions')
    op.drop_table('mobile_gps_sessions')

    # Remove columns from sensor_readings
    with op.batch_alter_table('sensor_readings', schema=None) as batch_op:
        batch_op.drop_constraint('uq_sensor_user_source_record', type_='unique')
        batch_op.drop_index('ix_sensor_user_source')
        batch_op.drop_index('ix_sensor_user_timestamp')
        batch_op.drop_index('ix_sensor_source_record_hash')
        batch_op.drop_index('ix_sensor_source_record_id')
        batch_op.drop_index('ix_sensor_device_id')
        batch_op.drop_column('updated_at')
        batch_op.drop_column('end_time')
        batch_op.drop_column('start_time')
        batch_op.drop_column('is_estimated')
        batch_op.drop_column('source_record_hash')
        batch_op.drop_column('source_record_id')
        batch_op.drop_column('device_id')
