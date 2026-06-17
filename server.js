const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// 全局中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './')));

// 数据库连接池
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// 全局存储验证码
let loginCode = "";
let regCode = "";

// 首页静态页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 登录接口（优先校验管理员账号 a1585546839）
app.post("/login", async (req, res) => {
    const { account, password, code } = req.body;
    // 验证码校验
    const realCode = loginCode;
    if (!code || code.toLowerCase() !== realCode.toLowerCase()) {
        return res.json({ code: 400, msg: "验证码错误" });
    }

    // 优先读取环境变量校验管理员
    const ADMIN_ACCOUNT = process.env.ADMIN_ACCOUNT;
    const ADMIN_PWD = process.env.ADMIN_PWD;
    if (account === ADMIN_ACCOUNT && password === ADMIN_PWD) {
        return res.json({
            code: 200,
            msg: "登录成功",
            isAdmin: true
        });
    }

    // 普通用户数据库查询
    db.query("SELECT * FROM user WHERE account = ?", [account], (err, result) => {
        if (err) {
            return res.json({ code: 500, msg: "数据库异常" });
        }
        if (result.length === 0) {
            return res.json({ code: 400, msg: "账号不存在" });
        }
        const user = result[0];
        if (user.password !== password) {
            return res.json({ code: 400, msg: "密码错误" });
        }
        return res.json({
            code: 200,
            msg: "登录成功",
            isAdmin: false
        });
    })
});

// 注册接口（禁止纯数字账号）
app.post("/register", (req, res) => {
    const { account, password, q, a, code } = req.body;
    const realCode = regCode;
    if (!code || code.toLowerCase() !== realCode.toLowerCase()) {
        return res.json({ code: 400, msg: "验证码错误" });
    }
    // 禁止纯数字
    const numReg = /^\d+$/;
    if (numReg.test(account)) {
        return res.json({ code: 400, msg: "账号禁止纯数字，请字母+数字组合" });
    }
    // 弱密码拦截
    const weakPwd = ["123456", "111111", "000000", "666666"];
    if (weakPwd.includes(password)) {
        return res.json({ code: 400, msg: "禁止简单弱密码" });
    }
    // 账号长度校验
    if (account.length < 4 || account.length > 16) {
        return res.json({ code: 400, msg: "账号长度4-16位" });
    }

    db.query("SELECT * FROM user WHERE account = ?", [account], (err, r) => {
        if (r.length > 0) return res.json({ code: 400, msg: "账号已存在" });
        db.query("INSERT INTO user(account,password,question,answer) VALUES (?,?,?,?)",
            [account, password, q, a], (err) => {
                if (err) return res.json({ code: 500, msg: "注册失败" });
                return res.json({ code: 200, msg: "注册成功" });
            })
    })
});

// 密码重置接口
app.post("/resetPwd", (req, res) => {
    const { account, answer, newPwd } = req.body;
    db.query("SELECT * FROM user WHERE account = ?", [account], (err, r) => {
        if (r.length === 0) return res.json({ code: 400, msg: "账号不存在" });
        if (r[0].answer !== answer) return res.json({ code: 400, msg: "密保答案错误" });
        db.query("UPDATE user SET password = ? WHERE account = ?", [newPwd, account], () => {
            return res.json({ code: 200, msg: "密码重置成功" });
        })
    })
});

// 音色管理接口
app.post("/addVoice", (req, res) => {
    const { name, vid, uid } = req.body;
    db.query("INSERT INTO voice(name,vid,uid) VALUES (?,?,?)", [name, vid, uid], (err) => {
        if (err) return res.json({ code: 500, msg: "新增音色失败" });
        return res.json({ code: 200, msg: "新增成功" });
    })
});
app.post("/getVoice", (req, res) => {
    const { uid } = req.body;
    db.query("SELECT * FROM voice WHERE uid = ?", [uid], (err, data) => {
        return res.json({ code: 200, list: data });
    })
});
app.post("/delVoice", (req, res) => {
    const { id } = req.body;
    db.query("DELETE FROM voice WHERE id = ?", [id], () => {
        return res.json({ code: 200, msg: "删除完成" });
    })
});

// 启动服务
app.listen(port, () => {
    console.log(`服务启动成功，端口:${port}`);
})
