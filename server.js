const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// 解析表单、json请求
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 托管前端静态页面 index.html
app.use(express.static(__dirname));

// ========== 数据库连接配置（匹配Render环境变量） ==========
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// 连接数据库 + 自动创建用户表
db.connect((err) => {
    if (err) {
        console.log("数据库连接失败：", err);
        return;
    }
    console.log("数据库连接成功");

    // 不存在则自动创建 user 用户表
    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS user(
        id INT AUTO_INCREMENT PRIMARY KEY,
        account VARCHAR(32) NOT NULL UNIQUE,
        password VARCHAR(32) NOT NULL,
        qa VARCHAR(100)
    )
    `;
    db.query(createTableSQL, (err) => {
        if (err) console.log("建表提示：", err);
        else console.log("用户数据表初始化完成");
    });
});

// ========== 管理员登录接口（仅读取环境变量校验，不依赖数据表） ==========
app.post('/admin-login', (req, res) => {
    const { account, pwd } = req.body;
    const realAdminAcc = process.env.ADMIN_ACCOUNT;
    const realAdminPwd = process.env.ADMIN_PWD;
    if (account === realAdminAcc && pwd === realAdminPwd) {
        return res.json({ code: 200, msg: "登录成功" });
    } else {
        return res.json({ code: 400, msg: "账号或密码错误" });
    }
});

// ========== 普通用户登录接口 ==========
app.post('/login', (req, res) => {
    const { account, password } = req.body;
    const sql = "SELECT * FROM user WHERE account = ? AND password = ?";
    db.query(sql, [account, password], (err, result) => {
        if (err) return res.json({ code: 500, msg: "数据库异常" });
        if (result.length > 0) {
            return res.json({ code: 200, msg: "登录成功" });
        } else {
            return res.json({ code: 400, msg: "账号或密码错误" });
        }
    });
});

// ========== 用户注册接口 ==========
app.post('/register', (req, res) => {
    const { account, password, qa } = req.body;
    const sql = "INSERT INTO user(account,password,qa) VALUES (?,?,?)";
    db.query(sql, [account, password, qa], (err) => {
        if (err) return res.json({ code: 500, msg: "数据库异常" });
        return res.json({ code: 200, msg: "注册成功" });
    });
});

// 访问首页，加载前端页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// 启动服务
app.listen(port, () => {
    console.log("服务启动成功，监听端口：" + port);
});
