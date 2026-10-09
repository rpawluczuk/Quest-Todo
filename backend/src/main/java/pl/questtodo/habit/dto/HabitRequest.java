package pl.questtodo.habit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record HabitRequest(
        @NotBlank(message = "Podaj nazwę nawyku.")
        @Size(max = 120, message = "Nazwa nawyku może mieć maksymalnie 120 znaków.")
        String name) {}
