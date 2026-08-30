/**
 * users.js
 * O USUÁRIO e a relação usuário↔hábito (habitSettings).
 *
 * Regra central deste app: "obrigatório" e "ativo" NUNCA são propriedades
 * do hábito (isso é global, em habits.js) — são configuração individual
 * de cada pessoa em relação àquele hábito. O mesmo hábito pode ser
 * obrigatório para Matheus e opcional para Luiza.
 *
 * Invariante garantida por este módulo (nunca deixamos o estado
 * inconsistente): active=false ⇒ mandatory=false.
 */

const Users = (() => {
  function getCurrentUserId() {
    return Storage.getData().currentUserId;
  }

  function getCurrentUser() {
    const data = Storage.getData();
    return data.currentUserId ? data.users[data.currentUserId] : null;
  }

  function getUser(userId) {
    return Storage.getData().users[userId];
  }

  function hasUser() {
    return !!getCurrentUser();
  }

  /**
   * Cria o usuário local (primeira utilização). initialMandatoryIds é a
   * lista de hábitos que o usuário marcou como obrigatórios na configuração
   * inicial — todos os hábitos do catálogo atual entram como "ativos".
   */
  function createUser(name, initialMandatoryIds) {
    Habits.seedDefaults();
    const data = Storage.getData();
    const userId = Storage.uid('u');
    const mandatorySet = new Set(initialMandatoryIds || []);
    const habitSettings = {};
    Habits.listAllHabits().forEach((habit) => {
      habitSettings[habit.id] = { active: true, mandatory: mandatorySet.has(habit.id) };
    });

    data.users[userId] = {
      id: userId,
      name: String(name).trim(),
      habitSettings,
      settings: Storage.defaultUserSettings()
    };
    data.currentUserId = userId;
    data.days[userId] = data.days[userId] || {};
    Storage.save();
    return data.users[userId];
  }

  function setUserName(name) {
    const user = getCurrentUser();
    if (!user) return;
    user.name = String(name).trim();
    Storage.save();
  }

  /** Config bruta do usuário para um hábito, com fallback seguro. */
  function getHabitSettings(userId, habitId) {
    const user = getUser(userId);
    if (!user) return { active: false, mandatory: false };
    const setting = user.habitSettings[habitId];
    if (setting) return setting;
    // Hábito ainda não configurado por este usuário. Só entra ativado
    // automaticamente se for um hábito PADRÃO novo (ex.: adicionado em uma
    // atualização do app) — um hábito personalizado criado por outra pessoa
    // nunca aparece sozinho para quem não o criou.
    const habit = Habits.getHabit(habitId);
    if (habit && habit.type === 'default') return { active: true, mandatory: false };
    return { active: false, mandatory: false };
  }

  function isHabitActive(userId, habitId) {
    return !!getHabitSettings(userId, habitId).active;
  }

  function isHabitMandatory(userId, habitId) {
    const setting = getHabitSettings(userId, habitId);
    return !!(setting.active && setting.mandatory);
  }

  function ensureSetting(user, habitId) {
    if (!user.habitSettings[habitId]) {
      user.habitSettings[habitId] = { active: true, mandatory: false };
    }
    return user.habitSettings[habitId];
  }

  function setHabitActive(userId, habitId, active) {
    const user = getUser(userId);
    if (!user) return;
    const setting = ensureSetting(user, habitId);
    setting.active = !!active;
    if (!setting.active) setting.mandatory = false; // nunca obrigatório+inativo
    Storage.save();
  }

  function setHabitMandatory(userId, habitId, mandatory) {
    const user = getUser(userId);
    if (!user) return;
    const setting = ensureSetting(user, habitId);
    setting.mandatory = !!mandatory;
    if (setting.mandatory) setting.active = true; // obrigatório implica ativo
    Storage.save();
  }

  function removeHabitSetting(userId, habitId) {
    const user = getUser(userId);
    if (!user) return;
    delete user.habitSettings[habitId];
    Storage.save();
  }

  /** Hábitos ativos deste usuário, na ordem do catálogo. */
  function getActiveHabits(userId) {
    return Habits.listAllHabits().filter((h) => isHabitActive(userId, h.id));
  }

  function getMandatoryHabits(userId) {
    return getActiveHabits(userId).filter((h) => isHabitMandatory(userId, h.id));
  }

  function getSettings(userId) {
    const user = getUser(userId);
    if (!user) return Storage.defaultUserSettings();
    user.settings = Object.assign(Storage.defaultUserSettings(), user.settings || {});
    return user.settings;
  }

  function updateSettings(userId, partial) {
    const user = getUser(userId);
    if (!user) return;
    user.settings = Object.assign(getSettings(userId), partial);
    Storage.save();
    return user.settings;
  }

  return {
    getCurrentUserId,
    getCurrentUser,
    getUser,
    hasUser,
    createUser,
    setUserName,
    getHabitSettings,
    isHabitActive,
    isHabitMandatory,
    setHabitActive,
    setHabitMandatory,
    removeHabitSetting,
    getActiveHabits,
    getMandatoryHabits,
    getSettings,
    updateSettings
  };
})();
