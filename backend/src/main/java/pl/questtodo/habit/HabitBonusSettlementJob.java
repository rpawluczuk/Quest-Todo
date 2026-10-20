package pl.questtodo.habit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.habits.bonus-settlement-enabled", havingValue = "true", matchIfMissing = true)
public class HabitBonusSettlementJob {
    private static final Logger LOG = LoggerFactory.getLogger(HabitBonusSettlementJob.class);
    private final HabitRepository habits;
    private final HabitCalendar calendar;
    private final HabitCompletionBonusService bonuses;

    public HabitBonusSettlementJob(HabitRepository habits, HabitCalendar calendar, HabitCompletionBonusService bonuses) {
        this.habits = habits;
        this.calendar = calendar;
        this.bonuses = bonuses;
    }

    @Scheduled(fixedDelayString = "${app.habits.bonus-settlement-delay:60000}",
            initialDelayString = "${app.habits.bonus-settlement-initial-delay:1000}")
    public void settleDueHabits() {
        for (long id : habits.findUnsettledDatedBonuses(calendar.today())) {
            try { bonuses.settle(id); }
            catch (RuntimeException exception) {
                LOG.error("Could not settle completion bonus for habit {}", id, exception);
            }
        }
    }
}
