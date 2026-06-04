from pathlib import Path
path = Path('Billing.jsx')
text = path.read_text(encoding='utf-8')
text = text.replace('import React, { useEffect, useMemo, useRef, useState } from "react";', 'import React, { useEffect, useMemo, useRef, useState } from "react";\nimport { flushSync } from "react-dom";')
old = '      payload = buildPrintData();\n      setPrintData(payload);\n      await new Promise((r) => setTimeout(r, 200));'
new = '      payload = buildPrintData();\n      flushSync(() => setPrintData(payload));\n      await new Promise((resolve) => requestAnimationFrame(resolve));'
if old not in text:
    raise SystemExit('Expected exportPdf snippet not found')
path.write_text(text.replace(old, new), encoding='utf-8')
print('sync flush patch applied')
