package pl.questtodo.habit.dto;

import jakarta.validation.constraints.NotNull;
import pl.questtodo.habit.HabitEndReason;

public record EndHabitRequest(@NotNull(message = "Wybierz powód zakończenia nawyku.") HabitEndReason reason) {}
