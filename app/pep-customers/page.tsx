"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type OrderRow = {
  id: string;
  orderId: string;
  orderGroup: string;
  orderDate: string;
  sku: string;
  productName: string;
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
  orderDate: ["order_date", "date"],
  sku: ["sku"],
  brand: ["brand"],
  qty: ["qty", "quantity"],
  cost: ["cost"],
  price: ["price"],
  customerName: ["customer_name", "customer"],
  company: ["company"],
  address: ["address", "address1", "address_1"],
  address2: ["address2", "address_2"],
  city: ["city"],
  state: ["state"],
  zipcode: ["zipcode", "zip", "postal_code"],
  country: ["country"],
  email: ["email", "email_address"],
  customerId: ["customer_id", "customerid"],
} as const;

const optionalColumns = {
  productName: ["product_name", "product", "item_name", "item"],
  ingredient: ["ingredient"],
} as const;

type ColumnKey = keyof typeof requiredColumns;
type OptionalColumnKey = keyof typeof optionalColumns;

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

function glpBrand(value: unknown) {
  return cleanText(value).match(/\bGLP-\d+\b/i)?.[0].toUpperCase() || cleanText(value);
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
  const itemLines = items.map((item) => `Qty ${item.qty || 0} - ${item.productName || item.sku}`);
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
      return {
        id: `${orderId}-${index}`,
        orderId,
        orderGroup: orderGroup(orderId),
        orderDate: formatDate(cell(row, columns, "orderDate")),
        sku: cleanText(cell(row, columns, "sku")),
        productName:
          cleanText(optionalCell(row, optional, "productName")) ||
          cleanText(optionalCell(row, optional, "ingredient")) ||
          cleanText(cell(row, columns, "brand")) ||
          cleanText(cell(row, columns, "sku")),
        brand: glpBrand(cell(row, columns, "brand")),
        qty: Number(cell(row, columns, "qty")) || 0,
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("No order file loaded");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [date, setDate] = useState("");
  const [copied, setCopied] = useState("");

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
  const exportCustomers = useMemo(() => {
    const source = selected.size ? orders.filter((order) => selected.has(order.id)) : filteredOrders;
    const rows = new Map<string, { firstName: string; email: string; customerName: string; customerId: string }>();
    source.forEach((order) => {
      if (!order.email || rows.has(order.email)) return;
      rows.set(order.email, {
        firstName: order.firstName,
        email: order.email,
        customerName: order.customerName,
        customerId: order.customerId,
      });
    });
    return Array.from(rows.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [filteredOrders, orders, selected]);

  async function handleFile(file: File) {
    setStatus("Reading order file...");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
      const imported = importOrders(rows);
      setOrders(imported);
      setSelected(new Set());
      setStatus(`Imported ${imported.length} order lines from ${file.name}`);
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
    setCopied(label);
  }

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

      <section className="panel top-gap">
        <div className="section-head">
          <div>
            <p className="section-step">Import</p>
            <h2>Order Spreadsheet</h2>
            <p>Reads the first sheet and keeps only the requested order, customer, revenue, and address fields.</p>
          </div>
          <input className="plain-file-input" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} />
        </div>
      </section>

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
      </section>

      <section className="panel top-gap">
        <div className="section-head">
          <div>
            <p className="section-step">Export</p>
            <h2>Customer List</h2>
            <p>Downloads first name and email from selected orders. If nothing is selected, it uses the visible orders.</p>
          </div>
          <div className="page-top-actions">
            <button className="action-button" type="button" onClick={() => downloadCsv(exportCustomers)}>Download CSV</button>
            <button className="action-button ghost" type="button" onClick={() => void navigator.clipboard.writeText(exportCustomers.map((row) => row.email).join("\n"))}>Copy emails</button>
          </div>
        </div>
        <pre className="log-box">{copied || exportCustomers.slice(0, 12).map((row) => `${row.firstName},${row.email}`).join("\n") || "Imported customer list exports will preview here."}</pre>
      </section>
    </main>
  );
}
