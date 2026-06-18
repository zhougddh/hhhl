const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// 解析表单json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 托管前端页面
app.use(express.static(__dirname));

// ========== 数据库连接 ==========
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME,
    port: 3306
});

// 连接数据库
db.connect((err) => {
    if (err) {
        console.log("数据库连接失败：", err);
        return;
    }
    console.log("数据库连接成功");

    // 自动创建用户表，不存在才创建
    const createTableSql = `
    CREATE TABLE IF NOT EXISTS user(
        id INT AUTO_INCREMENT PRIMARY KEY,
        account VARCHAR(32) NOT NULL UNIQUE,
        password VARCHAR(32) NOT NULL,
        qa VARCHAR(100)
    )
    `;
    db.query(createTableSql, (err) => {
        if (err) console.log("建表错误：", err);
        else console.log("用户数据表已就绪");
    })
});

// ========== 管理员登录接口（仅读取环境变量，不依赖表校验） ==========
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
    })
});

// ========== 用户注册接口 ==========
app.post('/register', (req, res) => {
    const { account, password, qa } = req.body;
    const sql = "INSERT INTO user(account,password,qa) VALUES (?,?,?)";
    db.query(sql, [account, password, qa], (err) => {
        if (err) return res.json({ code: 500, msg: "数据库异常" });
        return res.json({ code: 200, msg: "注册成功" });
    })
});

// 打开首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
})

app.listen(port, () => {
    console.log("服务启动成功，端口：" + port);
})
