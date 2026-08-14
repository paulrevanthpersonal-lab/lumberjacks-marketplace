const core=window.LumberjackCore;
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const state={products:[],categories:["All"],query:"",category:"All",sort:"featured",cart:JSON.parse(localStorage.getItem("lumberjack-cart")||"{}"),token:localStorage.getItem("lumberjack-token")||"",user:null,selected:null,api:true};
const esc=value=>String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

async function request(path,options={}){
  const headers={"Content-Type":"application/json",...(state.token?{Authorization:`Bearer ${state.token}`}:{}) ,...(options.headers||{})};
  const response=await fetch(path,{...options,headers});
  if(!response.ok){const message=await response.json().catch(()=>({error:`Request failed (${response.status})`}));throw new Error(message.error||"Request failed");}
  return response.json();
}

async function loadCatalog(){
  try{const payload=await request("/api/products");state.products=payload.items;state.categories=payload.categories;state.api=true;}
  catch{const response=await fetch("data/products.json");state.products=await response.json();state.categories=["All",...new Set(state.products.map(item=>item.category))];state.api=false;}
}

async function restoreSession(){
  if(!state.token)return;
  try{const payload=await request("/api/session");state.user=payload.user;const cart=await request("/api/cart");state.cart=Object.fromEntries(cart.lines.map(line=>[line.productId,line.quantity]));}
  catch{state.token="";state.user=null;localStorage.removeItem("lumberjack-token");}
}

function notify(message){const toast=$("#toast");toast.textContent=message;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),2400);}
function route(name){if(!$( `[data-page="${name}"]`))name="home";$$('[data-page]').forEach(page=>page.classList.toggle("active",page.dataset.page===name));$$('[data-route]').forEach(button=>button.classList.toggle("active",button.dataset.route===name));location.hash=name;scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});if(name==="orders")renderOrders();if(name==="operations")renderOperations();document.body.classList.remove("nav-open");}
function currentLines(){return core.normalizeLines(state.cart);}
function persist(){localStorage.setItem("lumberjack-cart",JSON.stringify(state.cart));if(state.user&&state.api)request("/api/cart",{method:"PUT",body:JSON.stringify({lines:currentLines()})}).catch(error=>notify(error.message));}

function productCard(item){const stockLabel=item.stock<12?`Only ${item.stock} left`:item.stock<20?"Low stock":"In stock";return `<article class="product-card">
  <button class="product-image" data-product="${esc(item.id)}" aria-label="View ${esc(item.name)}"><img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy"><span>${esc(item.category)}</span></button>
  <div class="product-copy"><div class="product-meta"><span>${esc(item.origin)}</span><span>★ ${item.rating} (${item.reviews})</span></div><button class="product-title" data-product="${esc(item.id)}">${esc(item.name)}</button><p>${esc(item.unit)}</p><div class="product-buy"><strong>${core.money(item.price)}</strong><button data-add="${esc(item.id)}" ${item.stock<1?"disabled":""}>${item.stock<1?"Sold out":"Add"}</button></div><small class="stock ${item.stock<20?"low":""}">${stockLabel}</small></div>
</article>`;}

function renderProducts(){const visible=core.filter(state.products,state);$("#resultSummary").textContent=`${visible.length} of ${state.products.length} products`;$("#productGrid").innerHTML=visible.length?visible.map(productCard).join(""):`<div class="empty-state"><h2>No products found</h2><p>Try a broader search or another department.</p><button class="secondary" id="clearFilters">Clear filters</button></div>`;$("#featuredProducts").innerHTML=state.products.filter(item=>item.rating>=4.8).slice(0,4).map(productCard).join("");$("#categoryBar").innerHTML=state.categories.map(category=>`<button data-category="${esc(category)}" class="${category===state.category?"active":""}">${esc(category)}</button>`).join("");}

function openProduct(id){const item=state.products.find(product=>product.id===id);if(!item)return;state.selected=item;$("#detailImage").src=item.image;$("#detailImage").alt=item.name;$("#detailMeta").textContent=`${item.category} · ${item.sku}`;$("#detailName").textContent=item.name;$("#detailRating").textContent=`★ ${item.rating} from ${item.reviews} verified reviews`;$("#detailDescription").textContent=item.description;$("#detailFacts").innerHTML=`<div><dt>Pack</dt><dd>${esc(item.unit)}</dd></div><div><dt>Origin</dt><dd>${esc(item.origin)}</dd></div><div><dt>Availability</dt><dd>${item.stock} units</dd></div>`;$("#detailPrice").textContent=core.money(item.price);$("#productDialog").showModal();}

function addItem(id,quantity=1){const item=state.products.find(product=>product.id===id);if(!item)return;const next=(state.cart[id]||0)+quantity;if(next>item.stock){notify(`Only ${item.stock} available`);return;}if(next<=0)delete state.cart[id];else state.cart[id]=next;persist();renderCart();notify(quantity>0?`${item.name} added`:`${item.name} updated`);}

function renderCart(){const lines=currentLines().map(line=>({...line,product:state.products.find(item=>item.id===line.productId)})).filter(line=>line.product);$("#cartCount").textContent=lines.reduce((sum,line)=>sum+line.quantity,0);$("#cartLines").innerHTML=lines.length?lines.map(({product,quantity})=>`<article class="cart-line"><img src="${esc(product.image)}" alt=""><div><strong>${esc(product.name)}</strong><small>${esc(product.unit)} · ${core.money(product.price)}</small><button data-remove="${esc(product.id)}">Remove</button></div><div class="stepper"><button data-step="-1" data-id="${esc(product.id)}" aria-label="Remove one">−</button><span>${quantity}</span><button data-step="1" data-id="${esc(product.id)}" aria-label="Add one">+</button></div></article>`).join(""):`<div class="empty-basket"><span>LM</span><h3>Your basket is empty</h3><p>Add market goods and they will appear here.</p></div>`;const totals=core.totals(currentLines(),state.products);$("#cartSummary").innerHTML=`<p><span>Subtotal</span><strong>${core.money(totals.subtotal)}</strong></p><p><span>Delivery</span><strong>${totals.delivery?core.money(totals.delivery):"Free"}</strong></p><p><span>Estimated tax</span><strong>${core.money(totals.tax)}</strong></p><p class="grand"><span>Total</span><strong>${core.money(totals.total)}</strong></p>`;}

function openCart(){$("#cartDrawer").classList.add("open");$("#cartDrawer").setAttribute("aria-hidden","false");$("#openCart").setAttribute("aria-expanded","true");$("#scrim").hidden=false;$("#closeCart").focus();}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#cartDrawer").setAttribute("aria-hidden","true");$("#openCart").setAttribute("aria-expanded","false");$("#scrim").hidden=true;}

async function renderOrders(){const panel=$("#ordersPanel");if(!state.user||!state.api){panel.innerHTML=`<div class="sign-in-state"><span>01</span><h2>Sign in to view server-saved orders</h2><p>The hosted frontend can be explored without an account. Run the full service locally and use the reviewer credentials for persistent order history.</p><button class="primary" id="ordersSignIn">Sign in</button></div>`;return;}panel.innerHTML=`<p class="loading">Loading order history…</p>`;try{const orders=await request("/api/orders");panel.innerHTML=orders.length?orders.map(order=>`<article class="order-card"><div><span>${esc(order.status)}</span><h2>${esc(order.id)}</h2><p>${new Date(order.createdAt).toLocaleString()}</p></div><div><small>${Array.isArray(order.items)?order.items.reduce((sum,item)=>sum+item.quantity,0):order.items} items</small><strong>${core.money(order.total)}</strong></div></article>`).join(""):`<div class="sign-in-state"><h2>No orders yet</h2><p>Your confirmed orders will appear here.</p></div>`;}catch(error){panel.innerHTML=`<div class="sign-in-state"><h2>Could not load orders</h2><p>${esc(error.message)}</p></div>`;}}

async function renderOperations(){const metrics=$("#operationsMetrics"),low=$("#lowStock"),audit=$("#auditStream");if(!state.api){metrics.innerHTML=`<article><span>Catalog</span><strong>${state.products.length}</strong><small>Static review build</small></article>`;low.innerHTML=`<p class="panel-note">Run <code>npm start</code> to view live inventory operations.</p>`;audit.innerHTML=`<p class="panel-note">Mutation events are recorded by the local service.</p>`;return;}try{const data=await request("/api/operations");metrics.innerHTML=[['Catalog',data.catalogSize,'active SKUs'],['Inventory',data.unitsInStock,'units available'],['Orders',data.orders,'recorded orders'],['Revenue',core.money(data.revenue),'seed + test orders']].map(item=>`<article><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></article>`).join("");low.innerHTML=data.lowStock.map(item=>`<div class="data-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.sku)}</small></div><span>${item.stock} units</span></div>`).join("");audit.innerHTML=data.audit.length?data.audit.map(item=>`<div class="data-row"><div><strong>${esc(item.type)}</strong><small>${new Date(item.at).toLocaleString()}</small></div><span>${esc(item.orderId||`${item.lines||0} lines`)}</span></div>`).join(""):`<p class="panel-note">No mutations recorded yet.</p>`;}catch(error){metrics.innerHTML=`<p class="panel-note">${esc(error.message)}</p>`;}}

document.addEventListener("click",event=>{
  const routeButton=event.target.closest("[data-route]");if(routeButton)route(routeButton.dataset.route);
  const product=event.target.closest("[data-product]");if(product)openProduct(product.dataset.product);
  const add=event.target.closest("[data-add]");if(add)addItem(add.dataset.add);
  const category=event.target.closest("[data-category]");if(category){state.category=category.dataset.category;renderProducts();}
  const step=event.target.closest("[data-step]");if(step)addItem(step.dataset.id,Number(step.dataset.step));
  const remove=event.target.closest("[data-remove]");if(remove){delete state.cart[remove.dataset.remove];persist();renderCart();}
  const close=event.target.closest("[data-close]");if(close)$( `#${close.dataset.close}`).close();
  if(event.target.id==="clearFilters"){state.query="";state.category="All";$("#searchInput").value="";renderProducts();}
  if(event.target.id==="ordersSignIn")$("#accountDialog").showModal();
});

$("#searchInput").addEventListener("input",event=>{state.query=event.target.value;renderProducts();});
$("#sortSelect").addEventListener("change",event=>{state.sort=event.target.value;renderProducts();});
$("#openCart").addEventListener("click",openCart);$("#closeCart").addEventListener("click",closeCart);$("#scrim").addEventListener("click",closeCart);
$("#accountButton").addEventListener("click",()=>state.user?route("orders"):$("#accountDialog").showModal());
$("#menuButton").addEventListener("click",()=>document.body.classList.toggle("nav-open"));
$("#detailAdd").addEventListener("click",()=>{if(state.selected)addItem(state.selected.id);$("#productDialog").close();});
$("#beginCheckout").addEventListener("click",()=>{if(!currentLines().length)return notify("Your basket is empty");closeCart();if(!state.user||!state.api)$("#accountDialog").showModal();else $("#checkoutDialog").showModal();});
$("#loginForm").addEventListener("submit",async event=>{event.preventDefault();$("#loginError").textContent="";try{const payload=await request("/api/auth/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});state.token=payload.token;state.user=payload.user;localStorage.setItem("lumberjack-token",state.token);await request("/api/cart",{method:"PUT",body:JSON.stringify({lines:currentLines()})});$("#accountButton").textContent=state.user.name.split(" ")[0];$("#accountDialog").close();notify("Signed in · basket saved to your account");}catch(error){$("#loginError").textContent=state.api?error.message:"Run the local service to use account features.";}});
$("#checkoutForm").addEventListener("submit",async event=>{event.preventDefault();$("#checkoutError").textContent="";try{await request("/api/cart",{method:"PUT",body:JSON.stringify({lines:currentLines()})});const payload=Object.fromEntries(new FormData(event.currentTarget));const order=await request("/api/orders",{method:"POST",body:JSON.stringify(payload)});state.cart={};persist();renderCart();$("#checkoutDialog").close();notify(`Order ${order.id} confirmed`);route("orders");}catch(error){$("#checkoutError").textContent=error.message;}});
window.addEventListener("keydown",event=>{if(event.key==="Escape")closeCart();if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();route("shop");$("#searchInput").focus();}});

await loadCatalog();await restoreSession();if(state.user)$("#accountButton").textContent=state.user.name.split(" ")[0];renderProducts();renderCart();route(location.hash.slice(1)||"home");
