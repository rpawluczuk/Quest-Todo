package pl.questtodo.goal;

import jakarta.validation.constraints.NotNull;

public record GoalCompletionRequest(
        @NotNull(message = "Podaj stan osiągnięcia celu.") Boolean completed) {}
