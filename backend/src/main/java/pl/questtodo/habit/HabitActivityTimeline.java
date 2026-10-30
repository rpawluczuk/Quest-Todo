package pl.questtodo.habit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/** Date-only completions use Warsaw calendar days; status periods remain exact UTC intervals. */
public final class HabitActivityTimeline {
    private final List<HabitStatusPeriodResponse> periods;

    public HabitActivityTimeline(List<HabitStatusPeriodResponse> periods) {
        this.periods = periods.stream().sorted(Comparator.comparing(HabitStatusPeriodResponse::startedAt)).toList();
    }

    public boolean isActiveAt(Instant at) {
        if (periods.isEmpty()) return true; // Legacy rows without a status history.
        if (at.isBefore(periods.getFirst().startedAt())) return legacyActive();
        return periods.stream().anyMatch(p -> p.status() == HabitStatus.ACTIVE
                && !at.isBefore(p.startedAt()) && (p.endedAt() == null || at.isBefore(p.endedAt())));
    }

    public boolean wasActiveOn(LocalDate date) {
        var start = startOf(date);
        var end = startOf(date.plusDays(1));
        if (periods.isEmpty() || (legacyActive() && start.isBefore(periods.getFirst().startedAt()))) return true;
        return periods.stream().anyMatch(p -> p.status() == HabitStatus.ACTIVE && overlaps(p, start, end));
    }

    /** The accounting interval is clipped to the habit's configured start/end by the caller. */
    public boolean fullyActive(LocalDate first, LocalDate last) {
        var start = startOf(first);
        var end = startOf(last.plusDays(1));
        if (!periods.isEmpty() && !legacyActive() && start.isBefore(periods.getFirst().startedAt())) return false;
        return periods.stream().noneMatch(p -> p.status() != HabitStatus.ACTIVE && overlaps(p, start, end));
    }

    private boolean legacyActive() { return periods.getFirst().status() == HabitStatus.ACTIVE; }

    private static boolean overlaps(HabitStatusPeriodResponse period, Instant start, Instant end) {
        // Empty intervals (several changes at exactly the same instant) have no duration.
        return (period.endedAt() == null || period.endedAt().isAfter(period.startedAt()))
                && period.startedAt().isBefore(end) && (period.endedAt() == null || period.endedAt().isAfter(start));
    }

    private static Instant startOf(LocalDate date) { return date.atStartOfDay(HabitCalendar.ZONE).toInstant(); }
}
