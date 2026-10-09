package pl.questtodo.habit;

import java.time.LocalDate;

public record Habit(long id, String name, LocalDate createdOn, boolean completed,
                    HabitTarget target, HabitTarget latestTarget) {}
