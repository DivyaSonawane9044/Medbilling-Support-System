package com.retailpulse.pharmacy.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Line pricing for retail medicine sales in India.
 *
 * Selling prices are GST-inclusive (MRP basis), so tax is back-calculated:
 *   gross   = packPrice x units / unitsPerPack           (rounded to paise)
 *   net     = gross - discount                           (the amount the customer pays)
 *   taxable = net x 100 / (100 + gstRate)
 *   CGST    = (net - taxable) / 2,  SGST = remainder     (so CGST + SGST + taxable == net exactly)
 */
public final class GstCalculator {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private GstCalculator() {
    }

    public record Line(BigDecimal unitPrice, BigDecimal gross, BigDecimal discount, BigDecimal taxable,
            BigDecimal cgst, BigDecimal sgst, BigDecimal total) {
    }

    public static Line price(BigDecimal packPrice, int unitsPerPack, int units, BigDecimal gstRatePercent,
            BigDecimal discountPercent) {
        if (packPrice == null || packPrice.signum() < 0) {
            throw new IllegalArgumentException("Price must be zero or more");
        }
        if (unitsPerPack <= 0 || units <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than zero");
        }
        BigDecimal rate = gstRatePercent == null ? BigDecimal.ZERO : gstRatePercent;
        BigDecimal disc = discountPercent == null ? BigDecimal.ZERO : discountPercent;

        BigDecimal unitPrice = packPrice.divide(BigDecimal.valueOf(unitsPerPack), 4, RoundingMode.HALF_UP);
        BigDecimal gross = packPrice.multiply(BigDecimal.valueOf(units))
                .divide(BigDecimal.valueOf(unitsPerPack), 2, RoundingMode.HALF_UP);
        BigDecimal discount = gross.multiply(disc).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(discount);
        BigDecimal taxable = net.multiply(HUNDRED).divide(HUNDRED.add(rate), 2, RoundingMode.HALF_UP);
        BigDecimal tax = net.subtract(taxable);
        BigDecimal cgst = tax.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        BigDecimal sgst = tax.subtract(cgst);
        return new Line(unitPrice, gross, discount, taxable, cgst, sgst, net);
    }
}
