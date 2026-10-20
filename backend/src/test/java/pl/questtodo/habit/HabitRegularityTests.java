package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HabitRegularityTests {
    private static final LocalDate MONDAY = LocalDate.of(2026, 7, 27);

    @Test
    void comparesBelowEqualAboveAndFullSuccessWithoutRounding() {
        assertFalse(HabitRegularity.of(7, 10).meets(80));
        assertTrue(HabitRegularity.of(8, 10).meets(80));
        assertTrue(HabitRegularity.of(9, 10).meets(80));
        assertTrue(HabitRegularity.of(10, 10).meets(100));
        assertFalse(HabitRegularity.of(0, 10).meets(1));
        assertFalse(HabitRegularity.of(2, 3).meets(67));
        assertTrue(HabitRegularity.of(2, 3).meets(66));
        assertNull(HabitRegularity.of(0, 0).successPercent());
        assertFalse(HabitRegularity.of(0, 0).meets(1));
    }

    @Test
    void countsSeparateWeeksAndNeverCompensatesForMissedWeeks() {
        var dates = new HashSet<LocalDate>();
        for (int day = 0; day < 7; day++) dates.add(MONDAY.plusDays(day));
        var result = calculate(MONDAY, MONDAY.plusDays(13), MONDAY.plusDays(14), 2, dates);
        assertEquals(2, result.totalWeeks());
        assertEquals(1, result.successfulWeeks());
        assertFalse(result.meets(80));
        assertEquals(0, calculate(MONDAY, MONDAY.plusDays(13), MONDAY.plusDays(14), 2, Set.of()).successfulWeeks());
    }

    @Test
    void roundsFirstPartialWeekUpAndIgnoresDaysBeforeStart() {
        var start = MONDAY.plusDays(3); // Thursday: ceil(5 * 4 / 7) = 3
        var dates = Set.of(MONDAY, start, start.plusDays(1));
        assertEquals(0, calculate(start, MONDAY.plusDays(6), MONDAY.plusWeeks(1), 5, dates).successfulWeeks());
        assertEquals(1, calculate(start, MONDAY.plusDays(6), MONDAY.plusWeeks(1), 5,
                Set.of(start, start.plusDays(1), start.plusDays(2))).successfulWeeks());
    }

    @Test
    void roundsLastPartialWeekUpAndIncludesEndDateOnlyAfterItsEnd() {
        var end = MONDAY.plusDays(2); // Wednesday: ceil(5 * 3 / 7) = 3
        var dates = Set.of(MONDAY, MONDAY.plusDays(1), end, end.plusDays(1));
        assertEquals(0, calculate(MONDAY, end, end, 5, dates).totalWeeks());
        assertEquals(1, calculate(MONDAY, end, end.plusDays(1), 5, dates).successfulWeeks());
        assertEquals(0, calculate(MONDAY, end, end.plusDays(1), 5,
                Set.of(MONDAY, MONDAY.plusDays(1), end.plusDays(1))).successfulWeeks());
    }

    @Test
    void oneDayHabitNeedsOneCompletionAndRunningWeekIsExcluded() {
        var day = MONDAY.plusDays(4);
        assertEquals(1, calculate(day, day, day.plusDays(1), 2, Set.of(day)).successfulWeeks());
        assertNull(calculate(day, day, day, 2, Set.of(day)).successPercent());
        var running = calculate(MONDAY, MONDAY.plusDays(20), MONDAY.plusDays(9), 2,
                Set.of(MONDAY, MONDAY.plusDays(1)));
        assertEquals(1, running.totalWeeks());
        assertEquals(1, running.successfulWeeks());
    }

    @Test
    void usesTargetInEffectForEachWeek() {
        var result = HabitRegularity.calculate(MONDAY, MONDAY.plusDays(13), MONDAY.plusDays(14),
                List.of(new HabitTarget(2, MONDAY), new HabitTarget(5, MONDAY.plusWeeks(1))),
                Set.of(MONDAY, MONDAY.plusDays(1), MONDAY.plusDays(7), MONDAY.plusDays(8)));
        assertEquals(1, result.successfulWeeks());
        assertEquals(2, result.totalWeeks());
    }

    private HabitRegularity calculate(LocalDate start, LocalDate end, LocalDate today, int target,
                                       Set<LocalDate> dates) {
        return HabitRegularity.calculate(start, end, today, List.of(new HabitTarget(target, MONDAY)), dates);
    }
}
