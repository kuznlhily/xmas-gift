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

// Initial state: Monster Hunter "呆猫集会所" Group Celebration Theme
const defaultData = {
  config: {
    title: '🐾「呆猫集会所」周年群庆 · 猎人补给大抽奖 🍖',
    budget: '50~70元',
    ruleTip: '各位苍蓝星各自上交一份50~70元狩猎物资，全员到齐后封池，艾露猫炼金机100%纯随机抽取（绝不抽到自己的纳品）！',
    adminPin: '8888',
    status: 'collecting' // 'collecting' (猎人纳品阶段) | 'rolling' (开炉炼金抽奖) | 'ended'
  },
  gifts: [
    // Pre-populate 2 sample MH themed gifts
    {
      id: 'g_sample_1',
      name: '🍖 熟肉抱枕 & 猎人特酿生啤杯',
      value: '¥68',
      icon: '🍖',
      provider: '集会所看板娘',
      winner: null,
      submittedAt: Date.now() - 3600000
    },
    {
      id: 'g_sample_2',
      name: '🐱 艾露猫猫爪肉垫防寒手套',
      value: '¥59',
      icon: '🐾',
      provider: '大团长',
      winner: null,
      submittedAt: Date.now() - 1800000
    }
  ],
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
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : (req.protocol || 'http');
  const shareUrl = `${protocol}://${host}`;

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, color: { dark: '#1e293b', light: '#ffffff' } });
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

// 2. Member Submits their Gift to Pool (猎人纳品登记)
app.post('/api/gift/submit', (req, res) => {
  const { provider, name, value, icon } = req.body;

  if (db.config.status !== 'collecting') {
    return res.status(400).json({ error: '当前集会所补给池已封存开奖，暂时无法添加新物资哦！' });
  }

  if (!provider || !provider.trim()) {
    return res.status(400).json({ error: '请输入你的猎人昵称' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请输入你纳品的礼物/物资名称' });
  }

  const cleanProvider = provider.trim();
  const cleanName = name.trim();
  const cleanValue = (value && value.trim()) ? value.trim() : '¥60';
  const cleanIcon = icon || '🍖';

  // Check if this hunter already submitted
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
    return res.status(400).json({ error: '请选择或输入你的猎人昵称！' });
  }
  const cleanName = name.trim();

  if (db.config.status !== 'rolling') {
    return res.status(400).json({ error: '集会所仍在纳品准备中，请等待大团长封池开奖！' });
  }

  // Check if user already won
  const alreadyWon = db.gifts.find(g => g.winner && g.winner.name.toLowerCase() === cleanName.toLowerCase());
  if (alreadyWon) {
    return res.status(400).json({
      error: `猎人你已经领过报酬啦！你斩获的是：【${alreadyWon.name}】`,
      gift: alreadyWon
    });
  }

  // Check assigned gift from derangement mapping
  const assignedGiftId = db.assignments[cleanName.toLowerCase()];
  let pickedGift = null;

  if (assignedGiftId) {
    pickedGift = db.gifts.find(g => g.id === assignedGiftId && !g.winner);
  }

  // Fallback random pick if not pre-assigned
  if (!pickedGift) {
    const available = db.gifts.filter(g => !g.winner && g.provider.toLowerCase() !== cleanName.toLowerCase());
    if (available.length > 0) {
      pickedGift = available[Math.floor(Math.random() * available.length)];
    } else {
      const anyAvailable = db.gifts.filter(g => !g.winner);
      if (anyAvailable.length === 0) {
        return res.status(400).json({ error: '集会所补给池已被全部领空啦！' });
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

// 4. Strict Derangement Algorithm (保证绝不抽到自己带来的纳品)
function generateDerangementAssignments(gifts) {
  const n = gifts.length;
  if (n < 2) return {};

  const providers = gifts.map(g => g.provider);
  let assigned = null;

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
    return res.status(403).json({ error: '大团长密码错误，默认密码为 8888' });
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
    return res.status(400).json({ error: '集会所至少需要 2 位猎人纳品才能封池开奖哦！' });
  }

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
  res.json({ success: true, message: '已重新开启集会所纳品阶段！' });
});

// Admin: Delete a gift (移除捣乱或错误的礼物)
app.post('/api/admin/gift/delete', checkAdmin, (req, res) => {
  const { id } = req.body;
  db.gifts = db.gifts.filter(g => g.id !== id);
  saveData(db);
  res.json({ success: true, gifts: db.gifts });
});

// Admin: Reset everything
app.post('/api/admin/clear-all', checkAdmin, (req, res) => {
  db.gifts = [];
  db.assignments = {};
  db.history = [];
  db.config.status = 'collecting';
  saveData(db);
  res.json({ success: true, message: '已清空补给池，可重新开始纳品！' });
});

// Admin route (Secret /sillydog - 加尔克专属入口)
app.get('/sillydog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Explicitly 404 on old /admin
app.get('/admin', (req, res) => {
  res.status(404).send('Not Found');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`====================================================`);
  console.log(`🐾 呆猫集会所 · 周年群庆补给抽奖 H5 启动就绪！`);
  console.log(`📱 猎人主页 (发微信群): http://${localIP}:${PORT}`);
  console.log(`👑 大团长后台 (加尔克暗道): http://${localIP}:${PORT}/sillydog`);
  console.log(`🔑 房主密码: ${db.config.adminPin}`);
  console.log(`====================================================`);
});
