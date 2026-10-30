package pl.questtodo.habit;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class HabitActivityTimelineTests {
    private static Instant at(LocalDate date) { return date.atStartOfDay(HabitCalendar.ZONE).toInstant(); }
    private static HabitStatusPeriodResponse period(HabitStatus status, Instant first, Instant last) {
        return new HabitStatusPeriodResponse(status, first, last);
    }
    @Test void preservesLegacyDaysButNeverInventsActivityBeforePlannedCreation() {
        var monday = LocalDate.of(2026, 10, 5);
        var migrated = new HabitActivityTimeline(List.of(period(HabitStatus.ACTIVE, at(monday.plusWeeks(2)), null)));
        assertTrue(migrated.fullyActive(monday, monday.plusDays(6)));
        assertTrue(migrated.wasActiveOn(monday));
        assertTrue(migrated.isActiveAt(at(monday)));
        var planned = new HabitActivityTimeline(List.of(period(HabitStatus.PLANNED, at(monday), at(monday.plusWeeks(1))),
                period(HabitStatus.ACTIVE, at(monday.plusWeeks(1)), null)));
        assertFalse(planned.wasActiveOn(monday.minusDays(1)));
        assertFalse(planned.isActiveAt(at(monday.minusDays(1))));
        assertFalse(planned.fullyActive(monday.minusWeeks(1), monday.minusDays(1)));
        assertTrue(planned.fullyActive(monday.plusWeeks(1), monday.plusDays(13)));
        assertTrue(new HabitActivityTimeline(List.of()).fullyActive(monday, monday.plusDays(6)));
    }
    @Test void exactBoundariesExcludePauseOutsideAccountingInterval() {
        var monday = LocalDate.of(2026, 10, 5);
        var pause = at(monday.plusWeeks(1)); var resume = at(monday.plusWeeks(2));
        var timeline = new HabitActivityTimeline(List.of(period(HabitStatus.ACTIVE, at(monday), pause),
                period(HabitStatus.PAUSED, pause, resume), period(HabitStatus.ACTIVE, resume, null)));
        assertTrue(timeline.fullyActive(monday, monday.plusDays(6)));
        assertFalse(timeline.fullyActive(monday.plusWeeks(1), monday.plusDays(13)));
        assertTrue(timeline.fullyActive(monday.plusWeeks(2), monday.plusDays(20)));
        assertFalse(timeline.isActiveAt(pause)); assertTrue(timeline.isActiveAt(resume));
        assertFalse(timeline.wasActiveOn(monday.plusWeeks(1)));
    }
    @Test void anyPositivePauseIsNeutralEvenIfEveryDayHasSomeActivity() {
        var monday = LocalDate.of(2026, 10, 5);
        var noon = at(monday.plusDays(2)).plusSeconds(3600 * 12);
        var timeline = new HabitActivityTimeline(List.of(period(HabitStatus.ACTIVE, at(monday), noon),
                period(HabitStatus.PAUSED, noon, noon.plusSeconds(1)), period(HabitStatus.ACTIVE, noon.plusSeconds(1), null)));
        assertFalse(timeline.fullyActive(monday, monday.plusDays(6)));
        assertTrue(timeline.wasActiveOn(monday.plusDays(2)));
        var empty = new HabitActivityTimeline(List.of(period(HabitStatus.ACTIVE, at(monday), noon),
                period(HabitStatus.PAUSED, noon, noon), period(HabitStatus.ACTIVE, noon, null)));
        assertTrue(empty.fullyActive(monday, monday.plusDays(6)));
    }
    @ParameterizedTest @ValueSource(strings = {"2026-03-29", "2026-10-25"})
    void dstUsesLocalCalendarDaysAndRealUtcBoundaries(String day) {
        var date = LocalDate.parse(day);
        long hours = Duration.between(at(date), at(date.plusDays(1))).toHours();
        assertEquals(date.getMonthValue() == 3 ? 23 : 25, hours);
        var timeline = new HabitActivityTimeline(List.of(period(HabitStatus.ACTIVE, at(date.minusDays(1)), at(date)),
                period(HabitStatus.PAUSED, at(date), at(date.plusDays(1))), period(HabitStatus.ACTIVE, at(date.plusDays(1)), null)));
        assertFalse(timeline.wasActiveOn(date)); assertTrue(timeline.wasActiveOn(date.minusDays(1)));
        assertTrue(timeline.wasActiveOn(date.plusDays(1)));
        assertFalse(timeline.fullyActive(date.minusDays(6), date));
        assertTrue(timeline.fullyActive(date.plusDays(1), date.plusDays(7)));
    }
    @Test void sixWeekExampleExcludesAllNeutralWeeksIncludingSuccessfulPartialWeek() {
        var start = LocalDate.of(2026, 8, 31);
        var pause = at(start.plusWeeks(2)); var resume = at(start.plusWeeks(4).plusDays(2));
        var timeline = new HabitActivityTimeline(List.of(period(HabitStatus.ACTIVE, at(start), pause),
                period(HabitStatus.PAUSED, pause, resume), period(HabitStatus.ACTIVE, resume, null)));
        var dates = Set.of(start, start.plusDays(1), start.plusDays(2), start.plusWeeks(1),
                start.plusWeeks(4).plusDays(3), start.plusWeeks(4).plusDays(4), start.plusWeeks(4).plusDays(5),
                start.plusWeeks(5), start.plusWeeks(5).plusDays(1), start.plusWeeks(5).plusDays(2));
        var result = HabitRegularity.calculate(start, start.plusDays(41), start.plusWeeks(6),
                List.of(new HabitTarget(3, start)), dates, timeline);
        assertEquals(3, result.totalWeeks()); assertEquals(2, result.successfulWeeks());
        assertEquals(new java.math.BigDecimal("66.67"), result.successPercent());
    }
    @Test void neutralityClipsToScheduledDatesAndDoesNotEvaluateRunningWeek() {
        var monday = LocalDate.of(2026, 10, 5);
        var start = monday.plusDays(2); var end = monday.plusDays(4);
        var timeline = new HabitActivityTimeline(List.of(period(HabitStatus.PLANNED, at(monday), at(start)),
                period(HabitStatus.ACTIVE, at(start), at(end.plusDays(1))), period(HabitStatus.PAUSED, at(end.plusDays(1)), null)));
        var targets = List.of(new HabitTarget(2, monday));
        assertEquals(1, HabitRegularity.calculate(start, end, end.plusDays(1), targets, Set.of(start), timeline).successfulWeeks());
        assertEquals(0, HabitRegularity.calculate(start, end, end, targets, Set.of(start), timeline).totalWeeks());
    }
}
