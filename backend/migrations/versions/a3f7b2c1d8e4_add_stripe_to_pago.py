"""add stripe fields to pago table

Revision ID: a3f7b2c1d8e4
Revises: bd9a37863492
Create Date: 2026-05-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a3f7b2c1d8e4'
down_revision = 'bd9a37863492'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'mysql':
        op.execute(
            "ALTER TABLE pago MODIFY COLUMN metodo "
            "ENUM('efectivo','transferencia','QR','otro','stripe') NOT NULL"
        )
    op.add_column('pago', sa.Column('stripe_payment_intent_id', sa.String(100), nullable=True))
    op.add_column('pago', sa.Column('stripe_status', sa.String(50), nullable=True))
    with op.batch_alter_table('pago', schema=None) as batch_op:
        batch_op.create_index('ix_pago_stripe_intent', ['stripe_payment_intent_id'], unique=True)


def downgrade():
    with op.batch_alter_table('pago', schema=None) as batch_op:
        batch_op.drop_index('ix_pago_stripe_intent')
    op.drop_column('pago', 'stripe_status')
    op.drop_column('pago', 'stripe_payment_intent_id')
    bind = op.get_bind()
    if bind.dialect.name == 'mysql':
        op.execute(
            "ALTER TABLE pago MODIFY COLUMN metodo "
            "ENUM('efectivo','transferencia','QR','otro') NOT NULL"
        )
