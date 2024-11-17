const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 4000;

app.use(express.json());
app.use(cors());

// 商品オブジェクトと在庫オブジェクトを結合
const getProductsWithStocks = () => {
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json')));
  const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/stocks.json')));
  return products.map(product => {
    const stockData = stocks.find(stock => product.id === stock.productId);
    return {...product, stock: stockData.stock}
  });
}

// 商品一覧API
app.get('/api/products', (req, res) => {
  const products = getProductsWithStocks();
  res.json(products);
});

// 商品詳細API
app.get('/api/products/:productId', (req, res) => {
  const { productId } = req.params;
  const products = getProductsWithStocks();
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
  const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/stocks.json')));
  const productStock = stocks.find(item => item.productId === productId);
  if (quantity > productStock.stock) {
    res.status(409).json({...productStock, message: '他のお客様が購入した為、在庫数が足りません。'});
    return;
  }

  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
  const productExists = cart.find(item => item.productId === productId);

  if (quantity > productStock.stock - (productExists ? productExists.quantity : 0)) {
    res.status(409).json({...productStock, message: `既に${productExists.quantity}個がカートに入っている為、その数量をカートに追加する事はできません。`});
    return;
  }

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
  const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/stocks.json')));
  // 注文が在庫より多かったらエラーを返す
  for (const item of cart) {
    const productStock = stocks.find(stock => stock.productId === item.productId);
    if (item.quantity > productStock.stock) {
      return res.status(409).json({message: `他のお客様が購入した為、在庫が不足しています。ページを更新の上ご確認ください。`});
    }
  };  
  // 注文が完了したら、注文情報を更新
  const orders = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/orders.json')));
  const orderId = orders.length + 1;
  const order = { 
    orderId,
    cart,
    totalAmount,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  // 注文が完了したら、在庫を更新
  cart.forEach(item => {
    const productStock = stocks.find(stock => stock.productId === item.productId);
    if (productStock) {
      productStock.stock -= item.quantity;
    }
  });
  // 注文情報を保存
  fs.writeFileSync(path.join(__dirname, 'data/orders.json'), JSON.stringify(orders, null, 2), 'utf8');
  // 在庫情報を保存
  fs.writeFileSync(path.join(__dirname, 'data/stocks.json'), JSON.stringify(stocks, null, 2), 'utf8');
  // カートをリセット
  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify([], null, 2), 'utf8');
  res.json({ message: '注文が完了しました', orderId });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});