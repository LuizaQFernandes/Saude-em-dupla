/**
 * ui.js
 * Camada de renderização/DOM. Não guarda estado nem regras de negócio —
 * apenas recebe dados já calculados (por app.js) e atualiza a tela.
 */

const UI = (() => {
  const RING_CIRCUMFERENCE_BIG = 2 * Math.PI * 52; // r=52
  const RING_CIRCUMFERENCE_WATER = 2 * Math.PI * 46; // r=46 — anel compacto do card de água

  // Biblioteca de ícones para hábitos personalizados, organizada por área da
  // vida — só para deixar o seletor navegável; não afeta nada na arquitetura.
  const EMOJI_CATEGORIES = [
    { label: '💄 Beleza', icons: ['💄', '🧴', '💅', '🪞', '🪒', '🧖', '✨', '💆'] },
    { label: '🚿 Higiene', icons: ['🚿', '🛁', '🪥', '🦷', '👂', '🧼', '🧻', '🚽'] },
    { label: '💊 Saúde', icons: ['💊', '🩺', '🌡️', '💉', '🏥', '😴', '🧬'] },
    { label: '🍎 Alimentação', icons: ['🍎', '🥗', '🥦', '🍓', '🍌', '🥕', '☕', '💧', '🥤', '🍽️'] },
    { label: '🏃 Esportes', icons: ['🏃', '🚴', '⚽', '🏊', '🏋️', '🧗', '🤸', '🥊', '🏓', '⛹️', '💪', '🦵', '🦶'] },
    { label: '📚 Estudos', icons: ['📚', '✏️', '💻', '🎓', '🧠', '📝', '🔬', '⏰'] },
    { label: '🧘 Bem-estar', icons: ['🧘', '🌙', '🌬️', '🕯️', '🎧', '🌿', '🙏', '😌'] },
    { label: '🏠 Rotina', icons: ['🏠', '🧹', '🧺', '🪴', '🐶', '🐱', '📅', '🗂️'] },
    { label: '❤️ Outros', icons: ['❤️', '👪', '💞', '🎵', '🎨', '🎯', '⭐', '🏆', '🎮', '📷', '🔊'] }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ---------- Navegação ----------

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.screen !== screenId);
    });
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === screenId);
    });
  }

  // ---------- Cabeçalho / saudação ----------

  function setGreeting(name) {
    $('greeting-text').textContent = name ? `Olá, ${name}! 👋` : 'Olá! 👋';
  }

  function setHeaderDate(text) {
    $('header-date').textContent = text;
  }

  // ---------- Card de progresso ----------

  function setRing(circleEl, percent, circumference) {
    const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
    circleEl.style.strokeDasharray = String(circumference);
    circleEl.style.strokeDashoffset = String(offset);
  }

  function renderProgress({ percent, done, total, motivation }) {
    setRing($('progress-ring-fg'), percent, RING_CIRCUMFERENCE_BIG);
    $('progress-percent').textContent = `${percent}%`;
    $('progress-fraction').textContent = `${done}/${total}`;
    $('progress-motivation').textContent = motivation;
  }

  /** pendingCount/totalMandatory === null quando o usuário não tem nenhum hábito obrigatório. */
  function renderMandatoryIndicator(pendingHabits) {
    const el = $('mandatory-indicator');
    if (pendingHabits === null) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    if (pendingHabits.length === 0) {
      el.textContent = '✓ Todos os hábitos obrigatórios concluídos';
      el.classList.add('all-done');
    } else if (pendingHabits.length === 1) {
      el.textContent = `⚠️ Ainda falta: ${pendingHabits[0].name}`;
      el.classList.remove('all-done');
    } else {
      el.textContent = `⚠️ ${pendingHabits.length} hábitos obrigatórios pendentes`;
      el.classList.remove('all-done');
    }
  }

  // ---------- Hábitos obrigatórios (dinâmico) ----------

  function renderMandatorySection(habits, completedMap) {
    const section = $('mandatory-section');
    if (!habits.length) {
      section.classList.add('hidden');
      $('mandatory-list').innerHTML = '';
      return;
    }
    section.classList.remove('hidden');
    $('mandatory-list').innerHTML = habits
      .map((h) => {
        const done = !!completedMap[h.id];
        return `
        <div class="mandatory-card ${done ? 'completed' : ''}">
          <div class="mandatory-card-main">
            <span class="mandatory-card-icon">${h.icon}</span>
            <div>
              <div class="mandatory-card-title">${escapeHtml(h.name)}</div>
              <div class="mandatory-card-tag">${done ? '✓ Concluído' : 'Obrigatório · Pendente'}</div>
            </div>
          </div>
          <button type="button" class="btn-mandatory-action ${done ? 'completed' : ''}" data-habit="${h.id}">
            ${done ? '✓ Concluído' : 'Fazer agora'}
          </button>
        </div>`;
      })
      .join('');
  }

  // ---------- Card água ----------

  function showWaterCard(visible) {
    $('card-water').classList.toggle('hidden', !visible);
  }

  function setWaterMandatoryBadge(visible) {
    $('water-mandatory-badge').classList.toggle('hidden', !visible);
  }

  function renderWater(day, goalMl) {
    const percent = Math.min(100, Math.round((day.waterMl / goalMl) * 100));
    const reached = day.waterMl >= goalMl;

    $('water-current').textContent = day.waterMl.toLocaleString('pt-BR');
    $('water-goal').textContent = `/ ${goalMl.toLocaleString('pt-BR')} ml`;
    setRing($('water-hero-fg'), percent, RING_CIRCUMFERENCE_WATER);
    $('water-percent').textContent = `${percent}%`;
    $('water-hero-ring-wrap').classList.toggle('goal-reached', reached);

    // Uma única linha compacta, mesmo quando a meta é ultrapassada.
    const statusEl = $('water-status');
    if (reached) {
      const over = day.waterMl - goalMl;
      statusEl.textContent = over > 0 ? `✓ Meta atingida · +${over.toLocaleString('pt-BR')} ml` : '✓ Meta atingida';
      statusEl.classList.add('goal-reached');
    } else {
      statusEl.textContent = `Faltam ${(goalMl - day.waterMl).toLocaleString('pt-BR')} ml`;
      statusEl.classList.remove('goal-reached');
    }
  }

  /** Pequena reação visual (pulso + bolhas) ao registrar água — só ao adicionar. */
  function pulseWaterRing() {
    const wrap = $('water-hero-ring-wrap');
    wrap.classList.remove('just-updated');
    // força reflow para permitir reiniciar a animação em cliques seguidos
    void wrap.offsetWidth;
    wrap.classList.add('just-updated');
    setTimeout(() => wrap.classList.remove('just-updated'), 500);

    const positions = [38, 50, 62];
    positions.forEach((leftPercent, i) => {
      const bubble = document.createElement('span');
      bubble.className = 'water-bubble';
      bubble.style.left = `${leftPercent}%`;
      bubble.style.animationDelay = `${i * 70}ms`;
      wrap.appendChild(bubble);
      setTimeout(() => bubble.remove(), 1000);
    });
  }

  /** Celebração breve ao cruzar a meta de água pela primeira vez no dia. */
  function celebrateWaterGoal() {
    const wrap = $('water-hero-ring-wrap');
    wrap.classList.remove('celebrate');
    void wrap.offsetWidth;
    wrap.classList.add('celebrate');
    setTimeout(() => wrap.classList.remove('celebrate'), 900);
  }

  /** Celebração breve no card de progresso ao concluir todos os hábitos do dia. */
  function celebrateDayComplete() {
    const card = document.querySelector('.card-progress');
    if (!card) return;
    card.classList.remove('celebrate');
    void card.offsetWidth;
    card.classList.add('celebrate');
    setTimeout(() => card.classList.remove('celebrate'), 900);
  }

  /** Resumo (valor atual/meta + barrinha) mostrado dentro do modal de edição. */
  function renderWaterModalSummary(day, goalMl) {
    const percent = Math.min(100, Math.round((day.waterMl / goalMl) * 100));
    $('water-modal-current').textContent = day.waterMl.toLocaleString('pt-BR');
    $('water-modal-goal').textContent = `/ ${goalMl.toLocaleString('pt-BR')} ml`;
    $('water-modal-bar-fill').style.width = `${percent}%`;
  }

  function renderWaterEntries(entries) {
    const list = $('water-entries-list');
    if (!entries.length) {
      list.innerHTML = '<div class="water-entry-row"><span>Nenhum registro ainda hoje</span></div>';
      return;
    }
    list.innerHTML = entries
      .map((e, i) => ({ ...e, index: i }))
      .reverse()
      .map(
        (e) => `
      <div class="water-entry-row" data-entry-row="${e.index}">
        <span>${escapeHtml(e.time)}</span>
        <span class="water-entry-amount ${e.ml < 0 ? 'negative' : ''}">${e.ml >= 0 ? '+' : ''}${e.ml} ml</span>
        <span class="water-entry-actions">
          <button type="button" class="water-entry-edit" data-entry-edit="${e.index}" aria-label="Editar este registro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z"/></svg>
          </button>
          <button type="button" class="water-entry-delete" data-entry-index="${e.index}" aria-label="Remover este registro">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </span>
      </div>`
      )
      .join('');
  }

  function renderWaterEntriesTotal(totalMl) {
    $('water-entries-total').textContent = `Total: ${totalMl.toLocaleString('pt-BR')} ml`;
  }

  /** Troca a linha de um registro pelo modo de edição inline (input + salvar/cancelar). */
  function showWaterEntryEditRow(entryIndex, currentMl) {
    const row = document.querySelector(`.water-entry-row[data-entry-row="${entryIndex}"]`);
    if (!row) return;
    row.innerHTML = `
      <input type="number" class="water-entry-edit-input" value="${currentMl}" step="1" />
      <span class="water-entry-actions">
        <button type="button" class="water-entry-save" data-entry-save="${entryIndex}" aria-label="Salvar edição">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>
        </button>
        <button type="button" class="water-entry-cancel" data-entry-cancel="${entryIndex}" aria-label="Cancelar edição">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </span>`;
  }

  // ---------- Modal de hidratação: troca de abas ----------

  function switchWaterTab(tabName) {
    document.querySelectorAll('.water-tab').forEach((btn) => {
      const active = btn.dataset.waterTab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.water-tab-panel').forEach((panel) => {
      panel.classList.toggle('water-tab-panel-inactive', panel.dataset.waterPanel !== tabName);
    });
  }

  // ---------- Grade de desafios (dinâmica) ----------

  function renderHabitGrid(habits, completedMap) {
    const grid = $('habit-grid');
    $('no-habits-message').classList.toggle('hidden', habits.length > 0);
    grid.innerHTML = habits
      .map((h) => {
        const done = !!completedMap[h.id];
        return `
        <button type="button" class="habit-card ${done ? 'completed' : ''}" data-habit="${h.id}" aria-label="${escapeHtml(h.name)}${done ? ', concluído' : ', pendente'}">
          <span class="habit-emoji">${h.icon}</span>
          <span class="habit-label">${escapeHtml(h.name)}</span>
          <span class="habit-status-row">
            <span class="habit-point-tag">${done ? 'Concluído' : '+1 ponto'}</span>
            <span class="habit-check">${done ? '✓' : ''}</span>
          </span>
        </button>`;
      })
      .join('');
  }

  function pulseHabitCard(habitId) {
    let card = document.querySelector(`.habit-card[data-habit="${habitId}"]`);
    if (!card) {
      const btn = document.querySelector(`.mandatory-card button[data-habit="${habitId}"]`);
      card = btn ? btn.closest('.mandatory-card') : null;
    }
    if (!card) return;
    card.classList.add('just-completed');
    setTimeout(() => card.classList.remove('just-completed'), 350);
  }

  // ---------- Perguntas contextuais ----------

  function renderQuestions(questions) {
    const list = $('questions-list');
    if (!questions.length) {
      list.innerHTML = '<div class="questions-empty">Tudo em dia por aqui! 💚</div>';
      return;
    }
    list.innerHTML = questions
      .map((q) => `<div class="question-item"><span class="question-emoji">${q.emoji}</span><span>${escapeHtml(q.text)}</span></div>`)
      .join('');
  }

  // ---------- Fechamento do dia ----------

  function renderClosing(habits, completedMap, done, total) {
    const icons = habits
      .map((h) => `<span class="${completedMap[h.id] ? '' : 'closing-icon-pending'}" title="${escapeHtml(h.name)}">${h.icon}</span>`)
      .join('');
    $('closing-icons').innerHTML = icons || '<span class="questions-empty">Nenhum hábito ativo.</span>';
    $('closing-score').textContent = `🏆 ${done}/${total} pontos`;

    const pendingEl = $('closing-pending');
    const pendingHabits = habits.filter((h) => !completedMap[h.id]);
    if (!pendingHabits.length) {
      pendingEl.textContent = '';
    } else {
      pendingEl.textContent = `Hoje faltou: ${pendingHabits.map((h) => h.icon).join(' ')}`;
    }
  }

  // ---------- Semana ----------

  function renderWeekStats(stats) {
    $('week-total').textContent = `${stats.total}/${stats.maxTotal}`;
    $('week-average').textContent = stats.average.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    $('week-perfect').textContent = String(stats.perfectDays);
    $('week-best').textContent = `${stats.bestDay}/${stats.bestDayTotal}`;
    $('week-consistency').textContent = stats.maxTotal > 0 ? `${stats.consistency.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
    $('streak-current').textContent = `${stats.streak} ${stats.streak === 1 ? 'dia seguido' : 'dias seguidos'}`;
    $('streak-best').textContent = `Melhor sequência: ${stats.bestStreak} ${stats.bestStreak === 1 ? 'dia' : 'dias'}`;
  }

  function scoreDotClass(done, total) {
    if (total === 0) return 'gray';
    if (done === total) return 'green';
    if (done >= Math.ceil(total * 0.6)) return 'yellow';
    return 'gray';
  }

  function renderWeekDays(rows) {
    $('week-days-list').innerHTML = rows
      .map(
        (r) => `
      <div class="week-day-row ${r.isToday ? 'is-today' : ''}">
        <div>
          <div class="week-day-name">${r.isToday ? 'HOJE' : r.weekdayName}</div>
          <div class="week-day-date">${r.dateLabel}</div>
        </div>
        <div class="week-day-score">
          <span class="day-dot ${scoreDotClass(r.done, r.total)}"></span>
          ${r.exists ? `${r.done}/${r.total}` : '—'}
        </div>
      </div>`
      )
      .join('');
  }

  // ---------- Histórico: dashboard ----------

  /** rows: [{ label, percent, isToday }], já em ordem cronológica (mais antigo → hoje). */
  function renderHistoryChart(rows) {
    $('history-chart').innerHTML = rows
      .map(
        (r) => `
      <div class="history-chart-col ${r.isToday ? 'is-today' : ''}">
        <div class="history-chart-track">
          <div class="history-chart-bar" style="height:${Math.max(r.percent, 3)}%"></div>
        </div>
        <span class="history-chart-label">${r.label}</span>
      </div>`
      )
      .join('');
  }

  /** cells: [{ level: 0-3, title }], 35 células em ordem cronológica (5 semanas × 7 dias). */
  function renderHistoryHeatmap(cells) {
    $('history-heatmap').innerHTML = cells
      .map((c) => `<span class="heatmap-cell level-${c.level}" title="${escapeHtml(c.title)}"></span>`)
      .join('');
  }

  /** rows: [{ habit: {icon, name}, done, total, percent }], já ordenado. */
  function renderHabitConsistency(rows) {
    const list = $('habit-consistency-list');
    if (!rows.length) {
      list.innerHTML = '<div class="questions-empty">Nenhum hábito ativo para mostrar.</div>';
      return;
    }
    list.innerHTML = rows
      .map(
        (r) => `
      <div class="habit-consistency-row">
        <span class="habit-consistency-icon">${r.habit.icon}</span>
        <div class="habit-consistency-info">
          <div class="habit-consistency-name">${escapeHtml(r.habit.name)}</div>
          <div class="habit-consistency-track"><div class="habit-consistency-fill" style="width:${r.percent}%"></div></div>
        </div>
        <span class="habit-consistency-value">${r.done}/${r.total}</span>
      </div>`
      )
      .join('');
  }

  // ---------- Configurações ----------

  function renderConfigForm(settings, name) {
    $('config-name').value = name || '';
    $('config-water-goal').value = settings.waterGoalMl;
    $('config-work-start').value = settings.workStart;
    $('config-work-end').value = settings.workEnd;
    $('config-reminders-toggle').checked = !!settings.remindersEnabled;
  }

  /** schedule: [{ id, title, time, disabled }] — vem de Reminders.getScheduleForConfig(). */
  function renderReminderTimesConfig(schedule) {
    $('reminder-times-list').innerHTML = schedule
      .map(
        (item) => `
      <div class="reminder-time-row ${item.disabled ? 'is-disabled' : ''}">
        <input type="checkbox" class="switch-input" data-reminder-toggle="${item.id}" ${item.disabled ? '' : 'checked'} aria-label="Ativar/desativar este lembrete" />
        <span class="reminder-time-row-label">${escapeHtml(item.title)}</span>
        <input type="time" data-reminder-id="${item.id}" value="${item.time}" ${item.disabled ? 'disabled' : ''} />
      </div>`
      )
      .join('');
  }

  // ---------- Meus hábitos ----------

  function habitRowHtml(habit, setting, isCustom) {
    const activeChecked = setting.active ? 'checked' : '';
    const mandatoryChecked = setting.mandatory ? 'checked' : '';
    const mandatoryDisabled = setting.active ? '' : 'disabled';
    return `
    <div class="habit-row" data-habit-row="${habit.id}">
      <div class="habit-row-main">
        <span class="habit-row-emoji">${habit.icon}</span>
        <span class="habit-row-name">${escapeHtml(habit.name)}</span>
      </div>
      <div class="habit-row-toggles">
        <div class="habit-row-toggle-line">
          <span>Ativo</span>
          <input type="checkbox" class="switch-input" data-active-toggle="${habit.id}" ${activeChecked} />
        </div>
        <div class="habit-row-toggle-line">
          <span>Obrigatório</span>
          <input type="checkbox" class="switch-input" data-mandatory-toggle="${habit.id}" ${mandatoryChecked} ${mandatoryDisabled} />
        </div>
      </div>
      ${isCustom
        ? `<div class="habit-row-actions">
             <button type="button" class="btn btn-outline btn-with-icon" data-edit-habit="${habit.id}">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5 19.5 8.5 8 20H4v-4z"/></svg>
               Editar
             </button>
             <button type="button" class="btn btn-danger btn-with-icon" data-delete-habit="${habit.id}">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15"/><path d="M9.5 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7"/><path d="M6.5 7l.9 12.2c.1 1 .9 1.8 1.9 1.8h5.4c1 0 1.8-.8 1.9-1.8L17.5 7"/><path d="M10.3 11v6M13.7 11v6"/></svg>
               Excluir
             </button>
           </div>`
        : ''}
    </div>`;
  }

  function renderMyHabits(defaultHabits, customHabits, getSetting) {
    $('default-habits-list').innerHTML = defaultHabits.map((h) => habitRowHtml(h, getSetting(h.id), false)).join('');
    $('no-custom-habits-message').classList.toggle('hidden', customHabits.length > 0);
    $('custom-habits-list').innerHTML = customHabits.map((h) => habitRowHtml(h, getSetting(h.id), true)).join('');
  }

  function openMyHabitsScreen() {
    $('screen-my-habits').classList.remove('hidden');
    lockBodyScroll();
  }

  function closeMyHabitsScreen() {
    $('screen-my-habits').classList.add('hidden');
    unlockBodyScroll();
  }

  // ---------- Formulário de hábito (criar/editar) ----------

  function renderEmojiPicker(selectedIcon) {
    $('habit-form-emoji-picker').innerHTML = EMOJI_CATEGORIES
      .map(
        (cat) => `
      <div class="emoji-category">
        <div class="emoji-category-label">${cat.label}</div>
        <div class="emoji-picker-row">
          ${cat.icons
            .map((e) => `<button type="button" class="emoji-btn ${e === selectedIcon ? 'selected' : ''}" data-emoji="${e}">${e}</button>`)
            .join('')}
        </div>
      </div>`
      )
      .join('');
  }

  function setEmojiSelected(icon) {
    document.querySelectorAll('.emoji-btn').forEach((btn) => btn.classList.toggle('selected', btn.dataset.emoji === icon));
  }

  function setMandatoryRadio(value) {
    document.querySelectorAll('.mandatory-radio-btn').forEach((btn) => btn.classList.toggle('selected', btn.dataset.mandatory === String(value)));
  }

  function openHabitForm({ mode, id, name, icon, mandatory, active }) {
    $('habit-form-title').textContent = mode === 'edit' ? 'Editar hábito' : 'Adicionar hábito';
    $('habit-form-submit').textContent = mode === 'edit' ? 'Salvar' : 'Criar hábito';
    $('habit-form-id').value = id || '';
    $('habit-form-name').value = name || '';
    renderEmojiPicker(icon || '⭐');
    setMandatoryRadio(!!mandatory);
    $('habit-form-active-row').classList.toggle('hidden', mode !== 'edit');
    $('habit-form-active-toggle').checked = active !== false;
    openModal('modal-habit-form');
  }

  // ---------- Onboarding: passo 2 (quais hábitos padrão ativar) ----------

  /** Todos vêm pré-marcados — a pessoa desmarca o que não quiser usar agora. */
  function renderHabitActivePicker(habits) {
    $('habit-active-picker-list').innerHTML = habits
      .map(
        (h) => `
      <label class="habit-picker-row checked" data-picker-row="${h.id}">
        <input type="checkbox" data-picker-habit="${h.id}" checked />
        <span class="habit-picker-emoji">${h.icon}</span>
        <span class="habit-picker-name">${escapeHtml(h.name)}</span>
      </label>`
      )
      .join('');
  }

  // ---------- Configurações: chips de dia de trabalho ----------

  function setWorkdayChips(workDays) {
    document.querySelectorAll('#config-workday-chips .workday-chip').forEach((chip) => {
      chip.classList.toggle('selected', workDays.includes(Number(chip.dataset.workday)));
    });
  }

  function getWorkdayChipsSelection() {
    return Array.from(document.querySelectorAll('#config-workday-chips .workday-chip.selected')).map((chip) =>
      Number(chip.dataset.workday)
    );
  }

  // ---------- Banner de lembrete ----------

  function showReminderBanner(reminder) {
    const banner = $('reminder-banner');
    if (!reminder) {
      banner.classList.add('hidden');
      return;
    }
    $('reminder-title').textContent = reminder.title;
    $('reminder-body').textContent = reminder.body;
    banner.classList.remove('hidden');
    banner.dataset.reminderId = reminder.id;
  }

  // ---------- Modais ----------

  /**
   * Trava o scroll do body sem perder a posição (necessário no iOS, onde
   * apenas overflow:hidden não impede o "bounce" por trás de um modal).
   * Contador de referência: vários modais podem abrir empilhados (ex.:
   * confirmação sobre um modal já aberto) e só destravamos quando o
   * último deles fecha.
   */
  let scrollLockCount = 0;
  let savedScrollY = 0;

  function lockBodyScroll() {
    if (scrollLockCount === 0) {
      savedScrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    scrollLockCount += 1;
  }

  function unlockBodyScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY);
    }
  }

  function openModal(id) {
    $(id).classList.remove('hidden');
    lockBodyScroll();
  }

  function closeModal(id) {
    $(id).classList.add('hidden');
    unlockBodyScroll();
  }

  function openConfirm(title, message) {
    $('confirm-title').textContent = title;
    $('confirm-message').textContent = message;
    openModal('modal-confirm');
  }

  // ---------- Resumo ----------

  function setSummaryText(text) {
    $('summary-text').value = text;
  }

  function setSummaryFeedback(text) {
    const el = $('summary-feedback');
    el.textContent = text;
    if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2500);
  }

  function setActiveSummaryTab(tab) {
    document.querySelectorAll('.summary-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.summaryTab === tab);
    });
  }

  // ---------- Toast ----------

  let toastTimer = null;
  let toastActionHandler = null;

  function hideToastAction() {
    const actionBtn = $('toast-action');
    if (toastActionHandler) actionBtn.removeEventListener('click', toastActionHandler);
    toastActionHandler = null;
    actionBtn.classList.add('hidden');
  }

  function showToast(message, duration = 2200) {
    hideToastAction();
    const toast = $('toast');
    $('toast-message').textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
  }

  /** Toast com um botão de ação (ex.: "Desfazer"). onAction roda uma única vez. */
  function showActionToast(message, actionLabel, onAction, duration = 5000) {
    hideToastAction();
    const toast = $('toast');
    const actionBtn = $('toast-action');
    $('toast-message').textContent = message;
    actionBtn.textContent = actionLabel;
    actionBtn.classList.remove('hidden');
    toast.classList.remove('hidden');

    toastActionHandler = () => {
      hideToastAction();
      toast.classList.add('hidden');
      clearTimeout(toastTimer);
      onAction();
    };
    actionBtn.addEventListener('click', toastActionHandler);

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hideToastAction();
      toast.classList.add('hidden');
    }, duration);
  }

  // ---------- Onboarding ----------

  function showOnboardingStep(step) {
    $('onboarding-step-name').classList.toggle('hidden', step !== 'name');
    $('onboarding-step-habits').classList.toggle('hidden', step !== 'habits');
    $('onboarding-step-workdays').classList.toggle('hidden', step !== 'workdays');
  }

  function showOnboarding() {
    $('onboarding-screen').classList.remove('hidden');
    $('app-shell').classList.add('hidden');
    showOnboardingStep('name');
  }

  function showApp() {
    $('onboarding-screen').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
  }

  return {
    $,
    escapeHtml,
    showScreen,
    setGreeting,
    setHeaderDate,
    renderProgress,
    renderMandatoryIndicator,
    renderMandatorySection,
    showWaterCard,
    setWaterMandatoryBadge,
    renderWater,
    pulseWaterRing,
    celebrateWaterGoal,
    celebrateDayComplete,
    renderWaterEntries,
    renderWaterEntriesTotal,
    showWaterEntryEditRow,
    switchWaterTab,
    renderWaterModalSummary,
    renderHabitGrid,
    pulseHabitCard,
    renderQuestions,
    renderClosing,
    renderWeekStats,
    renderWeekDays,
    renderHistoryChart,
    renderHistoryHeatmap,
    renderHabitConsistency,
    renderConfigForm,
    renderReminderTimesConfig,
    renderMyHabits,
    openMyHabitsScreen,
    closeMyHabitsScreen,
    openHabitForm,
    setEmojiSelected,
    setMandatoryRadio,
    renderHabitActivePicker,
    setWorkdayChips,
    getWorkdayChipsSelection,
    showOnboardingStep,
    showReminderBanner,
    openModal,
    closeModal,
    openConfirm,
    setSummaryText,
    setSummaryFeedback,
    setActiveSummaryTab,
    showToast,
    showActionToast,
    showOnboarding,
    showApp
  };
})();
