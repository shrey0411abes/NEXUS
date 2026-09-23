"""Initial schema representing NEXUS data layer with Numeric monetary precision.

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-31 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. businesses table
    op.create_table(
        'businesses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('industry', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. products table
    op.create_table(
        'products',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('sku', sa.String(length=100), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('unit_price >= 0', name='chk_product_unit_price'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'sku', name='uq_business_sku')
    )
    op.create_index(op.f('ix_products_business_id'), 'products', ['business_id'], unique=False)
    op.create_index(op.f('ix_products_sku'), 'products', ['sku'], unique=False)

    # 3. inventories table
    op.create_table(
        'inventories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('reorder_level', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('quantity >= 0', name='chk_inventory_quantity'),
        sa.CheckConstraint('reorder_level >= 0', name='chk_inventory_reorder_level'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id')
    )
    op.create_index(op.f('ix_inventories_product_id'), 'inventories', ['product_id'], unique=True)

    # 4. transactions table
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('business_id', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.String(length=50), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('transaction_date', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('total_amount >= 0', name='chk_transaction_total_amount'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_business_id'), 'transactions', ['business_id'], unique=False)
    op.create_index('ix_transactions_business_date_type', 'transactions', ['business_id', 'transaction_date', 'transaction_type'], unique=False)

    # 5. transaction_items table
    op.create_table(
        'transaction_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_transaction_item_quantity'),
        sa.CheckConstraint('unit_price >= 0', name='chk_transaction_item_unit_price'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transaction_items_product_id'), 'transaction_items', ['product_id'], unique=False)
    op.create_index(op.f('ix_transaction_items_transaction_id'), 'transaction_items', ['transaction_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_transaction_items_transaction_id'), table_name='transaction_items')
    op.drop_index(op.f('ix_transaction_items_product_id'), table_name='transaction_items')
    op.drop_table('transaction_items')
    op.drop_index('ix_transactions_business_date_type', table_name='transactions')
    op.drop_index(op.f('ix_transactions_business_id'), table_name='transactions')
    op.drop_table('transactions')
    op.drop_index(op.f('ix_inventories_product_id'), table_name='inventories')
    op.drop_table('inventories')
    op.drop_index(op.f('ix_products_sku'), table_name='products')
    op.drop_index(op.f('ix_products_business_id'), table_name='products')
    op.drop_table('products')
    op.drop_table('businesses')
