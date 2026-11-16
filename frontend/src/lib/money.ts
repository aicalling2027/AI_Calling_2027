/** Rupee formatting for anything a customer reads. */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Plain counts with Indian grouping: `20000` becomes `20,000`. */
export function formatCount(amount: number): string {
  return amount.toLocaleString("en-IN");
}

/** Whole rupees with Indian grouping: `14999` becomes `₹14,999`. */
export function formatInr(amount: number): string {
  return INR.format(amount);
}
