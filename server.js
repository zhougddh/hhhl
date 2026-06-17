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

// 获取真实客户端IP
app.use((req, res, next) => {
  req.clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  next();
});

// 数据库连接池
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// 全局验证码存储
let loginCode = "";
let regCode = "";

// IP注册频率限制内存存储：{ip: [timestamp1, timestamp2...]} 20分钟=1200000ms
const ipRegRecord = new Map();
const LIMIT_COUNT = 5;
const LIMIT_TIME = 20 * 60 * 1000;

// 首页
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, './index.html'), (err) => {
        if (err) return res.send("index.html 文件缺失，请上传到根目录");
    });
});

// 验证码接口（修复404报错）
app.get("/getLoginCode", (req, res) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for(let i=0;i<4;i++) code += chars[Math.floor(Math.random()*chars.length)];
    loginCode = code;
    res.json({code: loginCode});
})
app.get("/getRegCode", (req, res) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for(let i=0;i<4;i++) code += chars[Math.floor(Math.random()*chars.length)];
    regCode = code;
    res.json({code: regCode});
})

// 登录接口（记录在线登录IP，管理员优先校验）
app.post("/login", async (req, res) => {
    const { account, password, code } = req.body;
    const ip = req.clientIp;
    if (!code || code.toLowerCase() !== loginCode.toLowerCase()) {
        return res.json({ code: 400, msg: "验证码错误" });
    }

    // 管理员账号校验
    const adminAcc = process.env.ADMIN_ACCOUNT;
    const adminPwd = process.env.ADMIN_PWD;
    if(account === adminAcc && password === adminPwd){
        db.query("DELETE FROM online_user WHERE account = ?", [account]);
        db.query("INSERT INTO online_user(account,ip) VALUES (?,?)", [account, ip]);
        return res.json({code:200, msg:"登录成功", isAdmin:true});
    }

    // 普通用户登录
    db.query("SELECT * FROM user WHERE account = ?", [account], (err, r) => {
        if(err) return res.json({code:500, msg:"数据库异常"});
        if(r.length === 0) return res.json({code:400, msg:"账号不存在"});
        if(r[0].password !== password) return res.json({code:400, msg:"密码错误"});
        // 更新在线IP
        db.query("DELETE FROM online_user WHERE account = ?", [account]);
        db.query("INSERT INTO online_user(account,ip) VALUES (?,?)", [account, ip]);
        return res.json({code:200, msg:"登录成功", isAdmin:false});
    })
});

// 注册接口：20分钟同一IP最多注册5次，无需新建数据表
app.post("/register", (req, res) => {
    const { account, password, q, a, code } = req.body;
    const realCode = regCode;
    const ip = req.clientIp;
    const now = Date.now();

    // 验证码校验
    if (!code || code.toLowerCase() !== realCode.toLowerCase()) {
        return res.json({ code: 400, msg: "验证码错误" });
    }
    // 禁止纯数字账号
    const numReg = /^\d+$/;
    if (numReg.test(account)) {
        return res.json({ code: 400, msg: "账号禁止纯数字，请字母+数字组合" });
    }
    // 弱密码拦截
    const weakPwd = ["123456", "111111", "000000", "666666"];
    if (weakPwd.includes(password)) {
        return res.json({ code: 400, msg: "禁止简单弱密码" });
    }
    // 账号长度
    if (account.length < 4 || account.length > 16) {
        return res.json({ code: 400, msg: "账号长度4-16位" });
    }

    // 清理20分钟外的过期注册记录
    let recordList = ipRegRecord.get(ip) || [];
    recordList = recordList.filter(time => now - time < LIMIT_TIME);
    ipRegRecord.set(ip, recordList);

    // 判断是否达到5次上限
    if(recordList.length >= LIMIT_COUNT){
        return res.json({ code: 400, msg: "该IP20分钟内注册次数已达上限，请稍后再试" });
    }

    // 检查账号是否重复
    db.query("SELECT * FROM user WHERE account = ?", [account], (err, r) => {
        if (r.length > 0) return res.json({ code: 400, msg: "账号已存在" });
        // 注册新用户
        db.query("INSERT INTO user(account,password,question,answer) VALUES (?,?,?,?)",
            [account, password, q, a], (err) => {
                if (err) return res.json({ code: 500, msg: "注册失败" });
                // 记录本次注册时间戳
                recordList.push(now);
                ipRegRecord.set(ip, recordList);
                return res.json({ code: 200, msg: "注册成功" });
            })
    })
});

// 密码重置
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

// 管理员：查看当前在线账号+登录IP
app.get("/admin/getOnlineIP", (req, res) => {
    db.query("SELECT * FROM online_user ORDER BY login_time DESC", (err, list) => {
        res.json({code:200, list: list});
    })
})

// 管理员：强制下线指定账号
app.post("/admin/kickUser", (req, res) => {
    const { account } = req.body;
    db.query("DELETE FROM online_user WHERE account = ?", [account], (err) => {
        if(err) return res.json({code:500, msg:"下线失败"});
        return res.json({code:200, msg:"已强制下线该账号"});
    })
})

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
