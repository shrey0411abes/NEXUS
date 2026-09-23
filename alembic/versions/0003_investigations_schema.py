"""Investigation audit persistence schema.

Revision ID: 0003_investigations_schema
Revises: 0002_user_auth_schema
Create Date: 2026-09-09 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0003_investigations_schema'
down_revision: Union[str, None] = '0002_user_auth_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'investigations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('question', sa.String(length=2000), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('confidence', sa.String(length=20), nullable=False),
        sa.Column('verification_status', sa.String(length=20), nullable=False),
        sa.Column('context_snapshot', sa.JSON(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('execution_duration_ms', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_investigations_business_id'), 'investigations', ['business_id'], unique=False)
    op.create_index(op.f('ix_investigations_user_id'), 'investigations', ['user_id'], unique=False)
    op.create_index('ix_investigations_business_created', 'investigations', ['business_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_investigations_business_created', table_name='investigations')
    op.drop_index(op.f('ix_investigations_user_id'), table_name='investigations')
    op.drop_index(op.f('ix_investigations_business_id'), table_name='investigations')
    op.drop_table('investigations')
