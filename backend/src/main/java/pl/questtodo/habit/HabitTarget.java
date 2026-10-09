package pl.questtodo.habit;

import java.time.LocalDate;

public record HabitTarget(int targetDays, LocalDate effectiveFrom) {}
