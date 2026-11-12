const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get local IPv4 address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Initial state: starts in 'collecting' phase so friends can submit their gifts
const defaultData = {
  config: {
    title: '🎄 微信群圣诞礼物大抽奖 🎁',
    budget: '50~70元',
    ruleTip: '大家各自提交一份50~70元礼物进池，全员到齐后封池，100%纯随机抽取（绝不抽到自己的）！',
    adminPin: '8888',
    status: 'collecting' // 'collecting' (收集礼物) | 'rolling' (开放抽奖) | 'ended'
  },
  gifts: [
    // Pre-populate 2 sample gifts submitted by friends so the page isn't empty initially
    {
      id: 'g_sample_1',
      name: '🔥 智能数显发热围巾',
      value: '¥68',
      icon: '🧣',
      provider: '小鹿',
      winner: null,
      submittedAt: Date.now() - 3600000
    },
    {
      id: 'g_sample_2',
      name: '📻 复古黑胶无线小音响',
      value: '¥59',
      icon: '📻',
      provider: '阿杰',
      winner: null,
      submittedAt: Date.now() - 1800000
    }
  ],
  // Pre-calculated derangement assignments: { "小明": "g_xxx" }
  assignments: {},
  history: []
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.gifts && parsed.config) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading data.json:', err);
  }
  saveData(defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing data.json:', err);
  }
}

let db = loadData();

// 1. Public API: Get Room State & Gift Pool
app.get('/api/public-state', async (req, res) => {
  const localIP = getLocalIP();
  const shareUrl = `http://${localIP}:${PORT}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, color: { dark: '#165b33', light: '#ffffff' } });
  } catch (e) {}

  const totalGifts = db.gifts.length;
  const remainingGifts = db.gifts.filter(g => !g.winner).length;
  const wonGifts = db.gifts.filter(g => g.winner).length;

  res.json({
    config: {
      title: db.config.title,
      budget: db.config.budget,
      ruleTip: db.config.ruleTip,
      status: db.config.status
    },
    stats: {
      totalGifts,
      remainingGifts,
      wonGifts
    },
    gifts: db.gifts,
    history: db.history.slice(-10).reverse(),
    shareUrl,
    qrCodeDataUrl
  });
});

// 2. Member Submits their Gift to Pool (群友登记自己的礼物)
app.post('/api/gift/submit', (req, res) => {
  const { provider, name, value, icon } = req.body;

  if (db.config.status !== 'collecting') {
    return res.status(400).json({ error: '当前礼物池已封存开奖，暂时无法添加新礼物哦！' });
  }

  if (!provider || !provider.trim()) {
    return res.status(400).json({ error: '请输入你的微信群昵称' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请输入你买的礼物名称' });
  }

  const cleanProvider = provider.trim();
  const cleanName = name.trim();
  const cleanValue = (value && value.trim()) ? value.trim() : '¥60';
  const cleanIcon = icon || '🎁';

  // Check if this provider already submitted
  const existingIndex = db.gifts.findIndex(g => g.provider.toLowerCase() === cleanProvider.toLowerCase());
  if (existingIndex >= 0) {
    // Update existing submission
    db.gifts[existingIndex].name = cleanName;
    db.gifts[existingIndex].value = cleanValue;
    db.gifts[existingIndex].icon = cleanIcon;
    db.gifts[existingIndex].submittedAt = Date.now();
    saveData(db);
    return res.json({ success: true, updated: true, gift: db.gifts[existingIndex] });
  }

  // Create new gift
  const newGift = {
    id: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: cleanName,
    value: cleanValue,
    icon: cleanIcon,
    provider: cleanProvider,
    winner: null,
    submittedAt: Date.now()
  };

  db.gifts.push(newGift);
  saveData(db);

  res.json({ success: true, updated: false, gift: newGift });
});

// 3. Roll / Draw a Gift (From the pooled gifts, 100% avoiding own gift)
app.post('/api/roll', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请选择或输入你的群昵称！' });
  }
  const cleanName = name.trim();

  if (db.config.status !== 'rolling') {
    return res.status(400).json({ error: '当前还在收集礼物阶段，请等待房主封池开奖！' });
  }

  // Check if user already won
  const alreadyWon = db.gifts.find(g => g.winner && g.winner.name.toLowerCase() === cleanName.toLowerCase());
  if (alreadyWon) {
    return res.status(400).json({
      error: `你已经抽过礼物啦！你抽中的是：【${alreadyWon.name}】`,
      gift: alreadyWon
    });
  }

  // Check assigned gift from derangement mapping
  const assignedGiftId = db.assignments[cleanName.toLowerCase()];
  let pickedGift = null;

  if (assignedGiftId) {
    pickedGift = db.gifts.find(g => g.id === assignedGiftId && !g.winner);
  }

  // Fallback random pick if not pre-assigned (e.g. joined late or guest roll)
  if (!pickedGift) {
    const available = db.gifts.filter(g => !g.winner && g.provider.toLowerCase() !== cleanName.toLowerCase());
    if (available.length > 0) {
      pickedGift = available[Math.floor(Math.random() * available.length)];
    } else {
      // Last resort if only self gift remains
      const anyAvailable = db.gifts.filter(g => !g.winner);
      if (anyAvailable.length === 0) {
        return res.status(400).json({ error: '礼物池已经被抽空啦！' });
      }
      pickedGift = anyAvailable[0];
    }
  }

  // Assign winner
  pickedGift.winner = {
    name: cleanName,
    time: Date.now()
  };

  // Add history
  db.history.push({
    name: cleanName,
    giftName: pickedGift.name,
    icon: pickedGift.icon,
    value: pickedGift.value,
    provider: pickedGift.provider,
    time: Date.now()
  });

  saveData(db);

  res.json({
    success: true,
    gift: pickedGift
  });
});

// 4. Strict Derangement Algorithm Generator: A person NEVER draws their own gift
function generateDerangementAssignments(gifts) {
  const n = gifts.length;
  if (n < 2) return {};

  const providers = gifts.map(g => g.provider);
  let assigned = null;

  // Try random shuffle up to 1000 times
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = [...gifts];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
    }

    let valid = true;
    for (let i = 0; i < n; i++) {
      if (candidate[i].provider.toLowerCase() === providers[i].toLowerCase()) {
        valid = false;
        break;
      }
    }

    if (valid) {
      assigned = candidate;
      break;
    }
  }

  // Fallback: simple shift by 1 if providers are distinct, or swap
  if (!assigned) {
    assigned = gifts.map((_, i) => gifts[(i + 1) % n]);
  }

  const map = {};
  for (let i = 0; i < n; i++) {
    map[providers[i].toLowerCase()] = assigned[i].id;
  }
  return map;
}

// ================= ADMIN APIS =================

function checkAdmin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.body.adminPin;
  if (pin !== db.config.adminPin) {
    return res.status(403).json({ error: '管理员密码错误，默认密码为 8888' });
  }
  next();
}

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { adminPin } = req.body;
  if (adminPin !== db.config.adminPin) {
    return res.status(403).json({ error: '密码错误！默认密码：8888' });
  }
  res.json({ success: true });
});

// Admin: Lock pool and start rolling (封池开奖)
app.post('/api/admin/lock-and-match', checkAdmin, (req, res) => {
  if (db.gifts.length < 2) {
    return res.status(400).json({ error: '至少需要 2 份群友礼物才能封池开奖哦！' });
  }

  // Generate perfect derangement mapping (no one gets own gift)
  db.assignments = generateDerangementAssignments(db.gifts);
  db.config.status = 'rolling';
  db.gifts.forEach(g => { g.winner = null; });
  db.history = [];
  saveData(db);

  res.json({ success: true, count: db.gifts.length });
});

// Admin: Reopen collection (重新开启收集)
app.post('/api/admin/reopen-collection', checkAdmin, (req, res) => {
  db.config.status = 'collecting';
  db.assignments = {};
  db.gifts.forEach(g => { g.winner = null; });
  db.history = [];
  saveData(db);
  res.json({ success: true, message: '已重新开启礼物收集阶段！' });
});

// Admin: Delete a gift (移除捣乱或错误的礼物)
app.post('/api/admin/gift/delete', checkAdmin, (req, res) => {
  const { id } = req.body;
  db.gifts = db.gifts.filter(g => g.id !== id);
  saveData(db);
  res.json({ success: true, gifts: db.gifts });
});

// Admin: Reset everything (清空所有人或恢复示例)
app.post('/api/admin/clear-all', checkAdmin, (req, res) => {
  db.gifts = [];
  db.assignments = {};
  db.history = [];
  db.config.status = 'collecting';
  saveData(db);
  res.json({ success: true, message: '已清空礼物池，可重新开始收集！' });
});

// Admin page route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`====================================================`);
  console.log(`🎄 群友自报礼物池 + 圣诞疯狂抽奖 H5 启动就绪！`);
  console.log(`📱 玩家主页 (发微信群): http://${localIP}:${PORT}`);
  console.log(`👑 管理员后台: http://${localIP}:${PORT}/admin`);
  console.log(`🔑 管理员密码: ${db.config.adminPin}`);
  console.log(`====================================================`);
});
