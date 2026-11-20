package com.retailpulse.pharmacy.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class GstCalculatorTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    @Test
    void fullStripAt12PercentSplitsTaxOutOfInclusivePrice() {
        GstCalculator.Line l = GstCalculator.price(bd("112.00"), 10, 10, bd("12"), BigDecimal.ZERO);
        assertEquals(bd("112.00"), l.gross());
        assertEquals(bd("100.00"), l.taxable());
        assertEquals(bd("6.00"), l.cgst());
        assertEquals(bd("6.00"), l.sgst());
        assertEquals(bd("112.00"), l.total());
        assertEquals(bd("11.2000"), l.unitPrice());
    }

    @Test
    void looseTabletsArePricedProRata() {
        GstCalculator.Line l = GstCalculator.price(bd("112.00"), 10, 5, bd("12"), BigDecimal.ZERO);
        assertEquals(bd("56.00"), l.total());
        assertEquals(bd("50.00"), l.taxable());
        assertEquals(bd("3.00"), l.cgst());
    }

    @Test
    void oddAmountsStillReconcileToThePaisa() {
        // MRP 28.83 per strip of 11: customer pays exactly MRP, never more
        GstCalculator.Line l = GstCalculator.price(bd("28.83"), 11, 11, bd("12"), BigDecimal.ZERO);
        assertEquals(bd("28.83"), l.total());
        assertEquals(bd("25.74"), l.taxable());
        assertEquals(bd("1.55"), l.cgst());
        assertEquals(bd("1.54"), l.sgst());
        assertEquals(l.total(), l.taxable().add(l.cgst()).add(l.sgst()));
    }

    @Test
    void discountIsTakenBeforeTaxIsSplit() {
        GstCalculator.Line l = GstCalculator.price(bd("100.00"), 1, 1, bd("5"), bd("10"));
        assertEquals(bd("10.00"), l.discount());
        assertEquals(bd("90.00"), l.total());
        assertEquals(bd("85.71"), l.taxable());
        assertEquals(l.total(), l.taxable().add(l.cgst()).add(l.sgst()));
    }

    @Test
    void zeroRatedItemHasNoTax() {
        GstCalculator.Line l = GstCalculator.price(bd("50.00"), 1, 2, BigDecimal.ZERO, BigDecimal.ZERO);
        assertEquals(bd("100.00"), l.taxable());
        assertEquals(bd("0.00"), l.cgst());
    }

    @Test
    void rejectsNonPositiveQuantity() {
        assertThrows(IllegalArgumentException.class, () -> GstCalculator.price(bd("10"), 10, 0, bd("12"), null));
        assertThrows(IllegalArgumentException.class, () -> GstCalculator.price(bd("10"), 10, -5, bd("12"), null));
    }
}
