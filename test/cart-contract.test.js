/* Headless contract test for the cart + dataLayer layer. No DOM needed. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = require('path').resolve(__dirname, '..');

const sandbox = {
  console, setTimeout, clearTimeout, Promise, Math, Date, JSON, Intl, Error, Object, Array, String, Number,
  URLSearchParams,
  crypto: require('crypto').webcrypto,
};
sandbox.window = sandbox;
sandbox.window.location = { search: '?variation=b' };
vm.createContext(sandbox);

for (const f of ['config.js','product-data.js','analytics.js','cart-api.js','cart-mock.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js',f),'utf8'), sandbox, { filename: f });
}

const D = sandbox.window.Digicom;
let pass = 0, fail = 0;
const ok  = (n,c,extra='') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${extra}`)); };

console.log('\n── dataLayer init ─────────────────────────────');
ok('window.dataLayer is an array', Array.isArray(sandbox.window.dataLayer));
ok('starts empty', sandbox.window.dataLayer.length === 0);
ok('page_variation read from ?variation=b', D.config.pageVariation === 'b', `got ${D.config.pageVariation}`);

console.log('\n── view_item fires once per page load ─────────');
const v = D.product.variants[1]; // stemless / couple pair — 80.92
const tracked = { id: v.id, name: D.product.name, brand: D.product.brand, variantName: v.title, price: v.price };
D.analytics.viewItem(tracked);
D.analytics.viewItem(tracked);
D.analytics.viewItem(tracked);
const viewEvents = sandbox.window.dataLayer.filter(e => e.event === 'view_item');
ok('exactly one view_item after 3 calls', viewEvents.length === 1, `got ${viewEvents.length}`);
ok('preceded by ecommerce:null reset', sandbox.window.dataLayer[0].ecommerce === null);
const vi = viewEvents[0];
ok('carries page_variation', vi.page_variation === 'b');
ok('currency present', vi.ecommerce.currency === 'USD');
ok('value = unit price', vi.ecommerce.value === 80.92, `got ${vi.ecommerce.value}`);
ok('item_id is the variant id', vi.ecommerce.items[0].item_id === String(v.id));
ok('item_name is the product name', vi.ecommerce.items[0].item_name === 'VoChill Wine Chiller');
ok('quantity 1', vi.ecommerce.items[0].quantity === 1);

console.log('\n── /cart/add.js request shape ─────────────────');
let captured = null;
const spy = (url, init) => { captured = { url, init }; return realTransport(url, init); };
const realTransport = D.cartMock.createTransport(id => {
  const found = D.product.variants.find(x => x.id === id);
  if (!found) return null;
  return { id: found.id, productId: D.product.id, productTitle: D.product.name, title: found.title,
           sku: found.sku, price: found.price, inventory: found.inventory, handle: D.product.handle, image: null };
});

(async () => {
  const res = await D.cartApi.addToCart({ variantId: v.id, quantity: 2 }, spy);
  ok('POSTs to /cart/add.js', captured.url === '/cart/add.js', `got ${captured.url}`);
  ok('method is POST', captured.init.method === 'POST');
  ok('Content-Type application/json', captured.init.headers['Content-Type'] === 'application/json');
  const body = JSON.parse(captured.init.body);
  ok('body is { items: [...] }', Array.isArray(body.items) && body.items.length === 1);
  ok('sends the selected variant id', body.items[0].id === v.id, `got ${body.items[0].id}`);
  ok('sends the quantity', body.items[0].quantity === 2);
  ok('response has items[]', Array.isArray(res.items));
  ok('price returned in minor units', res.items[0].price === 8092, `got ${res.items[0].price}`);
  ok('line_price = price x qty', res.items[0].line_price === 16184, `got ${res.items[0].line_price}`);

  console.log('\n── add_to_cart fires only on success ──────────');
  D.analytics.addToCart(tracked, 2);
  const atc = sandbox.window.dataLayer.filter(e => e.event === 'add_to_cart');
  ok('one add_to_cart', atc.length === 1);
  ok('value = unit x qty', atc[0].ecommerce.value === 161.84, `got ${atc[0].ecommerce.value}`);
  ok('unit price unchanged in item', atc[0].ecommerce.items[0].price === 80.92);
  ok('quantity 2', atc[0].ecommerce.items[0].quantity === 2);
  ok('carries page_variation', atc[0].page_variation === 'b');
  ok('carries event_id for Meta dedup', typeof atc[0].event_id === 'string' && atc[0].event_id.length > 8, `got ${atc[0].event_id}`);

  console.log('\n── failure paths push nothing ─────────────────');
  const before = sandbox.window.dataLayer.length;

  // 422: over inventory (stemmed pair-plus has 4)
  const scarce = D.product.variants.find(x => x.inventory === 4);
  let err422 = null;
  try { await D.cartApi.addToCart({ variantId: scarce.id, quantity: 99 }, realTransport); }
  catch (e) { err422 = e; }
  ok('over-inventory rejects', err422 !== null);
  ok('status 422', err422 && err422.status === 422, `got ${err422 && err422.status}`);
  ok('CartError carries Shopify description', err422 && /only add 4/.test(err422.message), `got "${err422 && err422.message}"`);

  // 404: unknown variant
  let err404 = null;
  try { await D.cartApi.addToCart({ variantId: 111111, quantity: 1 }, realTransport); }
  catch (e) { err404 = e; }
  ok('unknown variant rejects', err404 !== null);
  ok('status 404', err404 && err404.status === 404);

  ok('no dataLayer pushes from failures', sandbox.window.dataLayer.length === before,
     `grew by ${sandbox.window.dataLayer.length - before}`);

  console.log(`\n${'─'.repeat(47)}\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
