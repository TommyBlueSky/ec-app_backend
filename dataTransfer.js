const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');

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

// user.jsonをMySQLへデータ移管
// const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/user.json')));
// users.forEach(user => {
//   const { username, email, password } = user;
//   db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password], (err, result) => {
//     if (err) {
//       console.error('ユーザーの挿入に失敗しました: ', err);
//     } else {
//       console.log('ユーザーが挿入されました: ', result.insertId);
//     }
//   });
// });

// cart.jsonをMySQLへデータ移管
const carts = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cart.json')));
carts.forEach(cart => {
  const { userId: user_id, productId: product_id, quantity } = cart;
  db.query('INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, ?)', [user_id, product_id, quantity], (err, result) => {
    if (err) {
      console.error('カート情報の挿入に失敗しました: ', err);
    } else {
      console.log('カート情報が挿入されました: ', result.insertId);
    }
  });
});

// products.jsonをMySQLへデータ移管
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/products.json')));
products.forEach(product => {
  const { name, price, description } = product;
  db.query('INSERT INTO products (name, price, description) VALUES (?, ?, ?)', [name, price, description], (err, result) => {
    if (err) {
      console.error('商品情報の挿入に失敗しました: ', err);
    } else {
      console.log('商品情報が挿入されました: ', result.insertId);
    }
  });
});

// orders.jsonをMySQLへデータ移管
const orders = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/orders.json')));
orders.forEach(order => {
  const { userId: user_id, totalAmount: total_amount } = order;
  db.query('INSERT INTO orders (user_id, total_amount) VALUES (?, ?)', [user_id, total_amount], (err, result) => {
    if (err) {
      console.error('注文情報の挿入に失敗しました: ', err);
    } else {
      console.log('注文情報が挿入されました: ', result.insertId);
    }
  });
});

// ordered_products.jsonをMySQLへデータ移管
const ordered_products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/ordered_products.json')));
ordered_products.forEach(ordered_product => {
  const { orderId: order_id, productId: product_id, price, quantity } = ordered_product;
  db.query('INSERT INTO ordered_products (order_id, product_id, price, quantity) VALUES (?, ?, ?, ?)', [order_id, product_id, price, quantity], (err, result) => {
    if (err) {
      console.error('注文商品情報の挿入に失敗しました: ', err);
    } else {
      console.log('注文商品情報が挿入されました: ', result.insertId);
    }
  });
});

// stocks.jsonをMySQLへデータ移管
const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/stocks.json')));
stocks.forEach(s => {
  const { productId: product_id, stock } = s;
  db.query('INSERT INTO stocks (product_id, stock) VALUES (?, ?)', [product_id, stock], (err, result) => {
    if (err) {
      console.error('在庫情報の挿入に失敗しました: ', err);
    } else {
      console.log('在庫情報が挿入されました: ', product_id);
    }
  });
});