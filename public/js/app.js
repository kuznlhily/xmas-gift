// Monster Hunter "呆猫集会所" Group Celebration - Main App Script
const { createApp, ref, computed, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    // Public state
    const config = ref({
      title: '🐾「呆猫集会所」周年群庆 · 猎人补给大抽奖 🍖',
      budget: '50~70元',
      status: 'collecting', // 'collecting' | 'rolling'
      ruleTip: ''
    });
    const stats = ref({ totalGifts: 0, remainingGifts: 0, wonGifts: 0 });
    const gifts = ref([]);
    const hunters = ref([]);
    const history = ref([]);
    const isInitialLoading = ref(true);
    const shareUrl = ref('');
    const qrCodeDataUrl = ref('');

    // User identification
    const currentName = ref('');
    const mySubmittedGift = ref(null);
    const myPrize = ref(null);

    // Gift Submission Form Modal
    const showSubmitModal = ref(false);
    const submitForm = ref({
      name: '',
      price: '¥65',
      icon: '🍖'
    });

    // Monster Hunter Themed Icons
    const iconList = [
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
    ];

    // Slot Machine State
    const isSpinning = ref(false);
    const displaySlotItem = ref({ icon: '🍖', name: '准备炼金中...', value: '¥50~70' });

    // Modals
    const showWinnerModal = ref(false);
    const winningGift = ref(null);
    const showPosterModal = ref(false);
    const posterDataUrl = ref('');
    const showQrModal = ref(false);

    // Audio & Toast
    const isMuted = ref(false);
    const toast = ref({ show: false, msg: '' });

    const showToast = (msg, duration = 2500) => {
      toast.value = { show: true, msg };
      setTimeout(() => { toast.value.show = false; }, duration);
    };

    // Audio Synthesizer (Monster Hunter SFX)
    let audioCtx = null;
    const initAudio = () => {
      try {
        if (!audioCtx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        // Play a tiny silent pulse synchronously on tap to unlock iOS Safari/WeChat audio
        if (audioCtx) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(0);
          osc.stop(audioCtx.currentTime + 0.01);
        }
      } catch (e) {}
    };

    const playClick = () => {
      if (isMuted.value || !audioCtx) return;
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(750 + Math.random() * 200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } catch (e) {}
    };

    // Classic Monster Hunter "So Tasty! / 上手に焼けました～" Victory Fanfare
    const playMHFanfare = () => {
      if (isMuted.value || !audioCtx) return;
      // Notes: G4, C5, E5, G5, C6 (So tasty fanfare!)
      const notes = [
        { f: 392.00, d: 0.15 }, // G4
        { f: 523.25, d: 0.15 }, // C5
        { f: 659.25, d: 0.15 }, // E5
        { f: 783.99, d: 0.25 }, // G5
        { f: 1046.50, d: 0.60 } // C6 (Ta-da!)
      ];

      let elapsed = 0;
      notes.forEach((n) => {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + n.d);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + n.d);
          } catch(e) {}
        }, elapsed * 1000);
        elapsed += n.d * 0.85;
      });
    };

    // Confetti Engine
    const launchConfetti = () => {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const particles = [];
      const colors = ['#f59e0b', '#fbbf24', '#b91c1c', '#ea580c', '#ffffff', '#22c55e'];

      for (let i = 0; i < 110; i++) {
        particles.push({
          x: canvas.width / 2,
          y: canvas.height * 0.4,
          vx: (Math.random() - 0.5) * 18,
          vy: (Math.random() - 0.8) * 18,
          size: Math.random() * 8 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 12,
          opacity: 1
        });
      }

      let animId;
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.38;
          p.vx *= 0.98;
          p.rotation += p.vRot;
          p.opacity -= 0.012;

          if (p.opacity > 0) {
            alive = true;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
            ctx.restore();
          }
        });

        if (alive) {
          animId = requestAnimationFrame(animate);
        } else {
          cancelAnimationFrame(animId);
          canvas.remove();
        }
      };
      animate();
    };

    // Hearth Embers & Sparks Animation (集会所壁炉暖火星动效)
    const initEmbers = () => {
      const canvas = document.getElementById('snow-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let w = (canvas.width = window.innerWidth);
      let h = (canvas.height = window.innerHeight);

      window.addEventListener('resize', () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      });

      const embers = [];
      for (let i = 0; i < 45; i++) {
        embers.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2.5 + 1,
          speedY: Math.random() * 1.2 + 0.4,
          speedX: Math.random() * 0.8 - 0.4,
          alpha: Math.random() * 0.7 + 0.3
        });
      }

      const drawEmbers = () => {
        ctx.clearRect(0, 0, w, h);
        embers.forEach(e => {
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245, 158, 11, ${e.alpha})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ea580c';
          ctx.fill();

          e.y -= e.speedY; // float up like campfire embers
          e.x += e.speedX;

          if (e.y < -10) {
            e.y = h + 10;
            e.x = Math.random() * w;
          }
          if (e.x > w) e.x = 0;
          if (e.x < 0) e.x = w;
        });

        requestAnimationFrame(drawEmbers);
      };
      drawEmbers();
    };

    // Fetch Public State
    const fetchState = async () => {
      try {
        const res = await fetch('/api/public-state');
        if (!res.ok) return;
        const data = await res.json();
        config.value = data.config;
        stats.value = data.stats;
        gifts.value = data.gifts;
        hunters.value = data.hunters || [];
        history.value = data.history || [];
        shareUrl.value = window.location.origin || data.shareUrl;
        qrCodeDataUrl.value = data.qrCodeDataUrl || '';
        isInitialLoading.value = false;

        updateUserStatus();
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    const selectHunter = (name) => {
      currentName.value = name;
      localStorage.setItem('mh_saved_hunter_name', name);
      updateUserStatus();
    };

    const updateUserStatus = () => {
      if (!currentName.value) {
        mySubmittedGift.value = null;
        myPrize.value = null;
        return;
      }
      const cName = currentName.value.trim().toLowerCase();
      mySubmittedGift.value = gifts.value.find(g => g.provider.toLowerCase() === cName) || null;
      myPrize.value = gifts.value.find(g => g.winner && g.winner.name.toLowerCase() === cName) || null;
    };

    const onNameChange = () => {
      if (currentName.value.trim()) {
        localStorage.setItem('mh_saved_hunter_name', currentName.value.trim());
      }
      updateUserStatus();
    };

    const openSubmitModal = () => {
      initAudio();
      if (mySubmittedGift.value) {
        submitForm.value.name = mySubmittedGift.value.name;
        submitForm.value.price = mySubmittedGift.value.value;
        submitForm.value.icon = mySubmittedGift.value.icon || '🍖';
      }
      showSubmitModal.value = true;
    };

    // Submit Gift to Pool
    const submitMyGift = async () => {
      initAudio();
      if (!currentName.value.trim()) {
        showToast('请先输入你的猎人昵称！');
        return;
      }
      if (!submitForm.value.name.trim()) {
        showToast('请输入你买的狩猎物资名称！');
        return;
      }

      try {
        const res = await fetch('/api/gift/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: currentName.value.trim(),
            name: submitForm.value.name.trim(),
            value: submitForm.value.price.trim(),
            icon: submitForm.value.icon
          })
        });
        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || '纳品失败');
          return;
        }

        playMHFanfare();
        launchConfetti();
        showToast(data.updated ? '✅ 纳品物资已更新！' : '🎉 物资成功入库！静候大团长封池开炉！');
        showSubmitModal.value = false;
        fetchState();
      } catch (err) {
        showToast('网络开小差了，请重试');
      }
    };

    // Slot Machine Roll
    const startRoll = async () => {
      initAudio();

      if (!currentName.value.trim()) {
        showToast('👉 请先输入你的猎人昵称！');
        return;
      }

      if (config.value.status !== 'rolling') {
        showToast('集会所仍在纳品筹备中，请等待大团长封池！');
        return;
      }

      if (myPrize.value) {
        showToast('每位猎人限领1份报酬，你已经领过啦！');
        return;
      }

      if (!confirm(`确认你是【${currentName.value.trim()}】本人吗？\n点击确定即可开炉抽取，机会只有1次哦！`)) {
        return;
      }

      isSpinning.value = true;

      // Fast ticker shuffle
      let spinTimer = setInterval(() => {
        const rand = gifts.value[Math.floor(Math.random() * gifts.value.length)];
        displaySlotItem.value = rand;
        playClick();
      }, 70);

      try {
        const res = await fetch('/api/roll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: currentName.value.trim() })
        });
        const data = await res.json();

        if (!res.ok) {
          clearInterval(spinTimer);
          isSpinning.value = false;
          displaySlotItem.value = { icon: '🍖', name: '准备炼金中...', value: '¥50~70' };
          showToast(data.error || '抽取失败', 3500);
          return;
        }

        // 2.2s suspense
        setTimeout(() => {
          clearInterval(spinTimer);
          isSpinning.value = false;

          const won = data.gift;
          displaySlotItem.value = won;
          winningGift.value = won;
          myPrize.value = won;

          playMHFanfare();
          launchConfetti();
          showWinnerModal.value = true;

          fetchState();
        }, 2200);

      } catch (err) {
        clearInterval(spinTimer);
        isSpinning.value = false;
        showToast('请求超时，请稍后重试');
      }
    };

    const copyText = (text, tip = '已复制！') => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(tip));
      } else {
        const input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
        showToast(tip);
      }
    };

    // Generate Monster Hunter Quest Clear Certificate Poster
    const generatePoster = () => {
      const gift = myPrize.value || winningGift.value;
      if (!gift) return;

      const canvas = document.createElement('canvas');
      canvas.width = 750;
      canvas.height = 1050;
      const ctx = canvas.getContext('2d');

      // MH Tavern Parchment Gradient
      const grad = ctx.createLinearGradient(0, 0, 750, 1050);
      grad.addColorStop(0, '#2e1a0c');
      grad.addColorStop(0.5, '#170d06');
      grad.addColorStop(1, '#0a0502');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 750, 1050);

      // Bronze Hunter Guild Border
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 8;
      ctx.strokeRect(30, 30, 690, 990);

      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 42, 666, 966);

      // Top Header
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('🐾「呆猫集会所」周年群庆特别纳品 🍖', 375, 120);

      ctx.fillStyle = '#fef3c7';
      ctx.font = '22px sans-serif';
      ctx.fillText('MONSTER HUNTER · 猎人公会特别嘉奖单', 375, 165);

      // Quest Parchment Card
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.roundRect(80, 220, 590, 520, 20);
      ctx.fill();

      // Quest Complete Banner
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.roundRect(100, 240, 550, 60, 12);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`🏆 QUEST COMPLETE! 苍蓝星【${currentName.value}】`, 375, 280);

      // Big Gift Icon
      ctx.font = '85px sans-serif';
      ctx.fillText(gift.icon || '🍖', 375, 415);

      // Gift Title
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(gift.name, 375, 495);

      // Value
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`💰 任务报酬估值：${gift.value}`, 375, 555);

      ctx.fillStyle = '#78350f';
      ctx.font = '20px sans-serif';
      ctx.fillText(`由集会所猎人 @${gift.provider} 纳品赞助`, 375, 605);

      // Red Circle Quest Stamp
      ctx.save();
      ctx.translate(560, 630);
      ctx.rotate(-15 * Math.PI / 180);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('CLEAR', 0, -6);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('公会认证', 0, 16);
      ctx.restore();

      // Divider
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(140, 645);
      ctx.lineTo(480, 645);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#15803d';
      ctx.font = 'italic bold 22px sans-serif';
      ctx.fillText('“ 上手に焼けました～！愿指引明路的苍蓝星为你闪耀！ ”', 375, 695);

      // Bottom QR
      if (qrCodeDataUrl.value) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 100, 780, 180, 180);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 28px sans-serif';
          ctx.fillText('扫码进入呆猫集会所', 310, 840);
          ctx.fillStyle = '#fde68a';
          ctx.font = '20px sans-serif';
          ctx.fillText('群庆物资大抽奖 · 纯随机盲盒', 310, 885);
          ctx.fillText('快来领取属于你的周年狩猎报酬！', 310, 925);

          posterDataUrl.value = canvas.toDataURL('image/png');
          showPosterModal.value = true;
        };
        qrImg.src = qrCodeDataUrl.value;
      } else {
        posterDataUrl.value = canvas.toDataURL('image/png');
        showPosterModal.value = true;
      }
    };

    let pollTimer = null;

    onMounted(() => {
      const saved = localStorage.getItem('mh_saved_hunter_name');
      if (saved) currentName.value = saved;
      fetchState();
      initEmbers();
      pollTimer = setInterval(fetchState, 4000);
    });

    onUnmounted(() => {
      if (pollTimer) clearInterval(pollTimer);
    });

    return {
      config,
      stats,
      gifts,
      hunters,
      history,
      isInitialLoading,
      shareUrl,
      qrCodeDataUrl,
      currentName,
      mySubmittedGift,
      myPrize,
      showSubmitModal,
      submitForm,
      iconList,
      isSpinning,
      displaySlotItem,
      showWinnerModal,
      winningGift,
      showPosterModal,
      posterDataUrl,
      showQrModal,
      isMuted,
      toast,
      onNameChange,
      selectHunter,
      openSubmitModal,
      submitMyGift,
      startRoll,
      copyText,
      generatePoster
    };
  }
}).mount('#app');
