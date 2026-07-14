-- Retiro de pasarelas (MP/Lemon Squeezy/Wompi) -> PayU: limpieza de esquema.

-- 1) Columna de retiro agnóstica de proveedor (era 'mp_payout_ref' por Mercado Pago).
ALTER TABLE "public"."retiros" RENAME COLUMN "mp_payout_ref" TO "payout_ref";

-- 2) Los medios granulares de Wompi (nequi/pse/tarjeta) nunca se escribieron; la
--    app solo guarda 'efectivo' u 'online'. Apretamos el CHECK.
ALTER TABLE "public"."pagos" DROP CONSTRAINT "pagos_medio_check";
ALTER TABLE "public"."pagos" ADD CONSTRAINT "pagos_medio_check"
  CHECK ("medio" = ANY (ARRAY['efectivo'::"text", 'online'::"text"]));
