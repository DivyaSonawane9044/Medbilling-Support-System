package com.retailpulse.pharmacy.service;

import com.retailpulse.pharmacy.dto.DashboardDTO;
import com.retailpulse.pharmacy.model.*;
import com.retailpulse.pharmacy.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    @Autowired
    private SalesInvoiceRepository salesInvoiceRepository;

    @Autowired
    private InventoryBatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private PurchaseInvoiceRepository purchaseInvoiceRepository;

    public DashboardDTO getDashboardMetrics() {
        DashboardDTO dto = new DashboardDTO();

        BigDecimal todayRevenue = salesInvoiceRepository.getTotalRevenueForDate(LocalDate.now());
        dto.setTodayRevenue(todayRevenue != null ? todayRevenue : BigDecimal.ZERO);

        BigDecimal yesterdayRevenue = salesInvoiceRepository.getTotalRevenueForDate(LocalDate.now().minusDays(1));
        dto.setYesterdayRevenue(yesterdayRevenue != null ? yesterdayRevenue : BigDecimal.ZERO);

        LocalDateTime startOfMonth = LocalDateTime.now().withDayOfMonth(1).with(LocalTime.MIN);
        LocalDateTime endOfMonth = LocalDateTime.now().withDayOfMonth(LocalDate.now().lengthOfMonth()).with(LocalTime.MAX);
        List<SalesInvoice> monthlySales = salesInvoiceRepository.findSalesInDateRange(startOfMonth, endOfMonth);
        dto.setMonthlyRevenue(monthlySales.stream().map(SalesInvoice::getGrandTotal).reduce(BigDecimal.ZERO, BigDecimal::add));

        LocalDateTime startOfToday = LocalDateTime.now().with(LocalTime.MIN);
        LocalDateTime endOfToday = LocalDateTime.now().with(LocalTime.MAX);
        List<SalesInvoice> todaySales = salesInvoiceRepository.findSalesInDateRange(startOfToday, endOfToday);

        BigDecimal todayProfit = BigDecimal.ZERO;
        BigDecimal todayCost = BigDecimal.ZERO;
        for (SalesInvoice invoice : todaySales) {
            for (SalesInvoiceItem item : invoice.getItems()) {
                if (item.getBatch() != null && item.getLineTotal() != null) {
                    int stripSize = Math.max(1, item.getBatch().getProduct().getStripSize());
                    BigDecimal costPerTablet = item.getBatch().getCostPrice()
                            .divide(new BigDecimal(stripSize), 4, RoundingMode.HALF_UP);
                    BigDecimal lineCost = costPerTablet.multiply(new BigDecimal(item.getQuantitySoldTablets()));
                    todayCost = todayCost.add(lineCost);
                    todayProfit = todayProfit.add(item.getLineTotal().subtract(lineCost));
                }
            }
        }
        dto.setProfit(todayProfit.setScale(2, RoundingMode.HALF_UP));
        dto.setTotalCost(todayCost.setScale(2, RoundingMode.HALF_UP));

        LocalDate threeMonthsFromNow = LocalDate.now().plusMonths(3);
        dto.setNearExpiryCount(batchRepository.findNearExpiryBatches(LocalDate.now(), threeMonthsFromNow).size());

        List<Product> products = productRepository.findAll();
        int lowStockCount = 0;
        BigDecimal totalMrp = BigDecimal.ZERO;
        BigDecimal totalStockCost = BigDecimal.ZERO;

        for (Product p : products) {
            long totalTablets = 0;
            for (InventoryBatch b : batchRepository.findAllBatchesForProductForSale(p.getProductId())) {
                int batchTablets = (b.getStripStock() * p.getStripSize()) + b.getTabletStock();
                totalTablets += batchTablets;
                if (batchTablets > 0) {
                    int stripSize = Math.max(1, p.getStripSize());
                    totalMrp = totalMrp.add(b.getMrp().divide(new BigDecimal(stripSize), 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal(batchTablets)));
                    totalStockCost = totalStockCost.add(b.getCostPrice().divide(new BigDecimal(stripSize), 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal(batchTablets)));
                }
            }
            if (p.getReorderLevel() != null && totalTablets <= p.getReorderLevel()) {
                lowStockCount++;
            }
        }
        dto.setLowStockCount(lowStockCount);
        dto.setTotalStockValueMrp(totalMrp.setScale(2, RoundingMode.HALF_UP));
        dto.setTotalStockValueCost(totalStockCost.setScale(2, RoundingMode.HALF_UP));

        dto.setBestSellingMedicines(computeBestSellers(monthlySales));
        dto.setTopCustomers(computeTopCustomers(monthlySales));
        dto.setTopSuppliers(computeTopSuppliers());
        dto.setProfitLossPie(buildProfitPie(dto.getTodayRevenue(), dto.getTotalCost(), dto.getProfit()));
        dto.setSalesTrend(computeSalesTrend(7));

        return dto;
    }

    private List<Map<String, Object>> computeBestSellers(List<SalesInvoice> invoices) {
        Map<String, Long> qtyByProduct = new HashMap<>();
        Map<String, String> nameByKey = new HashMap<>();
        for (SalesInvoice inv : invoices) {
            for (SalesInvoiceItem item : inv.getItems()) {
                if (item.getBatch() == null || item.getBatch().getProduct() == null) continue;
                Product p = item.getBatch().getProduct();
                String key = String.valueOf(p.getProductId());
                qtyByProduct.merge(key, (long) item.getQuantitySoldTablets(), Long::sum);
                nameByKey.put(key, p.getName());
            }
        }
        return qtyByProduct.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(5)
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", nameByKey.get(e.getKey()));
                    m.put("quantity", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> computeTopCustomers(List<SalesInvoice> invoices) {
        Map<Long, BigDecimal> spend = new HashMap<>();
        Map<Long, String> names = new HashMap<>();
        for (SalesInvoice inv : invoices) {
            if (inv.getCustomer() == null) continue;
            Long id = inv.getCustomer().getCustomerId();
            spend.merge(id, inv.getGrandTotal(), BigDecimal::add);
            names.put(id, inv.getCustomer().getName());
        }
        return spend.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", names.get(e.getKey()));
                    m.put("totalSpend", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> computeTopSuppliers() {
        Map<Long, BigDecimal> totals = new HashMap<>();
        Map<Long, String> names = new HashMap<>();
        for (PurchaseInvoice pi : purchaseInvoiceRepository.findAll()) {
            if (pi.getSupplier() == null) continue;
            Long sid = pi.getSupplier().getSupplierId();
            totals.merge(sid, pi.getTotalAmount() != null ? pi.getTotalAmount() : BigDecimal.ZERO, BigDecimal::add);
            names.put(sid, pi.getSupplier().getName());
        }
        return totals.entrySet().stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue()))
                .limit(5)
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("name", names.get(e.getKey()));
                    m.put("totalPurchase", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildProfitPie(BigDecimal revenue, BigDecimal cost, BigDecimal profit) {
        List<Map<String, Object>> pie = new ArrayList<>();
        Map<String, Object> costSlice = new HashMap<>();
        costSlice.put("name", "Cost");
        costSlice.put("value", cost != null ? cost : BigDecimal.ZERO);
        pie.add(costSlice);
        Map<String, Object> profitSlice = new HashMap<>();
        profitSlice.put("name", "Profit");
        profitSlice.put("value", profit != null ? profit.max(BigDecimal.ZERO) : BigDecimal.ZERO);
        pie.add(profitSlice);
        return pie;
    }

    private List<Map<String, Object>> computeSalesTrend(int days) {
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusDays(i);
            BigDecimal rev = salesInvoiceRepository.getTotalRevenueForDate(d);
            Map<String, Object> point = new HashMap<>();
            point.put("date", d.toString());
            point.put("revenue", rev != null ? rev : BigDecimal.ZERO);
            trend.add(point);
        }
        return trend;
    }

    public List<Product> getProductsBelowThreshold(double thresholdPercentage) {
        return productRepository.findAll().stream()
                .filter(p -> {
                    if (p.getTargetStockLevel() == null || p.getTargetStockLevel() == 0) return false;
                    long currentTablets = batchRepository.findAllBatchesForProductForSale(p.getProductId()).stream()
                            .mapToLong(b -> (long) b.getStripStock() * p.getStripSize() + b.getTabletStock())
                            .sum();
                    double currentPercentage = (double) currentTablets / p.getTargetStockLevel() * 100.0;
                    return currentPercentage <= thresholdPercentage;
                })
                .collect(Collectors.toList());
    }

    public Map<String, Object> getAccountingSummary(String period) {
        LocalDateTime start;
        LocalDateTime end = LocalDateTime.now();
        if ("year".equalsIgnoreCase(period)) {
            start = end.withDayOfYear(1).with(LocalTime.MIN);
        } else if ("month".equalsIgnoreCase(period)) {
            start = end.withDayOfMonth(1).with(LocalTime.MIN);
        } else {
            start = end.with(LocalTime.MIN);
        }
        List<SalesInvoice> sales = salesInvoiceRepository.findSalesInDateRange(start, end);
        BigDecimal taxable = BigDecimal.ZERO;
        BigDecimal cgst = BigDecimal.ZERO;
        BigDecimal sgst = BigDecimal.ZERO;
        BigDecimal grand = BigDecimal.ZERO;
        BigDecimal cost = BigDecimal.ZERO;
        for (SalesInvoice inv : sales) {
            taxable = taxable.add(inv.getTotalTaxableAmount() != null ? inv.getTotalTaxableAmount() : BigDecimal.ZERO);
            cgst = cgst.add(inv.getTotalCgst() != null ? inv.getTotalCgst() : BigDecimal.ZERO);
            sgst = sgst.add(inv.getTotalSgst() != null ? inv.getTotalSgst() : BigDecimal.ZERO);
            grand = grand.add(inv.getGrandTotal() != null ? inv.getGrandTotal() : BigDecimal.ZERO);
            for (SalesInvoiceItem item : inv.getItems()) {
                if (item.getBatch() != null) {
                    int stripSize = Math.max(1, item.getBatch().getProduct().getStripSize());
                    BigDecimal cpt = item.getBatch().getCostPrice().divide(new BigDecimal(stripSize), 4, RoundingMode.HALF_UP);
                    cost = cost.add(cpt.multiply(new BigDecimal(item.getQuantitySoldTablets())));
                }
            }
        }
        Map<String, Object> summary = new HashMap<>();
        summary.put("period", period);
        summary.put("invoiceCount", sales.size());
        summary.put("totalTaxable", taxable);
        summary.put("totalCgst", cgst);
        summary.put("totalSgst", sgst);
        summary.put("totalGst", cgst.add(sgst));
        summary.put("grandTotal", grand);
        summary.put("totalCost", cost);
        summary.put("profit", grand.subtract(cost));
        return summary;
    }
}
