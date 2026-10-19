package pl.questtodo.habit;

import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;
import pl.questtodo.goal.GoalHabitRepository;
import pl.questtodo.goal.GoalHabitEntity;
import pl.questtodo.goal.GoalEntity;
import pl.questtodo.goal.GoalRepository;
import pl.questtodo.category.CategoryEntity;
import pl.questtodo.category.CategoryRepository;

@Service
@Transactional
public class HabitService {
    private final HabitRepository habits;
    private final UserService users;
    private final CurrentUserProvider currentUser;
    private final HabitCompletionRepository completions;
    private final HabitCalendar calendar;
    private final HabitTargetRepository targets;
    private final HabitAwardRepository awards;
    private final GoalHabitRepository goalHabits;
    private final GoalRepository goals;
    private final CategoryRepository categories;

    public HabitService(HabitRepository habits, UserService users, CurrentUserProvider currentUser,
                        HabitCompletionRepository completions, HabitCalendar calendar, HabitTargetRepository targets,
                        HabitAwardRepository awards, GoalHabitRepository goalHabits, GoalRepository goals,
                        CategoryRepository categories) {
        this.habits = habits;
        this.users = users;
        this.currentUser = currentUser;
        this.completions = completions;
        this.calendar = calendar;
        this.targets = targets;
        this.awards = awards;
        this.goalHabits = goalHabits;
        this.goals = goals;
        this.categories = categories;
    }

    @Transactional(readOnly = true)
    public List<Habit> getHabits(LocalDate requestedDate) {
        return getHabits(requestedDate, false);
    }

    @Transactional(readOnly = true)
    public List<Habit> getHabits(LocalDate requestedDate, boolean includeInactive) {
        LocalDate date = requestedDate == null ? calendar.today() : requestedDate;
        validateDate(date);
        long userId = currentUser.getUserId();
        var completedIds = completions.findCompletedIds(userId, date);
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var awardedIds = awards.findAwardedHabitIds(userId, monday);
        var weeklyCounts = completions.countWeek(userId, monday, monday.plusDays(6)).stream()
                .collect(Collectors.toMap(HabitCompletionRepository.WeeklyCount::getHabitId,
                        HabitCompletionRepository.WeeklyCount::getCompletedDays));
        var totals = completions.countAll(userId).stream().collect(Collectors.toMap(
                HabitCompletionRepository.WeeklyCount::getHabitId, HabitCompletionRepository.WeeklyCount::getCompletedDays));
        var throughDate = completions.countThrough(userId, date).stream().collect(Collectors.toMap(
                HabitCompletionRepository.WeeklyCount::getHabitId, HabitCompletionRepository.WeeklyCount::getCompletedDays));
        var targetHistory = targets.findByHabitUserIdOrderByEffectiveFromAsc(userId).stream()
                .collect(Collectors.groupingBy(HabitTargetEntity::getHabitId));
        var result = habits.findByUserIdOrderByIdAsc(userId).stream()
                .filter(habit -> includeInactive || !habit.getStartDate().isAfter(date))
                .map(habit -> toHabit(habit, date, completedIds.contains(habit.getId()),
                        targetHistory.getOrDefault(habit.getId(), List.of()),
                        weeklyCounts.getOrDefault(habit.getId(), 0L), awardedIds.contains(habit.getId()),
                        totals.getOrDefault(habit.getId(), 0L), throughDate.getOrDefault(habit.getId(), 0L)))
                .toList();
        return withGoalTitles(result, userId);
    }

    public Habit createHabit(String name, Integer targetDays) {
        return createHabit(name, targetDays, null);
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints) {
        return createHabit(name, targetDays, rewardPoints, null);
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints, String description) {
        return createHabit(name, targetDays, rewardPoints, description, null, null, null);
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints, String description,
                             LocalDate startDate, LocalDate endDate, Integer completionLimit) {
        return createHabit(name, targetDays, rewardPoints, description, startDate, endDate, completionLimit, List.of());
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints, String description,
                             LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds) {
        return createHabit(name, targetDays, rewardPoints, description, startDate, endDate, completionLimit,
                goalIds, null);
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints, String description,
                             LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds,
                             Long categoryId) {
        return createHabit(name, targetDays, rewardPoints, description, startDate, endDate, completionLimit,
                goalIds, categoryId, null, null);
    }

    public Habit createHabit(String name, Integer targetDays, Integer rewardPoints, String description,
                             LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds,
                             Long categoryId, Integer completionBonusPoints, Integer requiredSuccessPercent) {
        var selectedGoals = ownedGoals(goalIds == null ? List.of() : goalIds);
        var category = ownedCategory(categoryId);
        LocalDate today = calendar.today();
        LocalDate start = startDate == null ? today : startDate;
        validateSchedule(start, endDate, completionLimit);
        validateCompletionBonus(endDate, completionLimit, completionBonusPoints, requiredSuccessPercent);
        HabitEntity habit = habits.save(new HabitEntity(name, category, users.currentReference(), today));
        habit.schedule(start, endDate, completionLimit);
        habit.setCompletionBonus(completionBonusPoints, requiredSuccessPercent);
        habit.setRewardPoints(rewardPoints == null ? 0 : rewardPoints);
        habit.changeDescription(description == null ? null : description.strip());
        HabitTargetEntity target = targets.save(new HabitTargetEntity(habit, targetDays == null ? 7 : targetDays,
                start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))));
        selectedGoals.forEach(goal -> goalHabits.save(new GoalHabitEntity(goal, habit)));
        var selected = selectedGoals.stream().map(GoalEntity::toGoal).toList();
        return toHabit(habit, today, false, List.of(target), 0, false, 0, 0).withGoals(
                selected.stream().map(goal -> goal.id()).toList(),
                selected.stream().map(goal -> goal.title()).toList());
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays) {
        return updateHabit(id, name, targetDays, null);
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints) {
        return updateHabit(id, name, targetDays, rewardPoints, null);
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints,
                                             String description) {
        return updateHabit(id, name, targetDays, rewardPoints, description, null, null, null);
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints,
            String description, LocalDate startDate, LocalDate endDate, Integer completionLimit) {
        return updateHabit(id, name, targetDays, rewardPoints, description, startDate, endDate, completionLimit, null);
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints,
            String description, LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds) {
        return updateHabit(id, name, targetDays, rewardPoints, description, startDate, endDate, completionLimit,
                goalIds, null, false, null, null, false);
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints,
            String description, LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds,
            Long categoryId) {
        return updateHabit(id, name, targetDays, rewardPoints, description, startDate, endDate, completionLimit,
                goalIds, categoryId, true, null, null, false);
    }

    public HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints,
            String description, LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds,
            Long categoryId, Integer completionBonusPoints, Integer requiredSuccessPercent, boolean replaceCompletionBonus) {
        return updateHabit(id, name, targetDays, rewardPoints, description, startDate, endDate, completionLimit,
                goalIds, categoryId, true, completionBonusPoints, requiredSuccessPercent, replaceCompletionBonus);
    }

    private HabitCompletionResult updateHabit(long id, String name, Integer targetDays, Integer rewardPoints,
            String description, LocalDate startDate, LocalDate endDate, Integer completionLimit, List<Long> goalIds,
            Long categoryId, boolean updateCategory, Integer completionBonusPoints, Integer requiredSuccessPercent,
            boolean replaceCompletionBonus) {
        HabitEntity habit = findForUpdate(id);
        if (habit.getEndedOn() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Zakończonego nawyku nie można edytować.");
        if (startDate == null && (endDate != null || completionLimit != null))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Podaj datę rozpoczęcia nawyku.");
        boolean updateBonus = replaceCompletionBonus || completionBonusPoints != null || requiredSuccessPercent != null;
        Integer effectiveBonus = updateBonus ? completionBonusPoints : habit.getCompletionBonusPoints();
        Integer effectivePercent = updateBonus ? requiredSuccessPercent : habit.getRequiredSuccessPercent();
        if (!updateBonus && startDate != null) {
            // Older clients send the schedule without bonus fields. Keep compatible settings
            // and drop only those that no longer apply to the selected ending mode.
            if (endDate == null) effectivePercent = null;
            if (endDate == null && completionLimit == null) effectiveBonus = null;
            if (endDate != null && effectiveBonus != null && effectivePercent == null) effectiveBonus = null;
        }
        validateCompletionBonus(startDate == null ? habit.getEndDate() : endDate,
                startDate == null ? habit.getCompletionLimit() : completionLimit, effectiveBonus, effectivePercent);
        boolean bonusChanged = !Objects.equals(effectiveBonus, habit.getCompletionBonusPoints())
                || !Objects.equals(effectivePercent, habit.getRequiredSuccessPercent());
        var selectedGoals = goalIds == null ? null : ownedGoals(goalIds);
        CategoryEntity category = updateCategory ? ownedCategory(categoryId) : null;
        if (startDate != null) {
            validateSchedule(startDate, endDate, completionLimit);
            if (completions.existsByHabitIdAndDateBefore(id, startDate)
                    || (endDate != null && completions.existsByHabitIdAndDateAfter(id, endDate)))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Wybrany okres pomija zapisane wykonania. Najpierw cofnij je lub rozszerz zakres dat.");
            habit.schedule(startDate, endDate, completionLimit);
            var history = targets.findByHabit_IdOrderByEffectiveFromAsc(id);
            var monday = startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            if (!history.isEmpty() && monday.isBefore(history.getFirst().getEffectiveFrom()))
                targets.save(new HabitTargetEntity(habit, history.getFirst().getTargetDays(), monday));
        }
        habit.rename(name);
        if (rewardPoints != null) habit.setRewardPoints(rewardPoints);
        if (description != null) habit.changeDescription(description.strip());
        if (updateCategory) habit.setCategory(category);
        if (selectedGoals != null) {
            goalHabits.deleteByHabitId(habit.getId());
            selectedGoals.forEach(goal -> goalHabits.save(new GoalHabitEntity(goal, habit)));
        }
        if (bonusChanged) habit.setCompletionBonus(effectiveBonus, effectivePercent);
        LocalDate today = calendar.today();
        Habit before = snapshot(habit, today);
        boolean targetLowered = targetDays != null && before.target() != null
                && targetDays < before.target().targetDays();
        if (targetDays != null) changeTarget(habit, targetDays, today);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        HabitAwardEntity award = null;
        Long balance = null;
        Habit current = snapshot(habit, today);
        if (targetLowered && current.target() != null
                && current.weeklyCompletedDays() >= current.target().targetDays()
                && !current.weeklyRewardGranted()) {
            var latestCompletion = completions.findFirstByHabitIdAndDateBetweenOrderByDateDescIdDesc(
                    id, monday, monday.plusDays(6));
            if (latestCompletion.isPresent()) {
                award = grantAward(habit, monday, latestCompletion.get(), latestCompletion.get().getDate());
                balance = users.lockCurrentUser().getPoints();
                current = snapshot(habit, today);
            }
        }
        return new HabitCompletionResult(withGoalTitles(current), balance, award == null ? null : award.toAward());
    }

    private void changeTarget(HabitEntity habit, int days, LocalDate today) {
        var history = targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId());
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var current = history.stream().filter(t -> t.getEffectiveFrom().equals(monday)).findFirst().orElse(null);
        // Preserve older weeks and replace any legacy scheduled changes.
        history.stream().filter(t -> t != current && !t.getEffectiveFrom().isBefore(monday))
                .forEach(targets::delete);
        if (current != null) {
            current.changeTargetDays(days);
        } else {
            targets.save(new HabitTargetEntity(habit, days, monday));
        }
    }

    private Habit toHabit(HabitEntity habit, LocalDate date, boolean completed, List<HabitTargetEntity> history,
                          long weeklyCompletedDays, boolean weeklyRewardGranted, long totalCompletions, long completedThroughDate) {
        HabitTarget active = null;
        HabitTarget latest = null;
        for (var target : history) {
            latest = target.toTarget();
            if (!target.getEffectiveFrom().isAfter(date)) active = latest;
        }
        String status = habit.getEndedOn() != null && !date.isBefore(habit.getEndedOn()) ? "FINISHED"
                : date.isBefore(habit.getStartDate()) ? "UPCOMING"
                : (habit.getEndDate() != null && date.isAfter(habit.getEndDate()))
                    || (habit.getCompletionLimit() != null && completedThroughDate >= habit.getCompletionLimit())
                    ? "FINISHED" : "ACTIVE";
        return habit.toHabit(completed, active, latest, weeklyCompletedDays, weeklyRewardGranted, totalCompletions, status);
    }

    public void deleteHabit(long id) {
        HabitEntity habit = findForUpdate(id);
        awards.deleteByHabit_Id(id);
        completions.deleteByHabitId(id);
        targets.deleteByHabit_Id(id);
        habits.delete(habit);
    }

    public Habit endHabit(long id, HabitEndReason reason) {
        if (reason == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz powód zakończenia nawyku.");
        HabitEntity habit = findForUpdate(id);
        if (habit.getEndedOn() != null)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ten nawyk został już zakończony.");
        habit.end(calendar.today(), reason);
        return withGoalTitles(snapshot(habit, calendar.today()));
    }

    public HabitCompletionResult setCompletion(long id, LocalDate date, boolean completed) {
        HabitEntity habit = findForUpdate(id);
        validateDate(date);
        boolean existingCompletion = completions.existsByHabitIdAndDate(id, date);
        boolean outsideActivePeriod = date.isBefore(habit.getStartDate())
                || (habit.getEndDate() != null && date.isAfter(habit.getEndDate()))
                || (habit.getEndedOn() != null && !date.isBefore(habit.getEndedOn()));
        if (outsideActivePeriod && (completed || !existingCompletion))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ten dzień jest poza okresem obowiązywania nawyku.");
        HabitAwardEntity award = null;
        Long balance = null;
        // Locking the habit serializes repeated or simultaneous changes to its completions.
        if (completed) {
            if (!existingCompletion) {
                if (habit.getCompletionLimit() != null && completions.countByHabitId(id) >= habit.getCompletionLimit())
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Osiągnięto liczbę wykonań kończącą ten nawyk.");
                var completion = completions.save(new HabitCompletionEntity(habit, date));
                var snapshot = snapshot(habit, date);
                LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                if (snapshot.target() != null && snapshot.weeklyCompletedDays() >= snapshot.target().targetDays()
                        && !awards.existsByHabit_IdAndWeekStart(id, monday)) {
                    award = grantAward(habit, monday, completion, date);
                    balance = users.lockCurrentUser().getPoints();
                }
            }
        } else {
            completions.deleteByHabitIdAndDate(id, date);
        }
        return new HabitCompletionResult(withGoalTitles(snapshot(habit, date)), balance,
                award == null ? null : award.toAward());
    }

    public HabitCompletionResult undoAward(long habitId, java.util.UUID awardId) {
        HabitEntity habit = findForUpdate(habitId);
        var award = awards.findByIdAndHabit_Id(awardId, habitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Ta nagroda została już cofnięta lub nie istnieje."));
        var user = users.lockCurrentUser();
        // Check after acquiring both locks so waiting cannot extend the undo window.
        if (!calendar.now().isBefore(award.getUndoUntil()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Czas na cofnięcie nagrody upłynął.");
        var completion = completions.findByHabitIdAndDate(habitId, award.getCompletionDate());
        if (completion.isPresent() && completion.get().getId() != award.getCompletionId())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Wykonanie zostało już zmienione. Nie można cofnąć tej operacji.");
        completion.ifPresent(completions::delete);
        user.addPoints(-(long) award.getPoints());
        awards.delete(award);
        return new HabitCompletionResult(withGoalTitles(snapshot(habit, award.getCompletionDate())),
                user.getPoints(), null);
    }

    private Habit snapshot(HabitEntity habit, LocalDate date) {
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return toHabit(habit, date, completions.existsByHabitIdAndDate(habit.getId(), date),
                targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId()),
                completions.countByHabitIdAndDateBetween(habit.getId(), monday, monday.plusDays(6)),
                awards.existsByHabit_IdAndWeekStart(habit.getId(), monday), completions.countByHabitId(habit.getId()),
                completions.countByHabitIdAndDateLessThanEqual(habit.getId(), date));
    }

    private Habit withGoalTitles(Habit habit) {
        return withGoalTitles(List.of(habit), currentUser.getUserId()).getFirst();
    }

    private List<Habit> withGoalTitles(List<Habit> habitList, long userId) {
        if (habitList.isEmpty()) return List.of();
        var idsByHabit = new HashMap<Long, List<Long>>();
        var titlesByHabit = new HashMap<Long, List<String>>();
        var habitIds = habitList.stream().map(Habit::id).toList();
        for (var link : goalHabits.findGoalTitles(userId, habitIds)) {
            idsByHabit.computeIfAbsent(link.getHabitId(), ignored -> new ArrayList<>()).add(link.getGoalId());
            titlesByHabit.computeIfAbsent(link.getHabitId(), ignored -> new ArrayList<>()).add(link.getGoalTitle());
        }
        return habitList.stream().map(habit -> habit.withGoals(
                idsByHabit.getOrDefault(habit.id(), List.of()),
                titlesByHabit.getOrDefault(habit.id(), List.of()))).toList();
    }

    private List<GoalEntity> ownedGoals(List<Long> requestedIds) {
        var ids = new LinkedHashSet<>(requestedIds);
        if (ids.isEmpty()) return List.of();
        var selectedGoals = goals.findByUserIdAndIdInOrderByIdAsc(currentUser.getUserId(), ids);
        if (selectedGoals.size() != ids.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Co najmniej jeden wybrany cel nie istnieje.");
        }
        return selectedGoals;
    }

    private CategoryEntity ownedCategory(Long categoryId) {
        if (categoryId == null) return null;
        return categories.findByIdAndUserId(categoryId, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kategoria nie istnieje."));
    }

    private HabitAwardEntity grantAward(HabitEntity habit, LocalDate monday,
                                         HabitCompletionEntity completion, LocalDate completionDate) {
        var user = users.lockCurrentUser();
        user.addPoints(habit.getRewardPoints());
        return awards.save(new HabitAwardEntity(habit, monday, habit.getRewardPoints(),
                completion.getId(), completionDate, calendar.now()));
    }

    private void validateSchedule(LocalDate start, LocalDate end, Integer limit) {
        if (end != null && end.isBefore(start))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data zakończenia nie może być wcześniejsza niż początek.");
        if (limit != null && (limit < 1 || end != null))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybierz datę zakończenia albo dodatnią liczbę wykonań.");
    }

    private void validateCompletionBonus(LocalDate end, Integer limit, Integer bonus, Integer percent) {
        if (bonus != null && bonus <= 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Premia za zakończenie musi być dodatnia.");
        if (percent != null && (percent < 1 || percent > 100))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wymagany procent musi wynosić od 1 do 100.");
        if (percent != null && end == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Próg regularności wymaga daty zakończenia.");
        if (bonus != null && limit == null && (end == null || percent == null))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Premia wymaga limitu wykonań albo daty zakończenia i progu regularności.");
    }

    private void validateDate(LocalDate date) {
        if (date.isAfter(calendar.today())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nie można wybrać dnia z przyszłości.");
        }
    }

    private HabitEntity findForUpdate(long id) {
        return habits.findForUpdate(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nawyk nie istnieje."));
    }
}
