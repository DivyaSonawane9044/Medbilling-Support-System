const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise = null;

export function loadRazorpayScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Failed to load Razorpay checkout. Check the internet connection."));
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export class CheckoutDismissed extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "CheckoutDismissed";
  }
}

/**
 * Opens the real Razorpay checkout for a server-created order. The payment only
 * counts once the backend has verified the signature (onSuccess must call it).
 * onFailure is called for failed or dismissed checkouts so the server can record it.
 * There is deliberately no mock/demo path.
 */
export async function openRazorpayCheckout({ order, shopName, description, customerName, onSuccess, onFailure }) {
  const Razorpay = await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err, reason) => {
      if (settled) return;
      settled = true;
      Promise.resolve(onFailure?.(reason)).finally(() => reject(err));
    };

    const rzp = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: shopName || "Pharmacy",
      description,
      order_id: order.orderId,
      prefill: { name: customerName || "" },
      theme: { color: "#0b8276" }, // --mb-teal-700
      handler: async (response) => {
        settled = true;
        try {
          resolve(await onSuccess(response));
        } catch (err) {
          reject(err);
        }
      },
      modal: { ondismiss: () => fail(new CheckoutDismissed(), "checkout dismissed") },
    });
    rzp.on("payment.failed", (resp) => {
      const reason = resp.error?.description || "Payment failed";
      fail(new Error(reason), reason);
    });
    rzp.open();
  });
}
