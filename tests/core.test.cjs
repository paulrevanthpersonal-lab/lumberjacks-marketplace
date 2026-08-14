const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const {readFileSync}=require("node:fs");
const products=require("../data/products.json");
const context={};context.globalThis=context;vm.runInNewContext(readFileSync(require.resolve("../assets/core.js"),"utf8"),context);const core=context.LumberjackCore;

test("catalog contains 36 complete and uniquely identified products",()=>{
  assert.equal(products.length,36);
  assert.equal(new Set(products.map(item=>item.id)).size,36);
  products.forEach(item=>{assert.ok(item.sku&&item.name&&item.category&&item.description&&item.image);assert.ok(item.price>0);assert.ok(Number.isInteger(item.stock));});
});

test("catalog filtering searches product metadata without mutating source",()=>{
  const snapshot=JSON.stringify(products);
  const local=core.filter(products,{query:"local",category:"Produce",sort:"rating"});
  assert.ok(local.length>=2);
  assert.ok(local.every(item=>item.category==="Produce"&&(item.tags.includes("local")||item.origin.toLowerCase().includes("local"))));
  assert.equal(JSON.stringify(products),snapshot);
});

test("cart totals apply free-delivery threshold and Arizona estimate",()=>{
  const small=core.totals([{productId:"produce-oranges",quantity:1}],products);
  assert.equal(small.delivery,5.99);
  const large=core.totals([{productId:"beverage-coffee",quantity:4}],products);
  assert.equal(large.delivery,0);
  assert.equal(large.total,66.98);
});
