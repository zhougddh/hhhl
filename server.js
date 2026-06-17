const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ADMIN_ACCOUNT = process.env.ADMIN_ACCOUNT;
const ADMIN_PWD = process.env.ADMIN_PWD;

// IP注册限制配置
const ipRegRecord = {};
const MAX_REG_COUNT = 2;
const LOCK_MINUTE = 20;
const LOCK_TIME = LOCK_MINUTE * 60 * 1000;

// 内存用户存储
let userList = {};

// 密码哈希
function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

// 获取客户端IP
function getClientIp(req) {
  return req.headers["x-forwarded-for"] || req.connection.remoteAddress;
}

// 用户注册（完全移除邮箱、验证码逻辑，仅账号+密码+密保）
app.post('/api/register', (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  if (!ipRegRecord[ip]) ipRegRecord[ip] = { count: 0, lockEnd: 0 };
  const record = ipRegRecord[ip];

  // IP锁定判断
  if (record.lockEnd > now) {
    const restMin = Math.ceil((record.lockEnd - now) / 60000);
    return res.json({ code: 403, msg: `注册超限，请等待${restMin}分钟后重试` });
  }
  if (record.count >= MAX_REG_COUNT) {
    record.lockEnd = now + LOCK_TIME;
    return res.json({ code: 403, msg: `该IP最多注册2个账号，锁定20分钟` });
  }

  const { account, pwd, secretQuestion, secretAnswer } = req.body;
  const accReg = /^[a-zA-Z0-9]{4,16}$/;
  const allNum = /^\d+$/;
  const sameNum = /^(\d)\1{5,}$/;
  const asc = "0123456789";
  const desc = "9876543210";

  // 账号校验
  if (!accReg.test(account)) return res.json({ code: 400, msg: '账号4-16位字母数字' });
  if (allNum.test(account)) return res.json({ code: 400, msg: '账号禁止纯数字' });
  // 弱密码拦截
  if (allNum.test(pwd) || sameNum.test(pwd) || asc.includes(pwd) || desc.includes(pwd)) {
    return res.json({ code: 400, msg: '密码禁止简单连续数字/纯数字' });
  }
  if (pwd.length < 6 || pwd.length > 20) return res.json({ code: 400, msg: '密码长度6-20位' });
  if (pwd === account) return res.json({ code: 400, msg: '密码不能和账号相同' });
  // 密保校验
  if (!secretQuestion || secretQuestion.length < 4) return res.json({ code:400, msg:"密保问题至少4个字" });
  if (!secretAnswer || secretAnswer.length < 2) return res.json({ code:400, msg:"密保答案至少2个字" });
  if (userList[account]) return res.json({ code: 400, msg: '账号已存在' });

  const nowTime = new Date().toLocaleString();
  userList[account] = {
    account,
    pwd: hashStr(pwd),
    regTime: nowTime,
    voices: [],
    secretQuestion,
    secretAnswer: hashStr(secretAnswer)
  };
  record.count += 1;
  record.lockEnd = 0;
  res.json({ code: 200, msg: '注册成功，请登录' });
});

// 密保找回密码（唯一重置方式）
app.post('/api/findPwdBySecret', (req,res)=>{
  const {account, question, answer, newPwd} = req.body;
  const user = userList[account];
  if(!user) return res.json({code:400, msg:"账号不存在"});
  if(user.secretQuestion !== question) return res.json({code:400, msg:"密保问题不匹配"});
  if(hashStr(answer) !== user.secretAnswer) return res.json({code:400, msg:"密保答案错误"});
  // 校验新密码强度
  const allNum = /^\d+$/;
  const sameNum = /^(\d)\1{5,}$/;
  const asc = "0123456789";
  const desc = "9876543210";
  if (allNum.test(newPwd) || sameNum.test(newPwd) || asc.includes(newPwd) || desc.includes(newPwd)) {
    return res.json({ code: 400, msg: '新密码禁止简单连续数字/纯数字' });
  }
  if(newPwd.length <6 || newPwd.length>20) return res.json({code:400, msg:"密码6-20位"});
  user.pwd = hashStr(newPwd);
  return res.json({code:200, msg:"密码重置成功，请使用新密码登录"});
})

// 普通用户登录
app.post('/api/userLogin', (req, res) => {
  const { account, pwd } = req.body;
  const user = userList[account];
  if (!user) return res.json({ code: 400, msg: '账号不存在' });
  if (user.pwd !== hashStr(pwd)) return res.json({ code: 400, msg: '密码错误' });
  res.json({ code: 200, msg: '登录成功' });
});

// 管理员登录
app.post('/api/adminLogin', (req, res) => {
  const { account, pwd } = req.body;
  if (account !== ADMIN_ACCOUNT) return res.json({ code: 400, msg: '管理员账号错误' });
  if (hashStr(pwd) !== hashStr(ADMIN_PWD)) return res.json({ code: 400, msg: '管理员密码错误' });
  res.json({ code: 200, msg: '管理员登录成功' });
});

// 获取全部用户
app.get('/api/getAllUser', (req, res) => {
  const list = Object.values(userList).map(item=>{
    return {
      account:item.account,
      regTime:item.regTime,
      voices:item.voices,
      secretQuestion:item.secretQuestion
    }
  });
  res.json({ code: 200, list });
});

// 删除用户
app.post('/api/delUser', (req, res) => {
  const { account } = req.body;
  delete userList[account];
  res.json({ code: 200, msg: '删除成功' });
});

app.listen(port, () => {
  console.log(`服务启动，端口${port}`);
});
