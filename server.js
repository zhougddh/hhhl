const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

// 解析post请求参数
app.use(express.json());

// 管理员登录接口，仅读取Render环境变量校验账号密码
app.post('/admin-login', (req, res) => {
    const { account, pwd } = req.body;
    const adminAcc = process.env.ADMIN_ACCOUNT;
    const adminPwd = process.env.ADMIN_PWD;
    if (account === adminAcc && pwd === adminPwd) {
        return res.json({
            code: 200,
            msg: "管理员登录成功"
        });
    } else {
        return res.json({
            code: 400,
            msg: "账号或密码错误"
        });
    }
});

// 根路径提示，无前端页面
app.get('/', (req, res) => {
    res.send("服务运行正常，仅提供管理员登录接口 /admin-login");
});

app.listen(port, () => {
    console.log("后台服务启动完成，无数据库、无前端页面");
});
