package pl.questtodo.habit;

import java.time.Instant;

public record HabitStatusPeriodResponse(HabitStatus status, Instant startedAt, Instant endedAt) {}
