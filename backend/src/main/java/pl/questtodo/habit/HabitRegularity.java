package pl.questtodo.habit;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

public record HabitRegularity(long successfulWeeks, long totalWeeks, BigDecimal successPercent) {
    public static HabitRegularity of(long successful, long total) {
        return new HabitRegularity(successful, total, total == 0 ? null :
                BigDecimal.valueOf(successful).multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP));
    }

    public boolean meets(int percent) {
        return totalWeeks > 0 && successfulWeeks * 100 >= totalWeeks * percent;
    }

    public static HabitRegularity calculate(LocalDate start, LocalDate end, LocalDate today,
                                            List<HabitTarget> targets, Set<LocalDate> completions) {
        return calculate(start, end, today, targets, completions, new HabitActivityTimeline(List.of()));
    }

    public static HabitRegularity calculate(LocalDate start, LocalDate end, LocalDate today,
                                            List<HabitTarget> targets, Set<LocalDate> completions,
                                            HabitActivityTimeline activity) {
        var history = targets.stream().sorted(Comparator.comparing(HabitTarget::effectiveFrom)).toList();
        long total = 0, successful = 0;
        int index = 0;
        HabitTarget target = null;
        for (LocalDate monday = start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
             !monday.isAfter(end) && monday.isBefore(today); monday = monday.plusWeeks(1)) {
            LocalDate first = monday.isBefore(start) ? start : monday;
            LocalDate last = monday.plusDays(6).isAfter(end) ? end : monday.plusDays(6);
            if (!last.isBefore(today)) break;
            while (index < history.size() && !history.get(index).effectiveFrom().isAfter(monday))
                target = history.get(index++);
            if (!activity.fullyActive(first, last)) continue;
            total++;
            int days = (int) ChronoUnit.DAYS.between(first, last) + 1;
            int required = target == null ? Integer.MAX_VALUE : (target.targetDays() * days + 6) / 7;
            int count = 0;
            for (LocalDate day = first; !day.isAfter(last); day = day.plusDays(1))
                if (completions.contains(day)) count++;
            if (count >= required) successful++;
        }
        return of(successful, total);
    }
}
