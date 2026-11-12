// Christmas Gift Pool Lottery - Main App Script
const { createApp, ref, computed, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    // Public state
    const config = ref({
      title: '🎄 2026 圣诞礼物大抽奖 🎁',
      budget: '50~70元',
      status: 'collecting', // 'collecting' | 'rolling'
      ruleTip: ''
    });
    const stats = ref({ totalGifts: 0, remainingGifts: 0, wonGifts: 0 });
    const gifts = ref([]);
    const history = ref([]);
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
      icon: '🎁'
    });
    const iconList = ['🎁', '🧣', '📻', '☕', '🍷', '💡', '🎮', '🕯️', '🧸', '🍪', '🧦', '✨'];

    // Slot Machine State
    const isSpinning = ref(false);
    const displaySlotItem = ref({ icon: '🎁', name: '准备摇奖...', value: '¥50~70' });

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

    // Audio Synthesizer
    let audioCtx = null;
    const initAudio = () => {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    };

    const playClick = () => {
      if (isMuted.value || !audioCtx) return;
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } catch (e) {}
    };

    const playWinFanfare = () => {
      if (isMuted.value || !audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.35);
          } catch(e) {}
        }, i * 110);
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
      const colors = ['#c41e3a', '#15803d', '#fbbf24', '#ffffff', '#38bdf8', '#ffd700'];

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

    // Snow animation on canvas
    const initSnow = () => {
      const canvas = document.getElementById('snow-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let w = (canvas.width = window.innerWidth);
      let h = (canvas.height = window.innerHeight);

      window.addEventListener('resize', () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      });

      const flakes = [];
      for (let i = 0; i < 50; i++) {
        flakes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 3 + 1,
          d: Math.random() * 1.5 + 0.5,
          drift: Math.random() * 0.8 - 0.4
        });
      }

      const drawSnow = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        flakes.forEach(f => {
          ctx.moveTo(f.x, f.y);
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);
        });
        ctx.fill();

        flakes.forEach(f => {
          f.y += f.d;
          f.x += f.drift;
          if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
          if (f.x > w) f.x = 0;
          if (f.x < 0) f.x = w;
        });

        requestAnimationFrame(drawSnow);
      };
      drawSnow();
    };

    // Fetch Public State
    const fetchState = async () => {
      try {
        const res = await fetch('/api/public-state');
        const data = await res.json();
        config.value = data.config;
        stats.value = data.stats;
        gifts.value = data.gifts;
        history.value = data.history || [];
        shareUrl.value = window.location.origin || data.shareUrl;
        qrCodeDataUrl.value = data.qrCodeDataUrl || '';

        updateUserStatus();
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    // Update current user's submitted gift & won prize
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
        localStorage.setItem('xmas_saved_name', currentName.value.trim());
      }
      updateUserStatus();
    };

    // Open Gift Submission Modal
    const openSubmitModal = () => {
      initAudio();
      if (mySubmittedGift.value) {
        // Pre-fill existing submission
        submitForm.value.name = mySubmittedGift.value.name;
        submitForm.value.price = mySubmittedGift.value.value;
        submitForm.value.icon = mySubmittedGift.value.icon || '🎁';
      }
      showSubmitModal.value = true;
    };

    // Submit Gift to Pool
    const submitMyGift = async () => {
      initAudio();
      if (!currentName.value.trim()) {
        showToast('请先输入你的昵称！');
        return;
      }
      if (!submitForm.value.name.trim()) {
        showToast('请输入你买的礼物名称！');
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
          showToast(data.error || '提交失败');
          return;
        }

        playWinFanfare();
        launchConfetti();
        showToast(data.updated ? '✅ 礼物信息已更新！' : '🎉 礼物成功入池！静待群主封池开奖！');
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
        showToast('👉 请先输入你的昵称！');
        return;
      }

      if (config.value.status !== 'rolling') {
        showToast('当前仍在礼物收集阶段，请等待房主封池开奖！');
        return;
      }

      if (myPrize.value) {
        showToast('你已经抽过礼物啦，每人限抽1次哦！');
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

        // 2.2s arcade suspense
        setTimeout(() => {
          clearInterval(spinTimer);
          isSpinning.value = false;

          if (!res.ok) {
            showToast(data.error || '抽奖失败');
            return;
          }

          const won = data.gift;
          displaySlotItem.value = won;
          winningGift.value = won;
          myPrize.value = won;

          playWinFanfare();
          launchConfetti();
          showWinnerModal.value = true;

          fetchState();
        }, 2200);

      } catch (err) {
        clearInterval(spinTimer);
        isSpinning.value = false;
        showToast('抽奖请求失败，请稍后重试');
      }
    };

    // Copy to clipboard
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

    // Poster Generation
    const generatePoster = () => {
      const gift = myPrize.value || winningGift.value;
      if (!gift) return;

      const canvas = document.createElement('canvas');
      canvas.width = 750;
      canvas.height = 1050;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 750, 1050);
      grad.addColorStop(0, '#1b3826');
      grad.addColorStop(0.5, '#0d1e14');
      grad.addColorStop(1, '#050c08');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 750, 1050);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 8;
      ctx.strokeRect(30, 30, 690, 990);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('🎄 2026 圣诞礼物大抽奖 🎁', 375, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.fillText('群友自备心意 · 纯随机盲盒抽取！', 375, 165);

      ctx.fillStyle = '#fff9e6';
      ctx.beginPath();
      ctx.roundRect(80, 220, 590, 520, 24);
      ctx.fill();

      ctx.fillStyle = '#c41e3a';
      ctx.beginPath();
      ctx.roundRect(100, 240, 550, 60, 14);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(`🎉 恭喜欧皇【${currentName.value}】斩获圣诞好礼！`, 375, 280);

      ctx.font = '90px sans-serif';
      ctx.fillText(gift.icon || '🎁', 375, 420);

      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(gift.name, 375, 500);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`💰 礼物估值：${gift.value}`, 375, 560);

      ctx.fillStyle = '#64748b';
      ctx.font = '20px sans-serif';
      ctx.fillText(`由 @${gift.provider} 精心准备提供`, 375, 610);

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(140, 650);
      ctx.lineTo(610, 650);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#15803d';
      ctx.font = 'italic bold 22px sans-serif';
      ctx.fillText('“ 冬日的第一份惊喜，已被我收入囊中！ ”', 375, 700);

      if (qrCodeDataUrl.value) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 100, 780, 180, 180);
          ctx.textAlign = 'left';
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 28px sans-serif';
          ctx.fillText('扫码进入圣诞抽奖池', 310, 840);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '20px sans-serif';
          ctx.fillText('预算50~70元 · 纯随机盲盒抽取', 310, 885);
          ctx.fillText('快来带走属于你的冬日心意！', 310, 925);

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
      const saved = localStorage.getItem('xmas_saved_name');
      if (saved) {
        currentName.value = saved;
      }
      fetchState();
      initSnow();
      pollTimer = setInterval(fetchState, 4000);
    });

    onUnmounted(() => {
      if (pollTimer) clearInterval(pollTimer);
    });

    return {
      config,
      stats,
      gifts,
      history,
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
      openSubmitModal,
      submitMyGift,
      startRoll,
      copyText,
      generatePoster
    };
  }
}).mount('#app');
