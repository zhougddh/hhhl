const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ========== 蓝莓云数据库固定配置 ==========
const db = mysql.createConnection({
    host: "hk1.88696.xyz", // 蓝莓云外网地址，Render外部访问用
    user: "a358473",
    password: "p635l3gw",
    database: "a358473",
    port: 3306
});

// 数据库连接 + 自动创建用户表
db.connect((err) => {
    if (err) {
        console.log("数据库连接失败：", err);
        return;
    }
    console.log("蓝莓云数据库连接成功");
    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS user(
        id INT AUTO_INCREMENT PRIMARY KEY,
        account VARCHAR(32) NOT NULL UNIQUE,
        password VARCHAR(32) NOT NULL,
        qa VARCHAR(100)
    )
    `;
    db.query(createTableSQL);
});

// 管理员登录（管理员账号密码依旧放Render环境变量）
app.post('/admin-login', (req, res) => {
    const { account, pwd } = req.body;
    const adminAcc = process.env.ADMIN_ACCOUNT;
    const adminPwd = process.env.ADMIN_PWD;
    if (account === adminAcc && pwd === adminPwd) {
        return res.json({ code: 200, msg: "登录成功" });
    } else {
        return res.json({ code: 400, msg: "账号或密码错误" });
    }
});

// 普通用户登录
app.post('/login', (req, res) => {
    const { account, password } = req.body;
    const sql = "SELECT * FROM user WHERE account = ? AND password = ?";
    db.query(sql, [account, password], (err, result) => {
        if (err) return res.json({ code: 500, msg: "数据库异常" });
        if (result.length > 0) return res.json({ code: 200, msg: "登录成功" });
        return res.json({ code: 400, msg: "账号或密码错误" });
    });
});

// 用户注册
app.post('/register', (req, res) => {
    const { account, password, qa } = req.body;
    const sql = "INSERT INTO user(account,password,qa) VALUES (?,?,?)";
    db.query(sql, [account, password, qa], (err) => {
        if (err) return res.json({ code: 500, msg: "数据库异常" });
        return res.json({ code: 200, msg: "注册成功" });
    });
});

// 首页页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
    console.log("服务启动完成");
});
