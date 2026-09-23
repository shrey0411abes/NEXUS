"""Risk action audit persistence schema.

Revision ID: 0004_risk_actions_schema
Revises: 0003_investigations_schema
Create Date: 2026-09-18 17:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004_risk_actions_schema'
down_revision: Union[str, None] = '0003_investigations_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'risk_actions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('risk_fingerprint', sa.String(length=64), nullable=False),
        sa.Column('risk_category', sa.String(length=50), nullable=False),
        sa.Column('state', sa.String(length=20), nullable=False),
        sa.Column('action_note', sa.String(length=1000), nullable=True),
        sa.Column('metrics_snapshot', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "state IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')",
            name='chk_risk_action_state'
        ),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_risk_actions_business_id'), 'risk_actions', ['business_id'], unique=False)
    op.create_index(op.f('ix_risk_actions_user_id'), 'risk_actions', ['user_id'], unique=False)
    op.create_index(op.f('ix_risk_actions_product_id'), 'risk_actions', ['product_id'], unique=False)
    op.create_index(op.f('ix_risk_actions_risk_fingerprint'), 'risk_actions', ['risk_fingerprint'], unique=False)
    op.create_index('ix_risk_actions_biz_fp_created', 'risk_actions', ['business_id', 'risk_fingerprint', 'created_at'], unique=False)
    op.create_index('ix_risk_actions_biz_state', 'risk_actions', ['business_id', 'state'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_risk_actions_biz_state', table_name='risk_actions')
    op.drop_index('ix_risk_actions_biz_fp_created', table_name='risk_actions')
    op.drop_index(op.f('ix_risk_actions_risk_fingerprint'), table_name='risk_actions')
    op.drop_index(op.f('ix_risk_actions_product_id'), table_name='risk_actions')
    op.drop_index(op.f('ix_risk_actions_user_id'), table_name='risk_actions')
    op.drop_index(op.f('ix_risk_actions_business_id'), table_name='risk_actions')
    op.drop_table('risk_actions')
