import { forwardRef } from "react";

interface SaleItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

interface InvoiceProps {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  pharmacyName?: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
}

/**
 * Thermal receipt optimized for 72mm paper width (effective print area ~64mm)
 * Compatible with 203dpi thermal printers, 250mm/s print speed
 * Paper roll: 79.5mm±0.5mm backing, 80mm OD
 * Supports CODE128 barcode format (primary) and all listed formats via JsBarcode
 */
export const InvoicePrint = forwardRef<HTMLDivElement, InvoiceProps>(
  ({ invoiceNumber, date, customerName, customerPhone, items, subtotal, discount, vat, total, paymentMethod, pharmacyName, pharmacyPhone, pharmacyAddress }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white text-black font-mono"
        style={{
          width: "72mm",
          maxWidth: "72mm",
          padding: "2mm 3mm",
          fontSize: "9pt",
          lineHeight: "1.3",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "3mm", marginBottom: "2mm" }}>
          <div style={{ fontSize: "12pt", fontWeight: "bold", marginBottom: "1mm" }}>
            {pharmacyName || "Medsuite-eT Pharmacy"}
          </div>
          {pharmacyAddress && <div style={{ fontSize: "7pt" }}>{pharmacyAddress}</div>}
          {pharmacyPhone && <div style={{ fontSize: "7pt" }}>Tel: {pharmacyPhone}</div>}
        </div>

        {/* Invoice Info */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8pt", marginBottom: "1mm" }}>
          <span>Inv: {invoiceNumber}</span>
          <span>{date}</span>
        </div>
        <div style={{ fontSize: "8pt", marginBottom: "1mm" }}>
          Customer: {customerName}
        </div>
        {customerPhone && <div style={{ fontSize: "8pt", marginBottom: "1mm" }}>Phone: {customerPhone}</div>}

        <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

        {/* Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #666" }}>
              <th style={{ textAlign: "left", padding: "1px 0", width: "45%" }}>Item</th>
              <th style={{ textAlign: "center", padding: "1px 0", width: "12%" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "1px 0", width: "20%" }}>Price</th>
              <th style={{ textAlign: "right", padding: "1px 0", width: "23%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: "1px 2px 1px 0", maxWidth: "28mm", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </td>
                <td style={{ textAlign: "center", padding: "1px 0" }}>{item.qty}</td>
                <td style={{ textAlign: "right", padding: "1px 0" }}>৳{item.price.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "1px 0" }}>৳{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px dashed #000", margin: "2mm 0" }} />

        {/* Totals */}
        <div style={{ fontSize: "8pt" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span><span>৳{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Discount</span><span>-৳{discount.toFixed(2)}</span>
            </div>
          )}
          {vat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>VAT (5%)</span><span>৳{vat.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "10pt", borderTop: "1px solid #000", paddingTop: "1mm", marginTop: "1mm" }}>
            <span>TOTAL</span><span>৳{total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ fontSize: "8pt", marginTop: "1mm" }}>Payment: {paymentMethod.toUpperCase()}</div>

        {/* Footer */}
        <div style={{ textAlign: "center", borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "3mm", fontSize: "7pt" }}>
          <div>Thank you for your purchase!</div>
          <div style={{ fontSize: "6pt", marginTop: "1mm" }}>Powered by Medsuite-eT — engineerstechbd.com</div>
        </div>
      </div>
    );
  }
);

InvoicePrint.displayName = "InvoicePrint";
