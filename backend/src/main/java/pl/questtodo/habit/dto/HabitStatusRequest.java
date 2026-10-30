package pl.questtodo.habit.dto;

import jakarta.validation.constraints.NotNull;
import pl.questtodo.habit.HabitStatus;

public record HabitStatusRequest(@NotNull HabitStatus status) {}
