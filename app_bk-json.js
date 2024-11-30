//JSONデータを使用したAPIの完成形です。バックアップとして残しています。

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const mysql = require('mysql2');

const app = express();
const port = 4000;

app.use(cors({
  origin: 'http://localhost:3000', // フロントエンドのURL
  credentials: true  // クッキーを許可
}));

// セッション設定
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,  // 本番環境では secure を true にする
    // httpOnly: true,  // XSS攻撃を防ぐ
    // sameSite: 'Strict', // CSRF攻撃を防ぐためにクロスサイトクッキーを許可
    // maxAge: 60 * 60 * 1000,  // 1時間
  }
}));

app.use(express.json());

// MySQLの接続設定
const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'ec_app',
  charset: 'utf8mb4'
});
db.connect((err) => {
  if(err) {
    console.error('MySQLの接続に失敗しました: ', err);
    process.exit();
  }
  console.log('MySQLに接続しました');
});

// ユーザー登録API
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/user.json')));
  // ユーザーが既に登録されているかチェック
  if (users.find(user => user.email === email)) {
    return res.status(400).json({ message: 'このメールアドレスは既に使用されています' });
  }
  // ユーザーの登録
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    userId: users.length + 1,
    username,
    email,
    password: hashedPassword
  };
  users.push(newUser);
  // ユーザー情報を保存
  fs.writeFileSync(path.join(__dirname, 'data/user.json'), JSON.stringify(users, null, 2));
  res.status(201).json({ message: 'ユーザー登録が完了しました' });
});

// ログインAPI
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/user.json')));
  // ユーザーを探す
  const user = users.find(user => user.email === email);
  if (!user) {
    return res.status(400).json({ message: 'メールアドレスまたはパスワードが間違っています' });
  }
  // パスワードを検証
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ message: 'メールアドレスまたはパスワードが間違っています' });
  }
  // ログイン状態をセッションに保存
  req.session.user = user;
  res.json({ message: 'ログイン成功' });
});

// ログイン状態チェックAPI
app.post('/api/user', (req, res) => {
  console.log('ログイン状態チェック:', req.session.user);
  if (req.session.user) {
    res.json(req.session.user);
  } else {
    res.clearCookie('connect.sid');
    res.status(401).json({message: 'Unauthorized'});
  }
});

// ログアウトAPI
app.get('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({message: 'ログアウトに失敗しました' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'ログアウト成功' });
  });
});

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
app.get('/api/cart/:userId', (req, res) => {
  const { userId } = req.params;
  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
  const usersCart = cart.filter(item => item.userId === parseInt(userId, 10));
  res.json(usersCart);
});

// カートに商品を追加API
app.post('/api/cart', (req, res) => {
  const { userId, productId, quantity } = req.body;
  const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/stocks.json')));
  const productStock = stocks.find(item => item.productId === productId);
  if (quantity > productStock.stock) {
    res.status(409).json({...productStock, message: '他のお客様が購入した為、在庫数が足りません。'});
    return;
  }

  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
  const productExists = cart.find(item => item.userId === userId && item.productId === productId);

  if (quantity > productStock.stock - (productExists ? productExists.quantity : 0)) {
    res.status(409).json({...productStock, message: `既に${productExists.quantity}個がカートに入っている為、その数量をカートに追加する事はできません。`});
    return;
  }

  if (productExists) {
    productExists.cartId = `${userId}_${Date.now()}`;
    productExists.quantity += quantity;
  } else {
    cart.push({ 
      cartId: `${userId}_${Date.now()}`,
      userId,
      productId, 
      quantity 
    });
  }

  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify(cart, null, 2), 'utf8');
  res.json({ message: '商品がカートに追加されました' });
});

// カートから商品を削除API
app.delete('/api/cart', (req, res) => {
  const { cartId } = req.body;
  const cart = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));

  const newCart = cart.filter(item => item.cartId !== cartId);
  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify(newCart, null, 2), 'utf8');
  res.json({ message: '商品がカートから削除されました' });
});

// 注文の確定API
app.post('/api/orders', (req, res) => {
  const { user, cart, totalAmount } = req.body;
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
    userId: user.userId,
    totalAmount,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  // 注文が完了したら、注文商品情報を更新
  const orderedProducts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/ordered_products.json')));
  const products = getProductsWithStocks();
  let orderedProductId = orderedProducts.length;
  const newOrderedProducts = cart.map(item => {
    orderedProductId++;
    const product = products.find(product => product.id === item.productId)
    return{
      orderedProductId,
      orderId,
      productId: item.productId,
      price: product.price,
      quantity: item.quantity,
      createdAt: new Date().toISOString()
    }
  });
  orderedProducts.push(...newOrderedProducts);
  // 注文が完了したら、在庫を更新
  cart.forEach(item => {
    const productStock = stocks.find(stock => stock.productId === item.productId);
    if (productStock) {
      productStock.stock -= item.quantity;
    }
  });
  // 注文が完了したら、カートをリセット
  const cartAll = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
  const newCart = cartAll.filter(item => item.userId !== user.userId);

  // 注文情報を保存
  fs.writeFileSync(path.join(__dirname, 'data/orders.json'), JSON.stringify(orders, null, 2), 'utf8');
  // 注文詳細情報を保存
  fs.writeFileSync(path.join(__dirname, 'data/ordered_products.json'), JSON.stringify(orderedProducts, null, 2), 'utf8');
  // 在庫情報を保存
  fs.writeFileSync(path.join(__dirname, 'data/stocks.json'), JSON.stringify(stocks, null, 2), 'utf8');
  // カートをリセット
  fs.writeFileSync(path.join(__dirname, 'data/cart.json'), JSON.stringify(newCart, null, 2), 'utf8');
  res.json({ message: '注文が完了しました', orderId });
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});