package com.retailpulse.pharmacy.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.retailpulse.pharmacy.model.*;
import com.retailpulse.pharmacy.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
public class ReportService {

    @Autowired
    private SalesInvoiceRepository salesInvoiceRepository;

    @Autowired
    private InventoryBatchRepository batchRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private PurchaseInvoiceRepository purchaseInvoiceRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private AnalyticsService analyticsService;

    public ByteArrayInputStream generateSalesPdfReport(LocalDateTime start, LocalDateTime end, String title) {
        return generateSalesPdfReport(salesInvoiceRepository.findSalesInDateRange(start, end), title);
    }

    public ByteArrayInputStream generateSalesPdfReport(List<SalesInvoice> invoices, String title) {
        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {

            PdfWriter.getInstance(document, out);
            document.open();
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
            Font headFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10);

            Paragraph p = new Paragraph(title, titleFont);
            p.setAlignment(Paragraph.ALIGN_CENTER);
            p.setSpacingAfter(20);
            document.add(p);

            PdfPTable table = new PdfPTable(7);
            table.setWidthPercentage(100);
            table.setWidths(new int[]{3, 3, 2, 2, 2, 2, 2});
            for (String header : new String[]{"Invoice #", "Customer", "Date", "Taxable", "CGST", "SGST", "Grand Total"}) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headFont));
                cell.setBackgroundColor(Color.GRAY);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                table.addCell(cell);
            }
            BigDecimal totalSales = BigDecimal.ZERO;
            for (SalesInvoice invoice : invoices) {
                table.addCell(new Phrase(invoice.getInvoiceNumber(), bodyFont));
                table.addCell(new Phrase(invoice.getCustomer() != null ? invoice.getCustomer().getName() : "Walk-in", bodyFont));
                table.addCell(new Phrase(invoice.getSaleDateTime().toLocalDate().toString(), bodyFont));
                table.addCell(new Phrase(String.valueOf(invoice.getTotalTaxableAmount()), bodyFont));
                table.addCell(new Phrase(String.valueOf(invoice.getTotalCgst()), bodyFont));
                table.addCell(new Phrase(String.valueOf(invoice.getTotalSgst()), bodyFont));
                table.addCell(new Phrase(String.valueOf(invoice.getGrandTotal()), bodyFont));
                totalSales = totalSales.add(invoice.getGrandTotal());
            }
            document.add(table);
            document.add(new Paragraph("\nTotal Sales: Rs. " + totalSales, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12)));
            document.close();
        } catch (DocumentException ex) {
            throw new IllegalStateException("Could not generate PDF report", ex);
        }
        return new ByteArrayInputStream(out.toByteArray());
    }

    public ByteArrayInputStream generateStockPdfReport() {
        return generateSimpleTablePdf("Stock Remaining Report",
                new String[]{"Product", "Batch", "Strips", "Tablets", "Expiry", "MRP"},
                batchRepository.findByStripStockGreaterThanOrTabletStockGreaterThan(0, 0).stream()
                        .sorted(Comparator.comparing(b -> b.getProduct().getName()))
                        .map(b -> new String[]{
                                b.getProduct().getName(),
                                b.getBatchNumber(),
                                String.valueOf(b.getStripStock()),
                                String.valueOf(b.getTabletStock()),
                                String.valueOf(b.getExpiryDate()),
                                String.valueOf(b.getMrp())
                        }).toList());
    }

    public ByteArrayInputStream generateExpiryPdfReport() {
        return generateSimpleTablePdf("Expiry Report",
                new String[]{"Product", "Batch", "Expiry", "Strips", "Tablets"},
                batchRepository.findNearExpiryBatches(LocalDate.now(), LocalDate.now().plusMonths(3)).stream()
                        .map(b -> new String[]{
                                b.getProduct().getName(),
                                b.getBatchNumber(),
                                String.valueOf(b.getExpiryDate()),
                                String.valueOf(b.getStripStock()),
                                String.valueOf(b.getTabletStock())
                        }).toList());
    }

    public ByteArrayInputStream generateProfitLossPdfReport() {
        var summary = analyticsService.getAccountingSummary("month");
        return generateSimpleTablePdf("Profit & Loss Statement",
                new String[]{"Metric", "Amount (Rs.)"},
                List.of(
                        new String[]{"Taxable Sales", String.valueOf(summary.get("totalTaxable"))},
                        new String[]{"CGST", String.valueOf(summary.get("totalCgst"))},
                        new String[]{"SGST", String.valueOf(summary.get("totalSgst"))},
                        new String[]{"Grand Total", String.valueOf(summary.get("grandTotal"))},
                        new String[]{"Cost", String.valueOf(summary.get("totalCost"))},
                        new String[]{"Profit", String.valueOf(summary.get("profit"))}
                ));
    }

    public ByteArrayInputStream generatePurchasePdfReport() {
        return generateSimpleTablePdf("Purchase Report",
                new String[]{"Invoice", "Supplier", "Date", "Amount", "Status"},
                purchaseInvoiceRepository.findAll().stream()
                        .map(pi -> new String[]{
                                pi.getInvoiceNumber(),
                                pi.getSupplier() != null ? pi.getSupplier().getName() : "",
                                String.valueOf(pi.getPurchaseDate()),
                                String.valueOf(pi.getTotalAmount()),
                                pi.getStatus()
                        }).toList());
    }

    public ByteArrayInputStream generateMedicinesPdfReport() {
        return generateSimpleTablePdf("Alphabetical Medicines List",
                new String[]{"Name", "Generic", "Company", "HSN", "Strip Size", "Reorder"},
                productRepository.findAllByOrderByNameAsc().stream()
                        .map(p -> new String[]{
                                p.getName(),
                                p.getGenericName() != null ? p.getGenericName() : "",
                                p.getCompany() != null ? p.getCompany() : "",
                                p.getHsnCode(),
                                String.valueOf(p.getStripSize()),
                                String.valueOf(p.getReorderLevel())
                        }).toList());
    }

    public String generateGstCsv(LocalDateTime start, LocalDateTime end) {
        StringWriter sw = new StringWriter();
        PrintWriter w = new PrintWriter(sw);
        w.println("Invoice,Date,Taxable,CGST,SGST,Grand Total");
        for (SalesInvoice inv : salesInvoiceRepository.findSalesInDateRange(start, end)) {
            w.printf("%s,%s,%s,%s,%s,%s%n",
                    inv.getInvoiceNumber(),
                    inv.getSaleDateTime().toLocalDate(),
                    inv.getTotalTaxableAmount(),
                    inv.getTotalCgst(),
                    inv.getTotalSgst(),
                    inv.getGrandTotal());
        }
        w.flush();
        return sw.toString();
    }

    private ByteArrayInputStream generateSimpleTablePdf(String title, String[] headers, List<String[]> rows) {
        Document document = new Document(PageSize.A4);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(document, out);
            document.open();
            document.add(new Paragraph(title, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16)));
            document.add(Chunk.NEWLINE);
            PdfPTable table = new PdfPTable(headers.length);
            table.setWidthPercentage(100);
            Font headFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9);
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, headFont));
                cell.setBackgroundColor(Color.DARK_GRAY);
                table.addCell(cell);
            }
            for (String[] row : rows) {
                for (String col : row) {
                    table.addCell(new Phrase(col != null ? col : "", bodyFont));
                }
            }
            document.add(table);
            document.close();
        } catch (DocumentException e) {
            throw new IllegalStateException("Could not generate PDF report", e);
        }
        return new ByteArrayInputStream(out.toByteArray());
    }
}
