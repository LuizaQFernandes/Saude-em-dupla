/**
 * storage.js
 * Camada de persistência local (localStorage) + migração de versões antigas.
 * Este arquivo NÃO conhece regras de negócio (hábitos, pontuação, etc.) —
 * apenas carrega/salva o "blob" de dados e garante que dados de versões
 * anteriores do app continuem funcionando (nada é apagado na migração).
 *
 * Formato atual (v2):
 * {
 *   version: 2,
 *   habits: { [habitId]: { id, name, icon, type: 'default'|'custom', createdAt } },
 *   users: { [userId]: { id, name, habitSettings: { [habitId]: {active,mandatory} }, settings } },
 *   currentUserId: 'u_xxx',
 *   days: { [userId]: { [dateKey]: { completedHabits, waterMl, waterEntries, dismissedReminders } } },
 *   meta: {}
 * }
 */

const Storage = (() => {
  const STORAGE_KEY = 'saudeEmDupla:v1';
  const CURRENT_VERSION = 2;

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function emptyData() {
    return {
      version: CURRENT_VERSION,
      habits: {},
      users: {},
      currentUserId: null,
      days: {},
      meta: {}
    };
  }

  function defaultDayProgress() {
    return {
      completedHabits: {},
      waterMl: 0,
      waterEntries: [],
      dismissedReminders: []
    };
  }

  function defaultUserSettings() {
    return {
      waterGoalMl: 3000,
      workStart: '08:00',
      workEnd: '18:00',
      remindersEnabled: true,
      reminderTimes: {},
      // Dias em que a pessoa trabalha (0=domingo ... 6=sábado, igual a Date#getDay()).
      // Usado para priorizar lembretes de exercício à noite (dia de trabalho)
      // ou de manhã (dia de folga) — ver reminders.js.
      workDays: [1, 2, 3, 4, 5],
      // Ids de lembretes que o usuário desativou individualmente (não aparecem
      // mais como pendentes nem disparam, mas continuam na lista para poder
      // reativar depois).
      disabledReminders: []
    };
  }

  /**
   * Converte o formato antigo (v1 — um único usuário implícito, "joelho"
   * sempre obrigatório globalmente) para o formato v2, sem apagar nada.
   */
  function migrateFromV1(old) {
    const data = emptyData();
    const DEFAULT_HABITS = [
      ['cardio', 'Cardio', '🏃'],
      ['academia', 'Academia', '💪'],
      ['agua', '3 L de água', '💧'],
      ['frutas', 'Frutas', '🍓'],
      ['legumes', 'Legumes', '🥦'],
      ['whey', 'Whey', '🥤'],
      ['fio', 'Fio dental', '🦷'],
      ['cotonete', 'Cotonete', '🔊'],
      ['joelho', 'Fortalecimento de joelho', '🦵']
    ];
    const now = new Date().toISOString();
    DEFAULT_HABITS.forEach(([id, name, icon]) => {
      data.habits[id] = { id, name, icon, type: 'default', createdAt: now };
    });

    const userId = uid('u');
    const habitSettings = {};
    DEFAULT_HABITS.forEach(([id]) => {
      // No app antigo, o joelho era obrigatório para todo mundo; preservamos
      // esse comportamento como o ponto de partida individual deste usuário.
      habitSettings[id] = { active: true, mandatory: id === 'joelho' };
    });

    data.users[userId] = {
      id: userId,
      name: (old.user && old.user.name) || '',
      habitSettings,
      settings: Object.assign(defaultUserSettings(), old.settings || {})
    };
    data.currentUserId = userId;

    const oldDays = old.days || {};
    data.days[userId] = {};
    Object.keys(oldDays).forEach((dateKey) => {
      const oldDay = oldDays[dateKey];
      data.days[userId][dateKey] = {
        completedHabits: Object.assign({}, oldDay.habits),
        waterMl: oldDay.waterMl || 0,
        waterEntries: oldDay.waterEntries || [],
        dismissedReminders: oldDay.dismissedReminders || []
      };
    });

    return data;
  }

  let cache = null;

  function load() {
    if (cache) return cache;
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error('Falha ao ler dados locais.', err);
    }

    if (!raw) {
      cache = emptyData();
      return cache;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('Dados locais corrompidos, iniciando do zero.', err);
      cache = emptyData();
      return cache;
    }

    if (!parsed.version || parsed.version < 2) {
      cache = migrateFromV1(parsed);
      persist(cache);
    } else {
      cache = parsed;
    }
    return cache;
  }

  function persist(data) {
    cache = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Falha ao salvar dados locais.', err);
    }
  }

  /** Retorna a referência viva do blob de dados — mutar e chamar save(). */
  function getData() {
    return load();
  }

  function save() {
    persist(cache || load());
  }

  function clearAllHistory() {
    const data = load();
    Object.keys(data.days).forEach((userId) => {
      data.days[userId] = {};
    });
    save();
  }

  /**
   * Apaga TUDO deste dispositivo (perfil, hábitos, histórico, tema) e volta
   * o app para o estado de primeira abertura — usado pelo botão "Sair do
   * app". Diferente de clearAllHistory, aqui não sobra nada para migrar.
   */
  function resetAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('saudeEmDupla:theme');
    } catch (err) {
      console.error('Falha ao apagar dados locais.', err);
    }
    cache = emptyData();
  }

  return {
    uid,
    getData,
    save,
    clearAllHistory,
    resetAll,
    defaultDayProgress,
    defaultUserSettings
  };
})();
