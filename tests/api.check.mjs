import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Readable} from "node:stream";

const sandbox=await mkdtemp(join(tmpdir(),"lumberjack-api-"));
process.env.LUMBERJACK_DATA_FILE=join(sandbox,"runtime.json");
const {handleApi}=await import(`../server.js?test=${Date.now()}`);

async function call(method,path,payload,token=""){
  const input=payload===undefined?[]:[Buffer.from(JSON.stringify(payload))];
  const req=Readable.from(input);req.method=method;req.headers={...(token?{authorization:`Bearer ${token}`}:{})};
  let status=0,raw="";
  const res={writeHead(code){status=code;},end(value){raw=value||"";}};
  await handleApi(req,res,new URL(path,"http://localhost"));
  return{status,body:raw?JSON.parse(raw):null};
}

try{
  const health=await call("GET","/api/health");
  assert.deepEqual(health.body,{status:"ok",service:"lumberjacks-marketplace",products:36});
  const filtered=await call("GET","/api/products?category=Bakery&q=sourdough");
  assert.ok(filtered.body.items.some(item=>item.id==="bakery-sourdough"));

  const login=await call("POST","/api/auth/login",{email:"paul@lumberjacks.local",password:"Lumberjack2026!"});
  assert.equal(login.status,200);
  const token=login.body.token;
  const cart=await call("PUT","/api/cart",{lines:[{productId:"produce-oranges",quantity:2},{productId:"beverage-coffee",quantity:1}]},token);
  assert.equal(cart.status,200);assert.equal(cart.body.lines.length,2);

  const order=await call("POST","/api/orders",{address:"1500 S Lumberjack Road",deliverySlot:"Today, 5–7 PM"},token);
  assert.equal(order.status,201);assert.match(order.body.id,/^LM-/);assert.equal(order.body.status,"Confirmed");
  const empty=await call("GET","/api/cart",undefined,token);
  assert.equal(empty.body.lines.length,0);
  const unauthorized=await call("POST","/api/orders",{});
  assert.equal(unauthorized.status,401);
  console.log("API integration check passed");
}finally{
  await rm(sandbox,{recursive:true,force:true});
}
