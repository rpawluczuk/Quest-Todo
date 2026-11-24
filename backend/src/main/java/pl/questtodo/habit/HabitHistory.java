package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.List;

public record HabitHistory(long id, String name, int year, LocalDate today,
                           List<Day> days, List<Week> weeks) {
    public enum DayStatus { ACTIVE, INACTIVE, FUTURE }
    public enum WeekStatus { MET, MISSED, IN_PROGRESS, NEUTRAL }

    public record Day(LocalDate date, boolean completed, DayStatus status) {}
    public record Week(LocalDate weekStart, int completedDays, Integer targetDays,
                       Integer requiredDays, WeekStatus status) {}
}
