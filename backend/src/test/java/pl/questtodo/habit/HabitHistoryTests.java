package pl.questtodo.habit;

import java.time.LocalDate;
import java.util.List;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserRepository;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static pl.questtodo.habit.HabitHistory.DayStatus.*;
import static pl.questtodo.habit.HabitHistory.WeekStatus.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:habit_history;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.stat=OFF",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF"
})
@AutoConfigureMockMvc
@org.springframework.context.annotation.Import(pl.questtodo.AuthenticatedApiTestConfiguration.class)
@Transactional
class HabitHistoryTests {
    @Autowired MockMvc mvc;
    @Autowired HabitHistoryService history;
    @Autowired HabitService service;
    @Autowired HabitRepository habits;
    @Autowired HabitTargetRepository targets;
    @Autowired HabitCompletionRepository completions;
    @Autowired HabitStatusPeriodRepository periods;
    @Autowired UserRepository users;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean CurrentUserProvider currentUser;
    @MockitoBean HabitCalendar calendar;

    @BeforeEach void prepare() {
        when(currentUser.getUserId()).thenReturn(1L);
        today("2026-10-14"); // Wednesday
        when(calendar.now()).thenReturn(java.time.Instant.parse("2026-10-14T12:00:00Z"));
    }

    @Test void midweekEditUsesCurrentMondayAndPreservesClosedWeek() {
        var habit = habit("2026-10-05", null, 2);
        complete(habit, "2026-10-05", "2026-10-06", "2026-10-12", "2026-10-13");
        service.updateHabit(habit.getId(), "History", 5);
        var result = history.get(habit.getId(), 2026);
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-05"), 2, 2, 2, MET), week(result, "2026-10-05"));
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-12"), 2, 5, 5, IN_PROGRESS), week(result, "2026-10-12"));
        assertEquals(List.of(LocalDate.parse("2026-10-05"), LocalDate.parse("2026-10-12")),
                targets.findByHabit_IdOrderByEffectiveFromAsc(habit.getId()).stream().map(HabitTargetEntity::getEffectiveFrom).toList());
    }

    @Test void crossYearWeekHasIdenticalFullResultFromBothYears() {
        today("2027-01-11");
        var habit = habit("2026-01-01", null, 4);
        complete(habit, "2026-12-28", "2026-12-31", "2027-01-01", "2027-01-03");
        var previous = history.get(habit.getId(), 2026);
        var next = history.get(habit.getId(), 2027);
        var expected = new HabitHistory.Week(LocalDate.parse("2026-12-28"), 4, 4, 4, MET);
        assertEquals(expected, week(previous, "2026-12-28"));
        assertEquals(expected, week(next, "2026-12-28"));
        assertEquals(365, previous.days().size());
        assertEquals(365, next.days().size());
        assertTrue(previous.days().stream().allMatch(d -> d.date().getYear() == 2026));
        assertTrue(next.days().stream().allMatch(d -> d.date().getYear() == 2027));
        assertEquals(previous.weeks().stream().map(HabitHistory.Week::weekStart).sorted().toList(),
                previous.weeks().stream().map(HabitHistory.Week::weekStart).toList());
    }

    @Test void partialWeeksUseLifetimeBoundsAndSameThresholdAsRegularity() {
        var habit = habit("2026-10-08", "2026-10-13", 5); // Thu-Sun: 3, Mon-Tue: 2
        complete(habit, "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-12");
        var result = history.get(habit.getId(), 2026);
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-05"), 3, 5, 3, MET), week(result, "2026-10-05"));
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-12"), 1, 5, 2, MISSED), week(result, "2026-10-12"));
        var regularity = HabitRegularity.calculate(habit.getStartDate(), habit.getEndDate(), calendar.today(),
                List.of(new HabitTarget(5, LocalDate.parse("2026-10-05"))),
                java.util.Set.of(LocalDate.parse("2026-10-08"), LocalDate.parse("2026-10-09"),
                        LocalDate.parse("2026-10-10"), LocalDate.parse("2026-10-12")));
        assertEquals(regularity.successfulWeeks(), result.weeks().stream().filter(w -> w.status() == MET).count());
        assertEquals(regularity.totalWeeks(), result.weeks().stream().filter(w -> w.status() == MET || w.status() == MISSED).count());
        assertEquals(INACTIVE, day(result, "2026-10-07").status());
        assertEquals(ACTIVE, day(result, "2026-10-13").status());
        assertEquals(INACTIVE, day(result, "2026-10-14").status());
    }

    @Test void pauseNeutralizesEvenMetWeekAndPlannedDaysAreInactive() {
        var habit = habit("2026-09-28", null, 2);
        period(habit, HabitStatus.PLANNED, "2026-09-28", "2026-10-01");
        period(habit, HabitStatus.ACTIVE, "2026-10-01", "2026-10-07");
        period(habit, HabitStatus.PAUSED, "2026-10-07", "2026-10-08");
        period(habit, HabitStatus.ACTIVE, "2026-10-08", null);
        complete(habit, "2026-10-05", "2026-10-06", "2026-10-07"); // preserve even a legacy inactive-day record
        var result = history.get(habit.getId(), 2026);
        assertEquals(NEUTRAL, week(result, "2026-09-28").status());
        assertEquals(NEUTRAL, week(result, "2026-10-05").status());
        assertEquals(3, week(result, "2026-10-05").completedDays());
        assertEquals(INACTIVE, day(result, "2026-09-30").status());
        assertEquals(new HabitHistory.Day(LocalDate.parse("2026-10-07"), true, INACTIVE), day(result, "2026-10-07"));
        assertEquals(ACTIVE, day(result, "2026-10-08").status());
    }

    @Test void runningWeekIsNotMissedAndTodayDoesNotReduceThreshold() {
        var habit = habit("2026-10-05", null, 5);
        complete(habit, "2026-10-05", "2026-10-12", "2026-10-13");
        var result = history.get(habit.getId(), 2026);
        assertEquals(MISSED, week(result, "2026-10-05").status());
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-12"), 2, 5, 5, IN_PROGRESS), week(result, "2026-10-12"));
        assertEquals(NEUTRAL, week(result, "2026-10-19").status());
        assertEquals(FUTURE, day(result, "2026-10-15").status());
        assertEquals(ACTIVE, day(result, "2026-10-14").status());
        today("2026-10-19");
        assertEquals(MISSED, week(history.get(habit.getId(), 2026), "2026-10-12").status());
    }

    @Test void openWeekCanBeMetWithoutAnyAwardAndMonthBoundaryDoesNotProrate() {
        today("2026-10-01");
        var habit = habit("2026-09-01", null, 2);
        complete(habit, "2026-09-28", "2026-10-01");
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-09-28"), 2, 2, 2, MET),
                week(history.get(habit.getId(), 2026), "2026-09-28"));
    }

    @Test void absentTargetStaysNullAndNeutralWithoutFallingBackToFutureTarget() {
        var habit = habit("2026-09-28", null, 3);
        targets.deleteByHabit_Id(habit.getId());
        targets.save(new HabitTargetEntity(habit, 4, LocalDate.parse("2026-10-12")));
        var result = history.get(habit.getId(), 2026);
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-05"), 0, null, null, NEUTRAL), week(result, "2026-10-05"));
        assertEquals(4, week(result, "2026-10-12").targetDays());
    }

    @Test void readsOwnEndedHabitAndUsesExclusiveManualEnding() throws Exception {
        var habit = habit("2026-10-05", "2026-10-20", 5);
        habit.end(LocalDate.parse("2026-10-08"), HabitEndReason.STOPPED);
        complete(habit, "2026-10-05", "2026-10-06", "2026-10-07");
        em.flush();
        mvc.perform(get("/api/habits/{id}/history", habit.getId()).param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(habit.getId()))
                .andExpect(jsonPath("$.name").value("History"))
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.today").value("2026-10-14"))
                .andExpect(jsonPath("$.days.length()").value(365))
                .andExpect(jsonPath("$.days[0].date").value("2026-01-01"))
                .andExpect(jsonPath("$.days[364].date").value("2026-12-31"));
        var result = history.get(habit.getId(), 2026);
        assertEquals(new HabitHistory.Week(LocalDate.parse("2026-10-05"), 3, 5, 3, MET), week(result, "2026-10-05"));
        assertEquals(INACTIVE, day(result, "2026-10-08").status());
        assertEquals(NEUTRAL, week(result, "2026-10-12").status());
    }

    @Test void missingAndForeignHabitsReturn404AndInvalidYearsReturn400() throws Exception {
        var habit = habit("2026-10-05", null, 3);
        when(currentUser.getUserId()).thenReturn(987654321L);
        mvc.perform(get("/api/habits/{id}/history", habit.getId()).param("year", "2026")).andExpect(status().isNotFound());
        when(currentUser.getUserId()).thenReturn(1L);
        mvc.perform(get("/api/habits/987654321/history").param("year", "2026")).andExpect(status().isNotFound());
        mvc.perform(get("/api/habits/{id}/history", habit.getId())).andExpect(status().isBadRequest());
        for (var year : List.of("0", "-1", "10000", "2147483648", "abc", "2026.5", ""))
            mvc.perform(get("/api/habits/{id}/history", habit.getId()).param("year", year)).andExpect(status().isBadRequest());
    }

    @Test void leapYearIncludesEveryDateAndReadsOnlyFourQueriesWithoutWrites() {
        var habit = habit("2024-01-01", null, 3);
        complete(habit, "2024-02-29");
        em.flush();
        em.clear();
        var stats = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        long balance = jdbc.queryForObject("select points from users where id = 1", Long.class);
        var result = history.get(habit.getId(), 2024);
        assertEquals(366, result.days().size());
        assertTrue(day(result, "2024-02-29").completed());
        assertEquals(4, stats.getPrepareStatementCount()); // habit, completion range, targets, activity
        assertEquals(0, stats.getEntityUpdateCount());
        assertEquals(0, stats.getEntityInsertCount());
        assertEquals(0, stats.getEntityDeleteCount());
        assertEquals(balance, jdbc.queryForObject("select points from users where id = 1", Long.class));
    }

    private void today(String date) { when(calendar.today()).thenReturn(LocalDate.parse(date)); }

    private HabitEntity habit(String start, String end, int target) {
        var date = LocalDate.parse(start);
        var habit = new HabitEntity("History", users.findById(1L).orElseThrow(), date);
        habit.schedule(date, end == null ? null : LocalDate.parse(end), null);
        habit = habits.save(habit);
        targets.save(new HabitTargetEntity(habit, target,
                date.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))));
        return habit;
    }

    private void complete(HabitEntity habit, String... dates) {
        for (String date : dates) completions.save(new HabitCompletionEntity(habit, LocalDate.parse(date)));
    }

    private void period(HabitEntity habit, HabitStatus status, String start, String end) {
        var period = new HabitStatusPeriod(habit, status, LocalDate.parse(start).atStartOfDay(HabitCalendar.ZONE).toInstant());
        if (end != null) period.close(LocalDate.parse(end).atStartOfDay(HabitCalendar.ZONE).toInstant());
        periods.save(period);
    }

    private HabitHistory.Week week(HabitHistory result, String monday) {
        return result.weeks().stream().filter(w -> w.weekStart().equals(LocalDate.parse(monday))).findFirst().orElseThrow();
    }

    private HabitHistory.Day day(HabitHistory result, String date) {
        return result.days().stream().filter(d -> d.date().equals(LocalDate.parse(date))).findFirst().orElseThrow();
    }
}
