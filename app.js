const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const mysql = require('mysql2');
const { rejects } = require('assert');

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
  // ユーザーが既に登録されているかチェック
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({message: 'データベースエラー'});
    if (results.length > 0) return res.status(400).json({ message: 'このメールアドレスは既に使用されています' });
    // ユーザーの登録
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = {
      username,
      email,
      password: hashedPassword
    };
    db.query('INSERT INTO users SET ?', newUser, (err, results) => {
      if (err) return res.status(500).json({ message: 'データベースエラー' });
      res.status(201).json({ message: 'ユーザー登録が完了しました' });
    });
  });
});

// ログインAPI
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'データベースエラー' });
    // ユーザーを探す
    if (results.length === 0) return res.status(400).json({ message: 'メールアドレスまたはパスワードが間違っています' });
    // パスワードを検証
    const user = results[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ message: 'メールアドレスまたはパスワードが間違っています' });
    //   // ログイン状態をセッションに保存
    req.session.user = user;
    res.json({ message: 'ログイン成功' });
  });
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
  return new Promise ((resolve) => {
    db.query('SELECT * FROM products', (err, products) => {
      if (err) return res.status(500).json({ message: 'データベースエラー' });
      db.query('SELECT * FROM stocks', (err, stocks) => {
        if (err) return res.status(500).json({ message: 'データベースエラー' });
        const productsAndStocks =  products.map(product => {
          const stockData = stocks.find(stock => stock.product_id === product.product_id);
          return {...product, stock: stockData.stock};
        });
        resolve(productsAndStocks);
      });
    });
  });
};

// 商品一覧API
app.get('/api/products', (req, res) => {
  getProductsWithStocks()
  .then(productsAndStocks => { res.json(productsAndStocks) })
  .catch(error => { console.error(error) });
});

// 商品詳細API
app.get('/api/products/:productId', (req, res) => {
  const { productId } = req.params;
  getProductsWithStocks()
  .then(productsAndStocks => {
    const product = productsAndStocks.find(p => p.product_id === parseInt(productId, 10));
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: '商品が見つかりません' });
    }
  })
  .catch(error => { console.error(error) });
});

// カートの取得API
app.get('/api/cart/:userId', (req, res) => {
  const { userId } = req.params;
  db.query('SELECT * FROM carts WHERE user_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'データベースエラー' });
    res.json(results);
  });
});

// カートに商品を追加API
app.post('/api/cart', (req, res) => {
  const { user_id, product_id, quantity } = req.body;
  db.query('SELECT * FROM stocks WHERE product_id = ?', [product_id], (err, stocks) => {
    if (err) return res.status(500).json({ message: 'データベースエラー' });
    if (quantity > stocks[0].stock) {
      res.status(409).json({...stocks[0], message: '他のお客様が購入した為、在庫数が足りません。'});
      return;
    }
    db.query('SELECT * FROM carts WHERE user_id = ? AND product_id = ?', [user_id, product_id], (err, productExists) => {
      if (err) return res.status(500).json({ message: 'データベースエラー' });
      if (quantity > stocks[0].stock - (productExists.length === 0 ? 0 : productExists[0].quantity)) {
        res.status(409).json({...stocks[0], message: `既に${productExists[0].quantity}個がカートに入っている為、その数量をカートに追加する事はできません。`});
        return;
      }
      if (productExists.length === 0) {
        db.query('INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)', [user_id, product_id, quantity], (err, results) => {
          if (err) return res.status(500).json({ message: 'データベースエラー' });
        });
      } else {
        productExists[0].quantity += quantity;
        db.query('UPDATE carts SET quantity = ? WHERE user_id = ? AND product_id = ?', [productExists[0].quantity, user_id, product_id], (err, results) => {
          if (err) return res.status(500).json({ message: 'データベースエラー' });
        });
      }
      res.json({ message: '商品がカートに追加されました' });
    });
  });
});

// カートから商品を削除API
app.delete('/api/cart', (req, res) => {
  const { cartId } = req.body;
  db.query('DELETE FROM carts WHERE cart_id = ?', [cartId], (err, results) => {
    if (err) return res.status(500).json({ message: 'データベースエラー' });
    if (results.affectedRows === 0) return res.status(404);
    res.json({ message: '商品がカートから削除されました' });
  });
});

// 注文の確定API
app.post('/api/orders', async (req, res) => {
  const { user, cart, totalAmount } = req.body;
  try {
    // トランザクションの開始
    await new Promise((resolve, reject) => {
      db.beginTransaction((err) => {
        if (err) reject('トランザクションの開始に失敗しました');
        resolve();
      });
    });
    // 注文が在庫より多かったらエラーを返す
    for (let item of cart) {
      const stocks = await new Promise((resolve, reject) => {
        db.query('SELECT stock FROM stocks WHERE product_id = ?', [item.product_id], (err, stocks) => {
          if (err) reject('データベースエラー');
          resolve(stocks);
        });
      });
      if (item.quantity > stocks[0].stock) {
        await new Promise((resolve, reject) => {
          db.rollback(() => {
            reject({ message: `他のお客様が購入した為、在庫が不足しています。ページを更新の上ご確認ください。` });
          });
        });
      }
    }
    // 注文が完了したら、注文情報を更新
    const insertOrderResult = await new Promise((resolve, reject) => {
      db.query('INSERT INTO orders (user_id, total_amount, created_at) VALUES (?, ?, NOW())', [user.user_id, totalAmount], (err, results) => {
        if (err) reject('データベースエラー');
        resolve(results);
      });
    });
    const order_id = insertOrderResult.insertId;
    // 注文商品情報を更新
    const productsAndStocks = await getProductsWithStocks();
    for (let item of cart) {
      const product = productsAndStocks.find(product => product.product_id === item.product_id);
      await new Promise((resolve, reject) => {
        db.query(
          'INSERT INTO ordered_products (order_id, product_id, price, quantity, created_at) VALUES (?, ?, ?, ?, NOW())',
          [order_id, item.product_id, product.price, item.quantity], (err, results) => {
            if (err) reject('データベースエラー');
            resolve(results);
        });
      });
      // 在庫を更新
      await new Promise((resolve, reject) => {
        db.query('UPDATE stocks SET stock = stock - ? WHERE product_id = ?', [item.quantity, product.product_id], (err, results) => {
          if (err) reject('データベースエラー');
          resolve(results);
        });
      });
    }
    // カートをクリア
    await new Promise((resolve, reject) => {
      db.query('DELETE FROM carts WHERE user_id = ?', [user.user_id], (err) => {
        if (err) reject('データベースエラー');
        resolve();
      });
    });
    // コミット
    await new Promise((resolve, reject) => {
      db.commit((err) => {
        if (err) reject('データベースエラー');
        resolve();
      });
    });
    res.json({ message: '注文が完了しました', order_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'データベースエラー' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});