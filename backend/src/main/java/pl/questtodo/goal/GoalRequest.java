package pl.questtodo.goal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoalRequest(
        @NotBlank(message = "Podaj tytuł celu.")
        @Size(max = 120, message = "Tytuł celu może mieć maksymalnie 120 znaków.")
        String title) {}
