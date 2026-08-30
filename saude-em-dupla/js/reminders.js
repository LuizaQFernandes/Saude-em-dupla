/**
 * reminders.js
 * Lembretes dentro do app (não são notificações reais do sistema) e
 * perguntas contextuais. Tudo aqui é calculado a partir dos hábitos
 * ATIVOS e OBRIGATÓRIOS do usuário atual — nunca de uma lista fixa.
 * Um hábito que o usuário desativou, ou que nunca teve, simplesmente
 * não gera lembrete nem pergunta.
 */

const Reminders = (() => {
  const KNOWN_QUESTIONS = {
    frutas: 'Já comeu frutas hoje?',
    legumes: 'Já comeu legumes hoje?',
    cardio: 'Já fez cardio?',
    academia: 'Já foi à academia?',
    joelho: 'Já fez o fortalecimento de joelho hoje?',
    whey: 'Já tomou whey?',
    fio: 'Já usou fio dental?',
    cotonete: 'Já usou cotonete?'
  };

  const BEFORE_WORK_IDS = ['agua', 'frutas', 'legumes'];
  const AFTER_WORK_IDS = ['cardio', 'academia', 'joelho', 'whey'];
  const NIGHT_IDS = ['fio', 'cotonete'];

  function formatLiters(ml) {
    return (ml / 1000).toFixed(1).replace('.0', '').replace('.', ',');
  }

  function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Hábitos ativos dentre os ids informados que ainda estão pendentes hoje. */
  function pendingAmong(userId, dateKey, ids) {
    const day = Progress.peekDay(userId, dateKey);
    return ids
      .filter((id) => Users.isHabitActive(userId, id))
      .map((id) => Habits.getHabit(id))
      .filter((h) => h && !day.completedHabits[h.id]);
  }

  function listLabel(habits) {
    return habits.map((h) => `${h.icon} ${h.name}`).join(' · ');
  }

  const SCHEDULE = [
    {
      id: 'morning',
      defaultTime: '08:00',
      title: '🌞 Bom dia!',
      relevant: (userId, dateKey) => Progress.getPendingMandatoryHabits(userId, dateKey).length > 0,
      body: (userId, dateKey) => `Começou mais um dia. Não esqueça: ${listLabel(Progress.getPendingMandatoryHabits(userId, dateKey))}.`
    },
    {
      id: 'water1',
      defaultTime: '10:30',
      title: '💧 Como está a água?',
      relevant: (userId, dateKey) => Users.isHabitActive(userId, 'agua') && !Progress.waterGoalReached(userId, dateKey),
      body: (userId, dateKey) => {
        const goal = Users.getSettings(userId).waterGoalMl || 3000;
        const day = Progress.peekDay(userId, dateKey);
        return `Meta: ${formatLiters(goal)} L. Você já bebeu ${day.waterMl.toLocaleString('pt-BR')} ml.`;
      }
    },
    {
      id: 'fruits',
      defaultTime: '12:00',
      title: '🍓 Já comeu frutas hoje?',
      relevant: (userId, dateKey) => Users.isHabitActive(userId, 'frutas') && !Progress.isHabitCompleted(userId, 'frutas', dateKey),
      body: () => 'Um lembrete rápido para manter o hábito.'
    },
    {
      id: 'veggies',
      defaultTime: '13:30',
      title: '🥦 Já comeu legumes hoje?',
      relevant: (userId, dateKey) => Users.isHabitActive(userId, 'legumes') && !Progress.isHabitCompleted(userId, 'legumes', dateKey),
      body: () => 'Um lembrete rápido para manter o hábito.'
    },
    {
      id: 'water2',
      defaultTime: '15:30',
      title: '💧 Hora de conferir a hidratação',
      relevant: (userId, dateKey) => Users.isHabitActive(userId, 'agua') && !Progress.waterGoalReached(userId, dateKey),
      body: (userId, dateKey) => {
        const goal = Users.getSettings(userId).waterGoalMl || 3000;
        const day = Progress.peekDay(userId, dateKey);
        return `Faltam ${Math.max(0, goal - day.waterMl).toLocaleString('pt-BR')} ml para a meta.`;
      }
    },
    {
      id: 'workend',
      defaultTime: '18:15',
      title: '🏋️ Fim do expediente!',
      relevant: (userId, dateKey) => pendingAmong(userId, dateKey, ['cardio', 'academia', 'joelho']).length > 0,
      body: (userId, dateKey) => `Agora é hora dos exercícios: ${listLabel(pendingAmong(userId, dateKey, ['cardio', 'academia', 'joelho']))}.`
    },
    {
      id: 'knee',
      defaultTime: '19:30',
      title: '🦵 Fortalecimento de joelho',
      relevant: (userId, dateKey) => Users.isHabitActive(userId, 'joelho') && !Progress.isHabitCompleted(userId, 'joelho', dateKey),
      body: (userId, dateKey) => (Users.isHabitMandatory(userId, 'joelho') ? 'Ainda está pendente hoje — é obrigatório!' : 'Ainda está pendente hoje.')
    },
    {
      id: 'whey',
      defaultTime: '20:30',
      title: '🥤 Já tomou whey?',
      relevant: (userId, dateKey) => Users.isHabitActive(userId, 'whey') && !Progress.isHabitCompleted(userId, 'whey', dateKey),
      body: () => 'Um lembrete rápido para manter o hábito.'
    },
    {
      id: 'nightcheck',
      defaultTime: '21:30',
      title: '🌙 Último check do dia',
      relevant: (userId, dateKey) => pendingAmong(userId, dateKey, ['fio', 'cotonete', 'joelho']).length > 0,
      body: (userId, dateKey) => listLabel(pendingAmong(userId, dateKey, ['fio', 'cotonete', 'joelho']))
    },
    {
      id: 'dayclose',
      defaultTime: '22:00',
      title: '🏆 Fechamento do dia',
      relevant: (userId, dateKey) => !Progress.isPerfectDay(userId, dateKey),
      body: (userId, dateKey) => {
        const { done, total } = Progress.calculateDailyPoints(userId, dateKey);
        return `Você fez ${done}/${total} hoje. Confira o resumo!`;
      }
    }
  ];

  function getScheduleWithTimes(settings) {
    const overrides = (settings && settings.reminderTimes) || {};
    return SCHEDULE.map((item) => ({ ...item, time: overrides[item.id] || item.defaultTime }));
  }

  /**
   * Retorna os lembretes cujo horário já passou, ainda relevantes para
   * ESTE usuário e ainda não dispensados hoje.
   */
  function getPendingReminders(userId, dateKey, now) {
    const settings = Users.getSettings(userId);
    if (!settings.remindersEnabled) return [];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const day = Progress.peekDay(userId, dateKey);
    const dismissed = day.dismissedReminders || [];
    return getScheduleWithTimes(settings)
      .filter((item) => timeToMinutes(item.time) <= nowMinutes)
      .filter((item) => !dismissed.includes(item.id))
      .filter((item) => item.relevant(userId, dateKey))
      .map((item) => ({ id: item.id, time: item.time, title: item.title, body: item.body(userId, dateKey) }));
  }

  /**
   * Perguntas contextuais para "Como está seu dia?". Considera todos os
   * hábitos ATIVOS pendentes do usuário (padrão ou personalizado),
   * priorizando obrigatórios e o período do dia.
   */
  function buildContextualQuestions(userId, dateKey, now) {
    const settings = Users.getSettings(userId);
    const workEndMinutes = timeToMinutes(settings.workEnd || '18:00');
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const afterWork = nowMinutes >= workEndMinutes;
    const night = nowMinutes >= timeToMinutes('21:00');
    const day = Progress.peekDay(userId, dateKey);

    const candidates = [];
    Users.getActiveHabits(userId).forEach((habit) => {
      if (day.completedHabits[habit.id]) return;

      let priority;
      if (BEFORE_WORK_IDS.includes(habit.id)) priority = afterWork ? 2 : 0;
      else if (AFTER_WORK_IDS.includes(habit.id)) priority = afterWork ? 0 : 2;
      else if (NIGHT_IDS.includes(habit.id)) priority = night ? 0 : 3;
      else priority = 2; // hábito personalizado: prioridade neutra

      if (Users.isHabitMandatory(userId, habit.id)) priority = -1;

      let text;
      if (habit.id === 'agua') {
        const goalL = formatLiters(settings.waterGoalMl || 3000);
        const currentL = formatLiters(day.waterMl);
        text = `Como está sua hidratação? Você está em ${currentL} L de ${goalL} L.`;
      } else if (KNOWN_QUESTIONS[habit.id]) {
        text = KNOWN_QUESTIONS[habit.id];
      } else {
        text = `Já fez ${habit.name.toLowerCase()} hoje?`;
      }

      candidates.push({ emoji: habit.icon, text, priority });
    });

    candidates.sort((a, b) => a.priority - b.priority);
    return candidates.slice(0, 3);
  }

  return {
    SCHEDULE,
    getScheduleWithTimes,
    getPendingReminders,
    buildContextualQuestions,
    timeToMinutes,
    formatLiters
  };
})();
