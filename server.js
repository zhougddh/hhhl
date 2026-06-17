const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 读取Render环境变量（不要写死邮箱/密码在代码里）
const MAIL_FROM = process.env.MAIL_FROM;
const MAIL_SMTP_CODE = process.env.MAIL_SMTP_CODE;
const ADMIN_ACCOUNT = process.env.ADMIN_ACCOUNT;
const ADMIN_PWD = process.env.ADMIN_PWD;

// 内存存储（Render免费版临时存储，重启会清空）
let userList = {};
let emailCodeCache = {};

// 生成6位验证码
function get6Code() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// 密码简单哈希
function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

// 发送邮箱验证码接口 /api/sendMailCode
app.post('/api/sendMailCode', async (req, res) => {
  const { targetEmail } = req.body;
  if (!targetEmail) return res.json({ code: 400, msg: '邮箱不能为空' });

  const code = get6Code();
  emailCodeCache[targetEmail] = code;

  // 邮箱发送配置
  const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: MAIL_FROM,
      pass: MAIL_SMTP_CODE
    }
  });

  const mailInfo = {
    from: `"小禾语音工具箱" <${MAIL_FROM}>`,
    to: targetEmail,
    subject: '注册/重置验证码',
    html: `<p>你的验证码：<b>${code}</b></p><p>请勿泄露给他人</p>`
  };

  try {
    await transporter.sendMail(mailInfo);
    res.json({ code: 200, msg: `验证码已发送至${targetEmail}` });
  } catch (err) {
    res.json({ code: 500, msg: '发送失败，请检查邮箱配置' });
  }
});

// 用户注册 /api/register
app.post('/api/register', (req, res) => {
  const { account, pwd, email, code } = req.body;
  const accReg = /^[a-zA-Z0-9]{4,16}$/;
  const allNum = /^\d+$/;

  // 账号规则校验
  if (!accReg.test(account)) return res.json({ code: 400, msg: '账号4-16位字母数字' });
  if (allNum.test(account)) return res.json({ code: 400, msg: '账号不能纯数字' });
  if (pwd.length < 6 || pwd.length > 20) return res.json({ code: 400, msg: '密码6-20位' });
  if (pwd === account) return res.json({ code: 400, msg: '密码不能和账号一致' });
  if (!email) return res.json({ code: 400, msg: '请填写邮箱' });
  if (emailCodeCache[email] !== code) return res.json({ code: 400, msg: '验证码错误' });
  if (userList[account]) return res.json({ code: 400, msg: '账号已被注册' });

  const now = new Date().toLocaleString();
  userList[account] = {
    account,
    pwd: hashStr(pwd),
    email,
    regTime: now,
    voices: []
  };
  res.json({ code: 200, msg: '注册成功，请登录' });
});

// 用户登录 /api/userLogin
app.post('/api/userLogin', (req, res) => {
  const { account, pwd } = req.body;
  const user = userList[account];
  if (!user) return res.json({ code: 400, msg: '账号不存在' });
  if (user.pwd !== hashStr(pwd)) return res.json({ code: 400, msg: '密码错误' });
  res.json({ code: 200, msg: '登录成功' });
});

// 管理员登录 /api/adminLogin
app.post('/api/adminLogin', (req, res) => {
  const { account, pwd } = req.body;
  if (account !== ADMIN_ACCOUNT) return res.json({ code: 400, msg: '管理员账号错误' });
  if (hashStr(pwd) !== hashStr(ADMIN_PWD)) return res.json({ code: 400, msg: '管理员密码错误' });
  res.json({ code: 200, msg: '管理员登录成功' });
});

// 获取全部用户 /api/getAllUser
app.get('/api/getAllUser', (req, res) => {
  const list = Object.values(userList);
  res.json({ code: 200, list });
});

// 删除用户 /api/delUser
app.post('/api/delUser', (req, res) => {
  const { account } = req.body;
  delete userList[account];
  res.json({ code: 200, msg: '删除成功' });
});

app.listen(port, () => {
  console.log(`服务启动成功，端口：${port}`);
});
