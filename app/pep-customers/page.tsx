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
  trackingNumber: string;
  processedAt: string;
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

type ProcessOrderRow = OrderRow & {
  groupKey: string;
  orderGroups: Set<string>;
  orderIds: string[];
  items: OrderItem[];
  dateText: string;
};

type SkuPriceRow = {
  id: string;
  sku: string;
  cost: number;
  price: number;
  updatedAt: string;
};

type ImportResult = {
  orders: OrderRow[];
  autoPriced: number;
  missingPriceSkus: string[];
};

type ShippingField = "company" | "address" | "address2" | "city" | "state" | "zipcode";

const shippingFields: ShippingField[] = ["company", "address", "address2", "city", "state", "zipcode"];

const requiredColumns = {
  orderId: ["order_id", "orderid", "order"],
  orderDate: ["order_date", "date_created", "date"],
  sku: ["sku"],
  brand: ["brand"],
  qty: ["qty", "quantity"],
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
type TabKey = "customers" | "orders" | "process" | "import" | "export";
type SortDirection = "asc" | "desc";
type ProcessSortKey = "orderDate" | "orderGroup";
type OrderSortKey =
  | "orderId"
  | "orderDate"
  | "brand"
  | "qty"
  | "cost"
  | "price"
  | "profit"
  | "customerName"
  | "customerId"
  | "status";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function skuKey(value: unknown) {
  return cleanText(value).toUpperCase();
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

function displayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${month}/${day}/${year.slice(2)}`;
}

function addressText(order: OrderRow) {
  return [order.address, order.address2, order.city, order.state, order.zipcode].filter(Boolean).join(", ");
}

function shippingAddressKey(order: Pick<OrderRow, "address" | "address2" | "city" | "state" | "zipcode">) {
  const normalized = [order.address, order.address2, order.city, order.state, order.zipcode]
    .map((value) => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter(Boolean)
    .join("|");
  return normalized || "missing-shipping-address";
}

function hasShippingAddress(order: Pick<OrderRow, "address" | "city" | "state" | "zipcode">) {
  return Boolean(order.address && order.city && order.state && order.zipcode);
}

function sortValue(order: OrderRow, key: OrderSortKey) {
  if (key === "qty" || key === "cost" || key === "price" || key === "profit") return order[key];
  if (key === "status") return order.processedAt ? "sent" : "pending";
  return cleanText(order[key]).toLowerCase();
}

function compareOrders(a: OrderRow, b: OrderRow, key: OrderSortKey, direction: SortDirection) {
  const aValue = sortValue(a, key);
  const bValue = sortValue(b, key);
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof aValue === "number" && typeof bValue === "number") return (aValue - bValue) * multiplier;
  return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * multiplier;
}

function processSortValue(order: ProcessOrderRow, key: ProcessSortKey) {
  if (key === "orderGroup") {
    return Math.min(...Array.from(order.orderGroups).map((group) => orderGroupNumber(group) || Number.MAX_SAFE_INTEGER));
  }
  return order.orderDate;
}

function compareProcessOrders(a: ProcessOrderRow, b: ProcessOrderRow, key: ProcessSortKey, direction: SortDirection) {
  const aValue = processSortValue(a, key);
  const bValue = processSortValue(b, key);
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof aValue === "number" && typeof bValue === "number") return (aValue - bValue) * multiplier;
  return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * multiplier;
}

function customerKey(order: OrderRow) {
  return order.customerId;
}

function shippingScore(order: Pick<OrderRow, ShippingField>) {
  return (order.address ? 4 : 0) + (order.city ? 2 : 0) + (order.state ? 1 : 0) + (order.zipcode ? 2 : 0) + (order.company ? 1 : 0);
}

function fillMissingShipping(target: Pick<OrderRow, ShippingField>, source?: Pick<OrderRow, ShippingField>) {
  if (!source) return;
  shippingFields.forEach((field) => {
    if (!target[field] && source[field]) {
      target[field] = source[field];
    }
  });
}

function addressLabel(order: OrderRow | CustomerRow | ProcessOrderRow) {
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
  return [order.customerName, order.company, order.address, order.address2, cityStateZip, order.email, ...itemLines]
    .map(cleanText)
    .filter(Boolean)
    .join("\n");
}

function processOrderGroups(orders: OrderRow[]) {
  const groups = new Map<string, ProcessOrderRow>();
  const bestShippingByOrderGroup = new Map<string, OrderRow>();
  const shippingByCustomer = new Map<string, Map<string, OrderRow>>();

  orders.forEach((order) => {
    const orderGroupKey = `${customerKey(order)}|${order.orderGroup}`;
    const existing = bestShippingByOrderGroup.get(orderGroupKey);
    if (!existing || shippingScore(order) > shippingScore(existing)) {
      bestShippingByOrderGroup.set(orderGroupKey, order);
    }

    if (hasShippingAddress(order)) {
      const customerShipping = shippingByCustomer.get(customerKey(order)) || new Map<string, OrderRow>();
      const shippingKey = shippingAddressKey(order);
      const current = customerShipping.get(shippingKey);
      if (!current || shippingScore(order) > shippingScore(current)) {
        customerShipping.set(shippingKey, order);
      }
      shippingByCustomer.set(customerKey(order), customerShipping);
    }
  });

  orders
    .filter((order) => !order.processedAt)
    .forEach((order) => {
      const effectiveOrder = { ...order };
      fillMissingShipping(effectiveOrder, bestShippingByOrderGroup.get(`${customerKey(order)}|${order.orderGroup}`));

      const customerShipping = shippingByCustomer.get(customerKey(order));
      if (!hasShippingAddress(effectiveOrder) && customerShipping?.size === 1) {
        fillMissingShipping(effectiveOrder, Array.from(customerShipping.values())[0]);
      }

      const key = `${customerKey(order)}|${shippingAddressKey(effectiveOrder)}`;
      const existing =
        groups.get(key) ||
        ({
          ...effectiveOrder,
          groupKey: key,
          orderGroups: new Set<string>(),
          orderIds: [],
          items: [],
          dateText: "",
        } satisfies ProcessOrderRow);
      fillMissingShipping(existing, effectiveOrder);
      existing.orderGroups.add(order.orderGroup);
      existing.orderIds.push(order.orderId);
      existing.items.push({
        orderId: order.orderId,
        productName: order.productName,
        dose: order.dose,
        qty: order.qty,
        sku: order.sku,
      });
      existing.dateText = Array.from(new Set([...existing.dateText.split(", ").filter(Boolean), displayDate(order.orderDate)]))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .join(", ");
      groups.set(key, existing);
    });

  return Array.from(groups.values()).sort((a, b) => {
    const dateCompare = a.orderDate.localeCompare(b.orderDate);
    return dateCompare || a.customerName.localeCompare(b.customerName);
  });
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

function importOrders(rows: unknown[][], skuPrices: SkuPriceRow[]): ImportResult {
  const headerIndex = rows.findIndex((row) => row.some((value) => normalizeHeader(value) === "order_id"));
  if (headerIndex < 0) throw new Error("Could not find an Order ID header row in the first sheet.");

  const columns = findColumns(rows[headerIndex]);
  const optional = findOptionalColumns(rows[headerIndex]);
  const priceMap = new Map(skuPrices.map((item) => [skuKey(item.sku), item]));
  let autoPriced = 0;
  const missingPriceSkus = new Set<string>();
  const missing = Object.entries(columns)
    .filter(([, index]) => index < 0)
    .map(([field]) => field);
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);

  const orders = rows
    .slice(headerIndex + 1)
    .map((row, index): OrderRow | null => {
      const orderId = cleanText(cell(row, columns, "orderId"));
      const customerName = cleanText(cell(row, columns, "customerName"));
      const customerId = cleanText(cell(row, columns, "customerId"));
      if (!orderId || !customerName || !customerId) return null;
      const rawProductName =
        cleanText(optionalCell(row, optional, "productName")) ||
        cleanText(optionalCell(row, optional, "ingredient")) ||
        cleanText(cell(row, columns, "brand"));
      const productName = productLabel(rawProductName) || cleanText(cell(row, columns, "sku"));
      const columnQty = Number(cell(row, columns, "qty")) || 0;
      const bundleQty = qtyFromProductName(rawProductName);
      const quantity = bundleQty > 1 && columnQty <= 1 ? bundleQty : columnQty || bundleQty || 0;
      const sku = cleanText(cell(row, columns, "sku"));
      const savedPrice = priceMap.get(skuKey(sku));
      const cost = savedPrice ? savedPrice.cost * quantity : 0;
      const price = savedPrice ? savedPrice.price * quantity : 0;
      if (savedPrice) {
        autoPriced += 1;
      } else if (sku) {
        missingPriceSkus.add(sku);
      }
      return {
        id: `${orderId}-${index}`,
        orderId,
        orderGroup: orderGroup(orderId),
        orderDate: formatDate(cell(row, columns, "orderDate")),
        sku,
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
        customerId,
        trackingNumber: "",
        processedAt: "",
      };
    })
    .filter((order): order is OrderRow => Boolean(order));

  return {
    orders,
    autoPriced,
    missingPriceSkus: Array.from(missingPriceSkus).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
}

function customerGroups(orders: OrderRow[]) {
  const groups = new Map<string, CustomerRow>();
  orders.forEach((order) => {
    const key = customerKey(order);
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

async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.left = "-9999px";
    field.style.position = "fixed";
    document.body.append(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
}

export default function PepCustomersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [skuPrices, setSkuPrices] = useState<SkuPriceRow[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("customers");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("Loading saved orders...");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [date, setDate] = useState("");
  const [orderSort, setOrderSort] = useState<{ key: OrderSortKey; direction: SortDirection } | null>(null);
  const [processSort, setProcessSort] = useState<{ key: ProcessSortKey; direction: SortDirection } | null>(null);
  const [exportStartOrderId, setExportStartOrderId] = useState("");
  const [exportEndOrderId, setExportEndOrderId] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [trackingOrder, setTrackingOrder] = useState<ProcessOrderRow | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [skuForm, setSkuForm] = useState({ sku: "", cost: "", price: "" });
  const [skuStatus, setSkuStatus] = useState("");
  const [isSavingSku, setIsSavingSku] = useState(false);
  const [editingPricing, setEditingPricing] = useState<{ orderId: string; field: "cost" | "price"; value: string } | null>(null);
  const [isSavingPricing, setIsSavingPricing] = useState(false);

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
  const visibleOrders = useMemo(() => {
    if (!orderSort) return filteredOrders;
    return [...filteredOrders].sort((a, b) => compareOrders(a, b, orderSort.key, orderSort.direction));
  }, [filteredOrders, orderSort]);
  const customers = useMemo(() => customerGroups(filteredOrders), [filteredOrders]);
  const processOrders = useMemo(() => processOrderGroups(orders), [orders]);
  const visibleProcessOrders = useMemo(() => {
    if (!processSort) return processOrders;
    return [...processOrders].sort((a, b) => compareProcessOrders(a, b, processSort.key, processSort.direction));
  }, [processOrders, processSort]);
  const pendingProductTotals = useMemo(() => {
    const totals = new Map<string, number>();
    processOrders.forEach((order) => {
      order.items.forEach((item) => {
        const label = productLabel(item.productName || item.sku);
        totals.set(label, (totals.get(label) || 0) + (item.qty || 0));
      });
    });
    return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [processOrders]);
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
      if (!order.customerId || rows.has(order.customerId)) return;
      rows.set(order.customerId, {
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

    async function loadSavedData() {
      try {
        const [ordersResponse, pricesResponse] = await Promise.all([
          fetch("/api/pep-customers/orders", { cache: "no-store" }),
          fetch("/api/pep-customers/sku-prices", { cache: "no-store" }),
        ]);
        const ordersData = await ordersResponse.json();
        const pricesData = await pricesResponse.json();
        if (!ordersResponse.ok) throw new Error(ordersData?.error || "Could not load saved orders.");
        if (!pricesResponse.ok) throw new Error(pricesData?.error || "Could not load saved SKU pricing.");

        const saved = Array.isArray(ordersData.orders) ? (ordersData.orders as OrderRow[]) : [];
        const savedPrices = Array.isArray(pricesData.prices) ? (pricesData.prices as SkuPriceRow[]) : [];

        if (!ignore) {
          setOrders(saved);
          setSkuPrices(savedPrices);
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

    void loadSavedData();

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
      const imported = importOrders(rows, skuPrices);
      setStatus(`Saving ${imported.orders.length} order lines from ${file.name}...`);
      const response = await fetch("/api/pep-customers/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: imported.orders, sourceFile: file.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save that order file.");

      setOrders(Array.isArray(data.orders) ? data.orders : imported.orders);
      setSelected(new Set());
      setActiveTab("orders");
      const pricingNote = imported.autoPriced
        ? ` ${imported.autoPriced} line${imported.autoPriced === 1 ? "" : "s"} priced by saved SKU.`
        : "";
      const missingNote = imported.missingPriceSkus.length
        ? ` Missing SKU pricing: ${imported.missingPriceSkus.slice(0, 6).join(", ")}${imported.missingPriceSkus.length > 6 ? "..." : ""}.`
        : "";
      setStatus(`Saved ${file.name}: ${data.added ?? 0} new order lines and ${data.updated ?? 0} updated lines.${pricingNote}${missingNote}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import that order file.");
    }
  }

  async function saveSkuPrice() {
    const sku = skuKey(skuForm.sku);
    if (!sku) {
      setSkuStatus("Enter a SKU first.");
      return;
    }

    setSkuStatus("Saving SKU pricing...");
    setIsSavingSku(true);
    try {
      const response = await fetch("/api/pep-customers/sku-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          cost: parseMoney(skuForm.cost),
          price: parseMoney(skuForm.price),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save that SKU pricing.");
      setSkuPrices(Array.isArray(data.prices) ? data.prices : skuPrices);
      setSkuForm({ sku: "", cost: "", price: "" });
      setSkuStatus(`Saved pricing for ${sku}.`);
    } catch (error) {
      setSkuStatus(error instanceof Error ? error.message : "Could not save that SKU pricing.");
    } finally {
      setIsSavingSku(false);
    }
  }

  async function deleteSkuPrice(sku: string) {
    const cleanedSku = skuKey(sku);
    if (!cleanedSku) return;

    setSkuStatus(`Removing pricing for ${cleanedSku}...`);
    setIsSavingSku(true);
    try {
      const response = await fetch(`/api/pep-customers/sku-prices?sku=${encodeURIComponent(cleanedSku)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not remove that SKU pricing.");
      setSkuPrices(Array.isArray(data.prices) ? data.prices : skuPrices.filter((item) => skuKey(item.sku) !== cleanedSku));
      setSkuStatus(`Removed pricing for ${cleanedSku}.`);
    } catch (error) {
      setSkuStatus(error instanceof Error ? error.message : "Could not remove that SKU pricing.");
    } finally {
      setIsSavingSku(false);
    }
  }

  function editSkuPrice(item: SkuPriceRow) {
    setSkuForm({
      sku: item.sku,
      cost: String(item.cost),
      price: String(item.price),
    });
    setSkuStatus(`Editing ${item.sku}.`);
  }

  function startPricingEdit(order: OrderRow, field: "cost" | "price") {
    setEditingPricing({
      orderId: order.orderId,
      field,
      value: String(order[field]),
    });
    setCopyStatus("");
  }

  function cancelPricingEdit() {
    setEditingPricing(null);
  }

  async function saveOrderPricing(order: OrderRow) {
    if (!editingPricing || editingPricing.orderId !== order.orderId || isSavingPricing) return;

    const nextValue = parseMoney(editingPricing.value);
    const cost = editingPricing.field === "cost" ? nextValue : order.cost;
    const price = editingPricing.field === "price" ? nextValue : order.price;

    setIsSavingPricing(true);
    setCopyStatus(`Saving pricing for ${order.orderId}...`);
    try {
      const response = await fetch("/api/pep-customers/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, cost, price }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save that order pricing.");
      setOrders(Array.isArray(data.orders) ? data.orders : orders);
      setEditingPricing(null);
      setCopyStatus(`Saved pricing for ${order.orderId}.`);
    } catch (error) {
      setCopyStatus(error instanceof Error ? error.message : "Could not save that order pricing.");
    } finally {
      setIsSavingPricing(false);
    }
  }

  function editableMoneyCell(order: OrderRow, field: "cost" | "price") {
    const active = editingPricing?.orderId === order.orderId && editingPricing.field === field;

    if (active) {
      return (
        <input
          aria-label={`${field === "cost" ? "Cost" : "Price"} for ${order.orderId}`}
          autoFocus
          className="money-edit-input"
          disabled={isSavingPricing}
          inputMode="decimal"
          onBlur={(event) => {
            if (event.currentTarget.dataset.cancel === "true") return;
            void saveOrderPricing(order);
          }}
          onChange={(event) => setEditingPricing((current) => current ? { ...current, value: event.target.value } : current)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveOrderPricing(order);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.dataset.cancel = "true";
              cancelPricingEdit();
            }
          }}
          value={editingPricing.value}
        />
      );
    }

    return (
      <button
        className="money-edit-button"
        onClick={() => startPricingEdit(order, field)}
        title={`Click to edit ${field === "cost" ? "cost" : "price"}`}
        type="button"
      >
        {moneyFormatter.format(order[field])}
      </button>
    );
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
    await writeClipboardText(label);
    setCopyStatus(`Copied address for ${order.customerName}.`);
  }

  async function copyProcessOrder(order: ProcessOrderRow) {
    const label = addressLabel(order);
    await writeClipboardText(label);
    setProcessStatus(`Copied order for ${order.customerName}.`);
  }

  async function copyOrderEmail(order: OrderRow) {
    if (!order.email) {
      setCopyStatus(`No email address saved for ${order.customerName}.`);
      return;
    }
    await writeClipboardText(order.email);
    setCopyStatus(`Copied email for ${order.customerName}: ${order.email}`);
  }

  function openTrackingDialog(order: ProcessOrderRow) {
    setTrackingOrder(order);
    setTrackingNumber(order.trackingNumber || "");
    setProcessStatus("");
  }

  function openEditTrackingDialog(order: OrderRow) {
    const relatedOrders = orders.filter((item) => item.customerId === order.customerId && item.orderGroup === order.orderGroup);
    const orderIds = relatedOrders.map((item) => item.orderId);
    const editOrder = {
      ...order,
      groupKey: `${order.customerId}|${order.orderGroup}|edit-tracking`,
      orderGroups: new Set<string>([order.orderGroup]),
      orderIds: orderIds.length ? orderIds : [order.orderId],
      items: relatedOrders.length
        ? relatedOrders.map((item) => ({
            orderId: item.orderId,
            productName: item.productName,
            dose: item.dose,
            qty: item.qty,
            sku: item.sku,
          }))
        : [{
            orderId: order.orderId,
            productName: order.productName,
            dose: order.dose,
            qty: order.qty,
            sku: order.sku,
          }],
      dateText: displayDate(order.orderDate),
    } satisfies ProcessOrderRow;

    openTrackingDialog(editOrder);
  }

  async function submitTrackingNumber() {
    if (!trackingOrder) return;
    const tracking = trackingNumber.trim();
    if (!tracking) {
      setProcessStatus("Enter a tracking number first.");
      return;
    }

    setProcessStatus("Saving tracking number...");
    setIsSavingTracking(true);
    try {
      const response = await fetch("/api/pep-customers/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: trackingOrder.orderIds, trackingNumber: tracking }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Could not process that order.");
      setOrders(Array.isArray(data.orders) ? data.orders : orders);
      setTrackingOrder(null);
      setTrackingNumber("");
      const message = `Saved tracking for ${Array.from(trackingOrder.orderGroups).sort().join(", ")}.`;
      setProcessStatus(message);
      setCopyStatus(message);
    } catch (error) {
      setProcessStatus(error instanceof Error ? error.message : "Could not process that order.");
    } finally {
      setIsSavingTracking(false);
    }
  }

  function toggleOrderSort(key: OrderSortKey) {
    setOrderSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function sortableHeader(key: OrderSortKey, label: string) {
    const active = orderSort?.key === key;
    return (
      <button className="sortable-header" onClick={() => toggleOrderSort(key)} type="button">
        <span>{label}</span>
        {active ? <span className="sort-indicator">{orderSort.direction === "asc" ? "Asc" : "Desc"}</span> : null}
      </button>
    );
  }

  function toggleProcessSort(key: ProcessSortKey) {
    setProcessSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function processSortableHeader(key: ProcessSortKey, label: string) {
    const active = processSort?.key === key;
    return (
      <button className="sortable-header" onClick={() => toggleProcessSort(key)} type="button">
        <span>{label}</span>
        {active ? <span className="sort-indicator">{processSort.direction === "asc" ? "Asc" : "Desc"}</span> : null}
      </button>
    );
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "customers", label: "Customers" },
    { key: "orders", label: "Orders" },
    { key: "import", label: "Import" },
    { key: "export", label: "Export" },
    { key: "process", label: "Process Orders" },
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

      <div className="tab-summary-row">
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
        <div className="pending-stock-summary" aria-label="Pending product totals">
          <span>Pending stock</span>
          {pendingProductTotals.length ? (
            pendingProductTotals.map(([label, qty]) => <strong key={label}>{qty} x {label}</strong>)
          ) : (
            <strong>All processed</strong>
          )}
        </div>
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
                  <th>Customer</th><th>Email</th><th>Customer ID</th><th>Orders</th><th>Revenue</th><th>Profit</th><th>Last Order</th>
                </tr>
              </thead>
              <tbody>
                {customers.length ? customers.map((customer) => (
                  <tr key={customer.customerId}>
                    <td><strong>{customer.customerName}</strong></td>
                    <td>{customer.email}</td>
                    <td>{customer.customerId}</td>
                    <td>{customer.orderGroups.size} orders<br /><small>{Array.from(customer.orderGroups).sort().join(", ")} · {customer.lineCount} lines</small></td>
                    <td>{moneyFormatter.format(customer.revenue)}</td>
                    <td>{moneyFormatter.format(customer.totalProfit)}</td>
                    <td>{displayDate(customer.lastOrder)}</td>
                  </tr>
                )) : <tr><td colSpan={7}>No customers imported yet.</td></tr>}
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
              <button className="action-button" type="button" onClick={() => setSelected(new Set(visibleOrders.map((order) => order.id)))}>Select visible</button>
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
                  <th>Select</th>
                  <th>{sortableHeader("orderId", "Order ID")}</th>
                  <th>{sortableHeader("orderDate", "Date")}</th>
                  <th>{sortableHeader("brand", "Brand")}</th>
                  <th>{sortableHeader("qty", "Qty")}</th>
                  <th>{sortableHeader("cost", "Cost")}</th>
                  <th>{sortableHeader("price", "Price")}</th>
                  <th>{sortableHeader("profit", "Profit")}</th>
                  <th>{sortableHeader("customerName", "Customer")}</th>
                  <th>{sortableHeader("customerId", "Customer ID")}</th>
                  <th>{sortableHeader("status", "Status")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.length ? visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td><input type="checkbox" checked={selected.has(order.id)} onChange={(event) => toggleSelected(order.id, event.target.checked)} /></td>
                    <td><strong>{order.orderId}</strong></td>
                    <td>{displayDate(order.orderDate)}</td>
                    <td><span className="status-chip ready">{order.brand}</span></td>
                    <td>{order.qty}</td>
                    <td>{editableMoneyCell(order, "cost")}</td>
                    <td>{editableMoneyCell(order, "price")}</td>
                    <td>{moneyFormatter.format(order.profit)}</td>
                    <td>
                      <button className="inline-copy-button" onClick={() => void copyOrderEmail(order)} title={order.email} type="button">
                        {order.customerName}
                      </button>
                    </td>
                    <td>{order.customerId}</td>
                    <td>
                      {order.processedAt ? (
                        <button
                          className="status-chip status-chip-button ready"
                          onClick={() => openEditTrackingDialog(order)}
                          title={order.trackingNumber ? `Tracking: ${order.trackingNumber}` : "Click to edit tracking"}
                          type="button"
                        >
                          Sent
                        </button>
                      ) : (
                        <span className="status-chip duplicate">Pending</span>
                      )}
                    </td>
                  </tr>
                )) : <tr><td colSpan={11}>No matching orders.</td></tr>}
              </tbody>
            </table>
          </div>
          {copyStatus ? <small className="inline-status">{copyStatus}</small> : null}
        </section>
      ) : null}

      {activeTab === "process" ? (
        <section className="panel top-gap">
          <div className="section-head">
            <div>
              <p className="section-step">Process Orders</p>
              <h2>Pending Shipments</h2>
              <p>Copy the order label, then enter tracking to mark the order as processed.</p>
            </div>
          </div>
          <div className="table-wrap process-orders-table-wrap">
            <table className="data-table ops-table">
              <thead>
                <tr>
                  <th>{processSortableHeader("orderDate", "Date of Order")}</th>
                  <th>Customer Name</th>
                  <th>Customer ID</th>
                  <th>{processSortableHeader("orderGroup", "Order #")}</th>
                  <th>Shipping Address</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProcessOrders.length ? visibleProcessOrders.map((order) => {
                  const mainOrders = Array.from(order.orderGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                  const allOrderIds = Array.from(new Set(order.orderIds)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                  return (
                    <tr key={order.groupKey}>
                      <td>{order.dateText}</td>
                      <td><strong>{order.customerName}</strong></td>
                      <td>{order.customerId}</td>
                      <td title={allOrderIds.join(", ")}>{mainOrders.join(", ")}</td>
                      <td>{addressText(order)}</td>
                      <td>
                        <div className="table-action-row">
                          <span className="copy-preview-wrap">
                            <button
                              className="action-button ghost"
                              title={addressLabel(order)}
                              type="button"
                              onClick={() => void copyProcessOrder(order)}
                            >
                              Copy Order
                            </button>
                            <span className="copy-preview-tooltip" role="tooltip">{addressLabel(order)}</span>
                          </span>
                          <button className="action-button" type="button" onClick={() => openTrackingDialog(order)}>Tracking</button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : <tr><td colSpan={6}>No pending orders to process.</td></tr>}
              </tbody>
            </table>
          </div>
          {processStatus ? <small className="inline-status">{processStatus}</small> : null}
        </section>
      ) : null}

      {activeTab === "import" ? (
        <section className="panel top-gap">
          <div className="section-head">
            <div>
              <p className="section-step">Import</p>
              <h2>Order Spreadsheet</h2>
              <p>Reads the first sheet, ignores spreadsheet cost and price columns, and prices each line from saved SKU pricing.</p>
            </div>
            <input className="plain-file-input" type="file" accept=".xlsx,.xls" onChange={(event) => event.target.files?.[0] && void handleFile(event.target.files[0])} />
          </div>
          <div className="pricing-manager top-gap">
            <div className="section-head compact-section-head">
              <div>
                <p className="section-step">SKU Pricing</p>
                <h2>Saved Cost And Price</h2>
                <p>Saved values are unit amounts for new imports. Existing order lines keep their saved cost and price unless edited on Orders.</p>
              </div>
            </div>
            <div className="host-form-grid sku-price-form">
              <label className="field">
                <span>SKU</span>
                <input
                  onChange={(event) => setSkuForm((current) => ({ ...current, sku: event.target.value }))}
                  placeholder="SKU"
                  value={skuForm.sku}
                />
              </label>
              <label className="field">
                <span>Supplier payout</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setSkuForm((current) => ({ ...current, cost: event.target.value }))}
                  placeholder="0.00"
                  value={skuForm.cost}
                />
              </label>
              <label className="field">
                <span>Price</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setSkuForm((current) => ({ ...current, price: event.target.value }))}
                  placeholder="0.00"
                  value={skuForm.price}
                />
              </label>
              <div className="page-top-actions sku-price-actions">
                <button className="action-button" disabled={isSavingSku} type="button" onClick={() => void saveSkuPrice()}>
                  {isSavingSku ? "Saving..." : "Save SKU"}
                </button>
                <button className="action-button ghost" disabled={isSavingSku} type="button" onClick={() => setSkuForm({ sku: "", cost: "", price: "" })}>
                  Clear
                </button>
              </div>
            </div>
            {skuStatus ? <small className="inline-status">{skuStatus}</small> : null}
            <div className="table-wrap top-gap">
              <table className="data-table ops-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Supplier Payout</th>
                    <th>Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {skuPrices.length ? skuPrices.map((item) => (
                    <tr key={item.sku}>
                      <td><strong>{item.sku}</strong></td>
                      <td>{moneyFormatter.format(item.cost)}</td>
                      <td>{moneyFormatter.format(item.price)}</td>
                      <td>
                        <div className="table-action-row">
                          <button className="action-button ghost" type="button" onClick={() => editSkuPrice(item)}>Edit</button>
                          <button className="action-button ghost danger-action" disabled={isSavingSku} type="button" onClick={() => void deleteSkuPrice(item.sku)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={4}>No SKU pricing saved yet.</td></tr>}
                </tbody>
              </table>
            </div>
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
                  void writeClipboardText(exportCustomers.map((row) => row.email).join("\n")).then(() => {
                    setCopyStatus(`Copied ${exportCustomers.length} email${exportCustomers.length === 1 ? "" : "s"}.`);
                  });
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

      {trackingOrder ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="dialog-panel" role="dialog">
            <div>
              <p className="section-step">Tracking</p>
              <h2>{trackingOrder.processedAt ? "Edit Tracking" : "Mark Order Processed"}</h2>
              <p className="quiet-note">{trackingOrder.customerName} · {Array.from(trackingOrder.orderGroups).sort().join(", ")}</p>
            </div>
            <label className="field">
              <span>Tracking number</span>
              <input
                autoFocus
                onChange={(event) => setTrackingNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitTrackingNumber();
                  }
                }}
                value={trackingNumber}
              />
            </label>
            {processStatus ? <small className="inline-status">{processStatus}</small> : null}
            <div className="page-top-actions">
              <button className="action-button" disabled={isSavingTracking} type="button" onClick={() => void submitTrackingNumber()}>
                {isSavingTracking ? "Saving..." : "Save tracking"}
              </button>
              <button className="action-button ghost" disabled={isSavingTracking} type="button" onClick={() => setTrackingOrder(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
