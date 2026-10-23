package pl.questtodo.goal;

import jakarta.validation.constraints.NotNull;

public record MilestoneCompletionRequest(
        @NotNull(message = "Podaj stan ukończenia kamienia milowego.") Boolean completed) {}
