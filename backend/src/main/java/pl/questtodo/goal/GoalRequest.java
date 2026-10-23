package pl.questtodo.goal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoalRequest(
        @NotBlank(message = "Podaj tytuł celu.")
        @Size(max = 120, message = "Tytuł celu może mieć maksymalnie 120 znaków.")
        String title,
        @Size(max = 2000, message = "Stan początkowy może mieć maksymalnie 2000 znaków.")
        String currentState,
        @Size(max = 2000, message = "Zamierzony efekt może mieć maksymalnie 2000 znaków.")
        String desiredOutcome) {}
