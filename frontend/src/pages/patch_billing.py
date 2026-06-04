from pathlib import Path
path = Path('Billing.jsx')
text = path.read_text(encoding='utf-8')
old = '''  const buildPrintData = (overrideItems = items, invoiceIdOverride = None) => ({
    invoiceId: invoiceIdOverride if invoiceIdOverride is not None else (printData.get('invoiceId') if printData else None),
    customerName,
    contactNumber,
    doctorName,
    items: [
      {
        'name': it['name'],
        'qty': f"{it['qtyStrips']} strip(s)" if it['mode'] == 'strip' else f"{it['qtyTablets']} tab(s)",
        'taxable': it['taxable'],
        'cgst': it['cgst'],
        'sgst': it['sgst'],
        'total': it['total'],
      }
      for it in overrideItems
    ],
    totals,
    createdAt: new Date().toLocaleString('en-IN'),
  });

  useEffect(() => {
'''
new = '''  const buildPrintData = (overrideItems = items, invoiceIdOverride = null) => ({
    invoiceId: invoiceIdOverride ?? (printData?.invoiceId ?? null),
    customerName,
    contactNumber,
    doctorName,
    items: overrideItems.map((it) => ({
      name: it.name,
      qty: it.mode === 'strip' ? `${it.qtyStrips} strip(s)` : `${it.qtyTablets} tab(s)`,
      taxable: it.taxable,
      cgst: it.cgst,
      sgst: it.sgst,
      total: it.total,
    })),
    totals,
    createdAt: new Date().toLocaleString('en-IN'),
  });

  useEffect(() => {
'''
if old not in text:
    raise SystemExit('Old block not found')
path.write_text(text.replace(old, new), encoding='utf-8')
print('replaced bad block')
