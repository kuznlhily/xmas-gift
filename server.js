const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Disable aggressive caching in WeChat WebView for HTML/JS/CSS
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Presets Definition
const THEME_PRESETS = {
  mh: {
    title: '🐾「呆猫集会所」周年群庆 · 猎人补给大抽奖 🍖',
    budget: '50~70元',
    budgetTip: '纳品物资预算指导',
    phase1Badge: '🟡 阶段一：集会所纳品征集中',
    phase1Sub: '每位猎人上交一份 50~70 元物资，全员到齐后大团长封池开炉！',
    phase1Btn: '📦 上交我的狩猎物资 (¥50~70)',
    phase2Btn: '🕹️ 上手に焼けました！开摇！',
    winnerBadge: '🏆 QUEST COMPLETE 达成！',
    ruleText: '💡 猎人公会防假赛条例：全员各自登记物资，到齐后封池。系统算法严格保证绝不会抽到自己带来的物资！100% 纯随机分发，人人有份！',
    icons: [
      { ic: '🍖', desc: '熟肉/猫饭' },
      { ic: '🐾', desc: '艾露猫爪' },
      { ic: '🐱', desc: '呆萌随从' },
      { ic: '⚔️', desc: '猎人神兵' },
      { ic: '🛡️', desc: '坚固防具' },
      { ic: '🐉', desc: '古龙素材' },
      { ic: '🧪', desc: '强走药G' },
      { ic: '💎', desc: '天鳞/宝玉' },
      { ic: '🍯', desc: '特产蜂蜜' },
      { ic: '💣', desc: '大爆弹G' },
      { ic: '🍺', desc: '集会麦酒' },
      { ic: '📯', desc: '狩猎号角' }
    ]
  },
  xmas: {
    title: '🎄 圣诞礼物大抽奖 · 秘密盲盒派对 🎁',
    budget: '50~70元',
    budgetTip: '圣诞心意预算指导',
    phase1Badge: '🟡 阶段一：圣诞礼物征集中',
    phase1Sub: '每个人买一份 50~70 元礼物入池，等大家到齐后房主封池开奖！',
    phase1Btn: '🎁 登记我买的礼物 (¥50~70)',
    phase2Btn: '🕹️ PULL! 摇出属于我的圣诞好礼',
    winnerBadge: '🎉 欧 气 大 爆 发 🎉',
    ruleText: '💡 圣诞老人公平协议：群友自主登记礼物，全员到齐后封池。系统算法严格保证绝对不会抽到自己带来的礼物！完全随机，人人有份！',
    icons: [
      { ic: '🎁', desc: '神秘礼盒' },
      { ic: '🧣', desc: '温暖围巾' },
      { ic: '☕', desc: '暖暖杯垫' },
      { ic: '🍷', desc: '热红酒包' },
      { ic: '💡', desc: '氛围夜灯' },
      { ic: '📻', desc: '复古音响' },
      { ic: '🍪', desc: '姜饼饼干' },
      { ic: '🧦', desc: '圣诞长袜' },
      { ic: '🔔', desc: '黄金铃铛' },
      { ic: '🕯️', desc: '松木香薰' },
      { ic: '🧸', desc: '可爱玩偶' },
      { ic: '✨', desc: '冬日盲盒' }
    ]
  },
  party: {
    title: '🎉 好友盲盒大互换 · 谁是终极手气王 🎲',
    budget: '50~70元',
    budgetTip: '派对礼物预算标准',
    phase1Badge: '🟡 阶段一：好友盲盒征集中',
    phase1Sub: '人人准备一份 50~70 元惊喜好物，到齐后一键封池开抽！',
    phase1Btn: '🎲 上架我的神秘盲盒 (¥50~70)',
    phase2Btn: '🎰 PULL! 启动幸运摇奖机',
    winnerBadge: '🏆 手 气 爆 棚 🏆',
    ruleText: '💡 公平抽奖守则：全员自备盲盒入池，绝不抽到自己带的礼物！完全随机公正，人人有份！',
    icons: [
      { ic: '🎲', desc: '幸运骰子' },
      { ic: '🎁', desc: '神秘好礼' },
      { ic: '🍰', desc: '甜蜜蛋糕' },
      { ic: '☕', desc: '下午茶礼' },
      { ic: '🎮', desc: '解压电玩' },
      { ic: '🎧', desc: '数码好物' },
      { ic: '📚', desc: '精神食粮' },
      { ic: '🍿', desc: '零食吃货' },
      { ic: '🪀', desc: '趣味搞怪' },
      { ic: '🕶️', desc: '潮流单品' },
      { ic: '🍵', desc: '养生好物' },
      { ic: '🌟', desc: '超级欧气' }
    ]
  }
};

// Start with a clean empty pool so no fake test items mix into real group activity
const defaultData = {
  config: {
    ...THEME_PRESETS.mh,
    adminPin: '8888',
    status: 'collecting'
  },
  gifts: [],
  assignments: {},
  history: []
};

// ================= DATABASE PERSISTENCE LAYER =================
let pgPool = null;
let isPgConnected = false;

if (process.env.DATABASE_URL) {
  try {
    const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
    console.log('📦 检测到 DATABASE_URL，已配置 PostgreSQL 连接池');
  } catch (err) {
    console.error('⚠️ PostgreSQL 配置初始化失败:', err);
  }
}

let db = JSON.parse(JSON.stringify(defaultData));

// Sequential promise queue to prevent race conditions during concurrent DB writes
let saveQueue = Promise.resolve();

async function initDB() {
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const res = await pgPool.query('SELECT data FROM app_state WHERE id = $1', ['default']);
      if (res.rows.length > 0) {
        db = res.rows[0].data;
        db.config = { ...THEME_PRESETS.mh, ...db.config };
        isPgConnected = true;
        console.log('✅【云数据库已连接】成功从 PostgreSQL 读取持久化数据！物资总数:', db.gifts.length);
        return;
      } else {
        await pgPool.query(
          'INSERT INTO app_state (id, data) VALUES ($1, $2)',
          ['default', JSON.stringify(defaultData)]
        );
        db = JSON.parse(JSON.stringify(defaultData));
        isPgConnected = true;
        console.log('✅【云数据库已初始化】已在 PostgreSQL 中创建初始记录！');
        return;
      }
    } catch (err) {
      console.error('⚠️ 连接 PostgreSQL 数据库出错，将回退到本地文件模式:', err.message);
      isPgConnected = false;
    }
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.gifts && parsed.config) {
        parsed.config = { ...THEME_PRESETS.mh, ...parsed.config };
        db = parsed;
        console.log('📁【本地文件模式】从 data.json 读取数据，物资总数:', db.gifts.length);
        return;
      }
    }
  } catch (err) {
    console.error('Error reading data.json:', err);
  }

  db = JSON.parse(JSON.stringify(defaultData));
  await saveData(db);
}

function saveData(data) {
  db = data;
  // Queue writes sequentially so Postgres never overwrites newer state with older state
  saveQueue = saveQueue.then(async () => {
    if (pgPool && isPgConnected) {
      try {
        await pgPool.query(`
          INSERT INTO app_state (id, data, updated_at)
          VALUES ('default', $1, NOW())
          ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()
        `, [JSON.stringify(data)]);
      } catch (err) {
        console.error('⚠️ 同步到 PostgreSQL 失败:', err.message);
      }
    }

    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing data.json:', err);
    }
  }).catch(err => console.error('Save queue error:', err));

  return saveQueue;
}

// 1. Public API: Get Room State & Gift Pool (Sanitized! NEVER expose adminPin or assignments!)
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

  // Strip sensitive adminPin before sending to frontend!
  const { adminPin, ...safeConfig } = db.config;

  // Registered hunters list (with whether they have already rolled)
  const hunters = db.gifts.map(g => ({
    name: g.provider,
    hasRolled: db.gifts.some(item => item.winner && item.winner.name.toLowerCase() === g.provider.toLowerCase())
  }));

  res.json({
    config: safeConfig,
    stats: {
      totalGifts,
      remainingGifts,
      wonGifts
    },
    gifts: db.gifts,
    hunters,
    history: db.history.slice(-10).reverse(),
    shareUrl,
    qrCodeDataUrl,
    dbStatus: {
      isPostgres: isPgConnected,
      mode: isPgConnected ? 'PostgreSQL 云数据库 (数据永久持久化)' : '本地文件模式 (未配置云数据库)'
    }
  });
});

// 2. Member Submits their Gift
app.post('/api/gift/submit', async (req, res) => {
  const { provider, name, value, icon } = req.body;

  if (db.config.status !== 'collecting') {
    return res.status(400).json({ error: '当前补给池已封存开奖，暂时无法添加新物资哦！' });
  }

  if (!provider || !provider.trim()) {
    return res.status(400).json({ error: '请输入你的昵称' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请输入你买的物资/礼物名称' });
  }

  const cleanProvider = provider.trim();
  const cleanName = name.trim();
  let cleanValue = (value && value.trim()) ? value.trim() : '¥60';
  // Auto prefix ¥ if user just entered a number like "65"
  if (/^\d+(\.\d+)?$/.test(cleanValue)) {
    cleanValue = '¥' + cleanValue;
  }
  const cleanIcon = icon || '🎁';

  const existingIndex = db.gifts.findIndex(g => g.provider.toLowerCase() === cleanProvider.toLowerCase());
  if (existingIndex >= 0) {
    db.gifts[existingIndex].name = cleanName;
    db.gifts[existingIndex].value = cleanValue;
    db.gifts[existingIndex].icon = cleanIcon;
    db.gifts[existingIndex].submittedAt = Date.now();
    await saveData(db);
    return res.json({ success: true, updated: true, gift: db.gifts[existingIndex] });
  }

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
  await saveData(db);

  res.json({ success: true, updated: false, gift: newGift });
});

// 3. Roll / Draw (Strictly limited to participants who actually submitted a gift!)
app.post('/api/roll', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '请选择或输入你的昵称！' });
  }
  const cleanName = name.trim();
  const lowerName = cleanName.toLowerCase();

  if (db.config.status !== 'rolling') {
    return res.status(400).json({ error: '活动仍在准备中，请等待管理员封池开奖！' });
  }

  // Check if user already won
  const alreadyWon = db.gifts.find(g => g.winner && g.winner.name.toLowerCase() === lowerName);
  if (alreadyWon) {
    return res.status(400).json({
      error: `你已经抽过啦！你斩获的是：【${alreadyWon.name}】`,
      gift: alreadyWon
    });
  }

  // Verify user actually participated (submitted a gift) to prevent random typos or guests stealing gifts
  const isParticipant = db.gifts.some(g => g.provider.toLowerCase() === lowerName);
  if (!isParticipant) {
    return res.status(403).json({
      error: `未找到 "${cleanName}" 的登记记录！请核对名字是否与登记时一致，或直接点击下方名字标签选择。`
    });
  }

  const assignedGiftId = db.assignments[lowerName];
  let pickedGift = null;

  if (assignedGiftId) {
    pickedGift = db.gifts.find(g => g.id === assignedGiftId && !g.winner);
  }

  if (!pickedGift) {
    const available = db.gifts.filter(g => !g.winner && g.provider.toLowerCase() !== lowerName);
    if (available.length > 0) {
      pickedGift = available[Math.floor(Math.random() * available.length)];
    } else {
      const anyAvailable = db.gifts.filter(g => !g.winner);
      if (anyAvailable.length === 0) {
        return res.status(400).json({ error: '补给池已被全部领空啦！' });
      }
      pickedGift = anyAvailable[0];
    }
  }

  // Preserve exact original casing of provider name
  const originalProvider = db.gifts.find(g => g.provider.toLowerCase() === lowerName)?.provider || cleanName;

  pickedGift.winner = {
    name: originalProvider,
    time: Date.now()
  };

  db.history.push({
    name: originalProvider,
    giftName: pickedGift.name,
    icon: pickedGift.icon,
    value: pickedGift.value,
    provider: pickedGift.provider,
    time: Date.now()
  });

  await saveData(db);

  res.json({
    success: true,
    gift: pickedGift
  });
});

// 4. Strict Derangement
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
  const pin = req.headers['x-admin-pin'] || (req.body && req.body.adminPin) || req.query.adminPin;
  if (pin !== db.config.adminPin) {
    return res.status(403).json({ error: '密码错误，默认密码为 8888' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { adminPin } = req.body;
  if (adminPin !== db.config.adminPin) {
    return res.status(403).json({ error: '密码错误！默认密码：8888' });
  }
  res.json({ success: true });
});

app.post('/api/admin/update-settings', checkAdmin, async (req, res) => {
  const {
    title, budget, budgetTip, phase1Badge, phase1Sub, phase1Btn,
    phase2Btn, winnerBadge, ruleText, icons, newAdminPin
  } = req.body;

  if (title) db.config.title = title.trim();
  if (budget) db.config.budget = budget.trim();
  if (budgetTip) db.config.budgetTip = budgetTip.trim();
  if (phase1Badge) db.config.phase1Badge = phase1Badge.trim();
  if (phase1Sub) db.config.phase1Sub = phase1Sub.trim();
  if (phase1Btn) db.config.phase1Btn = phase1Btn.trim();
  if (phase2Btn) db.config.phase2Btn = phase2Btn.trim();
  if (winnerBadge) db.config.winnerBadge = winnerBadge.trim();
  if (ruleText) db.config.ruleText = ruleText.trim();

  if (Array.isArray(icons) && icons.length > 0) {
    db.config.icons = icons.map(item => ({
      ic: item.ic ? item.ic.trim() : '🎁',
      desc: item.desc ? item.desc.trim() : '好礼'
    }));
  }

  if (newAdminPin && newAdminPin.trim().length >= 4) {
    db.config.adminPin = newAdminPin.trim();
  }

  await saveData(db);
  const { adminPin, ...safeConfig } = db.config;
  res.json({ success: true, config: safeConfig });
});

app.post('/api/admin/preset-theme', checkAdmin, async (req, res) => {
  const { themeKey } = req.body;
  const target = THEME_PRESETS[themeKey];
  if (!target) {
    return res.status(400).json({ error: '未知的主题预设' });
  }

  db.config = {
    ...db.config,
    ...target
  };

  await saveData(db);
  const { adminPin, ...safeConfig } = db.config;
  res.json({ success: true, config: safeConfig });
});

app.post('/api/admin/lock-and-match', checkAdmin, async (req, res) => {
  if (db.gifts.length < 2) {
    return res.status(400).json({ error: '至少需要 2 份物资才能封池开奖哦！' });
  }

  db.assignments = generateDerangementAssignments(db.gifts);
  db.config.status = 'rolling';
  db.gifts.forEach(g => { g.winner = null; });
  db.history = [];
  await saveData(db);

  res.json({ success: true, count: db.gifts.length });
});

app.post('/api/admin/reopen-collection', checkAdmin, async (req, res) => {
  db.config.status = 'collecting';
  db.assignments = {};
  db.gifts.forEach(g => { g.winner = null; });
  db.history = [];
  await saveData(db);
  res.json({ success: true, message: '已重新开启纳品/收集阶段！' });
});

app.post('/api/admin/gift/delete', checkAdmin, async (req, res) => {
  const { id } = req.body;
  db.gifts = db.gifts.filter(g => g.id !== id);
  await saveData(db);
  res.json({ success: true, gifts: db.gifts });
});

app.post('/api/admin/clear-all', checkAdmin, async (req, res) => {
  db.gifts = [];
  db.assignments = {};
  db.history = [];
  db.config.status = 'collecting';
  await saveData(db);
  res.json({ success: true, message: '已清空补给池，可重新开始！' });
});

app.get('/api/admin/export-backup', checkAdmin, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=mh_gift_backup_${Date.now()}.json`);
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/admin/import-restore', checkAdmin, async (req, res) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.gifts || !backupData.config) {
    return res.status(400).json({ error: '导入的备份数据格式不正确！' });
  }

  db = backupData;
  await saveData(db);
  res.json({ success: true, message: `成功恢复数据！当前包含 ${db.gifts.length} 份物资。` });
});

// Admin route (Secret /sillydog)
app.get('/sillydog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin', (req, res) => {
  res.status(404).send('Not Found');
});

// Start server after initializing DB
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`====================================================`);
    console.log(`🐾「呆猫集会所」群庆 · 猎人补给大抽奖启动！`);
    console.log(`💾 数据库状态: ${isPgConnected ? '🟢 PostgreSQL 云数据库已连通' : '🟡 本地文件模式 (建议配置 DATABASE_URL)'}`);
    console.log(`📱 玩家主页 (发微信群): http://${localIP}:${PORT}`);
    console.log(`👑 管理员后台: http://${localIP}:${PORT}/sillydog`);
    console.log(`🔑 房主密码: ${db.config.adminPin}`);
    console.log(`====================================================`);
  });
}).catch(err => {
  console.error('Fatal initialization error:', err);
});
