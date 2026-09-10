// Formatting / date helpers — shared across pages.

export const CURRENCY = "₹";

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "credit_card", label: "Credit card" },
  { value: "debit_card", label: "Debit card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "wallet", label: "Wallet" },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills",
  "Entertainment", "Health", "Education", "Other",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Salary", "Freelance", "Business", "Investment", "Gift", "Other",
];

export const money = (n) =>
  CURRENCY + Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// LOCAL date string — toISOString() is UTC and reports yesterday
// between midnight and 5:30 AM in IST.
export const localISO = (d = new Date()) =>
  d.getFullYear() + "-" +
  String(d.getMonth() + 1).padStart(2, "0") + "-" +
  String(d.getDate()).padStart(2, "0");

export const todayISO = () => localISO();

export const monthBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: localISO(start), end: localISO(end) };
};

export const formatDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
