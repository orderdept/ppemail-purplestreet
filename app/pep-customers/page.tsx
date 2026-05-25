"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type OrderRow = {
  id: string;
  orderId: string;
  orderGroup: string;
  orderDate: string;
  sku: string;
  productName: string;
  dose: string;
  brand: string;
  qty: number;
  cost: number;
  price: number;
  profit: number;
  customerName: string;
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  email: string;
  customerId: string;
};

type OrderItem = {
  orderId: string;
  productName: string;
  dose: string;
  qty: number;
  sku: string;
};

type CustomerRow = OrderRow & {
  orderGroups: Set<string>;
  lineCount: number;
  revenue: number;
  totalProfit: number;
  lastOrder: string;
  items: OrderItem[];
};

const requiredColumns = {
  orderId: ["order_id", "orderid", "order"],
  orderDate: ["order_date", "date_created", "date"],
  sku: ["sku"],
  brand: ["brand"],
  qty: ["qty", "quantity"],
  cost: ["cost", "supplier_payout"],
  price: ["price"],
  customerName: ["customer_name", "customer"],
  company: ["company", "shipping_company"],
  address: ["address", "address1", "address_1", "shipping_address1", "shipping_address_1"],
  address2: ["address2", "address_2", "shipping_address2", "shipping_address_2"],
  city: ["city", "shipping_city"],
  state: ["state", "shipping_state"],
  zipcode: ["zipcode", "zip", "postal_code", "shipping_zip"],
  country: ["country", "shipping_country"],
  email: ["email", "email_address"],
  customerId: ["customer_id", "customerid"],
} as const;

const optionalColumns = {
  productName: ["product_name", "product", "item_name", "item"],
  ingredient: ["ingredient"],
  dose: ["dose"],
} as const;

type ColumnKey = keyof typeof requiredColumns;
type OptionalColumnKey = keyof typeof optionalColumns;
type TabKey = "customers" | "orders" | "import" | "export";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeHeader(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseMoney(value: unknown) {
  const raw = String(value ?? "");
  const parsed = Number(raw.replace(/[$,\s]/g, "").replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return raw.includes("(") && raw.includes(")") ? -parsed : parsed;
}

function formatDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const raw = cleanText(value);
  const parsed = new Date(raw);
  return raw && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : raw;
}

function firstNameFrom(name: string) {
  return name.split(/\s+/).filter(Boolean)[0] || "";
}

function lastNameFrom(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}

function orderGroup(orderId: string) {
  return orderId.match(/^(\d{5})/)?.[1] || orderId.slice(0, 5);
}

function orderGroupNumber(value: string) {
  const match = cleanText(value).match(/^(\d{5})/);
  return match ? Number(match[1]) : null;
}

function glpBrand(value: unknown) {
  return cleanText(value).match(/\bGLP-\d+\b/i)?.[0].toUpperCase() || cleanText(value);
}

function productLabel(value: unknown) {
  return glpBrand(value) || cleanText(value);
}

function productDoseLabel(item: { productName: string; sku: string; dose?: string }) {
  return [productLabel(item.productName || item.sku), cleanText(item.dose)].filter(Boolean).join(" ");
}

function doseFromProductName(value: unknown) {
  const text = cleanText(value);
  const bundleDose = text.match(/\b\d+\s*x\s*(\d+(?:\.\d+)?\s*mg)\b/i)?.[1];
  const anyDose = text.match(/\b(\d+(?:\.\d+)?\s*mg)\b/i)?.[1];
  return cleanText(bundleDose || anyDose).replace(/\s+/g, "");
}

function qtyFromProductName(value: unknown) {
  const bundleQty = cleanText(value).match(/\b(\d+)\s*x\s*\d+(?:\.\d+)?\s*mg\b/i)?.[1];
  return bundleQty ? Number(bundleQty) : 0;
}

function dateSearchText(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${value} ${Number(month)}/${Number(day)}/${year} ${Number(month)}/${Number(day)}/${year.slice(2)}`;
}

function addressLabel(order: OrderRow | CustomerRow) {
  const cityStateZip = [[order.city, order.state].filter(Boolean).join(", "), order.zipcode]
    .filter(Boolean)
    .join(" ");
  const items: OrderItem[] = "items" in order ? order.items : [order];
  const itemTotals = new Map<string, number>();
  items.forEach((item) => {
    const label = productDoseLabel(item);
    itemTotals.set(label, (itemTotals.get(label) || 0) + (item.qty || 0));
  });
  const itemLines = Array.from(itemTotals.entries()).map(([label, qty]) => `Qty ${qty} - ${label}`);
  return [order.customerName, order.company, order.address, order.address2, cityStateZip, ...itemLines]
    .map(cleanText)
    .filter(Boolean)
    .join("\n");
}

function findColumns(headers: unknown[]) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(
    Object.entries(requiredColumns).map(([field, candidates]) => [
      field,
      normalized.findIndex((header) => (candidates as readonly string[]).includes(header)),
    ])
  ) as Record<ColumnKey, number>;
}

function findOptionalColumns(headers: unknown[]) {
  const normalized = headers.map(normalizeHeader);
  return Object.fromEntries(
    Object.entries(optionalColumns).map(([field, candidates]) => [
      field,
      normalized.findIndex((header) => (candidates as readonly string[]).includes(header)),
    ])
  ) as Record<OptionalColumnKey, number>;
}

function cell(row: unknown[], columns: Record<ColumnKey, number>, key: ColumnKey) {
  const index = columns[key];
  return index >= 0 ? row[index] : "";
}

function optionalCell(row: unknown[], columns: Record<OptionalColumnKey, number>, key: OptionalColumnKey) {
  const index = columns[key];
  return index >= 0 ? row[index] : "";
}

function importOrders(rows: unknown[][]) {
  const headerIndex = rows.findIndex((row) => row.some((value) => normalizeHeader(value) === "order_id"));
  if (headerIndex < 0) throw new Error("Could not find an Order ID header row in the first sheet.");

  const columns = findColumns(rows[headerIndex]);
  const optional = findOptionalColumns(rows[headerIndex]);
  const missing = Object.entries(columns)
    .filter(([, index]) => index < 0)
    .map(([field]) => field);
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);

  return rows
    .slice(headerIndex + 1)
    .map((row, index): OrderRow | null => {
      const orderId = cleanText(cell(row, columns, "orderId"));
      const customerName = cleanText(cell(row, columns, "customerName"));
      if (!orderId || !customerName) return null;
      const cost = parseMoney(cell(row, columns, "cost"));
      const price = parseMoney(cell(row, columns, "price"));
      const rawProductName =
        cleanText(optionalCell(row, optional, "productName")) ||
        cleanText(optionalCell(row, optional, "ingredient")) ||
        cleanText(cell(row, columns, "brand"));
      const productName = productLabel(rawProductName) || cleanText(cell(row, columns, "sku"));
      const columnQty = Number(cell(row, columns, "qty")) || 0;
      const bundleQty = qtyFromProductName(rawProductName);
      const quantity = bundleQty > 1 && columnQty <= 1 ? bundleQty : columnQty || bundleQty || 0;
      return {
        id: `${orderId}-${index}`,
        orderId,
        orderGroup: orderGroup(orderId),
        orderDate: formatDate(cell(row, columns, "orderDate")),
        sku: cleanText(cell(row, columns, "sku")),
        productName,
        dose: cleanText(optionalCell(row, optional, "dose")) || doseFromProductName(rawProductName),
        brand: glpBrand(cell(row, columns, "brand")) || productName,
        qty: quantity,
        cost,
        price,
        profit: price - cost,
        customerName,
        firstName: firstNameFrom(customerName),
        lastName: lastNameFrom(customerName),
        company: cleanText(cell(row, columns, "company")),
        address: cleanText(cell(row, columns, "address")),
        address2: cleanText(cell(row, columns, "address2")),
        city: cleanText(cell(row, columns, "city")),
        state: cleanText(cell(row, columns, "state")),
        zipcode: cleanText(cell(row, columns, "zipcode")),
        country: cleanText(cell(row, columns, "country")),
        email: cleanText(cell(row, columns, "email")).toLowerCase(),
        customerId: cleanText(cell(row, columns, "customerId")),
      };
    })
    .filter((order): order is OrderRow => Boolean(order));
}

function customerGroups(orders: OrderRow[]) {
  const groups = new Map<string, CustomerRow>();
  orders.forEach((order) => {
    const key = order.customerId || order.email || `${order.customerName}-${order.zipcode}`;
    const existing =
      groups.get(key) ||
      ({
        ...order,
        orderGroups: new Set<string>(),
        lineCount: 0,
        revenue: 0,
        totalProfit: 0,
        lastOrder: "",
        items: [],
      } satisfies CustomerRow);
    existing.orderGroups.add(order.orderGroup);
    existing.lineCount += 1;
    existing.revenue += order.price;
    existing.totalProfit += order.profit;
    existing.lastOrder = [existing.lastOrder, order.orderDate].sort().at(-1) || order.orderDate;
    existing.items.push({
      orderId: order.orderId,
      productName: order.productName,
      dose: order.dose,
      qty: order.qty,
      sku: order.sku,
    });
    groups.set(key, existing);
  });
  return Array.from(groups.values()).sort((a, b) => b.revenue - a.revenue);
}

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(rows: Array<{ firstName: string; email: string; customerName: string; customerId: string }>) {
  const lines = [
    ["first_name", "email", "customer_name", "customer_id"],
    ...rows.map((row) => [row.firstName, row.email, row.customerName, row.customerId]),
  ];
  const blob = new Blob([lines.map((line) => line.map(csvEscape).join(",")).join("\n") + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pep-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function PepCustomersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("customers");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("Loading saved orders...");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [date, setDate] = useState("");
  const [exportStartOrderId, setExportStartOrderId] = useState("");
  const [exportEndOrderId, setExportEndOrderId] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const brands = useMemo(() => Array.from(new Set(orders.map((order) => order.brand).filter(Boolean))).sort(), [orders]);
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const haystack = [
          order.orderId,
          order.orderGroup,
          order.lastName,
          order.customerId,
          order.email,
          dateSearchText(order.orderDate),
        ]
          .join(" ")
          .toLowerCase();
        return (!brand || order.brand === brand) && (!date || order.orderDate === date) && (!search || haystack.includes(search.toLowerCase()));
      }),
    [brand, date, orders, search]
  );
  const customers = useMemo(() => customerGroups(filteredOrders), [filteredOrders]);
  const groupedOrderCount = useMemo(() => new Set(orders.map((order) => order.orderGroup)).size, [orders]);
  const revenue = orders.reduce((sum, order) => sum + order.price, 0);
  const profit = orders.reduce((sum, order) => sum + order.profit, 0);
  const latestOrderGroup = useMemo(
    () => orders.reduce((latest, order) => Math.max(latest, orderGroupNumber(order.orderGroup) || 0), 0),
    [orders]
  );
  const exportRange = useMemo(() => {
    const start = orderGroupNumber(exportStartOrderId);
    const end = orderGroupNumber(exportEndOrderId) || latestOrderGroup;
    if (start === null || !end) return null;
    return {
      start: Math.min(start, end),
      end: Math.max(start, end),
    };
  }, [exportEndOrderId, exportStartOrderId, latestOrderGroup]);
  const exportSource = useMemo(() => {
    if (exportRange) {
      return orders.filter((order) => {
        const groupNumber = orderGroupNumber(order.orderGroup);
        return groupNumber !== null && groupNumber >= exportRange.start && groupNumber <= exportRange.end;
      });
    }
    return selected.size ? orders.filter((order) => selected.has(order.id)) : filteredOrders;
  }, [exportRange, filteredOrders, orders, selected]);
  const exportCustomers = useMemo(() => {
    const rows = new Map<string, { firstName: string; email: string; customerName: string; customerId: string }>();
    exportSource.forEach((order) => {
      if (!order.email || rows.has(order.email)) return;
      rows.set(order.email, {
        firstName: order.firstName,
        email: order.email,
        customerName: order.customerName,
        customerId: order.customerId,
      });
    });
    return Array.from(rows.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [exportSource]);
  const exportScopeText = exportRange
    ? `${exportSource.length} order line${exportSource.length === 1 ? "" : "s"} from order IDs ${String(exportRange.start).padStart(5, "0")} through ${String(exportRange.end).padStart(5, "0")}`
    : selected.size
      ? `${selected.size} selected order line${selected.size === 1 ? "" : "s"}`
      : `${filteredOrders.length} visible order line${filteredOrders.length === 1 ? "" : "s"} from the Orders tab`;

  useEffect(() => {
    if (orderGroupNumber(exportStartOrderId) === null || exportEndOrderId.trim() || !latestOrderGroup) return;
    setExportEndOrderId(String(latestOrderGroup).padStart(5, "0"));
  }, [exportEndOrderId, exportStartOrderId, latestOrderGroup]);

  useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      try {
        const response = await fetch("/api/pep-customers/orders", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Could not load saved orders.");

        const saved = Array.isArray(data.orders) ? (data.orders as OrderRow[]) : [];

        if (!ignore) {
          setOrders(saved);
          if (saved.length) {
            setStatus(`Loaded ${saved.length} saved order lines from the server database.`);
          } else if (!saved.length) {
            setStatus("No saved orders yet. Import an order spreadsheet to begin.");
          }
        }
      } catch (error) {
        if (!ignore) {
          setStatus(error instanceof Error ? error.message : "Could not load saved orders.");
        }
      }
    }

    void loadOrders();

    return () => {
      ignore = true;
    };
  }, []);

  async function handleFile(file: File) {
    setStatus("Reading order file...");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
      const imported = importOrders(rows);
      setStatus(`Saving ${imported.length} order lines from ${file.name}...`);
      const response = await fetch("/api/pep-customers/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: imported, sourceFile: file.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save that order file.");

      setOrders(Array.isArray(data.orders) ? data.orders : imported);
      setSelected(new Set());
      setActiveTab("orders");
      setStatus(`Saved ${file.name}: ${data.added ?? 0} new order lines and ${data.updated ?? 0} updated lines.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import that order file.");
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function copyAddress(order: OrderRow) {
    const label = addressLabel(order);
    await navigator.clipboard.writeText(label);
    setCopyStatus(`Copied address for ${order.customerName}.`);
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "customers", label: "Customers" },
    { key: "orders", label: "Orders" },
    { key: "import", label: "Import" },
    { key: "export", label: "Export" },
  ];

  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purplestreet</p>
          <h1>Pep Customers</h1>
          <p className="lede">Import peptide order spreadsheets, track order history, copy label addresses, and export selected customers.</p>
        </div>
        <div className="page-top-actions">
          <Link className="action-link ghost" href="/">
            All panels
          </Link>
          <span className="status-pill">{status}</span>
        </div>
      </div>

      <section className="stat-grid stat-grid-six">
        <div className="stat-card"><span>Orders</span><strong>{groupedOrderCount}</strong></div>
        <div className="stat-card"><span>Customers</span><strong>{customerGroups(orders).length}</strong></div>
        <div className="stat-card"><span>Order Lines</span><strong>{orders.length}</strong></div>
        <div className="stat-card"><span>Revenue</span><strong>{moneyFormatter.format(revenue)}</strong></div>
        <div className="stat-card"><span>Profit</span><strong>{moneyFormatter.format(profit)}</strong></div>
        <div className="stat-card"><span>Export</span><strong>{exportCustomers.length}</strong></div>
      </section>

      <div className="tab-row" role="tablist" aria-label="Pep Customers sections">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.key}
            className={`tab-button${activeTab === tab.key ? " active" : ""}`}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "customers" ? (
        <section className="panel top-gap">
          <div className="section-head">
            <div>
              <p className="section-step">Customers</p>
              <h2>Order History</h2>
              <p>Customer rollups combine order lines by Customer ID first, then email if the ID is missing.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table ops-table">
              <thead>
                <tr>
                  <th>Customer</th><th>Email</th><th>Customer ID</th><th>Orders</th><th>Revenue</th><th>Profit</th><th>Last Order</th><th>Label</th>
                </tr>
              </thead>
              <tbody>
                {customers.length ? customers.map((customer) => (
                  <tr key={customer.customerId || customer.email}>
                    <td><strong>{customer.customerName}</strong><br /><small>{customer.firstName}</small></td>
                    <td>{customer.email}</td>
                    <td>{customer.customerId}</td>
                    <td>{customer.orderGroups.size} orders<br /><small>{Array.from(customer.orderGroups).sort().join(", ")} · {customer.lineCount} lines</small></td>
                    <td>{moneyFormatter.format(customer.revenue)}</td>
                    <td>{moneyFormatter.format(customer.totalProfit)}</td>
                    <td>{customer.lastOrder}</td>
                    <td><button className="action-button ghost" type="button" onClick={() => void copyAddress(customer)}>Copy address</button></td>
                  </tr>
                )) : <tr><td colSpan={8}>No customers imported yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {copyStatus ? <small className="inline-status">{copyStatus}</small> : null}
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="panel top-gap">
          <div className="section-head">
            <div>
              <p className="section-step">Orders</p>
              <h2>Search And Select</h2>
              <p>Search by order ID, first 5 digits, last name, Customer ID, email address, or order date.</p>
            </div>
            <div className="page-top-actions">
              <button className="action-button" type="button" onClick={() => setSelected(new Set(filteredOrders.map((order) => order.id)))}>Select visible</button>
              <button className="action-button ghost" type="button" onClick={() => setSelected(new Set())}>Clear selection</button>
            </div>
          </div>
          <div className="host-form-grid">
            <label className="field">
              <span>Search orders</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="30468, 30468-A1, Chesney, 3161, email, or 5/13/26" />
            </label>
            <label className="field">
              <span>Brand</span>
              <select value={brand} onChange={(event) => setBrand(event.target.value)}>
                <option value="">All GLP brands</option>
                {brands.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Order date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
          <div className="table-wrap top-gap">
            <table className="data-table ops-table">
              <thead>
                <tr>
                  <th>Select</th><th>Order ID</th><th>Date</th><th>Brand</th><th>Qty</th><th>Cost</th><th>Price</th><th>Profit</th><th>Customer</th><th>Email</th><th>Customer ID</th><th>Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length ? filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td><input type="checkbox" checked={selected.has(order.id)} onChange={(event) => toggleSelected(order.id, event.target.checked)} /></td>
                    <td><strong>{order.orderId}</strong><br /><small>{order.orderGroup}</small></td>
                    <td>{order.orderDate}</td>
                    <td><span className="status-chip ready">{order.brand}</span></td>
                    <td>{order.qty}</td>
                    <td>{moneyFormatter.format(order.cost)}</td>
                    <td>{moneyFormatter.format(order.price)}</td>
                    <td>{moneyFormatter.format(order.profit)}</td>
                    <td>{order.customerName}<br /><small>{order.firstName}</small></td>
                    <td>{order.email}</td>
                    <td>{order.customerId}</td>
                    <td>{[order.address, order.address2, order.city, order.state, order.zipcode].filter(Boolean).join(", ")}</td>
                  </tr>
                )) : <tr><td colSpan={12}>No matching orders.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "import" ? (
        <section className="panel top-gap">
          <div className="section-head">
            <div>
              <p className="section-step">Import</p>
              <h2>Order Spreadsheet</h2>
              <p>Reads the first sheet, saves the requested order fields to the server database, and adds each new upload to the existing order history.</p>
            </div>
            <input className="plain-file-input" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} />
          </div>
        </section>
      ) : null}

      {activeTab === "export" ? (
        <section className="panel top-gap">
          <div className="section-head">
            <div>
              <p className="section-step">Export</p>
              <h2>Customer List</h2>
              <p>Downloads first name and email from an order ID range, selected orders, or the visible Orders tab results.</p>
            </div>
            <div className="page-top-actions">
              <button className="action-button" type="button" onClick={() => downloadCsv(exportCustomers)}>Download CSV</button>
              <button
                className="action-button ghost"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(exportCustomers.map((row) => row.email).join("\n"));
                  setCopyStatus(`Copied ${exportCustomers.length} email${exportCustomers.length === 1 ? "" : "s"}.`);
                }}
              >
                Copy emails
              </button>
            </div>
          </div>
          <div className="host-form-grid">
            <label className="field">
              <span>Beginning order ID</span>
              <input
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setExportStartOrderId(event.target.value)}
                value={exportStartOrderId}
              />
            </label>
            <label className="field">
              <span>Ending order ID</span>
              <input
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setExportEndOrderId(event.target.value)}
                value={exportEndOrderId}
              />
            </label>
          </div>
          <small className="inline-status">Export is using {exportScopeText}.</small>
          {copyStatus ? <small className="inline-status">{copyStatus}</small> : null}
          <pre className="log-box top-gap">{exportCustomers.slice(0, 12).map((row) => `${row.firstName},${row.email}`).join("\n") || "Imported customer list exports will preview here."}</pre>
        </section>
      ) : null}
    </main>
  );
}
