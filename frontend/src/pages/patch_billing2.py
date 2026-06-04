from pathlib import Path
path = Path('Billing.jsx')
text = path.read_text(encoding='utf-8')
old = '''  function handlePrint() {
    if (items.length === 0) {
      alert('No items to print. Add items first.');
      return;
    }

    const itemsForPrint = arguments.length > 0 && Array.isArray(arguments[0]) ? arguments[0] : items;
    const payload = {
      invoiceId: null,
      customerName,
      contactNumber,
      doctorName,
      items: itemsForPrint.map((it) => ({ name: it.name, qty: it.mode === 'strip' ? it.qtyStrips + ' strip(s)' : it.qtyTablets + ' tab(s)', taxable: it.taxable, cgst: it.cgst, sgst: it.sgst, total: it.total })),
      totals,
      createdAt: new Date().toLocaleString('en-IN'),
    };
    setPrintData(payload);
  }

  async function exportPdf() {
    if (items.length === 0) {
      alert('No items to export. Add items first.');
      return;
    }

    // Ensure printData exists for invoice content
    if (!printData) {
      handlePrint();
      // wait for printData set and DOM render
      await new Promise((r) => setTimeout(r, 300));
    }

    const el = document.getElementById('print-area');
    if (!el) {
      alert('Printable area not ready. Try again.');
      return;
    }

    const clone = el.cloneNode(true);
    clone.querySelectorAll('img').forEach((img) => img.remove());
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.visibility = 'visible';
    clone.style.pointerEvents = 'none';
    clone.style.width = '800px';
    clone.style.maxWidth = '800px';
    clone.style.backgroundColor = '#ffffff';
    clone.style.display = 'block';
    document.body.appendChild(clone);

    try {
      await new Promise((r) => setTimeout(r, 100));
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const fileName = `invoice_${printData.invoiceId || 'preview'}.pdf`;
      await pdf.html(clone, {
        x: 10,
        y: 10,
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        },
        callback: () => {
          pdf.save(fileName);
        },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF: ' + (err.message || err));
    } finally {
      document.body.removeChild(clone);
    }
  }
'''
new = '''  function handlePrint() {
    if (items.length === 0) {
      alert('No items to print. Add items first.');
      return;
    }

    const payload = buildPrintData();
    setPrintData(payload);
    return payload;
  }

  async function exportPdf() {
    if (items.length === 0) {
      alert('No items to export. Add items first.');
      return;
    }

    let payload = printData;
    if (!payload || payload.items.length === 0) {
      payload = buildPrintData();
      setPrintData(payload);
      await new Promise((r) => setTimeout(r, 200));
    }

    const el = document.getElementById('print-area');
    if (!el) {
      alert('Printable area not ready. Try again.');
      return;
    }

    const clone = el.cloneNode(true);
    clone.querySelectorAll('img').forEach((img) => img.remove());
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.visibility = 'visible';
    clone.style.pointerEvents = 'none';
    clone.style.width = '800px';
    clone.style.maxWidth = '800px';
    clone.style.backgroundColor = '#ffffff';
    clone.style.display = 'block';
    clone.style.boxSizing = 'border-box';
    document.body.appendChild(clone);

    try {
      await new Promise((r) => setTimeout(r, 100));
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const fileName = `invoice_${payload.invoiceId || 'preview'}.pdf`;
      await pdf.html(clone, {
        x: 10,
        y: 10,
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        },
        callback: () => {
          pdf.save(fileName);
        },
      });
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF: ' + (err.message || err));
    } finally {
      document.body.removeChild(clone);
    }
  }
'''
if old not in text:
    raise SystemExit('Old block not found')
path.write_text(text.replace(old, new), encoding='utf-8')
print('updated handlePrint and exportPdf')
