/**
 * app.js
 * Orquestração: estado da tela atual, eventos e cálculos de estatísticas.
 * Usa Storage (persistência), Habits (catálogo de hábitos), Users
 * (usuário + configuração individual active/mandatory), Progress
 * (conclusões diárias/água/pontuação) e Reminders (lembretes),
 * delegando toda manipulação de DOM para UI.
 */

(() => {
  const MOTIVATION_SNIPPETS = [
    'Mais um hábito concluído! 💚',
    'Falta pouco!',
    'Quase lá!',
    'Continue assim!',
    'Consistência > perfeição.'
  ];

  const THEME_STORAGE_KEY = 'saudeEmDupla:theme';
  const THEME_COLOR_BY_MODE = { light: '#F7F6EE', dark: '#14170F' };

  let currentDateKey = Habits.todayKey();
  let currentSummaryTab = 'completo';
  let pendingConfirm = null;
  let pendingOnboardingName = '';

  // ---------------------------------------------------------------
  // Tema (Light/Dark) — apenas uma camada visual; não toca em dados.
  // O tema salvo já foi aplicado ao <html> por um script inline no
  // <head> (evita "flash" do tema errado antes do CSS carregar).
  // ---------------------------------------------------------------
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      /* localStorage indisponível — tema não persiste, mas app funciona */
    }
    const metaThemeColor = document.getElementById('meta-theme-color');
    if (metaThemeColor) metaThemeColor.setAttribute('content', THEME_COLOR_BY_MODE[theme]);
  }

  function initTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const toggle = UI.$('theme-toggle');
    toggle.checked = isDark;
    applyTheme(isDark ? 'dark' : 'light');
    toggle.addEventListener('change', () => applyTheme(toggle.checked ? 'dark' : 'light'));
  }

  function uid() {
    return Users.getCurrentUserId();
  }

  // ---------------------------------------------------------------
  // Motivação
  // ---------------------------------------------------------------
  /** Mensagem orientada ao que falta — mais concreta do que uma faixa de %. */
  function motivationForProgress(done, total) {
    if (total === 0) return 'Ative um hábito em ⚙️ Meus hábitos para começar! 💚';
    const remaining = total - done;
    if (remaining === 0) return 'Dia perfeito! 🏆';
    if (done === 0) return 'Vamos começar o dia! 💚';
    if (remaining === 1) return 'Só falta 1! Você consegue. 💪';
    return `Faltam ${remaining} hábitos para completar seu dia 💚`;
  }

  function randomMotivationSnippet() {
    return MOTIVATION_SNIPPETS[Math.floor(Math.random() * MOTIVATION_SNIPPETS.length)];
  }

  function formatTimeNow() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // ---------------------------------------------------------------
  // Tela "Hoje"
  // ---------------------------------------------------------------
  function renderToday() {
    const userId = uid();
    currentDateKey = Habits.todayKey();
    const now = new Date();
    const day = Progress.getDay(userId, currentDateKey); // cria o registro de hoje se necessário
    const settings = Users.getSettings(userId);

    UI.setHeaderDate(Habits.formatHeaderDate(now));
    UI.setGreeting(Users.getCurrentUser().name);

    const { done, total } = Progress.calculateDailyPoints(userId, currentDateKey);
    const percent = Progress.calculateDailyProgress(userId, currentDateKey);
    UI.renderProgress({ percent, done, total, motivation: motivationForProgress(done, total) });

    const mandatoryHabits = Users.getMandatoryHabits(userId);
    UI.renderMandatoryIndicator(mandatoryHabits.length ? mandatoryHabits.filter((h) => !day.completedHabits[h.id]) : null);

    const nonWaterMandatory = mandatoryHabits.filter((h) => h.id !== Habits.WATER_HABIT_ID);
    UI.renderMandatorySection(nonWaterMandatory, day.completedHabits);

    const waterActive = Users.isHabitActive(userId, Habits.WATER_HABIT_ID);
    UI.showWaterCard(waterActive);
    if (waterActive) {
      UI.setWaterMandatoryBadge(Users.isHabitMandatory(userId, Habits.WATER_HABIT_ID));
      UI.renderWater(day, settings.waterGoalMl || 3000);
    }

    const activeHabits = Users.getActiveHabits(userId);
    const gridHabits = activeHabits.filter((h) => h.id !== Habits.WATER_HABIT_ID && !Users.isHabitMandatory(userId, h.id));
    UI.renderHabitGrid(gridHabits, day.completedHabits);

    const questions = Reminders.buildContextualQuestions(userId, currentDateKey, now);
    UI.renderQuestions(questions);

    UI.renderClosing(activeHabits, day.completedHabits, done, total);

    checkReminders(userId, currentDateKey, now);
  }

  function checkReminders(userId, dateKey, now) {
    const pending = Reminders.getPendingReminders(userId, dateKey, now);
    UI.showReminderBanner(pending.length ? pending[pending.length - 1] : null);
  }

  function dismissCurrentReminder() {
    const banner = UI.$('reminder-banner');
    const id = banner.dataset.reminderId;
    if (!id) return;
    const day = Progress.getDay(uid(), currentDateKey);
    if (!day.dismissedReminders.includes(id)) day.dismissedReminders.push(id);
    Storage.save();
    UI.showReminderBanner(null);
  }

  // ---------------------------------------------------------------
  // Hábitos: alternar concluído/pendente
  // ---------------------------------------------------------------
  function handleHabitToggle(habitId) {
    const userId = uid();
    const key = Habits.todayKey();
    const before = Progress.calculateDailyPoints(userId, key);
    Progress.toggleHabit(userId, habitId, key);
    const nowCompleted = Progress.isHabitCompleted(userId, habitId, key);
    const after = Progress.calculateDailyPoints(userId, key);

    renderToday();
    UI.pulseHabitCard(habitId);

    if (after.total > 0 && after.done === after.total && !(before.total > 0 && before.done === before.total)) {
      UI.showToast('🎉 Dia completo!', 3200);
      UI.celebrateDayComplete();
    } else if (nowCompleted) {
      UI.showToast(randomMotivationSnippet());
    }
  }

  // ---------------------------------------------------------------
  // Água
  // ---------------------------------------------------------------
  function refreshWaterModalIfOpen(day) {
    if (!UI.$('modal-water').classList.contains('hidden')) {
      UI.renderWaterEntries(day.waterEntries);
      UI.renderWaterModalSummary(day, Users.getSettings(uid()).waterGoalMl || 3000);
    }
  }

  /** Desfaz o último lançamento de água (usado pelo toast "Desfazer"). */
  function undoLastWaterEntry(userId, key) {
    const day = Progress.getDay(userId, key);
    const lastIndex = day.waterEntries.length - 1;
    if (lastIndex < 0) return;
    Progress.removeWaterEntryAt(userId, key, lastIndex);
    renderToday();
    refreshWaterModalIfOpen(Progress.getDay(userId, key));
    UI.showToast('Ação desfeita.', 1500);
  }

  /** ml pode ser positivo (adicionar) ou negativo (remover). */
  function addWaterAmount(ml) {
    if (!ml) return;
    const userId = uid();
    const key = Habits.todayKey();
    const before = Progress.waterGoalReached(userId, key);
    const timeLabel = formatTimeNow();
    const { day, entryIndex } = Progress.addWater(userId, key, ml, timeLabel);
    const after = Progress.waterGoalReached(userId, key);

    renderToday();
    refreshWaterModalIfOpen(day);

    if (entryIndex === -1) {
      UI.showToast(ml < 0 ? 'Não há água para remover.' : 'Nada para adicionar.', 1500);
      return;
    }

    const applied = day.waterEntries[entryIndex].ml;
    if (applied > 0) UI.pulseWaterRing();

    if (!before && after) {
      UI.celebrateWaterGoal();
      UI.showToast('🎉 Meta de água atingida! +1 ponto', 3200);
      return;
    }

    const message = applied >= 0 ? `+${applied} ml adicionados` : `${applied} ml removidos`;
    UI.showActionToast(message, 'Desfazer', () => undoLastWaterEntry(userId, key));
  }

  /** Remove um registro específico do extrato (edição manual, sem limite de tempo). */
  function removeWaterEntryAt(entryIndex) {
    const userId = uid();
    const key = Habits.todayKey();
    Progress.removeWaterEntryAt(userId, key, entryIndex);
    renderToday();
    refreshWaterModalIfOpen(Progress.getDay(userId, key));
    UI.showToast('Registro removido.', 1500);
  }

  function openWaterModal() {
    const userId = uid();
    const day = Progress.getDay(userId, Habits.todayKey());
    const goalMl = Users.getSettings(userId).waterGoalMl || 3000;
    UI.renderWaterEntries(day.waterEntries);
    UI.renderWaterModalSummary(day, goalMl);
    UI.$('water-modal-goal-input').value = goalMl;
    const signBtn = UI.$('water-custom-sign');
    signBtn.dataset.sign = '1';
    signBtn.textContent = '+';
    UI.$('water-custom-add').textContent = 'Adicionar';
    UI.$('water-custom-input').value = '';
    UI.openModal('modal-water');
  }

  function saveWaterGoalFromModal() {
    const value = parseInt(UI.$('water-modal-goal-input').value, 10);
    if (!Number.isFinite(value) || value <= 0) {
      UI.showToast('Digite uma meta válida.', 1500);
      return;
    }
    const userId = uid();
    Users.updateSettings(userId, { waterGoalMl: value });
    renderToday();
    UI.renderWaterModalSummary(Progress.getDay(userId, Habits.todayKey()), value);
    UI.showToast('Meta de água atualizada! 💚');
  }

  // ---------------------------------------------------------------
  // Semana / Histórico
  // ---------------------------------------------------------------
  function computeWeekStats(userId, now) {
    const weekKeys = Habits.getWeekKeys(now);
    const perDay = weekKeys.map((k) => Progress.calculateDailyPoints(userId, k));
    const total = perDay.reduce((s, p) => s + p.done, 0);
    const perDayTotal = Progress.calculateDailyPoints(userId, Habits.todayKey()).total;
    const maxTotal = perDayTotal * 7;
    const perfectDays = perDay.filter((p) => p.total > 0 && p.done === p.total).length;
    const bestDay = Math.max(0, ...perDay.map((p) => p.done));

    return {
      total,
      maxTotal,
      average: total / 7,
      perfectDays,
      bestDay,
      bestDayTotal: perDayTotal,
      consistency: maxTotal > 0 ? (total / maxTotal) * 100 : 0,
      streak: computeStreak(userId, now),
      bestStreak: computeBestStreak(userId, now)
    };
  }

  function computeStreak(userId, now) {
    let streak = 0;
    const cursor = new Date(now);
    if (Progress.isPerfectDay(userId, Habits.dateToKey(cursor))) streak++;
    cursor.setDate(cursor.getDate() - 1);
    while (Progress.isPerfectDay(userId, Habits.dateToKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function computeBestStreak(userId, now) {
    const days = Progress.getAllDays(userId);
    const completeDates = Object.keys(days)
      .filter((k) => Progress.isPerfectDay(userId, k))
      .map((k) => Habits.keyToDate(k))
      .sort((a, b) => a - b);

    let best = completeDates.length ? 1 : 0;
    let current = 1;
    for (let i = 1; i < completeDates.length; i++) {
      const diffDays = Math.round((completeDates[i] - completeDates[i - 1]) / 86400000);
      if (diffDays === 1) {
        current++;
        best = Math.max(best, current);
      } else {
        current = 1;
      }
    }
    return Math.max(best, computeStreak(userId, now));
  }

  function renderWeek() {
    const userId = uid();
    const now = new Date();
    UI.renderWeekStats(computeWeekStats(userId, now));

    const allDays = Progress.getAllDays(userId);
    const todayKey = Habits.todayKey();
    const rows = Habits.getWeekKeys(now).map((key) => {
      const date = Habits.keyToDate(key);
      const { done, total } = Progress.calculateDailyPoints(userId, key);
      return {
        weekdayName: Habits.WEEKDAY_NAMES[date.getDay()],
        dateLabel: Habits.formatShortDate(date),
        done,
        total,
        exists: !!allDays[key],
        isToday: key === todayKey
      };
    });
    UI.renderWeekDays(rows);
  }

  /** Dashboard do Histórico: gráfico de barras, heatmap de consistência e ranking por hábito. */
  function renderHistory() {
    const userId = uid();
    const now = new Date();
    const todayKey = Habits.todayKey();

    // Gráfico de barras — últimos 14 dias, do mais antigo ao de hoje.
    const chartKeys = Habits.getLastNDaysKeys(14, now).slice().reverse();
    const chartRows = chartKeys.map((key) => {
      const date = Habits.keyToDate(key);
      const percent = Progress.calculateDailyProgress(userId, key);
      return { label: String(date.getDate()), percent, isToday: key === todayKey };
    });
    UI.renderHistoryChart(chartRows);

    // Heatmap — últimas 5 semanas (segunda a domingo), como um mapa de calor.
    const mondayThisWeek = Habits.keyToDate(Habits.getWeekKeys(now)[0]);
    const heatmapStart = new Date(mondayThisWeek);
    heatmapStart.setDate(heatmapStart.getDate() - 28);
    const heatmapCells = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(heatmapStart);
      d.setDate(heatmapStart.getDate() + i);
      if (d > now) {
        heatmapCells.push({ level: 0, title: '' });
        continue;
      }
      const key = Habits.dateToKey(d);
      const percent = Progress.calculateDailyProgress(userId, key);
      let level = 0;
      if (percent >= 100) level = 3;
      else if (percent >= 50) level = 2;
      else if (percent > 0) level = 1;
      heatmapCells.push({ level, title: `${Habits.formatShortDate(d)} · ${percent}%` });
    }
    UI.renderHistoryHeatmap(heatmapCells);

    // Consistência por hábito — últimos 14 dias, do mais consistente ao menos.
    const consistencyKeys = Habits.getLastNDaysKeys(14, now);
    const consistencyRows = Users.getActiveHabits(userId)
      .map((habit) => {
        const done = consistencyKeys.reduce((sum, key) => sum + (Progress.isHabitCompleted(userId, habit.id, key) ? 1 : 0), 0);
        return { habit, done, total: consistencyKeys.length, percent: Math.round((done / consistencyKeys.length) * 100) };
      })
      .sort((a, b) => b.percent - a.percent);
    UI.renderHabitConsistency(consistencyRows);
  }

  // ---------------------------------------------------------------
  // Configurações
  // ---------------------------------------------------------------
  function renderConfigScreen() {
    const userId = uid();
    UI.renderConfigForm(Users.getSettings(userId), Users.getCurrentUser().name);
    UI.renderReminderTimesConfig(Reminders.getScheduleWithTimes(Users.getSettings(userId)));
  }

  function saveConfigForm() {
    const userId = uid();
    const name = UI.$('config-name').value.trim();
    const waterGoal = parseInt(UI.$('config-water-goal').value, 10);
    const workStart = UI.$('config-work-start').value || '08:00';
    const workEnd = UI.$('config-work-end').value || '18:00';
    const remindersEnabled = UI.$('config-reminders-toggle').checked;

    if (name) Users.setUserName(name);
    Users.updateSettings(userId, {
      waterGoalMl: Number.isFinite(waterGoal) && waterGoal > 0 ? waterGoal : 3000,
      workStart,
      workEnd,
      remindersEnabled
    });

    UI.showToast('Configurações salvas! 💚');
    renderToday();
  }

  function updateReminderTime(reminderId, value) {
    const userId = uid();
    const settings = Users.getSettings(userId);
    const reminderTimes = Object.assign({}, settings.reminderTimes || {}, { [reminderId]: value });
    Users.updateSettings(userId, { reminderTimes });
  }

  function openClearHistoryConfirm() {
    UI.openConfirm(
      'Apagar histórico',
      'Isso vai apagar todos os dados salvos (dias, água e histórico). Deseja continuar?'
    );
    pendingConfirm = () => {
      UI.closeModal('modal-confirm');
      setTimeout(() => {
        UI.openConfirm(
          'Tem certeza mesmo?',
          'Essa ação não pode ser desfeita. Todos os registros serão apagados permanentemente.'
        );
        pendingConfirm = () => {
          Storage.clearAllHistory();
          UI.closeModal('modal-confirm');
          UI.showToast('Histórico apagado.');
          renderToday();
          renderWeek();
          renderHistory();
        };
      }, 200);
    };
  }

  // ---------------------------------------------------------------
  // Meus hábitos
  // ---------------------------------------------------------------
  function renderMyHabitsScreen() {
    const userId = uid();
    const all = Habits.listAllHabits();
    const defaultHabits = all.filter((h) => h.type === 'default');
    const customHabits = all.filter((h) => h.type === 'custom');
    UI.renderMyHabits(defaultHabits, customHabits, (habitId) => Users.getHabitSettings(userId, habitId));
  }

  function openHabitFormForCreate() {
    UI.openHabitForm({ mode: 'create', icon: '⭐', mandatory: false });
  }

  function openHabitFormForEdit(habitId) {
    const userId = uid();
    const habit = Habits.getHabit(habitId);
    if (!habit) return;
    const setting = Users.getHabitSettings(userId, habitId);
    UI.openHabitForm({ mode: 'edit', id: habitId, name: habit.name, icon: habit.icon, mandatory: setting.mandatory, active: setting.active });
  }

  function submitHabitForm() {
    const userId = uid();
    const id = UI.$('habit-form-id').value;
    const name = UI.$('habit-form-name').value.trim();
    const selectedEmojiBtn = document.querySelector('.emoji-btn.selected');
    const icon = selectedEmojiBtn ? selectedEmojiBtn.dataset.emoji : '⭐';
    const mandatorySelected = document.querySelector('.mandatory-radio-btn.selected');
    const mandatory = mandatorySelected ? mandatorySelected.dataset.mandatory === 'true' : false;

    if (!name) {
      UI.showToast('Dê um nome para o hábito.');
      return;
    }

    if (id) {
      // edição de hábito personalizado
      Habits.updateHabit(id, { name, icon });
      const active = UI.$('habit-form-active-toggle').checked;
      Users.setHabitActive(userId, id, active);
      Users.setHabitMandatory(userId, id, mandatory);
      UI.showToast('Hábito atualizado! 💚');
    } else {
      const habit = Habits.addCustomHabit({ name, icon });
      Users.setHabitActive(userId, habit.id, true);
      Users.setHabitMandatory(userId, habit.id, mandatory);
      UI.showToast('Hábito criado! 💚');
    }

    UI.closeModal('modal-habit-form');
    renderMyHabitsScreen();
    renderToday();
  }

  function openDeleteHabitConfirm(habitId) {
    const habit = Habits.getHabit(habitId);
    if (!habit) return;
    UI.openConfirm(
      'Excluir hábito?',
      `Isso removerá "${habit.name}" da sua lista e apagará o histórico relacionado a ele.`
    );
    pendingConfirm = () => {
      const userId = uid();
      Habits.deleteCustomHabit(habitId);
      Users.removeHabitSetting(userId, habitId);
      Progress.purgeHabitHistory(userId, habitId);
      UI.closeModal('modal-confirm');
      UI.showToast('Hábito excluído.');
      renderMyHabitsScreen();
      renderToday();
    };
  }

  // ---------------------------------------------------------------
  // Resumo para WhatsApp
  // ---------------------------------------------------------------
  function summaryDateLabel(date) {
    const MONTH_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
  }

  function buildFullSummary() {
    const userId = uid();
    const now = new Date();
    const key = Habits.todayKey();
    const name = Users.getCurrentUser().name || 'Eu';
    const activeHabits = Users.getActiveHabits(userId);
    const day = Progress.getDay(userId, key);
    const { done, total } = Progress.calculateDailyPoints(userId, key);
    const percent = Progress.calculateDailyProgress(userId, key);
    const completed = activeHabits.filter((h) => day.completedHabits[h.id]);
    const mandatoryHabits = Users.getMandatoryHabits(userId);
    const pendingMandatory = mandatoryHabits.filter((h) => !day.completedHabits[h.id]);

    const lines = [];
    lines.push('💚 RESUMO DO DIA');
    lines.push('');
    lines.push(name);
    lines.push(`📅 ${summaryDateLabel(now)}`);
    lines.push('');
    lines.push(`${done} / ${total} hábitos`);
    lines.push(`${percent}%`);
    lines.push('');
    completed.forEach((h) => lines.push(`✓ ${h.name}`));

    if (mandatoryHabits.length > 0) {
      lines.push('');
      if (pendingMandatory.length === 0) {
        lines.push('⚠️ Obrigatórios pendentes:');
        lines.push('Nenhum');
      } else if (pendingMandatory.length === 1) {
        lines.push('⚠️ Obrigatório pendente:');
        lines.push(`${pendingMandatory[0].icon} ${pendingMandatory[0].name}`);
      } else {
        lines.push('⚠️ Obrigatórios pendentes:');
        pendingMandatory.forEach((h) => lines.push(`${h.icon} ${h.name}`));
      }
    }

    return lines.join('\n');
  }

  function buildCompactSummary() {
    const userId = uid();
    const now = new Date();
    const key = Habits.todayKey();
    const name = Users.getCurrentUser().name || 'Eu';
    const activeHabits = Users.getActiveHabits(userId);
    const day = Progress.getDay(userId, key);
    const { done, total } = Progress.calculateDailyPoints(userId, key);
    const emojis = activeHabits.filter((h) => day.completedHabits[h.id]).map((h) => h.icon).join('');
    return `💚 ${Habits.formatShortDate(now)}\n${name} ${done}/${total} ${emojis}`.trim();
  }

  function refreshSummaryText() {
    const text = currentSummaryTab === 'completo' ? buildFullSummary() : buildCompactSummary();
    UI.setSummaryText(text);
  }

  function openSummaryModal() {
    currentSummaryTab = 'completo';
    UI.setActiveSummaryTab('completo');
    refreshSummaryText();
    UI.openModal('modal-summary');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (err2) {
        return false;
      }
    }
  }

  // ---------------------------------------------------------------
  // Onboarding (passo 1: nome · passo 2: hábitos obrigatórios)
  // ---------------------------------------------------------------
  function initOnboarding() {
    const nameButtons = document.querySelectorAll('.onboarding-name-btn');
    const input = UI.$('onboarding-input');
    const nextBtn = UI.$('onboarding-next');

    nameButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        nameButtons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        input.value = btn.dataset.name;
        nextBtn.disabled = false;
      });
    });

    input.addEventListener('input', () => {
      nameButtons.forEach((b) => b.classList.remove('selected'));
      nextBtn.disabled = input.value.trim().length === 0;
    });

    nextBtn.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;
      pendingOnboardingName = name;
      Habits.seedDefaults();
      UI.renderMandatoryPicker(Habits.listAllHabits());
      UI.showOnboardingStep('mandatory');
    });

    UI.$('mandatory-picker-list').addEventListener('change', (e) => {
      const checkbox = e.target.closest('input[data-picker-habit]');
      if (!checkbox) return;
      const row = checkbox.closest('.mandatory-picker-row');
      row.classList.toggle('checked', checkbox.checked);
    });

    UI.$('onboarding-finish').addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('#mandatory-picker-list input[data-picker-habit]:checked')).map(
        (el) => el.dataset.pickerHabit
      );
      Users.createUser(pendingOnboardingName, checked);
      UI.showApp();
      renderToday();
    });
  }

  // ---------------------------------------------------------------
  // Wiring de eventos
  // ---------------------------------------------------------------
  function goToScreen(screen) {
    UI.showScreen(screen);
    if (screen === 'semana') renderWeek();
    if (screen === 'historico') renderHistory();
    if (screen === 'config') renderConfigScreen();
  }

  function wireEvents() {
    // Navegação inferior
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => goToScreen(btn.dataset.nav));
    });

    // Atalho de configurações no header
    UI.$('header-settings-btn').addEventListener('click', () => goToScreen('config'));

    // Grade de desafios (delegação)
    UI.$('habit-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.habit-card');
      if (!card) return;
      handleHabitToggle(card.dataset.habit);
    });

    // Hábitos obrigatórios (delegação)
    UI.$('mandatory-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-habit]');
      if (!btn) return;
      handleHabitToggle(btn.dataset.habit);
    });

    // Água: chips de adicionar rápido no card (não deve abrir o modal).
    // Na Home só é possível somar — remover/corrigir é só no modal.
    UI.$('card-water').addEventListener('click', (e) => {
      const quickBtn = e.target.closest('.chip-btn');
      if (quickBtn) {
        e.stopPropagation();
        addWaterAmount(Number(quickBtn.dataset.ml));
        return;
      }
      openWaterModal();
    });
    UI.$('card-water').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openWaterModal();
      }
    });

    // Modal de água: botões de quantidade (adicionar e remover)
    document.querySelectorAll('.water-amount-btn').forEach((btn) => {
      btn.addEventListener('click', () => addWaterAmount(Number(btn.dataset.ml)));
    });

    // Modal de água: alternar sinal (+/-) do valor personalizado
    const waterSignBtn = UI.$('water-custom-sign');
    waterSignBtn.addEventListener('click', () => {
      const next = waterSignBtn.dataset.sign === '1' ? '-1' : '1';
      waterSignBtn.dataset.sign = next;
      waterSignBtn.textContent = next === '1' ? '+' : '−';
      UI.$('water-custom-add').textContent = next === '1' ? 'Adicionar' : 'Remover';
    });

    // Modal de água: valor personalizado
    UI.$('water-custom-add').addEventListener('click', () => {
      const input = UI.$('water-custom-input');
      const value = parseInt(input.value, 10);
      const sign = waterSignBtn.dataset.sign === '-1' ? -1 : 1;
      if (Number.isFinite(value) && value > 0) {
        addWaterAmount(value * sign);
        input.value = '';
      }
    });

    // Modal de água: remover um registro específico do extrato
    UI.$('water-entries-list').addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.water-entry-delete');
      if (!deleteBtn) return;
      removeWaterEntryAt(Number(deleteBtn.dataset.entryIndex));
    });

    // Modal de água: editar a meta diária
    UI.$('water-modal-goal-save').addEventListener('click', saveWaterGoalFromModal);

    // Banner de lembrete
    UI.$('reminder-dismiss').addEventListener('click', dismissCurrentReminder);

    // Botão gerar resumo
    UI.$('btn-generate-summary').addEventListener('click', openSummaryModal);

    // Abas do resumo
    document.querySelectorAll('.summary-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        currentSummaryTab = tab.dataset.summaryTab;
        UI.setActiveSummaryTab(currentSummaryTab);
        refreshSummaryText();
      });
    });

    // Copiar / compartilhar resumo
    UI.$('summary-copy').addEventListener('click', async () => {
      const ok = await copyText(UI.$('summary-text').value);
      UI.setSummaryFeedback(ok ? 'Resumo copiado! 💚' : 'Não foi possível copiar automaticamente.');
    });
    UI.$('summary-share').addEventListener('click', async () => {
      const text = UI.$('summary-text').value;
      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch (err) {
          // usuário cancelou o compartilhamento — nada a fazer
        }
      } else {
        const ok = await copyText(text);
        UI.setSummaryFeedback(ok ? 'Resumo copiado! 💚' : 'Não foi possível copiar automaticamente.');
      }
    });

    // Fechar modais (botão "Fechar/Cancelar" e clique fora do sheet)
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => UI.closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) UI.closeModal(overlay.id);
      });
    });

    // Confirmação genérica
    UI.$('confirm-cancel').addEventListener('click', () => {
      pendingConfirm = null;
      UI.closeModal('modal-confirm');
    });
    UI.$('confirm-ok').addEventListener('click', () => {
      const fn = pendingConfirm;
      pendingConfirm = null;
      if (fn) fn();
    });

    // Configurações
    UI.$('config-save').addEventListener('click', saveConfigForm);
    UI.$('config-clear-history').addEventListener('click', openClearHistoryConfirm);
    UI.$('reminder-times-list').addEventListener('change', (e) => {
      const input = e.target.closest('input[data-reminder-id]');
      if (!input) return;
      updateReminderTime(input.dataset.reminderId, input.value);
    });

    // Meus hábitos
    UI.$('open-my-habits').addEventListener('click', () => {
      renderMyHabitsScreen();
      UI.openMyHabitsScreen();
    });
    const emptyStateGoHabits = UI.$('empty-state-go-habits');
    if (emptyStateGoHabits) {
      emptyStateGoHabits.addEventListener('click', () => {
        renderMyHabitsScreen();
        UI.openMyHabitsScreen();
      });
    }
    UI.$('my-habits-back').addEventListener('click', () => {
      UI.closeMyHabitsScreen();
      renderToday();
    });
    UI.$('open-add-habit').addEventListener('click', openHabitFormForCreate);

    function habitListChangeHandler(e) {
      const activeToggle = e.target.closest('input[data-active-toggle]');
      const mandatoryToggle = e.target.closest('input[data-mandatory-toggle]');
      const userId = uid();
      if (activeToggle) {
        Users.setHabitActive(userId, activeToggle.dataset.activeToggle, activeToggle.checked);
        renderMyHabitsScreen();
      } else if (mandatoryToggle) {
        Users.setHabitMandatory(userId, mandatoryToggle.dataset.mandatoryToggle, mandatoryToggle.checked);
        renderMyHabitsScreen();
      }
    }
    UI.$('default-habits-list').addEventListener('change', habitListChangeHandler);
    UI.$('custom-habits-list').addEventListener('change', habitListChangeHandler);

    UI.$('custom-habits-list').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-habit]');
      const deleteBtn = e.target.closest('[data-delete-habit]');
      if (editBtn) openHabitFormForEdit(editBtn.dataset.editHabit);
      if (deleteBtn) openDeleteHabitConfirm(deleteBtn.dataset.deleteHabit);
    });

    // Formulário de hábito (criar/editar)
    UI.$('habit-form-emoji-picker').addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-btn');
      if (!btn) return;
      UI.setEmojiSelected(btn.dataset.emoji);
    });
    document.querySelectorAll('.mandatory-radio-btn').forEach((btn) => {
      btn.addEventListener('click', () => UI.setMandatoryRadio(btn.dataset.mandatory === 'true'));
    });
    UI.$('habit-form-submit').addEventListener('click', submitHabitForm);

    // Revalida ao voltar para o app (troca de dia / lembretes perdidos)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') renderToday();
    });
    setInterval(() => {
      if (Habits.todayKey() !== currentDateKey) {
        renderToday();
      } else {
        checkReminders(uid(), currentDateKey, new Date());
      }
    }, 30000);
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    Habits.seedDefaults();
    initTheme();
    wireEvents();
    initOnboarding();

    if (!Users.hasUser()) {
      UI.showOnboarding();
    } else {
      UI.showApp();
      renderToday();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
