/**
 * progress.js
 * Progresso diário por usuário: hábitos concluídos, água, pontuação.
 * Tudo aqui é calculado dinamicamente a partir dos hábitos ATIVOS do
 * usuário — nunca um número fixo (o app pode ter 9, 10, 12... hábitos).
 *
 * Importante: peekDay() é somente leitura (nunca cria/persiste um registro).
 * Usamos isso para calcular estatísticas de semana/histórico sem "sujar"
 * o armazenamento com dias futuros ou vazios. getDay() é a versão que
 * cria (e persiste) o registro do dia — só deve ser usada quando de fato
 * vamos escrever algo (concluir hábito, registrar água, etc.).
 */

const Progress = (() => {
  function peekDay(userId, dateKey) {
    const data = Storage.getData();
    const userDays = data.days[userId];
    return (userDays && userDays[dateKey]) || Storage.defaultDayProgress();
  }

  function getDay(userId, dateKey) {
    const data = Storage.getData();
    if (!data.days[userId]) data.days[userId] = {};
    if (!data.days[userId][dateKey]) {
      data.days[userId][dateKey] = Storage.defaultDayProgress();
      Storage.save();
    }
    return data.days[userId][dateKey];
  }

  function getAllDays(userId) {
    return Storage.getData().days[userId] || {};
  }

  function isHabitCompleted(userId, habitId, dateKey) {
    return !!peekDay(userId, dateKey).completedHabits[habitId];
  }

  /** Alterna um hábito comum. Água tem seu próprio fluxo (addWater). */
  function toggleHabit(userId, habitId, dateKey) {
    const day = getDay(userId, dateKey);
    day.completedHabits[habitId] = !day.completedHabits[habitId];
    Storage.save();
    return day.completedHabits[habitId];
  }

  function updateWaterHabitFlag(userId, day) {
    const goal = Users.getSettings(userId).waterGoalMl || 3000;
    day.completedHabits[Habits.WATER_HABIT_ID] = day.waterMl >= goal;
  }

  /**
   * Recalcula a flag de conclusão do hábito de água para uma data
   * específica com base na meta ATUAL do usuário. Necessário sempre que a
   * meta é alterada: o volume não mudou nesse momento, então nada dispara
   * addWater/updateWaterEntryAt — sem chamar isso, completedHabits.agua
   * fica "congelado" com o resultado calculado contra a meta antiga.
   */
  function recalcWaterHabit(userId, dateKey) {
    const day = getDay(userId, dateKey);
    updateWaterHabitFlag(userId, day);
    Storage.save();
    return day;
  }

  /**
   * Registra um lançamento de água. `ml` pode ser positivo (adicionar) ou
   * negativo (remover) — o total nunca fica abaixo de zero. O que é
   * efetivamente guardado no "extrato" (waterEntries) é sempre a variação
   * REAL aplicada, para que a soma dos lançamentos bata com o total exibido
   * (isso é o que permite o "Desfazer": remover o último lançamento sempre
   * desfaz exatamente a última ação, seja ela positiva ou negativa).
   */
  function addWater(userId, dateKey, ml, timeLabel) {
    const requested = Math.round(Number(ml) || 0);
    const day = getDay(userId, dateKey);
    if (requested === 0) return { day, entryIndex: -1 };
    const before = day.waterMl;
    const after = Math.max(0, before + requested);
    const applied = after - before;
    if (applied === 0) return { day, entryIndex: -1 };
    day.waterMl = after;
    day.waterEntries.push({ time: timeLabel, ml: applied });
    updateWaterHabitFlag(userId, day);
    Storage.save();
    return { day, entryIndex: day.waterEntries.length - 1 };
  }

  /** Remove um lançamento específico do extrato (edição/correção manual). */
  function removeWaterEntryAt(userId, dateKey, entryIndex) {
    const day = getDay(userId, dateKey);
    const entry = day.waterEntries[entryIndex];
    if (!entry) return day;
    day.waterEntries.splice(entryIndex, 1);
    day.waterMl = Math.max(0, day.waterMl - entry.ml);
    updateWaterHabitFlag(userId, day);
    Storage.save();
    return day;
  }

  /** Corrige o valor de um lançamento específico (editar, não remover). */
  function updateWaterEntryAt(userId, dateKey, entryIndex, newMl) {
    const day = getDay(userId, dateKey);
    const entry = day.waterEntries[entryIndex];
    if (!entry) return day;
    const requested = Math.round(Number(newMl) || 0);
    const delta = requested - entry.ml;
    const before = day.waterMl;
    const after = Math.max(0, before + delta);
    const appliedDelta = after - before;
    day.waterMl = after;
    entry.ml = entry.ml + appliedDelta;
    updateWaterHabitFlag(userId, day);
    Storage.save();
    return day;
  }

  function waterGoalReached(userId, dateKey) {
    const day = peekDay(userId, dateKey);
    return day.waterMl >= (Users.getSettings(userId).waterGoalMl || 3000);
  }

  function waterPercent(userId, dateKey) {
    const day = peekDay(userId, dateKey);
    const goal = Users.getSettings(userId).waterGoalMl || 3000;
    return Math.min(100, Math.round((day.waterMl / goal) * 100));
  }

  /** {done, total} considerando somente os hábitos ATIVOS do usuário. */
  function calculateDailyPoints(userId, dateKey) {
    const activeHabits = Users.getActiveHabits(userId);
    const day = peekDay(userId, dateKey);
    const done = activeHabits.reduce((sum, h) => sum + (day.completedHabits[h.id] ? 1 : 0), 0);
    return { done, total: activeHabits.length };
  }

  function calculateDailyProgress(userId, dateKey) {
    const { done, total } = calculateDailyPoints(userId, dateKey);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function isPerfectDay(userId, dateKey) {
    const { done, total } = calculateDailyPoints(userId, dateKey);
    return total > 0 && done === total;
  }

  function getPendingMandatoryHabits(userId, dateKey) {
    const day = peekDay(userId, dateKey);
    return Users.getMandatoryHabits(userId).filter((h) => !day.completedHabits[h.id]);
  }

  /** Remove todo o histórico de um hábito específico (ex.: ao excluí-lo). */
  function purgeHabitHistory(userId, habitId) {
    const days = getAllDays(userId);
    Object.keys(days).forEach((dateKey) => {
      delete days[dateKey].completedHabits[habitId];
    });
    Storage.save();
  }

  return {
    peekDay,
    getDay,
    getAllDays,
    isHabitCompleted,
    toggleHabit,
    addWater,
    removeWaterEntryAt,
    updateWaterEntryAt,
    recalcWaterHabit,
    waterGoalReached,
    waterPercent,
    calculateDailyPoints,
    calculateDailyProgress,
    isPerfectDay,
    getPendingMandatoryHabits,
    purgeHabitHistory
  };
})();
