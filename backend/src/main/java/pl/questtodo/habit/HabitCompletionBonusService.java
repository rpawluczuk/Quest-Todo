package pl.questtodo.habit;

import java.util.stream.Collectors;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.UserRepository;

@Service
@Transactional
public class HabitCompletionBonusService {
    private final HabitRepository habits;
    private final HabitCompletionBonusAwardRepository awards;
    private final HabitCompletionRepository completions;
    private final HabitTargetRepository targets;
    private final HabitCalendar calendar;
    private final UserRepository users;

    public HabitCompletionBonusService(HabitRepository habits, HabitCompletionBonusAwardRepository awards,
            HabitCompletionRepository completions, HabitTargetRepository targets, HabitCalendar calendar,
            UserRepository users) {
        this.habits = habits;
        this.awards = awards;
        this.completions = completions;
        this.targets = targets;
        this.calendar = calendar;
        this.users = users;
    }

    public void settle(long habitId) {
        var habit = habits.findForSettlement(habitId).orElse(null);
        if (habit == null || habit.getEndDate() == null || !habit.getEndDate().isBefore(calendar.today())
                || habit.getEndedOn() != null || habit.getCompletionBonusPoints() == null
                || habit.getRequiredSuccessPercent() == null) return;
        var existing = awards.findById(habitId);
        if (existing.isPresent() && existing.get().getSettledOn() != null) return;
        reconcile(habit);
    }

    @Transactional(readOnly = true)
    public HabitRegularity regularity(HabitEntity habit) {
        if (habit.getEndDate() == null) return null;
        return HabitRegularity.calculate(habit.getStartDate(), habit.getEndDate(), calendar.today(),
                targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId()).stream()
                        .map(HabitTargetEntity::toTarget).toList(),
                completions.findByHabitIdAndDateBetween(habit.getId(), habit.getStartDate(), habit.getEndDate())
                        .stream().map(HabitCompletionEntity::getDate).collect(Collectors.toSet()));
    }

    // Caller holds the habit lock. Account locking follows the same order as weekly awards.
    // Explicit history/configuration corrections reconcile the existing entry, not a second award.
    public boolean reconcile(HabitEntity habit) {
        var recorded = awards.findById(habit.getId()).orElse(null);
        boolean configured = habit.getCompletionBonusPoints() != null;
        boolean finallySettled = recorded != null && recorded.getSettledOn() != null;
        HabitRegularity regularity = null;
        boolean eligible = false;
        if (configured && habit.getEndDate() != null) {
            // A legacy manual ending must not invalidate an already settled period.
            boolean due = (habit.getEndedOn() == null || finallySettled)
                    && habit.getRequiredSuccessPercent() != null && habit.getEndDate().isBefore(calendar.today());
            if (due) {
                regularity = regularity(habit);
                eligible = regularity.meets(habit.getRequiredSuccessPercent());
            }
        } else if (configured && habit.getCompletionLimit() != null) {
            eligible = habit.getEndedOn() == null
                    && completions.countByHabitId(habit.getId()) >= habit.getCompletionLimit();
        }
        if (recorded == null && !eligible && regularity == null) return false;
        boolean previouslyActive = recorded != null && recorded.isActive();
        if (recorded == null) {
            recorded = new HabitCompletionBonusAwardEntity(habit.getId(), habit.getCompletionBonusPoints());
        }
        if (configured) recorded.updateUnpaidPoints(habit.getCompletionBonusPoints());
        if (eligible && !previouslyActive && recorded.getPoints() != habit.getCompletionBonusPoints())
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Historyczna kwota premii różni się od konfiguracji. Rozliczenie wymaga wyjaśnienia danych historycznych; punkty nie zostały naliczone.");
        if (regularity != null) recorded.settle(calendar.today(), regularity);
        // Final settlement and first-payment history are permanent, also after corrections.
        boolean changed = previouslyActive != eligible;
        if (changed) {
            var user = users.findForUpdate(habit.ownerId()).orElseThrow();
            user.addPoints(eligible ? recorded.getPoints() : -(long) recorded.getPoints());
        }
        if (eligible) recorded.activate();
        else recorded.deactivate();
        awards.save(recorded);
        return changed;
    }

    // Caller holds the habit lock; validate before mutating any entity.
    public void assertEditable(HabitEntity habit, LocalDate start, LocalDate end,
            Integer limit, Integer bonus, Integer percent, Integer targetDays) {
        var recorded = awards.findById(habit.getId()).orElse(null);
        if (recorded == null || !recorded.conditionsLocked()) return;
        boolean changed = !Objects.equals(start, habit.getStartDate())
                || !Objects.equals(end, habit.getEndDate())
                || !Objects.equals(limit, habit.getCompletionLimit())
                || !Objects.equals(bonus, habit.getCompletionBonusPoints())
                || !Objects.equals(percent, habit.getRequiredSuccessPercent());
        // A count bonus is independent of weekly targets. A dated bonus depends on
        // targets only if the edited week overlaps its original active period.
        var monday = calendar.today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        if (targetDays != null && habit.getEndDate() != null && !monday.isAfter(habit.getEndDate())) {
            var effective = targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId()).stream()
                    .filter(t -> !t.getEffectiveFrom().isAfter(monday)).reduce((a, b) -> b).orElse(null);
            changed |= effective == null || effective.getTargetDays() != targetDays;
        }
        if (changed) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Warunki premii są zablokowane po jej przyznaniu lub ostatecznym rozliczeniu. Możesz edytować nazwę, notatki i powiązania oraz korygować wykonania. Historyczne wpisy o nieznanej wypłacie również są chronione.");
    }

    public void assertManualEndingAllowed(HabitEntity habit) {
        var recorded = awards.findById(habit.getId()).orElse(null);
        if (recorded != null && recorded.conditionsLocked())
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nawyk ma już rozliczoną premię lub historyczny wpis wymagający ochrony. Nie można zakończyć go ręcznie; nadal możesz korygować wykonania.");
    }
}
