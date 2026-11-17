package pl.questtodo.goal;

import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GoalReviewTests {
    @ParameterizedTest
    @CsvSource({"WEEKLY,2026-12-29,2027-01-05", "BIWEEKLY,2026-12-29,2027-01-12",
        "MONTHLY,2026-01-31,2026-02-28", "MONTHLY,2024-01-31,2024-02-29",
        "QUARTERLY,2023-11-30,2024-02-29", "MONTHLY,2026-12-17,2027-01-17",
        "WEEKLY,2026-03-28,2026-04-04", "WEEKLY,2026-10-24,2026-10-31"})
    void calendarIntervals(GoalReviewFrequency frequency, LocalDate from, LocalDate expected) {
        assertEquals(expected, frequency.nextDate(from));
    }

    @Test void dueRequiresActiveConfiguredGoalAndReachedDate() {
        GoalEntity goal = new GoalEntity("Goal", null, null, null);
        LocalDate start = LocalDate.of(2026, 11, 17);
        assertFalse(goal.reviewDue(start));
        goal.configureReviews(GoalReviewFrequency.MONTHLY, start);
        assertFalse(goal.reviewDue(start.plusMonths(1).minusDays(1)));
        assertTrue(goal.reviewDue(start.plusMonths(1)));
        assertTrue(goal.reviewDue(start.plusYears(1)));
        goal.setCompleted(true);
        assertFalse(goal.reviewDue(start.plusYears(1)));
        goal.configureReviews(null, start);
        assertFalse(goal.reviewDue(start.plusYears(1)));
    }
}
