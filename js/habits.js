/**
 * habits.js
 * O HÁBITO como entidade global (id, nome, ícone, tipo).
 * Este arquivo NUNCA guarda "mandatory" ou "active" — isso pertence à
 * relação usuário↔hábito e vive em users.js.
 */

const Habits = (() => {
  // Catálogo inicial. "agua" é especial (contagem em ml) mas continua
  // sendo só mais um hábito do catálogo — a obrigatoriedade dele, como a de
  // qualquer outro, é decidida por usuário.
  const DEFAULT_HABITS = [
    { id: 'cardio', name: 'Cardio', icon: '🏃' },
    { id: 'academia', name: 'Academia', icon: '💪' },
    { id: 'agua', name: '3 L de água', icon: '💧' },
    { id: 'frutas', name: 'Frutas', icon: '🍓' },
    { id: 'legumes', name: 'Legumes', icon: '🥦' },
    { id: 'whey', name: 'Whey', icon: '🥤' },
    { id: 'fio', name: 'Fio dental', icon: '🦷' },
    { id: 'cotonete', name: 'Cotonete', icon: '🔊' },
    { id: 'joelho', name: 'Fortalecimento de joelho', icon: '🦵' }
  ];

  const WATER_HABIT_ID = 'agua';

  /** Garante que os hábitos padrão existam no catálogo (idempotente, não destrutivo). */
  function seedDefaults() {
    const data = Storage.getData();
    let changed = false;
    DEFAULT_HABITS.forEach((h) => {
      if (!data.habits[h.id]) {
        data.habits[h.id] = { id: h.id, name: h.name, icon: h.icon, type: 'default', createdAt: new Date().toISOString() };
        changed = true;
      }
    });
    if (changed) Storage.save();
  }

  function getAllHabits() {
    return Storage.getData().habits;
  }

  function getHabit(habitId) {
    return Storage.getData().habits[habitId];
  }

  function listAllHabits() {
    return Object.values(getAllHabits());
  }

  function addCustomHabit({ name, icon }) {
    const data = Storage.getData();
    const id = Storage.uid('h');
    data.habits[id] = {
      id,
      name: String(name).trim(),
      icon: icon || '⭐',
      type: 'custom',
      createdAt: new Date().toISOString()
    };
    Storage.save();
    return data.habits[id];
  }

  /** Só permite editar nome/ícone de hábitos personalizados. */
  function updateHabit(habitId, { name, icon }) {
    const data = Storage.getData();
    const habit = data.habits[habitId];
    if (!habit || habit.type !== 'custom') return null;
    if (name != null) habit.name = String(name).trim();
    if (icon != null) habit.icon = icon;
    Storage.save();
    return habit;
  }

  /** Só permite excluir hábitos personalizados — padrões só podem ser desativados. */
  function deleteCustomHabit(habitId) {
    const data = Storage.getData();
    const habit = data.habits[habitId];
    if (!habit || habit.type !== 'custom') return false;
    delete data.habits[habitId];
    Storage.save();
    return true;
  }

  function isDefault(habitId) {
    const habit = getHabit(habitId);
    return !!habit && habit.type === 'default';
  }

  // ---------- Utilitários de data ----------

  function todayKey() {
    return dateToKey(new Date());
  }

  function dateToKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const WEEKDAY_NAMES = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
  const MONTH_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  function formatHeaderDate(date) {
    return `${WEEKDAY_NAMES[date.getDay()]} · ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
  }

  function formatShortDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  }

  function getWeekKeys(date) {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const keys = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      keys.push(dateToKey(d));
    }
    return keys;
  }

  function getLastNDaysKeys(n, endDate) {
    const keys = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      keys.push(dateToKey(d));
    }
    return keys;
  }

  return {
    DEFAULT_HABITS,
    WATER_HABIT_ID,
    seedDefaults,
    getAllHabits,
    getHabit,
    listAllHabits,
    addCustomHabit,
    updateHabit,
    deleteCustomHabit,
    isDefault,
    todayKey,
    dateToKey,
    keyToDate,
    formatHeaderDate,
    formatShortDate,
    WEEKDAY_NAMES,
    getWeekKeys,
    getLastNDaysKeys
  };
})();
