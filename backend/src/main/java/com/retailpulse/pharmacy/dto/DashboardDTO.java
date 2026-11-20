package com.retailpulse.pharmacy.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class DashboardDTO {
    private BigDecimal todayRevenue;
    private BigDecimal yesterdayRevenue;
    private BigDecimal monthlyRevenue;
    private BigDecimal monthlyProfit;
    private BigDecimal profit;
    private BigDecimal totalCost;
    private BigDecimal totalStockValueMrp;
    private BigDecimal totalStockValueCost;
    private int nearExpiryCount;
    private int lowStockCount;
    private List<Map<String, Object>> bestSellingMedicines = new ArrayList<>();
    private List<Map<String, Object>> topCustomers = new ArrayList<>();
    private List<Map<String, Object>> topSuppliers = new ArrayList<>();
    private List<Map<String, Object>> profitLossPie = new ArrayList<>();
    private List<Map<String, Object>> salesTrend = new ArrayList<>();

    public DashboardDTO() {
    }

    public BigDecimal getTodayRevenue() { return todayRevenue; }
    public void setTodayRevenue(BigDecimal todayRevenue) { this.todayRevenue = todayRevenue; }

    public BigDecimal getYesterdayRevenue() { return yesterdayRevenue; }
    public void setYesterdayRevenue(BigDecimal yesterdayRevenue) { this.yesterdayRevenue = yesterdayRevenue; }

    public BigDecimal getMonthlyProfit() { return monthlyProfit; }
    public void setMonthlyProfit(BigDecimal monthlyProfit) { this.monthlyProfit = monthlyProfit; }
    public BigDecimal getMonthlyRevenue() { return monthlyRevenue; }
    public void setMonthlyRevenue(BigDecimal monthlyRevenue) { this.monthlyRevenue = monthlyRevenue; }

    public BigDecimal getProfit() { return profit; }
    public void setProfit(BigDecimal profit) { this.profit = profit; }

    public BigDecimal getTotalCost() { return totalCost; }
    public void setTotalCost(BigDecimal totalCost) { this.totalCost = totalCost; }

    public BigDecimal getTotalStockValueMrp() { return totalStockValueMrp; }
    public void setTotalStockValueMrp(BigDecimal totalStockValueMrp) { this.totalStockValueMrp = totalStockValueMrp; }

    public BigDecimal getTotalStockValueCost() { return totalStockValueCost; }
    public void setTotalStockValueCost(BigDecimal totalStockValueCost) { this.totalStockValueCost = totalStockValueCost; }

    public int getNearExpiryCount() { return nearExpiryCount; }
    public void setNearExpiryCount(int nearExpiryCount) { this.nearExpiryCount = nearExpiryCount; }

    public int getLowStockCount() { return lowStockCount; }
    public void setLowStockCount(int lowStockCount) { this.lowStockCount = lowStockCount; }

    public List<Map<String, Object>> getBestSellingMedicines() { return bestSellingMedicines; }
    public void setBestSellingMedicines(List<Map<String, Object>> bestSellingMedicines) { this.bestSellingMedicines = bestSellingMedicines; }

    public List<Map<String, Object>> getTopCustomers() { return topCustomers; }
    public void setTopCustomers(List<Map<String, Object>> topCustomers) { this.topCustomers = topCustomers; }

    public List<Map<String, Object>> getTopSuppliers() { return topSuppliers; }
    public void setTopSuppliers(List<Map<String, Object>> topSuppliers) { this.topSuppliers = topSuppliers; }

    public List<Map<String, Object>> getProfitLossPie() { return profitLossPie; }
    public void setProfitLossPie(List<Map<String, Object>> profitLossPie) { this.profitLossPie = profitLossPie; }

    public List<Map<String, Object>> getSalesTrend() { return salesTrend; }
    public void setSalesTrend(List<Map<String, Object>> salesTrend) { this.salesTrend = salesTrend; }
}
