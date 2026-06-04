const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise = null;

export function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay));
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Opens Razorpay checkout or resolves immediately in mock/demo mode.
 */
export async function openRazorpayCheckout({ order, invoiceId, customerName, onSuccess }) {
  if (order.mock) {
    const mockPaymentId = `pay_mock_${Date.now()}`;
    await onSuccess({
      razorpay_order_id: order.orderId,
      razorpay_payment_id: mockPaymentId,
      razorpay_signature: "mock_signature_dev",
      invoice_id: String(invoiceId),
    });
    return;
  }

  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "Medbilling Pharmacy",
      description: `Invoice payment #${invoiceId}`,
      order_id: order.orderId,
      prefill: { name: customerName || "Customer" },
      theme: { color: "#0d9488" },
      handler: async (response) => {
        try {
          await onSuccess({
            ...response,
            invoice_id: String(invoiceId),
          });
          resolve(response);
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", (resp) => {
      reject(new Error(resp.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}
