"""Product soft archival active status schema.

Revision ID: 0005_product_active_schema
Revises: 0004_risk_actions_schema
Create Date: 2026-09-23 19:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0005_product_active_schema'
down_revision: Union[str, None] = '0004_risk_actions_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False)
    )
    op.create_index(op.f('ix_products_is_active'), 'products', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_products_is_active'), table_name='products')
    with op.batch_alter_table('products') as batch_op:
        batch_op.drop_column('is_active')
