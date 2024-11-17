const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 4000;

app.use(express.json());
app.use(cors());

// 商品一覧API
app.get('/api/products', (req, res) => {
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json')));
  res.json(products);
});

// 商品詳細API
app.get('/api/products/:productId', (req, res) => {
  const { productId } = req.params;
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json')));
  const product = products.find(p => p.id === parseInt(productId));

  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: '商品が見つかりません' });
  }
});

// カートの取得API
app.get('/api/cart', (req, res) => {
  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
  res.json(cart);
});

// カートに商品を追加API
app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
  const productExists = cart.find(item => item.productId === productId);

  if (productExists) {
    productExists.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }

  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify(cart, null, 2), 'utf8');
  res.json({ message: '商品がカートに追加されました' });
});

// カートから商品を削除API
app.delete('/api/cart', (req, res) => {
  const { productId } = req.body;
  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));

  const newCart = cart.filter(item => item.productId !== productId);
  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify(newCart, null, 2), 'utf8');
  res.json({ message: '商品がカートから削除されました' });
});

// 注文の確定API
app.post('/api/orders', (req, res) => {
  const { cart, totalAmount } = req.body;
  const orders = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/orders.json')));

  const orderId = orders.length + 1;
  const order = { 
    orderId,
    cart,
    totalAmount,
    createdAt: new Date().toISOString()
  };
  orders.push(order);

  fs.writeFileSync(path.join(__dirname, 'data/orders.json'), JSON.stringify(orders, null, 2), 'utf8');
  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify([], null, 2), 'utf8');  // カートをリセット
  res.json({ message: '注文が完了しました', orderId });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});