import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DATA_FILE = process.env.LUMBERJACK_DATA_FILE || join(ROOT, "data", "runtime.json");
const PRODUCT_FILE = join(ROOT, "data", "products.json");
const PORT = Number(process.env.PORT || 4173);
const sessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png"
};

const clone = value => JSON.parse(JSON.stringify(value));
const money = value => Math.round(Number(value) * 100) / 100;

async function products() {
  return JSON.parse(await readFile(PRODUCT_FILE, "utf8"));
}

async function initialState() {
  const catalog = await products();
  return {
    inventory: Object.fromEntries(catalog.map(item => [item.id, item.stock])),
    carts: {},
    orders: [
      {id:"LM-24081",userId:"paul",status:"Delivered",createdAt:"2026-08-06T17:42:00Z",total:42.16,items:4},
      {id:"LM-24057",userId:"paul",status:"Delivered",createdAt:"2026-07-29T19:15:00Z",total:68.92,items:7}
    ],
    audit: []
  };
}

async function loadState() {
  if (!existsSync(DATA_FILE)) return initialState();
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}

async function saveState(state) {
  await mkdir(join(DATA_FILE, ".."), {recursive: true});
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2));
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers});
  res.end(body);
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  if (Buffer.concat(chunks).length > 1_000_000) throw new Error("Payload too large");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function bearer(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
}

function userFrom(req) {
  return sessions.get(bearer(req));
}

function totals(lines, catalog) {
  const subtotal = money(lines.reduce((sum, line) => {
    const item = catalog.find(product => product.id === line.productId);
    return sum + (item?.price || 0) * line.quantity;
  }, 0));
  const delivery = subtotal >= 50 || subtotal === 0 ? 0 : 5.99;
  const tax = money(subtotal * 0.081);
  return {subtotal, delivery, tax, total: money(subtotal + delivery + tax)};
}

export async function handleApi(req, res, url) {
  const catalog = await products();
  const state = await loadState();

  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, {status:"ok",service:"lumberjacks-marketplace",products:catalog.length});
  }
  if (req.method === "GET" && url.pathname === "/api/products") {
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = url.searchParams.get("category") || "All";
    const sort = url.searchParams.get("sort") || "featured";
    let result = catalog.map(item => ({...item, stock: state.inventory[item.id] ?? item.stock}));
    if (query) result = result.filter(item => `${item.name} ${item.category} ${item.tags.join(" ")} ${item.origin}`.toLowerCase().includes(query));
    if (category !== "All") result = result.filter(item => item.category === category);
    result.sort((a,b) => sort === "price-asc" ? a.price-b.price : sort === "price-desc" ? b.price-a.price : sort === "rating" ? b.rating-a.rating : a.sku.localeCompare(b.sku));
    return send(res, 200, {items:result,total:result.length,categories:["All",...new Set(catalog.map(item=>item.category))]});
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/products/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const item = catalog.find(product => product.id === id);
    return item ? send(res, 200, {...item,stock:state.inventory[id] ?? item.stock}) : send(res, 404, {error:"Product not found"});
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const payload = await body(req);
    if (payload.email !== "paul@lumberjacks.local" || payload.password !== "Lumberjack2026!") return send(res, 401, {error:"Incorrect email or password"});
    const token = randomUUID();
    const user = {id:"paul",name:"Paul Revanth",email:payload.email,role:"customer"};
    sessions.set(token,user);
    return send(res, 200, {token,user});
  }
  if (req.method === "GET" && url.pathname === "/api/session") {
    const user = userFrom(req);
    return user ? send(res, 200, {user}) : send(res, 401, {error:"Session required"});
  }
  if (req.method === "GET" && url.pathname === "/api/cart") {
    const user = userFrom(req);
    if (!user) return send(res, 401, {error:"Sign in to access a server-saved cart"});
    const lines = state.carts[user.id] || [];
    return send(res, 200, {lines,totals:totals(lines,catalog)});
  }
  if (req.method === "PUT" && url.pathname === "/api/cart") {
    const user = userFrom(req);
    if (!user) return send(res, 401, {error:"Session required"});
    const payload = await body(req);
    const lines = Array.isArray(payload.lines) ? payload.lines.filter(line => catalog.some(item => item.id === line.productId) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 20) : [];
    state.carts[user.id] = lines;
    state.audit.unshift({id:randomUUID(),type:"cart.updated",userId:user.id,at:new Date().toISOString(),lines:lines.length});
    await saveState(state);
    return send(res, 200, {lines,totals:totals(lines,catalog)});
  }
  if (req.method === "POST" && url.pathname === "/api/orders") {
    const user = userFrom(req);
    if (!user) return send(res, 401, {error:"Sign in before checkout"});
    const payload = await body(req);
    const lines = state.carts[user.id] || [];
    if (!lines.length) return send(res, 422, {error:"Cart is empty"});
    for (const line of lines) if ((state.inventory[line.productId] || 0) < line.quantity) return send(res, 409, {error:`Insufficient stock for ${line.productId}`});
    if (!payload.deliverySlot || !payload.address?.trim()) return send(res, 422, {error:"Delivery slot and address are required"});
    lines.forEach(line => { state.inventory[line.productId] -= line.quantity; });
    const calculated = totals(lines,catalog);
    const order = {id:`LM-${String(Date.now()).slice(-6)}`,userId:user.id,status:"Confirmed",createdAt:new Date().toISOString(),deliverySlot:payload.deliverySlot,address:payload.address.trim(),total:calculated.total,items:clone(lines)};
    state.orders.unshift(order); state.carts[user.id] = [];
    state.audit.unshift({id:randomUUID(),type:"order.created",userId:user.id,orderId:order.id,at:order.createdAt});
    await saveState(state);
    return send(res, 201, order);
  }
  if (req.method === "GET" && url.pathname === "/api/orders") {
    const user = userFrom(req);
    if (!user) return send(res, 401, {error:"Session required"});
    return send(res, 200, state.orders.filter(order => order.userId === user.id));
  }
  if (req.method === "GET" && url.pathname === "/api/operations") {
    const lowStock = catalog.map(item => ({...item,stock:state.inventory[item.id] ?? item.stock})).filter(item => item.stock < 18).sort((a,b)=>a.stock-b.stock);
    return send(res, 200, {catalogSize:catalog.length,unitsInStock:Object.values(state.inventory).reduce((a,b)=>a+b,0),orders:state.orders.length,revenue:money(state.orders.reduce((sum,order)=>sum+order.total,0)),lowStock,audit:state.audit.slice(0,12)});
  }
  return send(res, 404, {error:"API route not found"});
}

async function serveStatic(req,res,url) {
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const clean = normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(ROOT, clean);
  if (!filePath.startsWith(ROOT)) return send(res,403,{error:"Forbidden"});
  try {
    const data = await readFile(filePath);
    res.writeHead(200,{"content-type":contentTypes[extname(filePath)] || "application/octet-stream","cache-control":extname(filePath)===".html"?"no-cache":"public, max-age=3600"});
    res.end(data);
  } catch { send(res,404,{error:"Not found"}); }
}

export function createApp() {
  return createServer(async (req,res) => {
    const url = new URL(req.url,"http://localhost");
    try { if (url.pathname.startsWith("/api/")) await handleApi(req,res,url); else await serveStatic(req,res,url); }
    catch (error) { send(res,error.message === "Payload too large" ? 413 : 500,{error:error.message}); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createApp().listen(PORT,()=>console.log(`Lumberjacks Marketplace running on http://localhost:${PORT}`));
