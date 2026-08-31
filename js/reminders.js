/**
 * reminders.js
 * Lembretes dentro do app (não são notificações reais do sistema) e
 * perguntas contextuais. Tudo aqui é calculado a partir dos hábitos
 * ATIVOS e OBRIGATÓRIOS do usuário atual — nunca de uma lista fixa.
 * Um hábito que o usuário desativou, ou que nunca teve, simplesmente
 * não gera lembrete nem pergunta. Lembretes que o usuário desativou
 * individualmente (Users.isReminderDisabled) também nunca disparam.
 * Regra geral: só entram em notificações hábitos PADRÃO e ATIVOS — hábitos
 * personalizados nunca geram lembrete/pergunta (ver o filtro por
 * habit.type === 'default' em buildContextualQuestions). "Fortalecimento de
 * joelho" e "Whey" não são mais hábitos padrão, então não têm mais entrada
 * própria aqui — quem os recriar como personalizado não recebe notificação
 * para eles, só o card normal em "Desafios de hoje".
 */

const Reminders = (() => {
  const KNOWN_QUESTIONS = {
    frutas: 'Já comeu frutas hoje?',
    legumes: 'Já comeu legumes hoje?',
    cardio: 'Já fez cardio?',
    academia: 'Já foi à academia?',
    fio: 'Já usou fio dental?',
    cotonete: 'Já usou cotonete?'
  };

  const BEFORE_WORK_IDS = ['agua', 'frutas', 'legumes'];
  const AFTER_WORK_IDS = ['cardio', 'academia'];
  const NIGHT_IDS = ['fio', 'cotonete'];
  const EXERCISE_IDS = ['cardio', 'academia'];

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
      // Só em dia de trabalho — em dia de folga os exercícios são
      // priorizados de manhã (ver o item "exercisemorningoff" abaixo).
      id: 'workend',
      defaultTime: '18:15',
      title: '🏋️ Fim do expediente!',
      relevant: (userId, dateKey) =>
        Users.isWorkDay(userId, Habits.keyToDate(dateKey)) && pendingAmong(userId, dateKey, EXERCISE_IDS).length > 0,
      body: (userId, dateKey) => `Agora é hora dos exercícios: ${listLabel(pendingAmong(userId, dateKey, EXERCISE_IDS))}.`
    },
    {
      // Só em dia de folga — mesma lista de exercícios do "workend", só que
      // priorizada de manhã em vez de depois do expediente.
      id: 'exercisemorningoff',
      defaultTime: '09:00',
      title: '🌤️ Dia de folga!',
      relevant: (userId, dateKey) =>
        !Users.isWorkDay(userId, Habits.keyToDate(dateKey)) && pendingAmong(userId, dateKey, EXERCISE_IDS).length > 0,
      body: (userId, dateKey) => `Bom momento para os exercícios: ${listLabel(pendingAmong(userId, dateKey, EXERCISE_IDS))}.`
    },
    {
      id: 'nightcheck',
      defaultTime: '21:30',
      title: '🌙 Último check do dia',
      relevant: (userId, dateKey) => pendingAmong(userId, dateKey, ['fio', 'cotonete']).length > 0,
      body: (userId, dateKey) => listLabel(pendingAmong(userId, dateKey, ['fio', 'cotonete']))
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

  /** Lista para a tela de Configurações: id, título, horário e se está desativado. */
  function getScheduleForConfig(userId) {
    const settings = Users.getSettings(userId);
    return getScheduleWithTimes(settings).map((item) => ({
      id: item.id,
      title: item.title,
      time: item.time,
      disabled: Users.isReminderDisabled(userId, item.id)
    }));
  }

  /**
   * Retorna os lembretes cujo horário já passou, ainda relevantes para
   * ESTE usuário, não desativados individualmente e ainda não dispensados hoje.
   */
  function getPendingReminders(userId, dateKey, now) {
    const settings = Users.getSettings(userId);
    if (!settings.remindersEnabled) return [];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const day = Progress.peekDay(userId, dateKey);
    const dismissed = day.dismissedReminders || [];
    return getScheduleWithTimes(settings)
      .filter((item) => !Users.isReminderDisabled(userId, item.id))
      .filter((item) => timeToMinutes(item.time) <= nowMinutes)
      .filter((item) => !dismissed.includes(item.id))
      .filter((item) => item.relevant(userId, dateKey))
      .map((item) => ({ id: item.id, time: item.time, title: item.title, body: item.body(userId, dateKey) }));
  }

  /**
   * Perguntas contextuais para "Como está seu dia?". Considera só os
   * hábitos PADRÃO e ATIVOS do usuário (hábitos personalizados nunca geram
   * notificação — só aparecem no card normal em "Desafios de hoje"),
   * priorizando obrigatórios e o período do dia — e, para os hábitos de
   * exercício, se hoje é dia de trabalho ou de folga para essa pessoa.
   */
  function buildContextualQuestions(userId, dateKey, now) {
    const settings = Users.getSettings(userId);
    const workEndMinutes = timeToMinutes(settings.workEnd || '18:00');
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const rawAfterWork = nowMinutes >= workEndMinutes;
    const night = nowMinutes >= timeToMinutes('21:00');
    const dayOff = !Users.isWorkDay(userId, now);
    // Em dia de folga não existe "fim de expediente" — exercício vira
    // prioridade o dia inteiro, em vez de só depois de um horário.
    const exercisePriorityNow = dayOff || rawAfterWork;
    const day = Progress.peekDay(userId, dateKey);

    const candidates = [];
    Users.getActiveHabits(userId)
      .filter((habit) => habit.type === 'default')
      .forEach((habit) => {
        if (day.completedHabits[habit.id]) return;

        let priority;
        if (BEFORE_WORK_IDS.includes(habit.id)) priority = rawAfterWork ? 2 : 0;
        else if (AFTER_WORK_IDS.includes(habit.id)) priority = exercisePriorityNow ? 0 : 2;
        else if (NIGHT_IDS.includes(habit.id)) priority = night ? 0 : 3;
        else priority = 2; // hábito padrão fora das listas acima: prioridade neutra

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
    getScheduleForConfig,
    getPendingReminders,
    buildContextualQuestions,
    timeToMinutes,
    formatLiters
  };
})();
