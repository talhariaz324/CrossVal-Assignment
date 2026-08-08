-- Trigger-maintained caches on orders.order_total_cents and orders.amount_paid_cents.
--
-- Why: the payment-recording transaction (the concurrency-critical path) needs
-- to read "how much is left to pay" as a single indexed row read, not an
-- aggregate scan over line_items/payments while holding a row lock. These
-- triggers run inside the SAME transaction as the write that fired them, so
-- the cache is never stale relative to a committed transaction, and the
-- amount_paid_never_exceeds_total CHECK constraint (see 0000 migration) is
-- evaluated against the freshly-recomputed value at commit time.

CREATE OR REPLACE FUNCTION recompute_order_total_cents() RETURNS TRIGGER AS $$
DECLARE
  affected_order_id UUID;
BEGIN
  affected_order_id := COALESCE(NEW.order_id, OLD.order_id);

  UPDATE orders
  SET order_total_cents = COALESCE(
        (SELECT SUM(quantity * unit_price_cents) FROM line_items WHERE order_id = affected_order_id),
        0
      ),
      updated_at = now()
  WHERE id = affected_order_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_line_items_recompute_order_total
AFTER INSERT OR UPDATE OR DELETE ON line_items
FOR EACH ROW EXECUTE FUNCTION recompute_order_total_cents();

CREATE OR REPLACE FUNCTION recompute_order_amount_paid_cents() RETURNS TRIGGER AS $$
DECLARE
  affected_order_id UUID;
BEGIN
  affected_order_id := COALESCE(NEW.order_id, OLD.order_id);

  UPDATE orders
  SET amount_paid_cents = COALESCE(
        (SELECT SUM(amount_cents) FROM payments WHERE order_id = affected_order_id),
        0
      ),
      row_version = row_version + 1,
      updated_at = now()
  WHERE id = affected_order_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_recompute_amount_paid
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION recompute_order_amount_paid_cents();
