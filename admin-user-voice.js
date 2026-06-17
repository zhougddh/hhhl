const API_BASE = "https://hhhl.onrender.com/api";
const API_HOST = "https://api.302ai.cn";
const TUTORIAL_URL = "https://v.douyin.com/1_So2yN4DHU/";
const QQ_CUSTOMER_URL = "https://qm.qq.com/q/RNPgd1P3Wg";
let currentLoginUser = null;
const fileInput = document.getElementById("audioFileInput");
let selectFileObj = null;

const IP_REG_KEY = "ip_reg_limit";
function getIpLimit(){
    let data = localStorage.getItem(IP_REG_KEY);
    if(!data) return {count:0,lockEnd:0};
    return JSON.parse(data);
}
function setIpLimit(count, lockEnd=0){
    localStorage.setItem(IP_REG_KEY, JSON.stringify({count,lockEnd}));
}

function isWeakPwd(pwd){
    const pureNum = /^\d+$/.test(pwd);
    const sameNum = /^(\d)\1{5,}$/.test(pwd);
    const asc = "0123456789";
    const desc = "9876543210";
    if(pureNum) return true;
    if(sameNum) return true;
    if(asc.includes(pwd) || desc.includes(pwd)) return true;
    return false;
}

function showToast(msg) {
    const wrap = document.getElementById("toastWrap");
    wrap.innerHTML = `<div class="toast">${msg}</div>`;
    setTimeout(()=>{ wrap.innerHTML = ""; }, 2200);
}

function hideAllPanel(){
    document.getElementById("auth").classList.add("hidden");
    document.getElementById("userPanel").classList.add("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
}
function showAuthPanel(){
    hideAllPanel();
    document.getElementById("auth").classList.remove("hidden");
    currentLoginUser = null;
}
function showUserPanel(){
    hideAllPanel();
    document.getElementById("userPanel").classList.remove("hidden");
    document.getElementById("logBox").innerText = `欢迎，操作日志：\n等待操作...`;
}
function showAdminPanel(){
    hideAllPanel();
    document.getElementById("adminPanel").classList.remove("hidden");
    renderUserList();
}

function openModal(id){
    document.getElementById(id).classList.remove("hidden");
}
function closeModal(id){
    document.getElementById(id).classList.add("hidden");
}

function appendLog(text){
    const box = document.getElementById("logBox");
    const now = new Date().toLocaleTimeString();
    box.innerText += `\n[${now}] ${text}`;
}
function clearLog(text){
    document.getElementById("logBox").textContent = text;
}

function copyText(text){
    const tempInput = document.createElement('input');
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
}

// 弹窗关闭绑定
document.getElementById("closeAdminNotice").onclick = ()=> closeModal("adminNoticeModal");
document.getElementById("closeUserWelcome").onclick = ()=> closeModal("userWelcomeModal");
document.getElementById("closeUploadSuccessBtn").onclick = ()=> closeModal("uploadSuccessModal");
document.getElementById("openForgetBtn").onclick = ()=> openModal("forgetModal");
document.getElementById("closeForgetBtn").onclick = ()=> closeModal("forgetModal");

// 登录注册标签切换
document.getElementById("loginTab").onclick = ()=>{
    document.getElementById("loginTab").classList.add("active");
    document.getElementById("regTab").classList.remove("active");
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("regForm").classList.add("hidden");
};
document.getElementById("regTab").onclick = ()=>{
    document.getElementById("regTab").classList.add("active");
    document.getElementById("loginTab").classList.remove("active");
    document.getElementById("regForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");
};
document.getElementById("tabUserList").onclick = ()=>{
    document.getElementById("tabUserList").classList.add("active");
    document.getElementById("tabSearchUser").classList.remove("active");
    document.getElementById("userListTab").classList.remove("hidden");
    document.getElementById("userDetailTab").classList.add("hidden");
};
document.getElementById("tabSearchUser").onclick = ()=>{
    document.getElementById("tabSearchUser").classList.add("active");
    document.getElementById("tabUserList").classList.remove("active");
    document.getElementById("userDetailTab").classList.remove("hidden");
    document.getElementById("userListTab").classList.add("hidden");
};

// 客服、退出按钮
document.querySelectorAll(".btn-kefu").forEach(btn=>{
    btn.onclick = ()=> window.open(QQ_CUSTOMER_URL);
});
function addQQ(){window.open(QQ_CUSTOMER_URL,"_blank");}
document.getElementById("logoutUserBtn").onclick = ()=>{
    showToast("已退出登录");
    showAuthPanel();
};
document.getElementById("logoutAdminBtn").onclick = ()=>{
    showToast("管理员已登出");
    showAuthPanel();
};

// 注册逻辑
document.getElementById("regSubmitBtn").onclick = async ()=>{
    const limit = getIpLimit();
    const now = Date.now();
    if(limit.lockEnd > now){
        const remain = Math.ceil((limit.lockEnd - now) / 60000);
        showToast(`注册超限，请等待${remain}分钟后重试`);
        return;
    }
    if(limit.count >= 2){
        const lockTime = now + 20 * 60 * 1000;
        setIpLimit(limit.count, lockTime);
        showToast("当前IP已注册2个账号，锁定20分钟");
        return;
    }
    const acc = document.getElementById("regUser").value.trim();
    const pwd = document.getElementById("regPwd").value.trim();
    const pwd2 = document.getElementById("regPwd2").value.trim();
    const secretQ = document.getElementById("regSecretQ").value.trim();
    const secretA = document.getElementById("regSecretA").value.trim();
    if(pwd !== pwd2){showToast("两次输入密码不一致");return;}
    if(isWeakPwd(pwd)){
        showToast("密码禁止纯数字/连续简单数字（123456/111111等）");
        return;
    }
    if(secretQ.length <4){showToast("密保问题至少4个字");return;}
    if(secretA.length <2){showToast("密保答案至少2个字");return;}
    const res = await fetch(`${API_BASE}/register`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({account:acc,pwd:pwd,secretQuestion:secretQ,secretAnswer:secretA})
    })
    const data = await res.json();
    showToast(data.msg);
    if(data.code === 200){
        setIpLimit(limit.count + 1, 0);
        document.getElementById("loginTab").click();
    }
};

// 密保重置密码
document.getElementById("submitResetBtn").onclick = async ()=>{
    const acc = document.getElementById("secretFindAcc").value.trim();
    const q = document.getElementById("secretQ").value.trim();
    const a = document.getElementById("secretA").value.trim();
    const newPwd = document.getElementById("newPwd").value.trim();
    const newPwd2 = document.getElementById("newPwd2").value.trim();
    if(newPwd !== newPwd2){showToast("两次新密码不一致");return;}
    if(isWeakPwd(newPwd)){showToast("新密码不能是简单弱密码");return;}
    const res = await fetch(`${API_BASE}/findPwdBySecret`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({account:acc,question:q,answer:a,newPwd:newPwd})
    });
    const d = await res.json();
    showToast(d.msg);
    if(d.code === 200) closeModal("forgetModal");
}

// 登录逻辑（全部校验交给后端，前端无管理员账号密码）
document.getElementById("loginBtn").onclick = async ()=>{
    const acc = document.getElementById("loginUser").value.trim();
    const pwd = document.getElementById("loginPwd").value.trim();
    const res = await fetch(`${API_BASE}/userLogin`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({account:acc,pwd:pwd})
    })
    const data = await res.json();
    showToast(data.msg);
    if(data.code === 200){
        currentLoginUser = acc;
        if(data.isAdmin){
            showAdminPanel();
            openModal("adminNoticeModal");
        }else{
            showUserPanel();
            openModal("userWelcomeModal");
        }
    }
};

// 音色上传
async function uploadVoice(){
    const key = document.getElementById("apiKey").value.trim();
    const customName = document.getElementById("customName").value.trim();
    if(!key){clearLog("⚠️ 请先填写API Key");return}
    if(!customName){clearLog("⚠️ 请先填写音色名称");return}
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "audio/*";
    inp.onchange = async e=>{
        const file = e.target.files[0]; 
        if(!file) return;
        appendLog(`选中音频文件：${file.name}，音色名称：${customName}`);
        clearLog("正在向接口提交训练请求...");
        const fd = new FormData();
        fd.append("type","tts");
        fd.append("title", customName);
        fd.append("train_mode","fast");
        fd.append("visibility","private");
        fd.append("voices", file);
        try{
            const res = await fetch(`${API_HOST}/fish-audio/model`,{
                method:"POST",headers:{Authorization:"Bearer "+key},body:fd
            });
            if(!res.ok) throw new Error(`接口响应异常，状态码：${res.status}`);
            const data = await res.json();
            const voiceId = data._id;
            copyText(voiceId);
            document.getElementById("voiceId").value = voiceId;
            const successTxt = `✅ 上传成功\n名称：${customName}\nID：${voiceId}\n✅ ID已自动复制到剪贴板`;
            clearLog(successTxt);
            document.getElementById("successVoiceName").innerText = customName;
            document.getElementById("successVoiceId").innerText = voiceId;
            openModal("uploadSuccessModal");
        }catch(err){
            clearLog(`❌ 上传失败：${err.message}\n请检查API密钥、音频文件或网络`);
        }
    };
    inp.click();
}

async function queryVoice(){
    const key = document.getElementById("apiKey").value.trim();
    const id = document.getElementById("voiceId").value.trim();
    if(!key){clearLog("⚠️ 请先填写API Key");return}
    if(!id){clearLog("⚠️ 请输入音色ID");return}
    clearLog("正在查询音色信息...");
    try{
        const res = await fetch(`${API_HOST}/fish-audio/model/${id}`,{headers:{Authorization:"Bearer "+key}});
        if(!res.ok) throw new Error(`查询失败，状态码${res.status}`);
        const data = await res.json();
        const state = data.state==="trained"?"✅ 训练完成":data.state==="training"?"⚙️ 训练中":"⏳ 排队等待";
        clearLog(`✅ 查询成功\n名称：${data.title}\n状态：${state}\nID：${data._id}`);
    }catch(err){
        clearLog(`❌ 查询失败：${err.message}`);
    }
}

function showDelConfirm(){
    const id = document.getElementById("voiceId").value.trim();
    if(!id){clearLog("⚠️ 请输入音色ID");return}
    clearLog(`即将永久删除音色ID：${id}\n点击确认按钮执行删除`);
    document.getElementById("delConfirmArea").style.display = "flex";
}
async function confirmDelete(){
    document.getElementById("delConfirmArea").style.display = "none";
    const key = document.getElementById("apiKey").value.trim();
    const id = document.getElementById("voiceId").value.trim();
    clearLog("正在发送删除指令...");
    try{
        const res = await fetch(`${API_HOST}/fish-audio/model/${id}`,{
            method:"DELETE",headers:{Authorization:"Bearer "+key}
        });
        if(!res.ok) throw new Error(`删除异常，状态码${res.status}`);
        clearLog("✅ 删除成功，该音色已永久移除");
    }catch(err){
        clearLog(`❌ 删除失败：${err.message}`);
    }
}
function cancelDelete(){
    document.getElementById("delConfirmArea").style.display = "none";
    clearLog("已取消本次删除操作");
}

async function loadAll(){
    const key = document.getElementById("apiKey").value.trim();
    if(!key){clearLog("⚠️ 请填写API Key");return}
    clearLog("正在加载账号全部音色列表...");
    let list = [], page = 1;
    let loadError = false;
    while(true){
        try{
            const res = await fetch(`${API_HOST}/fish-audio/model?page_size=50&page_number=${page}`,{headers:{Authorization:"Bearer "+key}});
            if(!res.ok) throw new Error(`加载分页${page}失败，状态码${res.status}`);
            const data = await res.json();
            if(!data.items?.length) break;
            list.push(...data.items); page++;
        }catch(err){
            loadError = true;
            appendLog(`分页${page}加载异常：${err.message}`);
            break;
        }
    }
    if(!list.length){clearLog("当前账号暂无音色数据");return}
    let txt = `✅ 共查询到 ${list.length} 个音色\n\n`;
    list.forEach((it,i)=>{
        const s = it.state==="trained"?"✅已完成":it.state==="training"?"⚙️训练中":"⏳排队";
        txt += `${i+1}. 音色名称：${it.title}\n音色ID：${it._id}\n训练状态：${s}\n------------------------\n`;
    });
    if(loadError) txt += "\n⚠️ 部分分页加载异常，列表不完整";
    clearLog(txt);
}

// 管理员用户列表
async function renderUserList(){
    const res = await fetch(`${API_BASE}/getAllUser`);
    const data = await res.json();
    const tbody = document.getElementById("userListBody");
    document.getElementById("userCount").innerText = data.list.length;
    tbody.innerHTML = "";
    data.list.forEach(u=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${u.account}</td>
            <td>${u.secretQuestion}</td>
            <td>${u.regTime}</td>
            <td>${u.voices.length}</td>
            <td><button class="btn-mini btn-danger" onclick="delUser('${u.account}')">删除用户</button></td>
        `;
        tbody.appendChild(tr);
    });
}
window.delUser = async function(acc){
    if(!confirm(`确认删除用户 ${acc}？`)) return;
    await fetch(`${API_BASE}/delUser`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({account:acc})
    })
    renderUserList();
    showToast("用户已删除");
}

// 运行计时初始化
function initRunTime(){
    let sec = 0;
    setInterval(()=>{
        sec++;
        const day = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        document.getElementById("totalRunTime").innerText = `${day}天${h}时${m}分${s}秒`;
    },1000);
}

window.onload = function(){
    initRunTime();
    showAuthPanel();
}
